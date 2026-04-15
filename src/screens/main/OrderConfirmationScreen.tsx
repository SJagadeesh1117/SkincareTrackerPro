/**
 * OrderConfirmationScreen.tsx
 *
 * Shown after a successful order placement. Animates a green checkmark in
 * on mount, displays the order ID, and offers two navigation CTAs.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';

import type { Task } from '../../constants/routineData';
import { RoutineUpdatedOverlay } from '../../components';
import { mapOrderToRoutine } from '../../services';
import { useRoutineStore } from '../../store/routineStore';
import type { RootStackParamList } from '../../types';

// ── Types ─────────────────────────────────────────────────

type NavProp = StackNavigationProp<RootStackParamList, 'OrderConfirmationScreen'>;
type RouteP  = RouteProp<RootStackParamList, 'OrderConfirmationScreen'>;

interface Props { navigation: NavProp; route: RouteP }

// ── Constants ─────────────────────────────────────────────

const PURPLE = '#8B5CF6';

const EMPTY_ADDED_TASKS: Record<Task['section'], Task[]> = {
  morning: [],
  night_normal: [],
  weekly: [],
};

// ── Component ─────────────────────────────────────────────

export function OrderConfirmationScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const [showOverlay, setShowOverlay] = useState(false);
  const [addedTasksBySection, setAddedTasksBySection] =
    useState<Record<Task['section'], Task[]>>(EMPTY_ADDED_TASKS);
  const {
    loadToday,
    setEditMode,
    setRoutineConfig,
  } = useRoutineStore();

  // Spring in from scale 0 → 1
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 60,
    }).start();
  }, [scaleAnim]);

  useEffect(() => {
    let isMounted = true;

    const syncRoutine = async () => {
      const uid = auth().currentUser?.uid;
      if (!uid) {
        return;
      }

      try {
        await loadToday();
        const currentSectionTasks = useRoutineStore.getState().sectionTasks;
        const result = await mapOrderToRoutine({
          uid,
          orderId,
          currentSectionTasks,
        });

        await setRoutineConfig(result.sectionTasks);

        if (!isMounted) {
          return;
        }

        if (result.addedTaskCount > 0) {
          setAddedTasksBySection(result.addedTasksBySection);
          setShowOverlay(true);
        }

        if (result.firestoreSyncFailed) {
          Toast.show({
            type: 'info',
            text1: 'Routine saved locally',
            text2: 'Cloud sync did not finish. You may need to re-add steps later.',
            visibilityTime: 5000,
          });
        }
      } catch {
        if (!isMounted) {
          return;
        }

        Toast.show({
          type: 'error',
          text1: 'Routine update failed',
          text2: 'Your order was placed, but we could not map the products into your routine.',
          visibilityTime: 5000,
        });
      }
    };

    syncRoutine();

    return () => {
      isMounted = false;
    };
  }, [loadToday, orderId, setRoutineConfig]);

  const handleViewRoutine = () => {
    navigation.navigate('MainTabs', { screen: 'HomeTab' });
  };

  const handleViewProducts = () => {
    navigation.navigate('MainTabs', { screen: 'ProductsTab' });
  };

  const handleEditRoutine = () => {
    setShowOverlay(false);
    setEditMode(true);
    navigation.navigate('MainTabs', { screen: 'HomeTab' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Animated checkmark */}
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <MaterialCommunityIcons
            name="check-circle"
            size={80}
            color={PURPLE}
          />
        </Animated.View>

        {/* Heading */}
        <Text style={styles.heading}>Order placed successfully</Text>

        {/* Order ID */}
        <View style={styles.orderIdBox}>
          <Text style={styles.orderIdLabel}>Order ID</Text>
          <Text style={styles.orderIdValue}>{orderId}</Text>
        </View>

        {/* Body text */}
        <Text style={styles.body}>
          Your skincare routine has been updated automatically
        </Text>

        {/* CTAs */}
        <View style={styles.btnGroup}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleViewRoutine}
            activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>View my routine</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleViewProducts}
            activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>View products</Text>
          </TouchableOpacity>
        </View>
      </View>

      <RoutineUpdatedOverlay
        visible={showOverlay}
        addedTasksBySection={addedTasksBySection}
        onEditRoutine={handleEditRoutine}
        onClose={() => setShowOverlay(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
  },
  orderIdBox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
    width: '100%',
  },
  orderIdLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  orderIdValue: {
    fontSize: 15,
    color: '#111',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  body: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  btnGroup: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  primaryBtn: {
    backgroundColor: PURPLE,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: PURPLE,
  },
  secondaryBtnText: {
    color: PURPLE,
    fontWeight: '700',
    fontSize: 16,
  },
});

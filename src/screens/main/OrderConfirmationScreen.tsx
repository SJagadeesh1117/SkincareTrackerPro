/**
 * OrderConfirmationScreen.tsx
 *
 * Shown after a successful order placement. Animates a green checkmark in
 * on mount, displays the order ID, and offers two navigation CTAs.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type { MyProductsStackParamList } from '../../types';

// ── Types ─────────────────────────────────────────────────

type NavProp = StackNavigationProp<MyProductsStackParamList, 'OrderConfirmationScreen'>;
type RouteP  = RouteProp<MyProductsStackParamList, 'OrderConfirmationScreen'>;

interface Props { navigation: NavProp; route: RouteP }

// ── Constants ─────────────────────────────────────────────

const TEAL = '#1D9E75';

// ── Component ─────────────────────────────────────────────

export function OrderConfirmationScreen({ navigation, route }: Props) {
  const { orderId } = route.params;

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

  const handleViewRoutine = () => {
    // Navigate up to the drawer and then to Home
    navigation.getParent()?.navigate('Home');
  };

  const handleViewOrder = () => {
    navigation.getParent()?.navigate('MyOrders');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Animated checkmark */}
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <MaterialCommunityIcons
            name="check-circle"
            size={80}
            color={TEAL}
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
            onPress={handleViewOrder}
            activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>View order</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    backgroundColor: TEAL,
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
    borderColor: TEAL,
  },
  secondaryBtnText: {
    color: TEAL,
    fontWeight: '700',
    fontSize: 16,
  },
});

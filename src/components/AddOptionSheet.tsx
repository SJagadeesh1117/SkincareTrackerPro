/**
 * AddOptionSheet — bottom sheet with "Add Manually" and "Scan Product" options.
 *
 * Shown when the user taps "+ Add" on a morning or evening routine section.
 * Rendered as a standard RN Modal + animated sheet so it works without
 * requiring a BottomSheetModalProvider at root level.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import type { RoutineSlotParam } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  slot: RoutineSlotParam;
  onAddManually: (slot: RoutineSlotParam) => void;
  onScanProduct: (slot: RoutineSlotParam) => void;
  onClose: () => void;
}

// ── Styles ────────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 8,
      paddingBottom: 32,
      paddingHorizontal: 20,
    },
    // Drag-to-dismiss handle
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 20,
      marginTop: 4,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primaryDark,
      marginBottom: 16,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: 14,
      marginBottom: 10,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionText: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryDark,
    },
    optionSubtitle: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    chevron: {
      marginLeft: 'auto',
    },
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddOptionSheet({ visible, slot, onAddManually, onScanProduct, onClose }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  // Slide-up animation
  const translateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      translateY.setValue(300);
    }
  }, [visible, translateY]);

  const handleAddManually = useCallback(() => {
    onClose();
    // Small delay so sheet closes before new modal opens
    setTimeout(() => onAddManually(slot), 200);
  }, [slot, onAddManually, onClose]);

  const handleScanProduct = useCallback(() => {
    onClose();
    setTimeout(() => onScanProduct(slot), 200);
  }, [slot, onScanProduct, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      {/* Backdrop — tap to dismiss */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}>
        {/* Sheet — stop touch propagation so tapping inside doesn't close */}
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            {/* Drag handle */}
            <View style={styles.handle} />

            <Text style={styles.title}>Add routine step</Text>

            {/* Option 1: Add Manually */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.75}
              onPress={handleAddManually}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Add Manually</Text>
                <Text style={styles.optionSubtitle}>Type in a custom step name</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.muted}
                style={styles.chevron}
              />
            </TouchableOpacity>

            {/* Option 2: Scan Product */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.75}
              onPress={handleScanProduct}>
              <View style={[styles.iconCircle, { backgroundColor: '#7C3AED20' }]}>
                <MaterialCommunityIcons
                  name="camera-outline"
                  size={22}
                  color="#7C3AED"
                />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Scan Product</Text>
                <Text style={styles.optionSubtitle}>Use camera to scan a product label</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.muted}
                style={styles.chevron}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

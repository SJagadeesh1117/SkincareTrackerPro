import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';

import { COLORS } from '../constants/theme';
import { activateProduct } from '../services/productTrackingService';
import { addProductToRoutine } from '../services/routineActivationService';
import type { TrackedProduct } from '../types';

interface ActivateProductSheetProps {
  product: TrackedProduct | null;
  visible: boolean;
  onClose: () => void;
  onActivated: () => void;
}

function getRoutinePresentation(routineSlot: string) {
  switch (routineSlot) {
    case 'morning':
      return {
        icon: 'weather-sunny',
        iconColor: COLORS.primary,
        label: 'Morning routine',
      };
    case 'night':
      return {
        icon: 'weather-night',
        iconColor: COLORS.primary800,
        label: 'Evening routine',
      };
    case 'both':
      return {
        icon: 'theme-light-dark',
        iconColor: COLORS.primary,
        label: 'Morning + Night routines',
      };
    case 'weekly':
      return {
        icon: 'calendar-week',
        iconColor: COLORS.primary700,
        label: 'Weekly extras',
      };
    default:
      return {
        icon: 'weather-sunny',
        iconColor: COLORS.primary,
        label: 'Morning routine',
      };
  }
}

export function ActivateProductSheet({
  product,
  visible,
  onClose,
  onActivated,
}: ActivateProductSheetProps) {
  const [activating, setActivating] = useState(false);

  const routineInfo = useMemo(
    () => getRoutinePresentation(product?.routineSlot ?? 'morning'),
    [product?.routineSlot],
  );

  const handleActivate = async () => {
    if (!product || activating) {
      return;
    }

    try {
      setActivating(true);
      await activateProduct(product.id);
      await addProductToRoutine(product);
      onActivated();
      onClose();
      Toast.show({
        type: 'success',
        text1: `${product.name} added to your routine!`,
        text2: 'Check your Home screen',
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Failed to activate',
      });
    } finally {
      setActivating(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.productName}>{product?.name ?? ''}</Text>
          <Text style={styles.brand}>{product?.brand ?? ''}</Text>

          <View style={styles.infoCard}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons
                name={routineInfo.icon}
                size={20}
                color={routineInfo.iconColor}
              />
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoLabel}>Will be added to:</Text>
              <Text style={styles.infoValue}>{routineInfo.label}</Text>
            </View>
          </View>

          <Text style={styles.stepInfo}>
            {product ? `Step ${product.stepOrder} in the routine` : ''}
          </Text>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              activating && styles.primaryButtonDisabled,
            ]}
            activeOpacity={0.85}
            onPress={handleActivate}
            disabled={activating || !product}>
            {activating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Add to my routine</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.7}
            onPress={onClose}
            disabled={activating}>
            <Text style={styles.secondaryButtonText}>Not yet</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.24)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  brand: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: COLORS.primary50,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary700,
  },
  stepInfo: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 6,
  },
  secondaryButtonText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

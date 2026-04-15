/**
 * ProductConfirmScreen.tsx
 *
 * Shows the GPT-4o extracted product identifiers in editable fields.
 * User can correct the brand / product name / barcode before adding
 * the step to their routine.
 *
 * Params received from ProductScanScreen:
 *   { brand, product_name, barcode, imageUri, slot }
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useRoutineStore } from '../../store/routineStore';
import type { Task } from '../../constants/routineData';
import type { RoutineSlotParam } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function slotToSection(slot: RoutineSlotParam): Task['section'] {
  switch (slot) {
    case 'morning': return 'morning';
    case 'evening': return 'night_normal';
    case 'weekly':  return 'weekly';
  }
}

function slotLabel(slot: RoutineSlotParam): string {
  switch (slot) {
    case 'morning': return 'Morning routine';
    case 'evening': return 'Evening routine';
    case 'weekly':  return 'Weekly extras';
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe:      { flex: 1, backgroundColor: colors.background },
    flex:      { flex: 1 },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: colors.primaryDark,
    },

    // Scroll content
    scroll:   { flex: 1 },
    content:  { padding: 20, gap: 16, paddingBottom: 40 },

    // Product image thumbnail
    imageCard: {
      height: 180,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    image: { width: '100%', height: '100%' },
    imagePlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    imagePlaceholderText: { fontSize: 13, color: colors.muted },

    // Detected banner
    detectedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#ECFDF5',
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: '#A7F3D0',
    },
    detectedText: { flex: 1, fontSize: 13, color: '#065F46', fontWeight: '500' },

    // Form card
    formCard: {
      backgroundColor: colors.white,
      borderRadius: 16,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    formCardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primaryDark,
      marginBottom: 2,
    },
    fieldBlock:  { gap: 4 },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryMid,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 14,
      color: colors.primaryDark,
      backgroundColor: colors.surface,
    },
    inputError: { borderColor: '#EF4444' },
    errorText:  { fontSize: 11, color: '#EF4444' },

    // Slot chip
    slotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    slotChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.primary + '1A',
      borderRadius: 8,
    },
    slotChipText: { fontSize: 12, fontWeight: '600', color: colors.primary },
    slotNote: { fontSize: 12, color: colors.muted },

    // Action buttons
    addBtn: {
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    addBtnDisabled: { opacity: 0.55 },
    addBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
    rescanBtn: {
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rescanBtnText: { fontSize: 15, fontWeight: '500', color: colors.primaryMid },
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function ProductConfirmScreen() {
  const { colors } = useTheme();
  const styles     = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();

  const {
    brand:        initialBrand        = '',
    product_name: initialProductName  = '',
    barcode:      initialBarcode      = null,
    imageUri,
    slot,
  }: {
    brand:        string;
    product_name: string;
    barcode:      string | null;
    imageUri:     string | undefined;
    slot:         RoutineSlotParam;
  } = route.params ?? {};

  const { addCustomTask } = useRoutineStore();

  const [brand, setBrand]             = useState(initialBrand);
  const [productName, setProductName] = useState(initialProductName);
  const [barcode, setBarcode]         = useState(initialBarcode ?? '');
  const [nameError, setNameError]     = useState('');
  const [saving, setSaving]           = useState(false);

  const handleAdd = useCallback(async () => {
    if (!productName.trim()) {
      setNameError('Product name is required');
      return;
    }
    setSaving(true);
    try {
      const task: Task = {
        id:           `scan_${Date.now()}`,
        name:         productName.trim(),
        subtitle:     brand.trim(),
        instructions: barcode.trim() ? `Barcode: ${barcode.trim()}` : '',
        section:      slotToSection(slot),
        isRequired:   false,
        isOptional:   true,
        stepOrder:    99,
        source:       'custom',
      };
      await addCustomTask(task);

      // Navigate back to Home (pop all the way to root tabs)
      navigation.popToTop();
    } finally {
      setSaving(false);
    }
  }, [productName, brand, barcode, slot, addCustomTask, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Product</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Photo thumbnail */}
          <View style={styles.imageCard}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <MaterialCommunityIcons
                  name="image-off-outline"
                  size={36}
                  color={colors.muted}
                />
                <Text style={styles.imagePlaceholderText}>No image</Text>
              </View>
            )}
          </View>

          {/* Detected banner */}
          <View style={styles.detectedBanner}>
            <MaterialCommunityIcons name="check-circle-outline" size={20} color="#059669" />
            <Text style={styles.detectedText}>
              Product identified — review and edit details below before adding.
            </Text>
          </View>

          {/* Editable fields */}
          <View style={styles.formCard}>
            <Text style={styles.formCardTitle}>Product details</Text>

            {/* Product name */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Product Name *</Text>
              <TextInput
                style={[styles.textInput, nameError ? styles.inputError : undefined]}
                value={productName}
                onChangeText={t => { setProductName(t); setNameError(''); }}
                placeholder="e.g. Gentle Foaming Cleanser"
                placeholderTextColor={colors.muted}
                returnKeyType="next"
              />
              {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}
            </View>

            {/* Brand */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Brand</Text>
              <TextInput
                style={styles.textInput}
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g. Cetaphil"
                placeholderTextColor={colors.muted}
                returnKeyType="next"
              />
            </View>

            {/* Barcode */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Barcode</Text>
              <TextInput
                style={styles.textInput}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="e.g. 123456789012 (optional)"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />
            </View>

            {/* Target routine slot */}
            <View style={styles.slotRow}>
              <MaterialCommunityIcons
                name="calendar-check-outline"
                size={16}
                color={colors.primaryMid}
              />
              <View style={styles.slotChip}>
                <Text style={styles.slotChipText}>{slotLabel(slot)}</Text>
              </View>
              <Text style={styles.slotNote}>Step will be added here</Text>
            </View>
          </View>

          {/* CTA buttons */}
          <TouchableOpacity
            style={[styles.addBtn, saving && styles.addBtnDisabled]}
            activeOpacity={0.8}
            disabled={saving}
            onPress={handleAdd}>
            <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#FFF" />
            <Text style={styles.addBtnText}>
              {saving ? 'Adding…' : `Add to ${slotLabel(slot)}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rescanBtn}
            activeOpacity={0.8}
            onPress={() => navigation.goBack()}>
            <Text style={styles.rescanBtnText}>Re-scan</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

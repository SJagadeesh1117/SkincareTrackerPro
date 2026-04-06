/**
 * BundleScreen.tsx
 *
 * Shows the user's selected product bundle, a delivery address form, and
 * a mock Razorpay payment flow (real SDK wired in Phase 9). On success:
 *   1. Writes order to Firestore: orders/{uid}/orders/{orderId}
 *   2. Updates users/{uid}: { lastOrderId }
 *   3. Navigates to OrderConfirmationScreen with orderId
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type {
  CatalogProduct,
  DeliveryAddress,
  MyProductsStackParamList,
  ProductTier,
} from '../../types';

// ── Types ─────────────────────────────────────────────────

type NavProp = StackNavigationProp<MyProductsStackParamList, 'BundleScreen'>;
type RouteP = RouteProp<MyProductsStackParamList, 'BundleScreen'>;

interface Props { navigation: NavProp; route: RouteP }

// ── Constants ─────────────────────────────────────────────

const TEAL = '#1D9E75';
const BG   = '#F7F9FC';

const TIER_COLORS: Record<ProductTier, string> = {
  best:   '#F59E0B',
  value:  '#6B7280',
  budget: '#92400E',
};
const TIER_LABELS: Record<ProductTier, string> = {
  best:   'Best',
  value:  'Value',
  budget: 'Budget',
};

const ROUTINE_SLOT_LABEL: Record<string, string> = {
  morning: '☀️ Morning',
  night:   '🌙 Night',
  both:    '☀️🌙 AM & PM',
  weekly:  '📅 Weekly',
};

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Chandigarh', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry',
];

// ── Product row ───────────────────────────────────────────

function ProductRow({ product, index }: { product: CatalogProduct; index: number }) {
  return (
    <View style={styles.productRow}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{index + 1}</Text>
      </View>

      <Image
        source={{ uri: product.imageUrl }}
        style={styles.productImage}
        resizeMode="cover"
      />

      <View style={styles.productInfo}>
        <View style={styles.productNameRow}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>
          <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[product.tier] }]}>
            <Text style={styles.tierBadgeText}>{TIER_LABELS[product.tier]}</Text>
          </View>
        </View>
        <Text style={styles.productBrand}>{product.brand}</Text>
        <View style={styles.productMeta}>
          <Text style={styles.productPrice}>₹{product.priceINR.toLocaleString('en-IN')}</Text>
          <Text style={styles.routineSlot}>
            {ROUTINE_SLOT_LABEL[product.routineSlot] ?? product.routineSlot}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Field component ───────────────────────────────────────

function FormField({
  label, value, onChangeText, placeholder, error,
  keyboardType, maxLength, autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: 'default' | 'numeric';
  maxLength?: number;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : undefined]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────

export function BundleScreen({ navigation, route }: Props) {
  const { selectedProducts } = route.params;

  const orderedProducts = useMemo(
    () => [...selectedProducts].sort((a, b) => a.stepOrder - b.stepOrder),
    [selectedProducts],
  );

  const totalPrice = useMemo(
    () => selectedProducts.reduce((sum, p) => sum + p.priceINR, 0),
    [selectedProducts],
  );

  // ── Address form state ─────────────────────────────────
  const [fullName,      setFullName]      = useState('');
  const [addressLine1,  setAddressLine1]  = useState('');
  const [addressLine2,  setAddressLine2]  = useState('');
  const [city,          setCity]          = useState('');
  const [state,         setState]         = useState('');
  const [pinCode,       setPinCode]       = useState('');
  const [errors,        setErrors]        = useState<Partial<Record<keyof DeliveryAddress, string>>>({});

  const [processing, setProcessing] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // ── Validation ─────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const errs: Partial<Record<keyof DeliveryAddress, string>> = {};
    if (!fullName.trim())     errs.fullName     = 'Full name is required';
    if (!addressLine1.trim()) errs.addressLine1 = 'Address is required';
    if (!city.trim())         errs.city         = 'City is required';
    if (!state)               errs.state        = 'Please select a state';
    if (!pinCode.trim()) {
      errs.pinCode = 'PIN code is required';
    } else if (!/^\d{6}$/.test(pinCode.trim())) {
      errs.pinCode = 'Enter a valid 6-digit PIN code';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      // Scroll to top of form so user can see the errors
      scrollRef.current?.scrollToEnd({ animated: true });
    }
    return Object.keys(errs).length === 0;
  }, [fullName, addressLine1, city, state, pinCode]);

  // ── Mock payment ────────────────────────────────────────
  const runMockPayment = useCallback(async () => {
    setProcessing(true);
    // 2-second simulated processing delay (replaced by real SDK in Phase 9)
    await new Promise<void>(resolve => setTimeout(resolve, 2000));

    try {
      const uid = auth().currentUser?.uid;
      if (!uid) throw new Error('Not authenticated');

      const orderId = 'ORD_' + Date.now();

      const deliveryAddress: DeliveryAddress = {
        fullName:     fullName.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim(),
        city:         city.trim(),
        state,
        pinCode:      pinCode.trim(),
      };

      const orderData = {
        orderId,
        userId: uid,
        products: selectedProducts,
        totalAmountINR: totalPrice,
        deliveryAddress,
        status: 'paid',
        placedAt: firestore.FieldValue.serverTimestamp(),
        paymentMethod: 'razorpay_mock',
      };

      // Write to orders/{uid}/orders/{orderId}
      await firestore()
        .collection('orders')
        .doc(uid)
        .collection('orders')
        .doc(orderId)
        .set(orderData);

      // Update users/{uid} with lastOrderId (merge so other fields survive)
      await firestore()
        .collection('users')
        .doc(uid)
        .set({ lastOrderId: orderId }, { merge: true });

      setProcessing(false);
      navigation.navigate('OrderConfirmationScreen', { orderId });
    } catch (err: unknown) {
      setProcessing(false);
      const msg = (err as { message?: string }).message ?? 'Order failed. Please try again.';
      Alert.alert('Payment failed', msg);
    }
  }, [
    fullName, addressLine1, addressLine2, city, state, pinCode,
    selectedProducts, totalPrice, navigation,
  ]);

  const handleProceed = useCallback(() => {
    if (!validate()) return;
    Alert.alert(
      'Confirm Payment',
      `Pay ₹${totalPrice.toLocaleString('en-IN')} via Razorpay`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Pay ₹${totalPrice.toLocaleString('en-IN')}`, onPress: runMockPayment },
      ],
    );
  }, [validate, totalPrice, runMockPayment]);

  // ── Processing overlay ──────────────────────────────────
  if (processing) {
    return (
      <SafeAreaView style={styles.processingContainer}>
        <ActivityIndicator size="large" color={TEAL} />
        <Text style={styles.processingText}>Processing payment…</Text>
      </SafeAreaView>
    );
  }

  // ── Main render ─────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#111" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Your bundle</Text>
            <Text style={styles.headerSub}>
              {selectedProducts.length}-step personalised routine
            </Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* ── Product list ──────────────────────────────── */}
          <Text style={styles.sectionLabel}>Routine Order</Text>

          <FlatList
            data={orderedProducts}
            keyExtractor={item => item.id}
            renderItem={({ item, index }) => (
              <ProductRow product={item} index={index} />
            )}
            scrollEnabled={false}
            nestedScrollEnabled={false}
          />

          {/* ── Subtotal ─────────────────────────────────── */}
          <View style={styles.priceSummary}>
            <Text style={styles.summaryTitle}>Bundle Summary</Text>
            {orderedProducts.map(p => (
              <View key={p.id} style={styles.priceRow}>
                <Text style={styles.priceRowName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.priceRowPrice}>₹{p.priceINR.toLocaleString('en-IN')}</Text>
              </View>
            ))}
            <View style={styles.dividerLine} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalPrice}>₹{totalPrice.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          <View style={styles.sectionDivider} />

          {/* ── Delivery address form ─────────────────────── */}
          <Text style={styles.sectionLabel}>Delivery address</Text>

          <FormField
            label="Full name"
            value={fullName}
            onChangeText={t => { setFullName(t); setErrors(e => ({ ...e, fullName: undefined })); }}
            placeholder="Enter your full name"
            error={errors.fullName}
            autoCapitalize="words"
          />
          <FormField
            label="Address line 1"
            value={addressLine1}
            onChangeText={t => { setAddressLine1(t); setErrors(e => ({ ...e, addressLine1: undefined })); }}
            placeholder="Street, building, flat no."
            error={errors.addressLine1}
          />
          <FormField
            label="Address line 2 (optional)"
            value={addressLine2}
            onChangeText={setAddressLine2}
            placeholder="Landmark, area"
          />
          <FormField
            label="City"
            value={city}
            onChangeText={t => { setCity(t); setErrors(e => ({ ...e, city: undefined })); }}
            placeholder="Enter city"
            error={errors.city}
            autoCapitalize="words"
          />

          {/* State picker */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>State</Text>
            <View style={[styles.pickerWrapper, errors.state ? styles.inputError : undefined]}>
              <Picker
                selectedValue={state}
                onValueChange={val => { setState(val as string); setErrors(e => ({ ...e, state: undefined })); }}
                style={styles.picker}
                dropdownIconColor="#6B7280">
                <Picker.Item label="Select state…" value="" color="#9CA3AF" />
                {INDIAN_STATES.map(s => (
                  <Picker.Item key={s} label={s} value={s} />
                ))}
              </Picker>
            </View>
            {errors.state ? <Text style={styles.errorText}>{errors.state}</Text> : null}
          </View>

          <FormField
            label="PIN code"
            value={pinCode}
            onChangeText={t => { setPinCode(t); setErrors(e => ({ ...e, pinCode: undefined })); }}
            placeholder="6-digit PIN code"
            keyboardType="numeric"
            maxLength={6}
            error={errors.pinCode}
          />

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Footer CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.orderBtn}
            onPress={handleProceed}
            activeOpacity={0.85}>
            <Text style={styles.orderBtnText}>Proceed to payment</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex:             { flex: 1 },
  safeArea:         { flex: 1, backgroundColor: BG },

  // Processing
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
    gap: 16,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn:         { padding: 4 },
  headerTextWrap:  { flex: 1 },
  headerTitle:     { fontSize: 18, fontWeight: '700', color: '#111' },
  headerSub:       { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Section label
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // Product rows
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBadgeText:  { fontSize: 12, fontWeight: '700', color: '#fff' },
  productImage:   { width: 56, height: 56, borderRadius: 8, backgroundColor: '#F3F4F6' },
  productInfo:    { flex: 1, gap: 3 },
  productNameRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  productName:    { fontSize: 13, fontWeight: '700', color: '#111', flex: 1 },
  tierBadge:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  tierBadgeText:  { fontSize: 10, fontWeight: '700', color: '#fff' },
  productBrand:   { fontSize: 11, color: '#9CA3AF' },
  productMeta:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  productPrice:   { fontSize: 13, fontWeight: '700', color: TEAL },
  routineSlot:    { fontSize: 11, color: '#6B7280' },

  // Price summary
  priceSummary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 4 },
  priceRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceRowName: { fontSize: 13, color: '#374151', flex: 1, marginRight: 8 },
  priceRowPrice:{ fontSize: 13, fontWeight: '600', color: '#374151' },
  dividerLine:  { height: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:   { fontSize: 15, fontWeight: '700', color: '#111' },
  totalPrice:   { fontSize: 18, fontWeight: '800', color: TEAL },

  sectionDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 20 },

  // Form
  fieldContainer: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: '#111',
  },
  inputError: { borderColor: '#EF4444' },
  errorText:  { fontSize: 12, color: '#EF4444', marginTop: 4 },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: {
    height: Platform.OS === 'ios' ? 180 : 52,
    color: '#111',
  },

  bottomSpacer: { height: 24 },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'android' ? 12 : 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  editBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText:  { fontSize: 15, fontWeight: '600', color: TEAL },
  orderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 12,
  },
  orderBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

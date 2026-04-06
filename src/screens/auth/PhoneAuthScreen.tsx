import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  SafeAreaView,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { AuthStackParamList } from '../../types';
import { sendPhoneOTP, getAuthErrorMessage } from '../../services/authService';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'PhoneAuth'>;
};

interface Country {
  code: string;
  name: string;
  dial: string;
}

const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India', dial: '+91' },
  { code: 'US', name: 'United States', dial: '+1' },
  { code: 'GB', name: 'United Kingdom', dial: '+44' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { code: 'SG', name: 'Singapore', dial: '+65' },
  { code: 'AU', name: 'Australia', dial: '+61' },
  { code: 'CA', name: 'Canada', dial: '+1' },
  { code: 'NZ', name: 'New Zealand', dial: '+64' },
  { code: 'DE', name: 'Germany', dial: '+49' },
  { code: 'FR', name: 'France', dial: '+33' },
  { code: 'IT', name: 'Italy', dial: '+39' },
  { code: 'ES', name: 'Spain', dial: '+34' },
  { code: 'PT', name: 'Portugal', dial: '+351' },
  { code: 'NL', name: 'Netherlands', dial: '+31' },
  { code: 'BE', name: 'Belgium', dial: '+32' },
  { code: 'CH', name: 'Switzerland', dial: '+41' },
  { code: 'AT', name: 'Austria', dial: '+43' },
  { code: 'SE', name: 'Sweden', dial: '+46' },
  { code: 'NO', name: 'Norway', dial: '+47' },
  { code: 'DK', name: 'Denmark', dial: '+45' },
  { code: 'FI', name: 'Finland', dial: '+358' },
  { code: 'PL', name: 'Poland', dial: '+48' },
  { code: 'CZ', name: 'Czech Republic', dial: '+420' },
  { code: 'HU', name: 'Hungary', dial: '+36' },
  { code: 'RO', name: 'Romania', dial: '+40' },
  { code: 'BG', name: 'Bulgaria', dial: '+359' },
  { code: 'HR', name: 'Croatia', dial: '+385' },
  { code: 'SK', name: 'Slovakia', dial: '+421' },
  { code: 'SI', name: 'Slovenia', dial: '+386' },
  { code: 'LT', name: 'Lithuania', dial: '+370' },
  { code: 'LV', name: 'Latvia', dial: '+371' },
  { code: 'EE', name: 'Estonia', dial: '+372' },
  { code: 'JP', name: 'Japan', dial: '+81' },
  { code: 'CN', name: 'China', dial: '+86' },
  { code: 'KR', name: 'South Korea', dial: '+82' },
  { code: 'TH', name: 'Thailand', dial: '+66' },
  { code: 'MY', name: 'Malaysia', dial: '+60' },
  { code: 'ID', name: 'Indonesia', dial: '+62' },
  { code: 'PH', name: 'Philippines', dial: '+63' },
  { code: 'VN', name: 'Vietnam', dial: '+84' },
];

const getFlagEmoji = (countryCode: string) => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export function PhoneAuthScreen({ navigation }: Props) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [search]);

  const handleSendOTP = async () => {
    if (!phone.trim() || phone.trim().length < 5) {
      setPhoneError('Enter a valid phone number');
      return;
    }
    setPhoneError('');
    setServerError('');
    setLoading(true);
    const fullNumber = `${selectedCountry.dial}${phone.trim()}`;
    try {
      await sendPhoneOTP(fullNumber);
      // Confirmation stored in authService module scope — OTPScreen retrieves it
      navigation.navigate('OTP', { phoneNumber: fullNumber });
    } catch (e: any) {
      setServerError(getAuthErrorMessage(e?.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const selectCountry = (country: Country) => {
    setSelectedCountry(country);
    setModalVisible(false);
    setSearch('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Enter your phone number</Text>
        <Text style={styles.subtitle}>We'll send a verification code to this number.</Text>

        <Text style={styles.label}>Phone number</Text>
        <View style={styles.phoneRow}>
          <TouchableOpacity
            style={styles.countryPicker}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.flagText}>{getFlagEmoji(selectedCountry.code)}</Text>
            <Text style={styles.dialCode}>{selectedCountry.dial}</Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color="#555" />
          </TouchableOpacity>

          <TextInput
            value={phone}
            onChangeText={text => {
              setPhone(text.replace(/[^0-9]/g, ''));
              if (phoneError) setPhoneError('');
            }}
            keyboardType="phone-pad"
            mode="outlined"
            outlineColor="#E0E0E0"
            activeOutlineColor="#1D9E75"
            style={styles.phoneInput}
            placeholder="Phone number"
            error={!!phoneError}
          />
        </View>
        {!!phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
        {!!serverError && <Text style={styles.errorText}>{serverError}</Text>}

        <Button
          mode="contained"
          buttonColor="#1D9E75"
          contentStyle={styles.buttonContent}
          style={styles.button}
          onPress={handleSendOTP}
          loading={loading}
          disabled={loading}
        >
          {loading ? '' : 'Send OTP'}
        </Button>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => { setModalVisible(false); setSearch(''); }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select country</Text>
            <TouchableOpacity
              onPress={() => { setModalVisible(false); setSearch(''); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <RNTextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search country..."
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.countryItem,
                  item.code === selectedCountry.code && styles.countryItemSelected,
                ]}
                onPress={() => selectCountry(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.countryFlag}>{getFlagEmoji(item.code)}</Text>
                <Text style={styles.countryName}>{item.name}</Text>
                <Text style={styles.countryDial}>{item.dial}</Text>
                {item.code === selectedCountry.code && (
                  <MaterialCommunityIcons name="check" size={18} color="#1D9E75" />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
    padding: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 28,
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    color: '#444',
    marginBottom: 8,
    fontWeight: '500',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 6,
    backgroundColor: '#FAFAFA',
  },
  flagText: {
    fontSize: 20,
  },
  dialCode: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#fff',
  },
  errorText: {
    color: '#E53935',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  buttonContent: {
    height: 50,
  },
  button: {
    borderRadius: 10,
    marginTop: 28,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  countryItemSelected: {
    backgroundColor: '#F0FAF6',
  },
  countryFlag: {
    fontSize: 22,
    width: 32,
  },
  countryName: {
    flex: 1,
    fontSize: 15,
    color: '#222',
  },
  countryDial: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginLeft: 64,
  },
});

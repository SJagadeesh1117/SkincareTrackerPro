import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { AuthStackParamList } from '../../types';
import { createAccount, signOut, getAuthErrorMessage } from '../../services/authService';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'EmailRegister'>;
};

type Strength = 'weak' | 'medium' | 'strong';

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function getPasswordStrength(pw: string): Strength {
  if (pw.length < 6) return 'weak';
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  const score = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
  if (pw.length >= 8 && score >= 3) return 'strong';
  if (pw.length >= 6 && score >= 2) return 'medium';
  return 'weak';
}

const STRENGTH_COLOR: Record<Strength, string> = {
  weak: '#DC2626',
  medium: '#FB8C00',
  strong: '#8B5CF6',
};
const STRENGTH_LABEL: Record<Strength, string> = {
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
};
const STRENGTH_FILL: Record<Strength, number> = {
  weak: 1,
  medium: 2,
  strong: 3,
};

export function EmailRegisterScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [serverError, setServerError] = useState('');
  const insets = useSafeAreaInsets();

  const strength = password.length > 0 ? getPasswordStrength(password) : null;

  const validate = () => {
    const next = { name: '', email: '', password: '', confirmPassword: '' };
    let valid = true;
    if (!name.trim()) { next.name = 'Full name is required'; valid = false; }
    if (!email.trim()) { next.email = 'Email is required'; valid = false; }
    else if (!isValidEmail(email)) { next.email = 'Enter a valid email address'; valid = false; }
    if (!password) { next.password = 'Password is required'; valid = false; }
    else if (password.length < 8) { next.password = 'Password must be at least 8 characters'; valid = false; }
    if (!confirmPassword) { next.confirmPassword = 'Please confirm your password'; valid = false; }
    else if (password !== confirmPassword) { next.confirmPassword = 'Passwords do not match'; valid = false; }
    setErrors(next);
    return valid;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setServerError('');
    setLoading(true);
    try {
      await createAccount(name.trim(), email.trim(), password);
      // Sign out immediately so the user must explicitly log in,
      // which triggers first-login detection in useAuth.
      await signOut();
      navigation.navigate('EmailLogin');
    } catch (e: any) {
      setServerError(getAuthErrorMessage(e?.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field: keyof typeof errors) =>
    setErrors(prev => ({ ...prev, [field]: '' }));

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      {/* Purple header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create account</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* White card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={[styles.card, { paddingBottom: insets.bottom + 24 }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Text style={styles.heading}>Create account</Text>
            <Text style={styles.subText}>Join Skincare Tracker Pro</Text>

            <View style={styles.fieldGroup}>
              <TextInput
                label="Full name"
                value={name}
                onChangeText={text => { setName(text); if (errors.name) clearError('name'); }}
                autoCapitalize="words"
                mode="outlined"
                outlineColor="#E9E4FF"
                activeOutlineColor="#8B5CF6"
                error={!!errors.name}
              />
              {!!errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            <View style={styles.fieldGroup}>
              <TextInput
                label="Email"
                value={email}
                onChangeText={text => { setEmail(text); if (errors.email) clearError('email'); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                mode="outlined"
                outlineColor="#E9E4FF"
                activeOutlineColor="#8B5CF6"
                error={!!errors.email}
              />
              {!!errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.fieldGroup}>
              <TextInput
                label="Password"
                value={password}
                onChangeText={text => { setPassword(text); if (errors.password) clearError('password'); }}
                secureTextEntry={!showPassword}
                mode="outlined"
                outlineColor="#E9E4FF"
                activeOutlineColor="#8B5CF6"
                error={!!errors.password}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(v => !v)}
                    color="#A78BFA"
                  />
                }
              />
              {!!errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

              {strength && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBars}>
                    {[1, 2, 3].map(level => (
                      <View
                        key={level}
                        style={[
                          styles.strengthBar,
                          { backgroundColor: STRENGTH_FILL[strength] >= level ? STRENGTH_COLOR[strength] : '#E9E4FF' },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: STRENGTH_COLOR[strength] }]}>
                    {STRENGTH_LABEL[strength]}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <TextInput
                label="Confirm password"
                value={confirmPassword}
                onChangeText={text => { setConfirmPassword(text); if (errors.confirmPassword) clearError('confirmPassword'); }}
                secureTextEntry={!showConfirm}
                mode="outlined"
                outlineColor="#E9E4FF"
                activeOutlineColor="#8B5CF6"
                error={!!errors.confirmPassword}
                right={
                  <TextInput.Icon
                    icon={showConfirm ? 'eye-off' : 'eye'}
                    onPress={() => setShowConfirm(v => !v)}
                    color="#A78BFA"
                  />
                }
              />
              {!!errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            {!!serverError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{serverError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Create account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signInRow}
              onPress={() => navigation.goBack()}
              disabled={loading}>
              <Text style={styles.newHereText}>Already have an account?  </Text>
              <Text style={styles.signInText}>Sign in</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const SB_HEIGHT = StatusBar.currentHeight ?? 24;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#7C3AED',
  },
  flex: {
    flex: 1,
  },
  // ── Header ────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: SB_HEIGHT + 4,
    paddingBottom: 8,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  // ── Card ─────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2E1065',
    marginBottom: 4,
  },
  subText: {
    fontSize: 13,
    color: '#A78BFA',
    marginBottom: 28,
  },
  // ── Fields ────────────────────────────────────────────
  fieldGroup: {
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 44,
    textAlign: 'right',
  },
  // ── Error banner ──────────────────────────────────────
  errorBanner: {
    marginBottom: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
  },
  // ── Buttons ───────────────────────────────────────────
  primaryBtn: {
    height: 52,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  newHereText: {
    fontSize: 13,
    color: '#A78BFA',
  },
  signInText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5CF6',
    textDecorationLine: 'underline',
  },
});

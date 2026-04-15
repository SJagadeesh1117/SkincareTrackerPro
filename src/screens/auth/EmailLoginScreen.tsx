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
import { signInWithEmail, getAuthErrorMessage } from '../../services/authService';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'EmailLogin'>;
};

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function EmailLoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const validate = () => {
    let valid = true;
    if (!email.trim()) {
      setEmailError('Email is required');
      valid = false;
    } else if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address');
      valid = false;
    } else {
      setEmailError('');
    }
    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    } else {
      setPasswordError('');
    }
    return valid;
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    setServerError('');
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      // RootNavigator picks up the auth state change — no manual navigation needed
    } catch (e: any) {
      setServerError(getAuthErrorMessage(e?.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

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
        <Text style={styles.headerTitle}>Sign in</Text>
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
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subText}>Sign in to your account</Text>

            <View style={styles.fieldGroup}>
              <TextInput
                label="Email"
                value={email}
                onChangeText={text => {
                  setEmail(text);
                  if (emailError) setEmailError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                mode="outlined"
                outlineColor="#E9E4FF"
                activeOutlineColor="#8B5CF6"
                error={!!emailError}
              />
              {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}
            </View>

            <View style={styles.fieldGroup}>
              <TextInput
                label="Password"
                value={password}
                onChangeText={text => {
                  setPassword(text);
                  if (passwordError) setPasswordError('');
                }}
                secureTextEntry={!showPassword}
                mode="outlined"
                outlineColor="#E9E4FF"
                activeOutlineColor="#8B5CF6"
                error={!!passwordError}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(v => !v)}
                    color="#A78BFA"
                  />
                }
              />
              {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
            </View>

            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {!!serverError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{serverError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign in</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.createRow}
              onPress={() => navigation.navigate('EmailRegister')}
              disabled={loading}>
              <Text style={styles.newHereText}>Don't have an account?  </Text>
              <Text style={styles.createAccountText}>Create one</Text>
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
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    color: '#8B5CF6',
    fontSize: 13,
    fontWeight: '500',
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
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  newHereText: {
    fontSize: 13,
    color: '#A78BFA',
  },
  createAccountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5CF6',
    textDecorationLine: 'underline',
  },
});

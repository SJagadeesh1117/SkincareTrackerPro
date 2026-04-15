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
import { sendPasswordReset, getAuthErrorMessage } from '../../services/authService';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const insets = useSafeAreaInsets();

  const handleSend = async () => {
    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address');
      return;
    }
    setEmailError('');
    setServerError('');
    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (e: any) {
      setServerError(getAuthErrorMessage(e?.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  // ── Success state ─────────────────────────────────────────────────────────────
  if (sent) {
    return (
      <SafeAreaView style={styles.root} edges={[]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reset password</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.card, styles.successCard, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.successIconCircle}>
            <MaterialCommunityIcons name="email-check-outline" size={48} color="#8B5CF6" />
          </View>
          <Text style={styles.successTitle}>Check your inbox</Text>
          <Text style={styles.successMessage}>
            We've sent a password reset link to{'\n'}
            <Text style={styles.successEmail}>{email.trim()}</Text>
          </Text>
          <Text style={styles.successHint}>
            Didn't receive it? Check your spam folder or try again.
          </Text>
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => { setSent(false); setEmail(''); }}
            activeOpacity={0.85}>
            <Text style={styles.outlineBtnText}>Try a different email</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Form state ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset password</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={[styles.card, { paddingBottom: insets.bottom + 24 }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Text style={styles.heading}>Forgot password?</Text>
            <Text style={styles.subText}>
              Enter your email and we'll send you a reset link.
            </Text>

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

            {!!serverError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{serverError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleSend}
              disabled={loading}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Send reset link</Text>
              )}
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
  successCard: {
    alignItems: 'center',
    justifyContent: 'center',
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
    lineHeight: 20,
  },
  // ── Fields ────────────────────────────────────────────
  fieldGroup: {
    marginBottom: 24,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
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
  outlineBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
  },
  outlineBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  // ── Success ───────────────────────────────────────────
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2E1065',
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  successEmail: {
    fontWeight: '700',
    color: '#2E1065',
  },
  successHint: {
    fontSize: 12,
    color: '#A78BFA',
    textAlign: 'center',
    marginBottom: 32,
  },
});

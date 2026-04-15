import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { AuthStackParamList } from '../../types';
import {
  verifyOTP,
  sendPhoneOTP,
  getStoredConfirmation,
  getAuthErrorMessage,
} from '../../services/authService';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'OTP'>;
  route: RouteProp<AuthStackParamList, 'OTP'>;
};

const OTP_LENGTH = 6;
const RESEND_DELAY = 30;

export function OTPScreen({ navigation, route }: Props) {
  const { phoneNumber } = route.params;

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [timer, setTimer] = useState(RESEND_DELAY);
  const [canResend, setCanResend] = useState(false);
  const insets = useSafeAreaInsets();

  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));

  useEffect(() => {
    if (timer <= 0) { setCanResend(true); return; }
    const id = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const handleVerify = useCallback(async (code: string) => {
    const confirmation = getStoredConfirmation();
    if (!confirmation) {
      setOtpError('Session expired. Please go back and request a new OTP.');
      return;
    }
    setOtpError('');
    setVerifying(true);
    try {
      await verifyOTP(confirmation, code);
      // RootNavigator picks up the auth state change — no manual navigation needed
    } catch (e: any) {
      setOtpError(getAuthErrorMessage(e?.code ?? ''));
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  }, []);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (next.every(d => d !== '')) {
      inputRefs.current[index]?.blur();
      handleVerify(next.join(''));
    }
  };

  const handleKeyPress = (event: { nativeEvent: { key: string } }, index: number) => {
    if (event.nativeEvent.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const next = [...otp];
        next[index - 1] = '';
        setOtp(next);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    setOtpError('');
    try {
      await sendPhoneOTP(phoneNumber);
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimer(RESEND_DELAY);
      setCanResend(false);
      inputRefs.current[0]?.focus();
    } catch (e: any) {
      setOtpError(getAuthErrorMessage(e?.code ?? ''));
    } finally {
      setResending(false);
    }
  };

  const filledCount = otp.filter(d => d !== '').length;

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
        <Text style={styles.headerTitle}>Verify</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* White card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={[styles.card, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.heading}>Enter verification code</Text>
          <Text style={styles.subText}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phoneHighlight}>{phoneNumber}</Text>
          </Text>

          {/* OTP boxes */}
          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={ref => { inputRefs.current[index] = ref; }}
                style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                value={digit}
                onChangeText={text => handleChange(text, index)}
                onKeyPress={event => handleKeyPress(event, index)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                selectTextOnFocus
                editable={!verifying}
              />
            ))}
          </View>

          {verifying && (
            <View style={styles.verifyingRow}>
              <ActivityIndicator size="small" color="#8B5CF6" />
              <Text style={styles.verifyingText}>Verifying...</Text>
            </View>
          )}

          {!!otpError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{otpError}</Text>
            </View>
          )}

          {/* Resend */}
          <View style={styles.resendRow}>
            {canResend ? (
              <TouchableOpacity onPress={handleResend} disabled={resending} activeOpacity={0.7}>
                {resending ? (
                  <ActivityIndicator size="small" color="#8B5CF6" />
                ) : (
                  <Text style={styles.resendActive}>Resend OTP</Text>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={styles.resendDisabled}>
                Resend OTP in <Text style={styles.timerText}>{timer}s</Text>
              </Text>
            )}
          </View>

          <Text style={styles.progressHint}>
            {filledCount}/{OTP_LENGTH} digits entered
          </Text>
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
    paddingTop: 32,
    alignItems: 'center',
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2E1065',
    marginBottom: 8,
    textAlign: 'center',
  },
  subText: {
    fontSize: 13,
    color: '#A78BFA',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 36,
  },
  phoneHighlight: {
    fontWeight: '700',
    color: '#2E1065',
  },
  // ── OTP boxes ─────────────────────────────────────────
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    borderRadius: 10,
    fontSize: 22,
    fontWeight: '700',
    color: '#2E1065',
    backgroundColor: '#FAFAFA',
  },
  otpBoxFilled: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
  },
  // ── Verifying ─────────────────────────────────────────
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  verifyingText: {
    color: '#8B5CF6',
    fontSize: 14,
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
    width: '100%',
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
  },
  // ── Resend ────────────────────────────────────────────
  resendRow: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resendActive: {
    color: '#8B5CF6',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  resendDisabled: {
    color: '#A78BFA',
    fontSize: 14,
  },
  timerText: {
    fontWeight: '700',
    color: '#2E1065',
  },
  progressHint: {
    color: '#C4B5FD',
    fontSize: 12,
    marginTop: 8,
  },
});

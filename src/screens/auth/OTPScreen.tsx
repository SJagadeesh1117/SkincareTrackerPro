import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
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

export function OTPScreen({ route }: Props) {
  const { phoneNumber } = route.params;

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [timer, setTimer] = useState(RESEND_DELAY);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));

  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true);
      return;
    }
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
      // Reset boxes so user can re-enter
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
      await sendPhoneOTP(phoneNumber); // updates _phoneConfirmation in authService
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.phoneNumber}>{phoneNumber}</Text>
        </Text>

        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => { inputRefs.current[index] = ref; }}
              style={[
                styles.otpBox,
                digit ? styles.otpBoxFilled : null,
              ]}
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
            <ActivityIndicator size="small" color="#1D9E75" />
            <Text style={styles.verifyingText}>Verifying...</Text>
          </View>
        )}

        {!!otpError && (
          <Text style={styles.otpError}>{otpError}</Text>
        )}

        <View style={styles.resendRow}>
          {canResend ? (
            <TouchableOpacity
              onPress={handleResend}
              disabled={resending}
              activeOpacity={0.7}
            >
              {resending ? (
                <ActivityIndicator size="small" color="#1D9E75" />
              ) : (
                <Text style={styles.resendActive}>Resend OTP</Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendDisabled}>
              Resend OTP in{' '}
              <Text style={styles.timerText}>{timer}s</Text>
            </Text>
          )}
        </View>

        <Text style={styles.progressHint}>
          {filledCount}/{OTP_LENGTH} digits entered
        </Text>
      </View>
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
    paddingTop: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  phoneNumber: {
    fontWeight: '700',
    color: '#222',
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    borderRadius: 10,
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    backgroundColor: '#FAFAFA',
  },
  otpBoxFilled: {
    borderColor: '#1D9E75',
    backgroundColor: '#F0FAF6',
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  verifyingText: {
    color: '#1D9E75',
    fontSize: 14,
    fontWeight: '500',
  },
  resendRow: {
    marginBottom: 16,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendActive: {
    color: '#1D9E75',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  resendDisabled: {
    color: '#888',
    fontSize: 14,
  },
  timerText: {
    fontWeight: '700',
    color: '#555',
  },
  progressHint: {
    color: '#BBB',
    fontSize: 12,
    marginTop: 8,
  },
  otpError: {
    color: '#E53935',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
});

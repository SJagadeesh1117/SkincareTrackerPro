import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { AuthStackParamList } from '../../types';
import { sendPasswordReset, getAuthErrorMessage } from '../../services/authService';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function ForgotPasswordScreen({ navigation: _navigation }: Props) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

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

  if (sent) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIconCircle}>
          <MaterialCommunityIcons name="email-check-outline" size={48} color="#1D9E75" />
        </View>
        <Text style={styles.successTitle}>Check your inbox</Text>
        <Text style={styles.successMessage}>
          We've sent a password reset link to{'\n'}
          <Text style={styles.successEmail}>{email.trim()}</Text>
        </Text>
        <Text style={styles.successHint}>
          Didn't receive it? Check your spam folder or try again.
        </Text>
        <Button
          mode="outlined"
          textColor="#1D9E75"
          style={styles.tryAgainButton}
          onPress={() => { setSent(false); setEmail(''); }}
        >
          Try a different email
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>
          Enter the email address associated with your account and we'll send you a reset link.
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
            outlineColor="#E0E0E0"
            activeOutlineColor="#1D9E75"
            error={!!emailError}
          />
          {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}
        </View>

        {!!serverError && (
          <Text style={styles.serverError}>{serverError}</Text>
        )}

        <Button
          mode="contained"
          buttonColor="#1D9E75"
          contentStyle={styles.buttonContent}
          style={styles.button}
          onPress={handleSend}
          loading={loading}
          disabled={loading}
        >
          {loading ? '' : 'Send reset link'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    flexGrow: 1,
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
  fieldGroup: {
    marginBottom: 24,
  },
  errorText: {
    color: '#E53935',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  buttonContent: {
    height: 50,
  },
  button: {
    borderRadius: 10,
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E8F5F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  successEmail: {
    fontWeight: '600',
    color: '#111',
  },
  successHint: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
  },
  tryAgainButton: {
    borderColor: '#1D9E75',
  },
  serverError: {
    color: '#E53935',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
});

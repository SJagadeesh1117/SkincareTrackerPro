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
import type { StackNavigationProp } from '@react-navigation/stack';
import type { AuthStackParamList } from '../../types';
import { createAccount, getAuthErrorMessage } from '../../services/authService';

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
  weak: '#E53935',
  medium: '#FB8C00',
  strong: '#1D9E75',
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

  const [errors, setErrors] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [serverError, setServerError] = useState('');

  const strength = password.length > 0 ? getPasswordStrength(password) : null;

  const validate = () => {
    const next = { name: '', email: '', password: '', confirmPassword: '' };
    let valid = true;

    if (!name.trim()) {
      next.name = 'Full name is required';
      valid = false;
    }
    if (!email.trim()) {
      next.email = 'Email is required';
      valid = false;
    } else if (!isValidEmail(email)) {
      next.email = 'Enter a valid email address';
      valid = false;
    }
    if (!password) {
      next.password = 'Password is required';
      valid = false;
    } else if (password.length < 8) {
      next.password = 'Password must be at least 8 characters';
      valid = false;
    }
    if (!confirmPassword) {
      next.confirmPassword = 'Please confirm your password';
      valid = false;
    } else if (password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match';
      valid = false;
    }

    setErrors(next);
    return valid;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setServerError('');
    setLoading(true);
    try {
      await createAccount(name.trim(), email.trim(), password);
      // RootNavigator picks up the auth state change — no manual navigation needed
    } catch (e: any) {
      setServerError(getAuthErrorMessage(e?.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field: keyof typeof errors) =>
    setErrors(prev => ({ ...prev, [field]: '' }));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join Skincare Tracker Pro</Text>

        <View style={styles.fieldGroup}>
          <TextInput
            label="Full name"
            value={name}
            onChangeText={text => { setName(text); if (errors.name) clearError('name'); }}
            autoCapitalize="words"
            mode="outlined"
            outlineColor="#E0E0E0"
            activeOutlineColor="#1D9E75"
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
            outlineColor="#E0E0E0"
            activeOutlineColor="#1D9E75"
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
            outlineColor="#E0E0E0"
            activeOutlineColor="#1D9E75"
            error={!!errors.password}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(v => !v)}
                color="#888"
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
                      {
                        backgroundColor:
                          STRENGTH_FILL[strength] >= level
                            ? STRENGTH_COLOR[strength]
                            : '#E0E0E0',
                      },
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
            outlineColor="#E0E0E0"
            activeOutlineColor="#1D9E75"
            error={!!errors.confirmPassword}
            right={
              <TextInput.Icon
                icon={showConfirm ? 'eye-off' : 'eye'}
                onPress={() => setShowConfirm(v => !v)}
                color="#888"
              />
            }
          />
          {!!errors.confirmPassword && (
            <Text style={styles.errorText}>{errors.confirmPassword}</Text>
          )}
        </View>

        {!!serverError && (
          <Text style={styles.serverError}>{serverError}</Text>
        )}

        <Button
          mode="contained"
          buttonColor="#1D9E75"
          contentStyle={styles.buttonContent}
          style={styles.button}
          onPress={handleRegister}
          loading={loading}
          disabled={loading}
        >
          {loading ? '' : 'Create account'}
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
  },
  fieldGroup: {
    marginBottom: 16,
  },
  errorText: {
    color: '#E53935',
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
  buttonContent: {
    height: 50,
  },
  button: {
    borderRadius: 10,
    marginTop: 8,
  },
  serverError: {
    color: '#E53935',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
});

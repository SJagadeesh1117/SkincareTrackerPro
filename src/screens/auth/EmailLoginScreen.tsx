import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

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
            outlineColor="#E0E0E0"
            activeOutlineColor="#1D9E75"
            error={!!passwordError}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(v => !v)}
                color="#888"
              />
            }
          />
          {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
        </View>

        <TouchableOpacity
          style={styles.forgotRow}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {!!serverError && (
          <Text style={styles.serverError}>{serverError}</Text>
        )}

        <Button
          mode="contained"
          buttonColor="#1D9E75"
          contentStyle={styles.buttonContent}
          style={styles.signInButton}
          onPress={handleSignIn}
          loading={loading}
          disabled={loading}
        >
          {loading ? '' : 'Sign in'}
        </Button>

        <TouchableOpacity
          style={styles.registerRow}
          onPress={() => navigation.navigate('EmailRegister')}
        >
          <Text style={styles.registerText}>
            Don't have an account?{' '}
            <Text style={styles.registerLink}>Create one</Text>
          </Text>
        </TouchableOpacity>
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
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    color: '#1D9E75',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonContent: {
    height: 50,
  },
  signInButton: {
    borderRadius: 10,
  },
  registerRow: {
    alignItems: 'center',
    marginTop: 24,
  },
  registerText: {
    fontSize: 14,
    color: '#555',
  },
  registerLink: {
    color: '#1D9E75',
    fontWeight: '600',
  },
  serverError: {
    color: '#E53935',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
});

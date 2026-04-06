import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Button } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { AuthStackParamList } from '../../types';
import { signInWithGoogle, getAuthErrorMessage } from '../../services/authService';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'Welcome'>;
};

export function WelcomeScreen({ navigation }: Props) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      // RootNavigator picks up the auth state change — no manual navigation needed
    } catch (e: any) {
      if (e?.code !== 'auth/cancelled') {
        setError(getAuthErrorMessage(e?.code ?? ''));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>STP</Text>
          </View>
          <Text style={styles.appName}>Skincare Tracker Pro</Text>
          <Text style={styles.tagline}>Your skin, your routine</Text>
        </View>

        <View style={styles.card}>
          <Button
            mode="outlined"
            icon={({ size, color }) => (
              <MaterialCommunityIcons name="google" size={size} color={color} />
            )}
            style={styles.outlinedButton}
            contentStyle={styles.buttonContent}
            textColor="#1D9E75"
            onPress={handleGoogle}
            loading={googleLoading}
            disabled={googleLoading}
          >
            Continue with Google
          </Button>

          <Button
            mode="outlined"
            icon={({ size, color }) => (
              <MaterialCommunityIcons name="phone" size={size} color={color} />
            )}
            style={[styles.outlinedButton, styles.mt12]}
            contentStyle={styles.buttonContent}
            textColor="#1D9E75"
            onPress={() => navigation.navigate('PhoneAuth')}
            disabled={googleLoading}
          >
            Continue with Phone
          </Button>

          <Button
            mode="contained"
            buttonColor="#1D9E75"
            style={styles.mt12}
            contentStyle={styles.buttonContent}
            onPress={() => navigation.navigate('EmailLogin')}
            disabled={googleLoading}
          >
            Sign in with Email
          </Button>
        </View>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.createAccountLink}
          onPress={() => navigation.navigate('EmailRegister')}
          disabled={googleLoading}
        >
          <Text style={styles.createAccountText}>Create account</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1D9E75',
  },
  flex: {
    flex: 1,
  },
  logoArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  outlinedButton: {
    borderColor: '#1D9E75',
    borderWidth: 1.5,
  },
  buttonContent: {
    height: 48,
  },
  mt12: {
    marginTop: 12,
  },
  createAccountLink: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  createAccountText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
  },
});

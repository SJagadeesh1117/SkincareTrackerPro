import React, { useRef, useState, useEffect } from 'react';
import {
  Animated,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { AuthStackParamList } from '../../types';
import { signInWithGoogle, getAuthErrorMessage } from '../../services/authService';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'Welcome'>;
};

// ── 4-colour Google G icon ────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  );
}

// ── Spring scale hook ─────────────────────────────────────────────────────────
function useButtonScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  return { scale, onPressIn, onPressOut };
}

// ── Sparkle dot positions around the ring ─────────────────────────────────────
const SPARKLE_DOTS = [
  { emoji: '✨', top: -10, left: 38 },   // 12 o'clock
  { emoji: '🌿', top: 38, right: -10 },  // 3 o'clock
  { emoji: '💧', bottom: -10, left: 38 }, // 6 o'clock
  { emoji: '🌸', top: 38, left: -10 },   // 9 o'clock
];

// ── Animated logo ─────────────────────────────────────────────────────────────
function AnimatedLogo() {
  // Waving hand bounce
  const waveAnim = useRef(new Animated.Value(0)).current;
  // Orbit rotation for sparkle ring
  const orbitAnim = useRef(new Animated.Value(0)).current;
  // Outer ring pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Wave: 0→1→-0.5→0.8→0 rotation sequence
    const wave = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: -0.6, duration: 200, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.delay(2000),
      ]),
    );

    // Orbit: slow full rotation of the sparkle dots
    const orbit = Animated.loop(
      Animated.timing(orbitAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      }),
    );

    // Pulse: subtle scale breathe on the outer ring
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    );

    wave.start();
    orbit.start();
    pulse.start();
    return () => { wave.stop(); orbit.stop(); pulse.stop(); };
  }, [waveAnim, orbitAnim, pulseAnim]);

  const waveRotate = waveAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-25deg', '0deg', '25deg'],
  });

  const orbitDeg = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={logoStyles.wrapper}>
      {/* Orbiting sparkle dots — rotate the whole ring */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { alignItems: 'center', justifyContent: 'center',
            transform: [{ rotate: orbitDeg }] },
        ]}
        pointerEvents="none">
        <View style={logoStyles.orbitRing}>
          {SPARKLE_DOTS.map((dot, i) => (
            <Text
              key={i}
              style={[logoStyles.sparkleDot, {
                top: dot.top,
                left: (dot as any).left,
                right: (dot as any).right,
                bottom: (dot as any).bottom,
              }]}>
              {dot.emoji}
            </Text>
          ))}
        </View>
      </Animated.View>

      {/* Outer pulse ring */}
      <Animated.View style={[logoStyles.outerRing, { transform: [{ scale: pulseAnim }] }]} />

      {/* Main circle */}
      <View style={logoStyles.circle}>
        {/* Waving emoji */}
        <Animated.Text
          style={[logoStyles.emoji, { transform: [{ rotate: waveRotate }] }]}>
          👋
        </Animated.Text>
      </View>
    </View>
  );
}

const logoStyles = StyleSheet.create({
  wrapper: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  outerRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  orbitRing: {
    width: 112,
    height: 112,
    position: 'relative',
  },
  sparkleDot: {
    position: 'absolute',
    fontSize: 15,
  },
  circle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 38,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export function WelcomeScreen({ navigation }: Props) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();

  const google = useButtonScale();
  const phone  = useButtonScale();
  const email  = useButtonScale();

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (e: any) {
      if (e?.code !== 'auth/cancelled') {
        setError(getAuthErrorMessage(e?.code ?? ''));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>

      {/* ── Purple hero ──────────────────────────────────── */}
      <View style={styles.hero}>
        <AnimatedLogo />
        <Text style={styles.appName}>Skincare Tracker Pro</Text>
        <Text style={styles.tagline}>Your skin, your routine</Text>
      </View>

      {/* ── White card ───────────────────────────────────── */}
      <View style={[styles.card, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.subText}>Sign in to continue your routine</Text>

        {/* Google */}
        <Animated.View style={{ transform: [{ scale: google.scale }] }}>
          <TouchableOpacity
            style={styles.googleBtn}
            activeOpacity={1}
            onPressIn={google.onPressIn}
            onPressOut={google.onPressOut}
            onPress={handleGoogle}
            disabled={googleLoading}>
            {googleLoading ? (
              <ActivityIndicator size="small" color="#8B5CF6" />
            ) : (
              <>
                <GoogleIcon />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Phone */}
        <Animated.View style={{ transform: [{ scale: phone.scale }], marginTop: 12 }}>
          <TouchableOpacity
            style={styles.outlineBtn}
            activeOpacity={1}
            onPressIn={phone.onPressIn}
            onPressOut={phone.onPressOut}
            onPress={() => navigation.navigate('PhoneAuth')}
            disabled={googleLoading}>
            <MaterialCommunityIcons name="phone-outline" size={18} color="#8B5CF6" />
            <Text style={styles.outlineBtnText}>Continue with Phone</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Email */}
        <Animated.View style={{ transform: [{ scale: email.scale }], marginTop: 12 }}>
          <TouchableOpacity
            style={styles.emailBtn}
            activeOpacity={0.85}
            onPressIn={email.onPressIn}
            onPressOut={email.onPressOut}
            onPress={() => navigation.navigate('EmailLogin')}
            disabled={googleLoading}>
            <Text style={styles.emailBtnText}>Sign in with Email</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Error banner */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* Push create-account row to bottom */}
        <View style={{ flex: 1 }} />

        {/* Create account */}
        <View style={[styles.createRow, { marginBottom: Platform.OS === 'ios' ? 0 : 8 }]}>
          <Text style={styles.newHereText}>New here?{'  '}</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('EmailRegister')}
            disabled={googleLoading}>
            <Text style={styles.createAccountText}>Create an account</Text>
          </TouchableOpacity>
        </View>
      </View>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#7C3AED',
  },

  // ── Hero ──────────────────────────────────────────────
  hero: {
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 23,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    color: '#DDD6FE',
    letterSpacing: 0.5,
    opacity: 0.9,
  },

  // ── Card ──────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
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

  // ── Buttons ───────────────────────────────────────────
  googleBtn: {
    height: 52,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9E4FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2E1065',
  },
  outlineBtn: {
    height: 52,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9E4FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  outlineBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2E1065',
  },
  emailBtn: {
    height: 52,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Error ─────────────────────────────────────────────
  errorBanner: {
    marginTop: 16,
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

  // ── Create account ────────────────────────────────────
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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

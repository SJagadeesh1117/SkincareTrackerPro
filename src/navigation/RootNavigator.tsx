import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { AuthNavigator } from './AuthNavigator';
import { RootStack } from './RootStack';
import { FaceScanPromptModal } from '../components/FaceScanPromptModal';
import { COLORS } from '../constants/theme';
import {
  loadLastScanLocally,
  loadLastScanFromFirestore,
} from '../services/scanPersistenceService';

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <View style={styles.logoCircle}>
        <Text style={styles.logoText}>STP</Text>
      </View>
      <ActivityIndicator
        size="large"
        color="rgba(255,255,255,0.9)"
        style={styles.indicator}
      />
    </View>
  );
}

// ── Hook: checks whether user has ever taken a face scan ──────────────────────

function useFaceScanCheck(isAuthenticated: boolean) {
  const [hasScan, setHasScan]   = useState<boolean | null>(null); // null = loading
  const checked = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setHasScan(null);
      checked.current = false;
      return;
    }

    // Only run once per auth session
    if (checked.current) return;
    checked.current = true;

    (async () => {
      try {
        // Check local cache first (fast)
        const local = await loadLastScanLocally();
        if (local) { setHasScan(true); return; }

        // Fall back to Firestore (catches reinstalls)
        const remote = await loadLastScanFromFirestore();
        setHasScan(!!remote);
      } catch {
        setHasScan(false);
      }
    })();
  }, [isAuthenticated]);

  return hasScan;
}

// ── RootStack wrapper with face-scan prompt ───────────────────────────────────

function AuthenticatedRoot({ isFirstLogin }: { isFirstLogin: boolean }) {
  const hasScan = useFaceScanCheck(true);
  const navigation = useNavigation<any>();
  const [modalDismissed, setModalDismissed] = useState(false);

  // Show prompt when scan check is done and no scan exists
  const showPrompt = hasScan === false && !modalDismissed;

  const handleTakeScan = () => {
    setModalDismissed(true);
    navigation.navigate('MainTabs', { screen: 'ScanTab' });
  };

  const handleSkip = () => {
    // Dismiss for this session; will reappear next app open
    setModalDismissed(true);
  };

  return (
    <>
      <RootStack />
      <FaceScanPromptModal
        visible={showPrompt}
        isFirstLogin={isFirstLogin}
        onTakeScan={handleTakeScan}
        onSkip={handleSkip}
      />
    </>
  );
}

// ── Root navigator ────────────────────────────────────────────────────────────

export function RootNavigator() {
  const { loading, isAuthenticated, isFirstLogin } = useAuth();

  if (loading) return <SplashScreen />;
  if (!isAuthenticated) return <AuthNavigator />;
  return <AuthenticatedRoot isFirstLogin={isFirstLogin} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  indicator: {
    marginTop: 8,
  },
});

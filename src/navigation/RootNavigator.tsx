import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { AuthNavigator } from './AuthNavigator';
import { DrawerNavigator } from './DrawerNavigator';

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

export function RootNavigator() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (isAuthenticated) {
    return <DrawerNavigator />;
  }

  return <AuthNavigator />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#1D9E75',
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
    marginBottom: 48,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  indicator: {
    marginTop: 8,
  },
});

/**
 * Shared test utilities for auth screen tests.
 * Provides a mock navigation prop and common setup.
 */
import React from 'react';

// ── Common native module mocks ────────────────────────────────────────────────
// These must be declared before any screen import; Jest hoists jest.mock() calls.

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => {
  const { View } = require('react-native');
  return ({ testID }: any) => <View testID={testID || 'icon'} />;
});

jest.mock('react-native-paper', () => {
  const RN = require('react-native');
  const PaperTextInput = ({ label, value, onChangeText, right, error, testID, ...rest }: any) => (
    <RN.View testID={`input-${label?.toLowerCase().replace(/\s/g, '-')}`}>
      <RN.TextInput
        testID={testID ?? `field-${label?.toLowerCase().replace(/\s/g, '-')}`}
        value={value}
        onChangeText={onChangeText}
        {...rest}
      />
      {right ?? null}
    </RN.View>
  );
  PaperTextInput.Icon = ({ icon, onPress, testID }: any) => (
    <RN.TouchableOpacity testID={testID ?? `icon-${icon}`} onPress={onPress}>
      <RN.Text>{icon}</RN.Text>
    </RN.TouchableOpacity>
  );

  const Button = ({ children, onPress, loading, disabled, testID, ...rest }: any) => (
    <RN.TouchableOpacity
      testID={testID ?? `btn-${String(children).replace(/\s/g, '-').toLowerCase()}`}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading
        ? <RN.ActivityIndicator testID="loading-indicator" />
        : <RN.Text>{children}</RN.Text>}
    </RN.TouchableOpacity>
  );

  return { TextInput: PaperTextInput, Button };
});

// ── Navigation mock factory ───────────────────────────────────────────────────
export function buildNavigation() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    reset: jest.fn(),
    setOptions: jest.fn(),
    dispatch: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
    isFocused: jest.fn().mockReturnValue(true),
    addListener: jest.fn().mockReturnValue(jest.fn()),
    removeListener: jest.fn(),
  };
}

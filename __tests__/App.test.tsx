/**
 * App smoke test — verifies the top-level wrapper renders without crashing.
 * Navigation internals are mocked so we're not testing React Navigation here.
 */

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-paper', () => ({
  PaperProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

// Stub out all navigation so no screen or Firebase code is loaded
jest.mock('../src/navigation', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    RootNavigator: () => React.createElement(View, { testID: 'root-navigator' }),
  };
});

import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../App';

describe('App', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('root-navigator')).toBeTruthy();
  });
});

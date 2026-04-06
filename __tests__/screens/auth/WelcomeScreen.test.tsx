import './testUtils';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { WelcomeScreen } from '../../../src/screens/auth/WelcomeScreen';
import * as authService from '../../../src/services/authService';
import { buildNavigation } from './testUtils';

jest.mock('../../../src/services/authService', () => ({
  signInWithGoogle: jest.fn(),
  getAuthErrorMessage: jest.fn((code: string) => `Error: ${code}`),
}));

const mockSignInWithGoogle = authService.signInWithGoogle as jest.MockedFunction<typeof authService.signInWithGoogle>;

describe('WelcomeScreen', () => {
  let navigation: ReturnType<typeof buildNavigation>;

  beforeEach(() => {
    navigation = buildNavigation();
    jest.clearAllMocks();
  });

  const renderScreen = () =>
    render(<WelcomeScreen navigation={navigation as any} />);

  it('renders the logo text', () => {
    const { getByText } = renderScreen();
    expect(getByText('STP')).toBeTruthy();
  });

  it('renders the app name and tagline', () => {
    const { getByText } = renderScreen();
    expect(getByText('Skincare Tracker Pro')).toBeTruthy();
    expect(getByText('Your skin, your routine')).toBeTruthy();
  });

  it('renders all three buttons', () => {
    const { getByText } = renderScreen();
    expect(getByText('Continue with Google')).toBeTruthy();
    expect(getByText('Continue with Phone')).toBeTruthy();
    expect(getByText('Sign in with Email')).toBeTruthy();
  });

  it('renders "Create account" link', () => {
    const { getByText } = renderScreen();
    expect(getByText('Create account')).toBeTruthy();
  });

  it('"Sign in with Email" navigates to EmailLogin', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Sign in with Email'));
    expect(navigation.navigate).toHaveBeenCalledWith('EmailLogin');
  });

  it('"Continue with Phone" navigates to PhoneAuth', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Continue with Phone'));
    expect(navigation.navigate).toHaveBeenCalledWith('PhoneAuth');
  });

  it('"Create account" navigates to EmailRegister', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Create account'));
    expect(navigation.navigate).toHaveBeenCalledWith('EmailRegister');
  });

  it('"Continue with Google" calls signInWithGoogle', async () => {
    mockSignInWithGoogle.mockResolvedValueOnce(undefined as any);
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Continue with Google'));
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
  });

  it('shows error banner when Google sign-in fails', async () => {
    mockSignInWithGoogle.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Continue with Google'));
    await waitFor(() =>
      expect(getByText('Error: auth/network-request-failed')).toBeTruthy(),
    );
  });

  it('does NOT show error banner when Google sign-in is cancelled', async () => {
    mockSignInWithGoogle.mockRejectedValueOnce({ code: 'auth/cancelled' });
    const { getByText, queryByText } = renderScreen();
    fireEvent.press(getByText('Continue with Google'));
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalled());
    expect(queryByText(/^Error:/)).toBeNull();
  });
});

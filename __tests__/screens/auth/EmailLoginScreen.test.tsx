import './testUtils';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { EmailLoginScreen } from '../../../src/screens/auth/EmailLoginScreen';
import * as authService from '../../../src/services/authService';
import { buildNavigation } from './testUtils';

jest.mock('../../../src/services/authService', () => ({
  signInWithEmail: jest.fn(),
  getAuthErrorMessage: jest.fn((code: string) => `Error: ${code}`),
}));

const mockSignIn = authService.signInWithEmail as jest.MockedFunction<
  typeof authService.signInWithEmail
>;

describe('EmailLoginScreen', () => {
  let navigation: ReturnType<typeof buildNavigation>;

  beforeEach(() => {
    navigation = buildNavigation();
    jest.clearAllMocks();
  });

  const renderScreen = () =>
    render(<EmailLoginScreen navigation={navigation as any} />);

  it('renders email and password fields', () => {
    const { getByText } = renderScreen();
    expect(getByText('Welcome back')).toBeTruthy();
    expect(getByText('Sign in to your account')).toBeTruthy();
  });

  it('renders Sign in button', () => {
    const { getByText } = renderScreen();
    expect(getByText('Sign in')).toBeTruthy();
  });

  it('renders Forgot password link', () => {
    const { getByText } = renderScreen();
    expect(getByText('Forgot password?')).toBeTruthy();
  });

  it('shows error when email is empty on submit', async () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Sign in'));
    await waitFor(() => expect(getByText('Email is required')).toBeTruthy());
  });

  it('shows error when email format is invalid', async () => {
    const { getByTestId, getByText } = renderScreen();
    fireEvent.changeText(getByTestId('field-email'), 'notanemail');
    fireEvent.press(getByText('Sign in'));
    await waitFor(() =>
      expect(getByText('Enter a valid email address')).toBeTruthy(),
    );
  });

  it('shows error when password is empty', async () => {
    const { getByTestId, getByText } = renderScreen();
    fireEvent.changeText(getByTestId('field-email'), 'test@example.com');
    fireEvent.press(getByText('Sign in'));
    await waitFor(() => expect(getByText('Password is required')).toBeTruthy());
  });

  it('calls signInWithEmail with trimmed credentials when form is valid', async () => {
    mockSignIn.mockResolvedValueOnce(undefined as any);
    const { getByTestId, getByText } = renderScreen();
    fireEvent.changeText(getByTestId('field-email'), '  user@test.com  ');
    fireEvent.changeText(getByTestId('field-password'), 'secret123');
    fireEvent.press(getByText('Sign in'));
    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('user@test.com', 'secret123'),
    );
  });

  it('shows server error message when sign-in fails', async () => {
    mockSignIn.mockRejectedValueOnce({ code: 'auth/wrong-password' });
    const { getByTestId, getByText } = renderScreen();
    fireEvent.changeText(getByTestId('field-email'), 'user@test.com');
    fireEvent.changeText(getByTestId('field-password'), 'wrongpass');
    fireEvent.press(getByText('Sign in'));
    await waitFor(() =>
      expect(getByText('Error: auth/wrong-password')).toBeTruthy(),
    );
  });

  it('"Forgot password?" navigates to ForgotPassword', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Forgot password?'));
    expect(navigation.navigate).toHaveBeenCalledWith('ForgotPassword');
  });

  it('"Create one" link navigates to EmailRegister', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Create one'));
    expect(navigation.navigate).toHaveBeenCalledWith('EmailRegister');
  });
});

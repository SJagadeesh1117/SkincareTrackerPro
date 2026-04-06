import './testUtils';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ForgotPasswordScreen } from '../../../src/screens/auth/ForgotPasswordScreen';
import * as authService from '../../../src/services/authService';
import { buildNavigation } from './testUtils';

jest.mock('../../../src/services/authService', () => ({
  sendPasswordReset: jest.fn(),
  getAuthErrorMessage: jest.fn((code: string) => `Error: ${code}`),
}));

const mockSendReset = authService.sendPasswordReset as jest.MockedFunction<
  typeof authService.sendPasswordReset
>;

describe('ForgotPasswordScreen', () => {
  let navigation: ReturnType<typeof buildNavigation>;

  beforeEach(() => {
    navigation = buildNavigation();
    jest.clearAllMocks();
  });

  const renderScreen = () =>
    render(<ForgotPasswordScreen navigation={navigation as any} />);

  it('renders the heading and description', () => {
    const { getByText } = renderScreen();
    expect(getByText('Reset password')).toBeTruthy();
    expect(
      getByText(/Enter the email address associated with your account/),
    ).toBeTruthy();
  });

  it('renders "Send reset link" button', () => {
    const { getByText } = renderScreen();
    expect(getByText('Send reset link')).toBeTruthy();
  });

  it('shows error when email is empty', async () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Send reset link'));
    await waitFor(() => expect(getByText('Email is required')).toBeTruthy());
  });

  it('shows error for invalid email format', async () => {
    const { getByTestId, getByText } = renderScreen();
    fireEvent.changeText(getByTestId('field-email'), 'notvalid');
    fireEvent.press(getByText('Send reset link'));
    await waitFor(() =>
      expect(getByText('Enter a valid email address')).toBeTruthy(),
    );
  });

  it('calls sendPasswordReset with trimmed email', async () => {
    mockSendReset.mockResolvedValueOnce(undefined as any);
    const { getByTestId, getByText } = renderScreen();
    fireEvent.changeText(getByTestId('field-email'), '  user@example.com  ');
    fireEvent.press(getByText('Send reset link'));
    await waitFor(() =>
      expect(mockSendReset).toHaveBeenCalledWith('user@example.com'),
    );
  });

  it('shows success state after reset link is sent', async () => {
    mockSendReset.mockResolvedValueOnce(undefined as any);
    const { getByTestId, getByText } = renderScreen();
    fireEvent.changeText(getByTestId('field-email'), 'user@example.com');
    fireEvent.press(getByText('Send reset link'));
    await waitFor(() => expect(getByText('Check your inbox')).toBeTruthy());
  });

  it('shows the email address in the success message', async () => {
    mockSendReset.mockResolvedValueOnce(undefined as any);
    const { getByTestId, getByText } = renderScreen();
    fireEvent.changeText(getByTestId('field-email'), 'user@example.com');
    fireEvent.press(getByText('Send reset link'));
    await waitFor(() =>
      expect(getByText('user@example.com')).toBeTruthy(),
    );
  });

  it('"Try a different email" resets success state', async () => {
    mockSendReset.mockResolvedValueOnce(undefined as any);
    const { getByTestId, getByText } = renderScreen();
    fireEvent.changeText(getByTestId('field-email'), 'user@example.com');
    fireEvent.press(getByText('Send reset link'));
    await waitFor(() => expect(getByText('Check your inbox')).toBeTruthy());
    fireEvent.press(getByText('Try a different email'));
    await waitFor(() => expect(getByText('Reset password')).toBeTruthy());
  });

  it('shows server error when reset fails', async () => {
    mockSendReset.mockRejectedValueOnce({ code: 'auth/user-not-found' });
    const { getByTestId, getByText } = renderScreen();
    fireEvent.changeText(getByTestId('field-email'), 'nobody@example.com');
    fireEvent.press(getByText('Send reset link'));
    await waitFor(() =>
      expect(getByText('Error: auth/user-not-found')).toBeTruthy(),
    );
  });
});

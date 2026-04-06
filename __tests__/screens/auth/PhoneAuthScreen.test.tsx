import './testUtils';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PhoneAuthScreen } from '../../../src/screens/auth/PhoneAuthScreen';
import * as authService from '../../../src/services/authService';
import { buildNavigation } from './testUtils';

jest.mock('../../../src/services/authService', () => ({
  sendPhoneOTP: jest.fn(),
  getAuthErrorMessage: jest.fn((code: string) => `Error: ${code}`),
}));

const mockSendOTP = authService.sendPhoneOTP as jest.MockedFunction<
  typeof authService.sendPhoneOTP
>;

describe('PhoneAuthScreen', () => {
  let navigation: ReturnType<typeof buildNavigation>;

  beforeEach(() => {
    navigation = buildNavigation();
    jest.clearAllMocks();
  });

  const renderScreen = () =>
    render(<PhoneAuthScreen navigation={navigation as any} />);

  it('renders the heading', () => {
    const { getByText } = renderScreen();
    expect(getByText('Enter your phone number')).toBeTruthy();
  });

  it('renders "Send OTP" button', () => {
    const { getByText } = renderScreen();
    expect(getByText('Send OTP')).toBeTruthy();
  });

  it('defaults to India (+91) as selected country', () => {
    const { getByText } = renderScreen();
    expect(getByText('+91')).toBeTruthy();
  });

  it('shows India flag emoji by default', () => {
    const { getByText } = renderScreen();
    // Flag emoji for IN
    expect(getByText('\uD83C\uDDEE\uD83C\uDDF3')).toBeTruthy();
  });

  it('shows error when phone number is empty', async () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Send OTP'));
    await waitFor(() =>
      expect(getByText('Enter a valid phone number')).toBeTruthy(),
    );
  });

  it('shows error when phone number is too short', async () => {
    const { getByText, getByPlaceholderText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText('Phone number'), '123');
    fireEvent.press(getByText('Send OTP'));
    await waitFor(() =>
      expect(getByText('Enter a valid phone number')).toBeTruthy(),
    );
  });

  it('calls sendPhoneOTP with dial code + number on valid input', async () => {
    mockSendOTP.mockResolvedValueOnce(undefined as any);
    const { getByText, getByPlaceholderText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText('Phone number'), '9876543210');
    fireEvent.press(getByText('Send OTP'));
    await waitFor(() =>
      expect(mockSendOTP).toHaveBeenCalledWith('+919876543210'),
    );
  });

  it('navigates to OTP screen after successful sendPhoneOTP', async () => {
    mockSendOTP.mockResolvedValueOnce(undefined as any);
    const { getByText, getByPlaceholderText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText('Phone number'), '9876543210');
    fireEvent.press(getByText('Send OTP'));
    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith('OTP', {
        phoneNumber: '+919876543210',
      }),
    );
  });

  it('shows error when sendPhoneOTP fails', async () => {
    mockSendOTP.mockRejectedValueOnce({ code: 'auth/invalid-phone-number' });
    const { getByText, getByPlaceholderText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText('Phone number'), '0000000000');
    fireEvent.press(getByText('Send OTP'));
    await waitFor(() =>
      expect(getByText('Error: auth/invalid-phone-number')).toBeTruthy(),
    );
  });

  it('only allows numeric input in phone field', () => {
    const { getByPlaceholderText } = renderScreen();
    const input = getByPlaceholderText('Phone number');
    fireEvent.changeText(input, 'abc123def');
    // The screen strips non-numeric characters
    expect(input.props.value).toBe('123');
  });
});

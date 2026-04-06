import './testUtils';
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

/** Advance fake timers by `seconds` ticks, letting React process state updates between each. */
async function tickSeconds(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    await act(async () => { jest.advanceTimersByTime(1000); });
  }
}
import { OTPScreen } from '../../../src/screens/auth/OTPScreen';
import * as authService from '../../../src/services/authService';
import { buildNavigation } from './testUtils';

jest.mock('../../../src/services/authService', () => ({
  verifyOTP: jest.fn(),
  sendPhoneOTP: jest.fn(),
  getStoredConfirmation: jest.fn(),
  getAuthErrorMessage: jest.fn((code: string) => `Error: ${code}`),
}));

const mockVerifyOTP = authService.verifyOTP as jest.MockedFunction<
  typeof authService.verifyOTP
>;
const mockSendPhoneOTP = authService.sendPhoneOTP as jest.MockedFunction<
  typeof authService.sendPhoneOTP
>;
const mockGetStoredConfirmation =
  authService.getStoredConfirmation as jest.MockedFunction<
    typeof authService.getStoredConfirmation
  >;

const PHONE = '+911234567890';
const MOCK_CONFIRMATION = { confirm: jest.fn() } as any;

describe('OTPScreen', () => {
  let navigation: ReturnType<typeof buildNavigation>;

  beforeEach(() => {
    navigation = buildNavigation();
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetStoredConfirmation.mockReturnValue(MOCK_CONFIRMATION);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderScreen = () =>
    render(
      <OTPScreen
        navigation={navigation as any}
        route={{ key: 'OTP', name: 'OTP', params: { phoneNumber: PHONE } } as any}
      />,
    );

  it('renders the heading', () => {
    const { getByText } = renderScreen();
    expect(getByText('Enter verification code')).toBeTruthy();
  });

  it('renders the phone number in the subtitle', () => {
    const { getByText } = renderScreen();
    expect(getByText(PHONE)).toBeTruthy();
  });

  it('renders 6 OTP input boxes', () => {
    const { getAllByDisplayValue } = renderScreen();
    // All boxes start empty
    const empties = getAllByDisplayValue('');
    expect(empties.length).toBe(6);
  });

  it('resend button is disabled initially', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Resend OTP in/)).toBeTruthy();
  });

  it('shows countdown timer starting at 30', () => {
    const { getByText } = renderScreen();
    expect(getByText(/30s/)).toBeTruthy();
  });

  it('enables resend button after 30 seconds', async () => {
    const { getByText } = renderScreen();
    await tickSeconds(30);
    await waitFor(() => expect(getByText('Resend OTP')).toBeTruthy());
  });

  it('shows session-expired error when confirmation is null', async () => {
    mockGetStoredConfirmation.mockReturnValue(null);
    const { getAllByDisplayValue, getByText } = renderScreen();
    const boxes = getAllByDisplayValue('');
    // Fill all 6 boxes to trigger auto-submit
    ['1', '2', '3', '4', '5', '6'].forEach((d, i) => {
      fireEvent.changeText(boxes[i], d);
    });
    await waitFor(() =>
      expect(
        getByText('Session expired. Please go back and request a new OTP.'),
      ).toBeTruthy(),
    );
  });

  it('calls verifyOTP with the 6-digit code on auto-submit', async () => {
    mockVerifyOTP.mockResolvedValueOnce(null);
    const { getAllByDisplayValue } = renderScreen();
    const boxes = getAllByDisplayValue('');
    ['1', '2', '3', '4', '5', '6'].forEach((d, i) => {
      fireEvent.changeText(boxes[i], d);
    });
    await waitFor(() =>
      expect(mockVerifyOTP).toHaveBeenCalledWith(MOCK_CONFIRMATION, '123456'),
    );
  });

  it('shows OTP error when verifyOTP rejects', async () => {
    mockVerifyOTP.mockRejectedValueOnce({ code: 'auth/invalid-verification-code' });
    const { getAllByDisplayValue, getByText } = renderScreen();
    const boxes = getAllByDisplayValue('');
    ['1', '2', '3', '4', '5', '6'].forEach((d, i) => {
      fireEvent.changeText(boxes[i], d);
    });
    await waitFor(() =>
      expect(
        getByText('Error: auth/invalid-verification-code'),
      ).toBeTruthy(),
    );
  });

  it('calls sendPhoneOTP again when resend is pressed', async () => {
    mockSendPhoneOTP.mockResolvedValueOnce(undefined as any);
    const { getByText } = renderScreen();
    await tickSeconds(30);
    await waitFor(() => expect(getByText('Resend OTP')).toBeTruthy());
    fireEvent.press(getByText('Resend OTP'));
    await waitFor(() =>
      expect(mockSendPhoneOTP).toHaveBeenCalledWith(PHONE),
    );
  });

  it('resets timer after resend', async () => {
    mockSendPhoneOTP.mockResolvedValueOnce(undefined as any);
    const { getByText } = renderScreen();
    await tickSeconds(30);
    await waitFor(() => expect(getByText('Resend OTP')).toBeTruthy());
    fireEvent.press(getByText('Resend OTP'));
    await waitFor(() => expect(getByText(/30s/)).toBeTruthy());
  });
});

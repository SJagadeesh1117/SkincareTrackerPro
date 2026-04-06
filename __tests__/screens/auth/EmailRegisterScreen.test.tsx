import './testUtils';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { EmailRegisterScreen } from '../../../src/screens/auth/EmailRegisterScreen';
import * as authService from '../../../src/services/authService';
import { buildNavigation } from './testUtils';

jest.mock('../../../src/services/authService', () => ({
  createAccount: jest.fn(),
  getAuthErrorMessage: jest.fn((code: string) => `Error: ${code}`),
}));

const mockCreateAccount = authService.createAccount as jest.MockedFunction<
  typeof authService.createAccount
>;

describe('EmailRegisterScreen', () => {
  let navigation: ReturnType<typeof buildNavigation>;

  beforeEach(() => {
    navigation = buildNavigation();
    jest.clearAllMocks();
  });

  const renderScreen = () =>
    render(<EmailRegisterScreen navigation={navigation as any} />);

  const fillForm = (
    utils: ReturnType<typeof render>,
    overrides: Partial<{
      name: string;
      email: string;
      password: string;
      confirm: string;
    }> = {},
  ) => {
    const values = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'Password1!',
      confirm: 'Password1!',
      ...overrides,
    };
    fireEvent.changeText(utils.getByTestId('field-full-name'), values.name);
    fireEvent.changeText(utils.getByTestId('field-email'), values.email);
    fireEvent.changeText(utils.getByTestId('field-password'), values.password);
    fireEvent.changeText(
      utils.getByTestId('field-confirm-password'),
      values.confirm,
    );
  };

  it('renders the heading', () => {
    const { getAllByText } = renderScreen();
    // Both heading <Text> and submit <Button> contain "Create account"
    expect(getAllByText('Create account').length).toBeGreaterThanOrEqual(1);
  });

  it('shows error when name is empty', async () => {
    const utils = renderScreen();
    fillForm(utils, { name: '' });
    fireEvent.press(utils.getByTestId('btn-create-account'));
    await waitFor(() =>
      expect(utils.getByText('Full name is required')).toBeTruthy(),
    );
  });

  it('shows error for invalid email', async () => {
    const utils = renderScreen();
    fillForm(utils, { email: 'bad-email' });
    fireEvent.press(utils.getByTestId('btn-create-account'));
    await waitFor(() =>
      expect(utils.getByText('Enter a valid email address')).toBeTruthy(),
    );
  });

  it('shows error when password is shorter than 8 chars', async () => {
    const utils = renderScreen();
    fillForm(utils, { password: 'short', confirm: 'short' });
    fireEvent.press(utils.getByTestId('btn-create-account'));
    await waitFor(() =>
      expect(
        utils.getByText('Password must be at least 8 characters'),
      ).toBeTruthy(),
    );
  });

  it('shows error when passwords do not match', async () => {
    const utils = renderScreen();
    fillForm(utils, { password: 'Password1!', confirm: 'Different1!' });
    fireEvent.press(utils.getByTestId('btn-create-account'));
    await waitFor(() =>
      expect(utils.getByText('Passwords do not match')).toBeTruthy(),
    );
  });

  it('shows "Weak" strength for a short password', () => {
    const utils = renderScreen();
    fireEvent.changeText(utils.getByTestId('field-password'), 'abc');
    expect(utils.getByText('Weak')).toBeTruthy();
  });

  it('shows "Medium" strength for a moderate password', () => {
    const utils = renderScreen();
    fireEvent.changeText(utils.getByTestId('field-password'), 'abcABC1');
    expect(utils.getByText('Medium')).toBeTruthy();
  });

  it('shows "Strong" strength for a complex password', () => {
    const utils = renderScreen();
    fireEvent.changeText(utils.getByTestId('field-password'), 'Secure#9Word');
    expect(utils.getByText('Strong')).toBeTruthy();
  });

  it('calls createAccount with correct args on valid submission', async () => {
    mockCreateAccount.mockResolvedValueOnce(undefined as any);
    const utils = renderScreen();
    fillForm(utils);
    fireEvent.press(utils.getByTestId('btn-create-account'));
    await waitFor(() =>
      expect(mockCreateAccount).toHaveBeenCalledWith(
        'Jane Doe',
        'jane@example.com',
        'Password1!',
      ),
    );
  });

  it('shows server error on createAccount failure', async () => {
    mockCreateAccount.mockRejectedValueOnce({ code: 'auth/email-already-in-use' });
    const utils = renderScreen();
    fillForm(utils);
    fireEvent.press(utils.getByTestId('btn-create-account'));
    await waitFor(() =>
      expect(utils.getByText('Error: auth/email-already-in-use')).toBeTruthy(),
    );
  });
});

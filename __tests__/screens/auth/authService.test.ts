/**
 * Unit tests for the pure helper `getAuthErrorMessage`.
 * All Firebase/Google deps are mocked via moduleNameMapper in jest.config.js.
 */
import { getAuthErrorMessage } from '../../../src/services/authService';

describe('getAuthErrorMessage', () => {
  it('returns a user-friendly message for known error codes', () => {
    expect(getAuthErrorMessage('auth/wrong-password')).toMatch(/incorrect password/i);
    expect(getAuthErrorMessage('auth/user-not-found')).toMatch(/no account/i);
    expect(getAuthErrorMessage('auth/email-already-in-use')).toMatch(/already exists/i);
    expect(getAuthErrorMessage('auth/too-many-requests')).toMatch(/too many/i);
    expect(getAuthErrorMessage('auth/invalid-phone-number')).toMatch(/phone number/i);
    expect(getAuthErrorMessage('auth/invalid-verification-code')).toMatch(/otp|incorrect/i);
    expect(getAuthErrorMessage('auth/network-request-failed')).toMatch(/network|connection/i);
  });

  it('returns a generic fallback for unknown codes', () => {
    expect(getAuthErrorMessage('auth/unknown-error')).toMatch(/something went wrong/i);
    expect(getAuthErrorMessage('')).toMatch(/something went wrong/i);
  });
});

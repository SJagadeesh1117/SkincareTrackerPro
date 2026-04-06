const GoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn().mockResolvedValue(true),
  signIn: jest.fn().mockResolvedValue({ type: 'success', data: { idToken: 'mock-id-token' } }),
  signOut: jest.fn().mockResolvedValue(undefined),
  isSignedIn: jest.fn().mockReturnValue(false),
  getCurrentUser: jest.fn().mockReturnValue(null),
};

module.exports = { GoogleSignin };

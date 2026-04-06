const mockConfirmation = {
  confirm: jest.fn().mockResolvedValue({ user: { uid: 'test-uid' } }),
};

const mockAuth = {
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({ user: { uid: 'test-uid' } }),
  createUserWithEmailAndPassword: jest.fn().mockResolvedValue({ user: { uid: 'test-uid', updateProfile: jest.fn() } }),
  signInWithCredential: jest.fn().mockResolvedValue({ user: { uid: 'test-uid' } }),
  signInWithPhoneNumber: jest.fn().mockResolvedValue(mockConfirmation),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  signOut: jest.fn().mockResolvedValue(undefined),
  currentUser: null,
  GoogleAuthProvider: {
    credential: jest.fn().mockReturnValue({ providerId: 'google.com' }),
  },
  onAuthStateChanged: jest.fn().mockReturnValue(jest.fn()),
};

const authModule = jest.fn(() => mockAuth);
authModule.GoogleAuthProvider = mockAuth.GoogleAuthProvider;

module.exports = authModule;
module.exports.default = authModule;

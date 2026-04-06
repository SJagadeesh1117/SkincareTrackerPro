module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      'react-native' +
      '|@react-native(?!-firebase|-google-signin)' +
      '|@react-navigation' +
      '|react-native-paper' +
      '|react-native-vector-icons' +
      '|react-native-safe-area-context' +
      '|react-native-screens' +
      '|react-native-reanimated' +
      '|react-native-modal' +
      '|@expo' +
      ')/)',
  ],
  moduleNameMapper: {
    // Native module stubs
    'react-native-vector-icons/(.*)':
      '<rootDir>/__mocks__/react-native-vector-icons.js',
    '^react-native-gesture-handler$':
      '<rootDir>/__mocks__/react-native-gesture-handler.js',
    // Firebase stubs (ESM packages that need native bridge)
    '^@react-native-firebase/auth$':
      '<rootDir>/__mocks__/@react-native-firebase/auth.js',
    '^@react-native-firebase/app$':
      '<rootDir>/__mocks__/@react-native-firebase/app.js',
    '^@react-native-firebase/firestore$':
      '<rootDir>/__mocks__/@react-native-firebase/firestore.js',
    '^@react-native-firebase/(.*)$':
      '<rootDir>/__mocks__/@react-native-firebase/app.js',
    '^@react-native-google-signin/google-signin$':
      '<rootDir>/__mocks__/@react-native-google-signin/google-signin.js',
  },
  // Exclude shared test helpers from being run as test suites
  testPathIgnorePatterns: ['/node_modules/', 'testUtils\\.tsx?$'],
};

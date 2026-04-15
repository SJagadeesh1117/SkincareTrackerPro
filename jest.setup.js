/* eslint-env jest */
// Gesture handler native mock
import 'react-native-gesture-handler/jestSetup';

// Silence the warning: Animated: `useNativeDriver` is not supported
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => {
  const { View } = require('react-native');
  const Icon = ({ testID, ...props }) => <View testID={testID || 'mock-icon'} {...props} />;
  return Icon;
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children(inset),
    SafeAreaView: ({ children, ...props }) => <View {...props}>{children}</View>,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    NavigationContainer: ({ children }) => children,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
    }),
    useRoute: () => ({ params: {}, name: '' }),
  };
});

// Mock @react-navigation/stack
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: ({ component: Component, ...props }) => {
      const { View } = require('react-native');
      return <View />;
    },
  }),
  StackNavigationProp: {},
  TransitionPresets: {},
  CardStyleInterpolators: {},
  HeaderStyleInterpolators: {},
  TransitionSpecs: {},
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

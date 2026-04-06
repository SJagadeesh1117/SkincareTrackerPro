const React = require('react');
const { View, ScrollView, TextInput, TouchableOpacity, TouchableHighlight, TouchableNativeFeedback, TouchableWithoutFeedback } = require('react-native');

const passthrough = ({ children }) => children ?? null;

module.exports = {
  GestureHandlerRootView: passthrough,
  Swipeable: passthrough,
  DrawerLayout: passthrough,
  State: {},
  PanGestureHandler: passthrough,
  TapGestureHandler: passthrough,
  FlingGestureHandler: passthrough,
  LongPressGestureHandler: passthrough,
  NativeViewGestureHandler: passthrough,
  PinchGestureHandler: passthrough,
  RotationGestureHandler: passthrough,
  ForceTouchGestureHandler: passthrough,
  ScrollView,
  TextInput,
  TouchableHighlight,
  TouchableNativeFeedback,
  TouchableOpacity,
  TouchableWithoutFeedback,
  gestureHandlerRootHOC: (component) => component,
  Directions: {},
};

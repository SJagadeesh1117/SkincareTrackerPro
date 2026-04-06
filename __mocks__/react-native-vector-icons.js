const React = require('react');
const { View } = require('react-native');
const Icon = (props) => React.createElement(View, { testID: props.testID || 'icon', ...props });
Icon.Button = Icon;
module.exports = Icon;
module.exports.default = Icon;

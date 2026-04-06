const mockApp = {
  name: '[DEFAULT]',
  options: {},
};
const firebase = jest.fn(() => mockApp);
firebase.apps = [mockApp];
firebase.app = jest.fn(() => mockApp);
module.exports = firebase;
module.exports.default = firebase;

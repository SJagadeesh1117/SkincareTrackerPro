/**
 * react-native.config.js
 *
 * Disables native Android autolinking for firebase packages whose generated
 * C++ source paths exceed the Windows MAX_PATH (260 chars) limit.
 * The JS/TS imports still work; these packages will be re-enabled once the
 * project is either moved to a shorter path or long-path support is enabled.
 *
 * Affected packages:
 *   @react-native-firebase/functions  — 264 chars
 *   @react-native-firebase/firestore  — 264 chars
 *   @react-native-firebase/messaging  — 264 chars
 */
module.exports = {
  dependencies: {
    // Long-path workaround: build from C:\stp (junction to this project).
    // All three packages are re-enabled — paths are safe from C:\stp.
  },
};

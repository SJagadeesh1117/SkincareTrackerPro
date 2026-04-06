// Firebase auto-initialises from google-services.json (already at android/app/google-services.json).
//
// Project:       skincare-routine-4d8e1
// Package name:  com.jagadeesh.skincaretracker
//
// For iOS: download GoogleService-Info.plist from Firebase console and place it at
//   ios/SkincareTrackerPro/GoogleService-Info.plist
//   Then add the REVERSED_CLIENT_ID URL scheme to ios/SkincareTrackerPro/Info.plist.
//
// No manual initializeApp() call is needed — @react-native-firebase/app handles it automatically
// from google-services.json on Android and GoogleService-Info.plist on iOS.

import firebase from '@react-native-firebase/app';
import firestore from '@react-native-firebase/firestore';

// Enable Firestore offline persistence so writes are queued automatically
// when the device is offline and flushed on reconnect.
//
// NOTE: The native Firestore module is currently disabled on Android builds
// (Windows MAX_PATH constraint — see react-native.config.js). These calls
// will throw and be silently swallowed. Re-enable by moving the project to
// a shorter path (≤ 200 chars) and removing the firestore override in
// react-native.config.js + re-enabling the Gradle dependency.
try {
  firestore()
    .settings({ persistence: true })
    .catch(() => {
      // Silently ignore: settings() must be called before any other Firestore
      // operation; if the module is unavailable this will throw here instead.
    });
} catch {
  // Native module not loaded — Firestore is disabled for this build.
}

export default firebase;

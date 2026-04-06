/**
 * authService.ts — Firebase Authentication via @react-native-firebase/auth
 *
 * ─── SETUP CHECKLIST ────────────────────────────────────────────────────────
 *
 * 1. google-services.json (Android)
 *    • Firebase console → Project settings → Your apps → Android app
 *    • Download google-services.json → place at android/app/google-services.json
 *    Required keys inside the file:
 *      "project_info.project_id"                         — Firebase project ID
 *      "client[0].client_info.mobilesdk_app_id"          — Android App ID
 *      "client[0].oauth_client[].client_id" (type 3)     — Web OAuth client ID
 *      "client[0].api_key[0].current_key"                — Android API key
 *
 * 2. GoogleService-Info.plist (iOS)
 *    • Firebase console → Project settings → Your apps → iOS app
 *    • Download GoogleService-Info.plist → place at ios/SkincareTrackerPro/GoogleService-Info.plist
 *    • Add REVERSED_CLIENT_ID as a URL scheme in ios/SkincareTrackerPro/Info.plist:
 *
 *      <key>CFBundleURLTypes</key>
 *      <array>
 *        <dict>
 *          <key>CFBundleURLSchemes</key>
 *          <array>
 *            <string>com.googleusercontent.apps.YOUR_REVERSED_CLIENT_ID</string>
 *          </array>
 *        </dict>
 *      </array>
 *
 *    The REVERSED_CLIENT_ID is in GoogleService-Info.plist under key REVERSED_CLIENT_ID
 *    (e.g. com.googleusercontent.apps.123456789-abcdefghij).
 *
 * 3. SHA fingerprints (Android — required for Google Sign-In & Phone Auth)
 *    Run from the project root:
 *      cd android && ./gradlew signingReport
 *    Locate the "debug" variant block and copy:
 *      SHA1:    AA:BB:CC:DD:...
 *      SHA-256: AA:BB:CC:DD:...
 *    Then: Firebase console → Project settings → Your apps → Android app
 *          → Add fingerprint → paste SHA-1 → Save, then repeat for SHA-256.
 *
 * 4. webClientId for GoogleSignin.configure()
 *    Firebase console → Project settings → Your apps → look for the Web app,
 *    OR: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs
 *        → find the entry with type "Web application" → copy its Client ID.
 *    It looks like: 123456789-abcdefghij.apps.googleusercontent.com
 *    Paste it as WEB_CLIENT_ID below.
 * ────────────────────────────────────────────────────────────────────────────
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// ─── Web Client ID (OAuth client type 3 from google-services.json) ───────────
const WEB_CLIENT_ID =
  '213529858076-8iv5ms10imo1j1mqanbv8pvlk8sh6ghn.apps.googleusercontent.com';

// Configure once at module load — safe to call multiple times (idempotent)
GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });

// ─── Phone auth confirmation store ───────────────────────────────────────────
// ConfirmationResult is a class instance; it cannot be serialised into nav params.
let _phoneConfirmation: FirebaseAuthTypes.ConfirmationResult | null = null;

export function getStoredConfirmation(): FirebaseAuthTypes.ConfirmationResult | null {
  return _phoneConfirmation;
}

// ─── Error message map ────────────────────────────────────────────────────────
const ERROR_MESSAGES: Record<string, string> = {
  'auth/wrong-password': 'Incorrect password. Try again or reset it below.',
  'auth/user-not-found': 'No account found with this email address.',
  'auth/email-already-in-use': 'An account already exists with this email.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes.',
  'auth/invalid-phone-number':
    'Please enter a valid phone number with country code.',
  'auth/invalid-verification-code':
    'Incorrect OTP. Please check your SMS and retry.',
  'auth/network-request-failed':
    'No internet connection. Please check your network.',
};

export function getAuthErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.';
}

// ─── Auth functions ───────────────────────────────────────────────────────────

/** Google Sign-In → Firebase credential → signInWithCredential */
export async function signInWithGoogle(): Promise<FirebaseAuthTypes.UserCredential> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  // v13+ returns { type: 'success' | 'cancelled', data: { idToken, ... } }
  if (result.type === 'cancelled') {
    throw Object.assign(new Error('Google sign-in cancelled'), {
      code: 'auth/cancelled',
    });
  }
  const credential = auth.GoogleAuthProvider.credential(result.data.idToken);
  return auth().signInWithCredential(credential);
}

/** Email + password sign-in */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<FirebaseAuthTypes.UserCredential> {
  return auth().signInWithEmailAndPassword(email, password);
}

/** Create account with email/password, then set displayName */
export async function createAccount(
  name: string,
  email: string,
  password: string,
): Promise<FirebaseAuthTypes.UserCredential> {
  const credential = await auth().createUserWithEmailAndPassword(email, password);
  await auth().currentUser?.updateProfile({ displayName: name });
  return credential;
}

/** Send password-reset email */
export async function sendPasswordReset(email: string): Promise<void> {
  return auth().sendPasswordResetEmail(email);
}

/**
 * Start phone auth — sends OTP via SMS.
 * The ConfirmationResult is stored in module scope for OTPScreen to retrieve.
 */
export async function sendPhoneOTP(
  phoneNumber: string,
): Promise<FirebaseAuthTypes.ConfirmationResult> {
  const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
  _phoneConfirmation = confirmation;
  return confirmation;
}

/** Verify OTP code against the given confirmation */
export async function verifyOTP(
  confirmation: FirebaseAuthTypes.ConfirmationResult,
  otp: string,
): Promise<FirebaseAuthTypes.UserCredential | null> {
  return confirmation.confirm(otp);
}

/** Sign out of Firebase and (if Google provider) Google Sign-In */
export async function signOut(): Promise<void> {
  const user = auth().currentUser;
  const isGoogleUser =
    user?.providerData.some(p => p.providerId === 'google.com') ?? false;
  await auth().signOut();
  if (isGoogleUser) {
    await GoogleSignin.signOut();
  }
  _phoneConfirmation = null;
}

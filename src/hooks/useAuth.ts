import { useState, useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useAuth() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async firebaseUser => {
      if (firebaseUser) {
        await syncUserToFirestore(firebaseUser);

        // Detect first-ever login for this UID
        const key = `user_first_login_done_${firebaseUser.uid}`;
        const alreadyLoggedIn = await AsyncStorage.getItem(key);
        if (!alreadyLoggedIn) {
          setIsFirstLogin(true);
          await AsyncStorage.setItem(key, 'true');
        } else {
          setIsFirstLogin(false);
        }
      } else {
        setIsFirstLogin(false);
      }

      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isFirstLogin,
  };
}

async function syncUserToFirestore(
  firebaseUser: FirebaseAuthTypes.User,
): Promise<void> {
  try {
    const docRef = firestore().collection('users').doc(firebaseUser.uid);
    const doc = await docRef.get();
    const provider =
      firebaseUser.providerData[0]?.providerId ?? 'unknown';

    const payload: Record<string, unknown> = {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName ?? null,
      email: firebaseUser.email ?? null,
      photoURL: firebaseUser.photoURL ?? null,
      lastLoginAt: firestore.FieldValue.serverTimestamp(),
      provider,
    };

    if (!doc.exists()) {
      payload.createdAt = firestore.FieldValue.serverTimestamp();
    }

    await docRef.set(payload, { merge: true });
  } catch {
    // Firestore errors must not block the auth state update
  }
}

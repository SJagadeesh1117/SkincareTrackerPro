import { useState, useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async firebaseUser => {
      if (firebaseUser) {
        await syncUserToFirestore(firebaseUser);
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

    // Only set createdAt on first write — merge:true won't overwrite
    // existing fields we omit, but will overwrite ones we include.
    // So we only add createdAt when the doc doesn't exist yet.
    if (!doc.exists) {
      payload.createdAt = firestore.FieldValue.serverTimestamp();
    }

    await docRef.set(payload, { merge: true });
  } catch {
    // Firestore errors must not block the auth state update
  }
}

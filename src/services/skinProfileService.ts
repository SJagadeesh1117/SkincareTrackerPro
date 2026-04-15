/**
 * skinProfileService.ts
 *
 * Reads the user's latest skin profile and recommendations from Firestore.
 *
 * Firestore persistence is enabled by default in the React Native SDK, so
 * this read will be served from the local cache when the device is offline.
 * The caller never needs to worry about connectivity.
 *
 * Data shape written by the `analyseSkine` Cloud Function:
 *   users/{uid}.latestSkinProfile  → { skinType, concerns, advice, scanId, scannedAt }
 *   users/{uid}.latestRecommendations → RecommendedProduct[]
 */

import firestore from '@react-native-firebase/firestore';
import type { SkinProfile } from '../store/skinProfileStore';
import { useSkinProfileStore } from '../store/skinProfileStore';
import type { RecommendedProduct } from '../types';

export async function fetchLatestProfile(uid: string): Promise<void> {
  const { setSkinProfile, setRecommendations, setProfileLoaded } =
    useSkinProfileStore.getState();

  try {
    const doc = await firestore().collection('users').doc(uid).get();
    const data = doc.data() ?? {};

    if (data.latestSkinProfile) {
      setSkinProfile(data.latestSkinProfile as SkinProfile);
    }

    if (
      Array.isArray(data.latestRecommendations) &&
      data.latestRecommendations.length > 0
    ) {
      setRecommendations(data.latestRecommendations as RecommendedProduct[]);
    }
  } catch {
    // Network error — Firestore SDK will have already returned any cached doc
    // above, so we only reach here if the cache is also empty. Either way,
    // mark loading as done so the UI stops showing the skeleton.
  } finally {
    setProfileLoaded(true);
  }
}

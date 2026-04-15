/**
 * scanPersistenceService.ts
 *
 * Two-layer scan result cache:
 *   1. AsyncStorage — available instantly on app open, survives offline.
 *   2. Firestore    — source of truth; used when AsyncStorage is empty (e.g. fresh install).
 *
 * Shape stored in AsyncStorage / Firestore users/{uid}.latestScanResult:
 *   { ...SkinAnalysisResult, scanId, cachedAt?, scannedAt? }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import type { SkinAnalysisResult } from '../types';

const SCAN_CACHE_KEY = 'lastScanResult';

export const saveLastScanLocally = async (
  scanResult: SkinAnalysisResult,
): Promise<void> => {
  await AsyncStorage.setItem(
    SCAN_CACHE_KEY,
    JSON.stringify({
      ...scanResult,
      cachedAt: new Date().toISOString(),
    }),
  );
};

export const loadLastScanLocally = async (): Promise<SkinAnalysisResult | null> => {
  const raw = await AsyncStorage.getItem(SCAN_CACHE_KEY);
  return raw ? (JSON.parse(raw) as SkinAnalysisResult) : null;
};

export const loadLastScanFromFirestore = async (): Promise<SkinAnalysisResult | null> => {
  const uid = auth().currentUser?.uid;
  if (!uid) return null;

  const doc = await firestore().collection('users').doc(uid).get();
  return (doc.data()?.latestScanResult as SkinAnalysisResult | undefined) ?? null;
};

export const clearLastScan = async (): Promise<void> => {
  await AsyncStorage.removeItem(SCAN_CACHE_KEY);

  const uid = auth().currentUser?.uid;
  if (uid) {
    try {
      await firestore()
        .collection('users')
        .doc(uid)
        .set({ latestScanResult: null }, { merge: true });
    } catch {
      // Non-critical — local cache is already cleared
    }
  }
};

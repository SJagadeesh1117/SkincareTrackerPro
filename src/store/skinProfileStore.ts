import { create } from 'zustand';
import type { RecommendedProduct, SkinConcern, SkinType } from '../types';

export interface SkinProfile {
  skinType: SkinType;
  concerns: SkinConcern[];
  advice: string[];
  scanId: string;
  scannedAt: any; // Firestore Timestamp on reads, null on immediate post-scan writes
}

interface SkinProfileStore {
  skinProfile: SkinProfile | null;
  recommendations: RecommendedProduct[] | null;
  /** True once we have attempted a Firestore fetch (success or fail). */
  profileLoaded: boolean;
  setSkinProfile: (profile: SkinProfile) => void;
  setRecommendations: (products: RecommendedProduct[]) => void;
  setProfileLoaded: (loaded: boolean) => void;
  /** Call on sign-out to reset state. */
  clearProfile: () => void;
}

export const useSkinProfileStore = create<SkinProfileStore>(set => ({
  skinProfile: null,
  recommendations: null,
  profileLoaded: false,
  setSkinProfile: profile => set({ skinProfile: profile }),
  setRecommendations: products => set({ recommendations: products }),
  setProfileLoaded: loaded => set({ profileLoaded: loaded }),
  clearProfile: () =>
    set({ skinProfile: null, recommendations: null, profileLoaded: false }),
}));

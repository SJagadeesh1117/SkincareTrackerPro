/**
 * skinAnalysisStore.ts
 *
 * Zustand store that holds the latest skin analysis result produced by the
 * analyseSkine Cloud Function.  FaceScanScreen writes here after a successful
 * API call; MyProductsScreen reads from here to personalise recommendations.
 */

import { create } from 'zustand';
import type { SkinAnalysisResult } from '../types';

interface SkinAnalysisStore {
  latestResult: SkinAnalysisResult | null;
  setResult: (result: SkinAnalysisResult) => void;
  clearResult: () => void;
}

export const useSkinAnalysisStore = create<SkinAnalysisStore>(set => ({
  latestResult: null,
  setResult: result => set({ latestResult: result }),
  clearResult: () => set({ latestResult: null }),
}));

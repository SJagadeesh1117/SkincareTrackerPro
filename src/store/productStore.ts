import { create } from 'zustand';

interface ProductStore {
  pendingCount: number;
  setPendingCount: (count: number) => void;
}

export const useProductStore = create<ProductStore>(set => ({
  pendingCount: 0,
  setPendingCount: count => set({ pendingCount: count }),
}));

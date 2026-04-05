// Shared TypeScript types and interfaces

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  ingredients?: string[];
  notes?: string;
  addedAt: string;
}

export interface RoutineStep {
  id: string;
  productId: string;
  order: number;
  timeOfDay: 'morning' | 'evening' | 'both';
  notes?: string;
}

export interface Routine {
  id: string;
  userId: string;
  steps: RoutineStep[];
  updatedAt: string;
}

export interface ProgressEntry {
  id: string;
  userId: string;
  photoURL?: string;
  notes?: string;
  rating: number;
  date: string;
}

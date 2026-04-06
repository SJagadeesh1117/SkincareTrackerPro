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

export interface ProgressEntry {
  id: string;
  userId: string;
  notes?: string;
  rating: number;
  date: string;
}

export type AuthStackParamList = {
  Welcome: undefined;
  EmailLogin: undefined;
  EmailRegister: undefined;
  ForgotPassword: undefined;
  PhoneAuth: undefined;
  OTP: { phoneNumber: string };
};

export type SkinType = 'oily' | 'dry' | 'combination' | 'sensitive' | 'normal';

export type SkinConcern =
  | 'acne'
  | 'pigmentation'
  | 'dehydration'
  | 'dark_circles'
  | 'redness'
  | 'fine_lines'
  | 'uneven_texture'
  | 'enlarged_pores';

export interface SkinAnalysisResult {
  skinType: SkinType;
  concerns: SkinConcern[];
  advice: string[];
  spfNote: string;
  disclaimer: string;
}

// ── Product Catalog ───────────────────────────────────────────────────────────

export type ProductCategory = 'cleanser' | 'moisturiser' | 'sunscreen' | 'serum' | 'toner';
export type ProductTier = 'best' | 'value' | 'budget';
export type RoutineSlot = 'morning' | 'night' | 'both' | 'weekly';

export interface CatalogProduct {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  tier: ProductTier;
  priceINR: number;
  keyIngredients: string[];
  suitableFor: SkinType[];
  routineSlot: RoutineSlot;
  stepOrder: number;
  instructions: string;
  imageUrl: string;
  whyItWorks: string;
}

export interface TierGroup {
  best: CatalogProduct[];
  value: CatalogProduct[];
  budget: CatalogProduct[];
}

export interface RecommendationsResult {
  cleanser: TierGroup;
  moisturiser: TierGroup;
  sunscreen: TierGroup;
  serum: TierGroup;
  toner: TierGroup;
}

// ── Navigation ────────────────────────────────────────────────────────────────

export type MainDrawerParamList = {
  Home: undefined;
  FaceScan: undefined;
  MyProducts: { skinType?: SkinType } | undefined;
  MyOrders: undefined;
  ReminderSettings: undefined;
  Profile: undefined;
};

export type MyProductsStackParamList = {
  MyProductsScreen: undefined;
  BundleScreen: { selectedProducts: CatalogProduct[] };
  OrderConfirmationScreen: { orderId: string };
};

// ── Order / Delivery types ────────────────────────────────────────────────────

export interface DeliveryAddress {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pinCode: string;
}

export type OrderStatus = 'paid' | 'pending' | 'failed';

export interface Order {
  orderId: string;
  userId: string;
  products: CatalogProduct[];
  totalAmountINR: number;
  deliveryAddress: DeliveryAddress;
  status: OrderStatus;
  placedAt: any; // Firestore Timestamp
  paymentMethod: string;
}

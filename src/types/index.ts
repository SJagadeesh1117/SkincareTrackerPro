import type { NavigatorScreenParams } from '@react-navigation/native';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

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
  scanId?: string;
  products: RecommendedProduct[];
}

export interface RecommendedProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  whyItWorks: string;
  keyIngredients: string[];
  routineSlot: RoutineSlot;
  stepOrder: number;
  amazonProductUrl: string;
  nykaaProductUrl: string;
  estimatedAmazonPriceINR: number;
  estimatedNykaaPriceINR: number;
}

export interface TrackedProduct extends RecommendedProduct {
  status: 'recommended' | 'ordered' | 'delivered' | 'active';
  isActive: boolean;
  addedAt: FirebaseFirestoreTypes.Timestamp | Date;
  orderedAt: FirebaseFirestoreTypes.Timestamp | Date | null;
  deliveredAt: FirebaseFirestoreTypes.Timestamp | Date | null;
  activatedAt: FirebaseFirestoreTypes.Timestamp | Date | null;
}

// ── Product Catalog ───────────────────────────────────────────────────────────

export type ProductCategory = 'cleanser' | 'moisturiser' | 'sunscreen' | 'serum' | 'toner';
export type ProductTier = 'best' | 'value' | 'budget';
export type RoutineSlot = 'morning' | 'night' | 'both' | 'weekly';

export interface HomeActivationPayload {
  productId: string;
  productName: string;
  routineSlot: RoutineSlot;
}

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
  ReminderSettings: undefined;
  Profile: undefined;
};

export type MyProductsStackParamList = {
  MyProductsScreen: undefined;
  BundleScreen: { selectedProducts: CatalogProduct[] };
  OrderConfirmationScreen: { orderId: string };
};

export type FaceScanStackParamList = {
  FaceScanScreen: undefined;
  RecommendationsScreen: {
    products?: RecommendedProduct[];
    skinType?: string;
    scanId?: string;
  } | undefined;
};

export type MainTabParamList = {
  HomeTab: { activatedProduct?: HomeActivationPayload } | undefined;
  ScanTab: undefined;
  ProductsTab: undefined;
  ProfileTab: undefined;
};

export type RoutineSlotParam = 'morning' | 'evening' | 'weekly';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  MyProducts: undefined;
  BundleScreen: { selectedProducts: CatalogProduct[] };
  OrderConfirmationScreen: { orderId: string };
  RecommendationsScreen: FaceScanStackParamList['RecommendationsScreen'];
  ReminderSettings: undefined;
  ProductScanScreen: { slot: RoutineSlotParam };
  ProductConfirmScreen: {
    brand: string;
    product_name: string;
    barcode: string | null;
    imageUri: string | undefined;
    slot: RoutineSlotParam;
  };
};

// ── Scanned / AI-analysed product ────────────────────────────────────────────

export interface ScannedProduct {
  id: string;                                         // Firestore doc ID
  name: string;
  brand: string;
  barcode: string | null;
  category: string;
  ingredients: string[];
  skinType: string[];
  usage: 'morning' | 'evening' | 'both';
  warnings: string[];
  description: string;
  addedBy: 'ai_scan' | 'admin';
  createdAt: FirebaseFirestoreTypes.Timestamp | Date;
}

export type ScannedProductSource = 'database' | 'ai_scan';

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

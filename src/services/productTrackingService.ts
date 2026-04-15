import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import type { RecommendedProduct } from '../types';

function getTrackedProductRef(productId: string) {
  const uid = auth().currentUser?.uid;
  if (!uid) {
    throw new Error('Not authenticated');
  }

  return firestore()
    .collection('trackedProducts')
    .doc(uid)
    .collection('items')
    .doc(productId);
}

function normalizeTrackedProduct(
  product: RecommendedProduct,
  status: 'recommended' | 'ordered',
) {
  const now = new Date();
  const productId =
    typeof product.id === 'string' && product.id.trim().length > 0
      ? product.id
      : `recommended_${Date.now()}`;

  return {
    id: productId,
    name:
      typeof product.name === 'string' && product.name.trim().length > 0
        ? product.name
        : 'Recommended product',
    brand: typeof product.brand === 'string' ? product.brand : '',
    category:
      typeof product.category === 'string' && product.category.length > 0
        ? product.category
        : 'serum',
    whyItWorks:
      typeof product.whyItWorks === 'string' ? product.whyItWorks : '',
    keyIngredients: Array.isArray(product.keyIngredients)
      ? product.keyIngredients.filter(
          (ingredient): ingredient is string =>
            typeof ingredient === 'string' && ingredient.length > 0,
        )
      : [],
    routineSlot:
      typeof product.routineSlot === 'string' ? product.routineSlot : 'morning',
    stepOrder: typeof product.stepOrder === 'number' ? product.stepOrder : 99,
    amazonProductUrl:
      typeof product.amazonProductUrl === 'string'
        ? product.amazonProductUrl
        : '',
    nykaaProductUrl:
      typeof product.nykaaProductUrl === 'string' ? product.nykaaProductUrl : '',
    estimatedAmazonPriceINR:
      typeof product.estimatedAmazonPriceINR === 'number'
        ? product.estimatedAmazonPriceINR
        : 0,
    estimatedNykaaPriceINR:
      typeof product.estimatedNykaaPriceINR === 'number'
        ? product.estimatedNykaaPriceINR
        : 0,
    status,
    isActive: false,
    addedAt: now,
    orderedAt: status === 'ordered' ? now : null,
    deliveredAt: null,
    activatedAt: null,
  };
}

export async function saveRecommendedProductAsOrdered(
  product: RecommendedProduct,
): Promise<string> {
  const payload = normalizeTrackedProduct(product, 'ordered');

  await getTrackedProductRef(payload.id).set(payload, { merge: true });

  return payload.id;
}

export async function markAsOrdered(productId: string): Promise<void> {
  await getTrackedProductRef(productId).set(
    {
      status: 'ordered',
      isActive: false,
      orderedAt: new Date(),
    },
    { merge: true },
  );
}

export async function markAsDelivered(productId: string): Promise<void> {
  await getTrackedProductRef(productId).set(
    {
      status: 'delivered',
      isActive: false,
      deliveredAt: new Date(),
    },
    { merge: true },
  );
}

export async function activateProduct(productId: string): Promise<void> {
  await getTrackedProductRef(productId).set(
    {
      status: 'active',
      isActive: true,
      activatedAt: new Date(),
    },
    { merge: true },
  );
}

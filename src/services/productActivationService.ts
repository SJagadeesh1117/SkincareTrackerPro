import type { TrackedProduct } from '../types';
import { addProductToRoutine } from './routineActivationService';
import { activateProduct as activateTrackedProduct } from './productTrackingService';

export async function activateProduct(product: TrackedProduct, uid?: string) {
  void uid;
  await activateTrackedProduct(product.id);
  return addProductToRoutine(product);
}

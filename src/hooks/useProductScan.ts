/**
 * useProductScan.ts
 *
 * Orchestrates the DB-first product lookup strategy:
 *
 *   scan() call
 *     │
 *     ├─ Step 1: searchProductInDB(brand, product_name, barcode)
 *     │            │
 *     │            ├─ HIT  → return { product, source: 'database' }
 *     │            │
 *     │            └─ MISS →
 *     │                Step 2: analyzeWithGPT4o(imageBase64)
 *     │                Step 3: saveProductToDB(aiProduct)
 *     │                return { product, source: 'ai_scan' }
 *     │
 *     └─ On error → sets error string, returns null
 *
 * Exposed state: { scan, loading, error, product, source }
 */

import { useCallback, useState } from 'react';

import {
  searchProductInDB,
  analyzeWithGPT4o,
  saveProductToDB,
} from '../services/productService';
import type { ScannedProduct, ScannedProductSource } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseProductScanParams {
  brand:        string;
  product_name: string;
  barcode:      string | null;
  imageBase64:  string;
}

export interface ScanResult {
  product: ScannedProduct;
  source:  ScannedProductSource;
}

export interface UseProductScanReturn {
  /** Trigger the DB-first lookup. Returns the result or null on error. */
  scan:    () => Promise<ScanResult | null>;
  loading: boolean;
  error:   string | null;
  product: ScannedProduct | null;
  source:  ScannedProductSource | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useProductScan(params: UseProductScanParams): UseProductScanReturn {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [source,  setSource]  = useState<ScannedProductSource | null>(null);

  const scan = useCallback(async (): Promise<ScanResult | null> => {
    setLoading(true);
    setError(null);
    setProduct(null);
    setSource(null);

    try {
      // ── Step 1: DB lookup ─────────────────────────────────────────────────────
      const dbProduct = await searchProductInDB(
        params.brand,
        params.product_name,
        params.barcode,
      );

      if (dbProduct) {
        setProduct(dbProduct);
        setSource('database');
        return { product: dbProduct, source: 'database' };
      }

      // ── Step 2: GPT-4o Vision analysis ───────────────────────────────────────
      const analysed = await analyzeWithGPT4o(params.imageBase64);

      // ── Step 3: Persist to Firestore ──────────────────────────────────────────
      const productId = await saveProductToDB(analysed);

      const savedProduct: ScannedProduct = {
        ...analysed,
        id:        productId,
        addedBy:   'ai_scan',
        createdAt: new Date(),   // local Date until Firestore write resolves
      };

      setProduct(savedProduct);
      setSource('ai_scan');
      return { product: savedProduct, source: 'ai_scan' };

    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? 'Something went wrong. Please try again.';
      setError(msg);
      return null;

    } finally {
      setLoading(false);
    }
  // Rebuild only when the lookup inputs actually change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.brand, params.product_name, params.barcode, params.imageBase64]);

  return { scan, loading, error, product, source };
}

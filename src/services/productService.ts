/**
 * productService.ts
 *
 * Three responsibilities:
 *   searchProductInDB  — query Firestore 'products' by name+brand (primary)
 *                        and barcode (fallback). Returns first match or null.
 *   analyzeWithGPT4o   — send image to GPT-4o Vision with the full analysis
 *                        prompt; parse and sanitize the response.
 *   saveProductToDB    — write an AI-analysed product to Firestore and return
 *                        the new document ID.
 */

import firestore from '@react-native-firebase/firestore';
import { OPENAI_API_KEY } from '../config/openaiConfig';
import type { ScannedProduct } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const PRODUCTS_COLLECTION = 'products';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const GPT4O_PROMPT =
  'You are a skincare product analyzer. Extract from this product label:\n' +
  '{ name: string, brand: string, barcode: string | null, category: string, ' +
  'ingredients: string[], skinType: string[], ' +
  'usage: "morning" | "evening" | "both", ' +
  'warnings: string[], description: string }\n' +
  'Return ONLY valid JSON, no extra text.';

// ── Internal types ────────────────────────────────────────────────────────────

type ProductCore = Omit<ScannedProduct, 'id' | 'addedBy' | 'createdAt'>;

// Raw GPT response shape (all fields optional — we sanitize below)
interface RawGPTProduct {
  name?: unknown;
  brand?: unknown;
  barcode?: unknown;
  category?: unknown;
  ingredients?: unknown;
  skinType?: unknown;
  usage?: unknown;
  warnings?: unknown;
  description?: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip markdown fences GPT-4o occasionally wraps JSON in. */
function stripFences(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

/** Ensure a value is a non-empty string array. */
function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

/** Coerce GPT output into a valid ProductCore, providing safe defaults. */
function sanitizeGPTProduct(raw: RawGPTProduct): ProductCore {
  const usage = (['morning', 'evening', 'both'] as const).includes(raw.usage as any)
    ? (raw.usage as 'morning' | 'evening' | 'both')
    : 'both';

  return {
    name:        typeof raw.name     === 'string' && raw.name.trim()     ? raw.name.trim()     : 'Unknown Product',
    brand:       typeof raw.brand    === 'string' && raw.brand.trim()    ? raw.brand.trim()    : 'Unknown Brand',
    barcode:     typeof raw.barcode  === 'string' && raw.barcode.trim()  ? raw.barcode.trim()  : null,
    category:    typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim() : 'skincare',
    description: typeof raw.description === 'string'                     ? raw.description     : '',
    ingredients: toStringArray(raw.ingredients),
    skinType:    toStringArray(raw.skinType),
    warnings:    toStringArray(raw.warnings),
    usage,
  };
}

// ── searchProductInDB ─────────────────────────────────────────────────────────

/**
 * Look up a product in Firestore.
 *
 * Primary query  : name == product_name AND brand == brand  (exact, case-sensitive)
 * Fallback query : barcode == barcode                        (only when barcode provided)
 *
 * Returns the first matching ScannedProduct, or null if nothing found.
 */
export async function searchProductInDB(
  brand: string,
  product_name: string,
  barcode: string | null,
): Promise<ScannedProduct | null> {
  // ── Primary: name + brand ────────────────────────────────────────────────────
  try {
    const primarySnap = await firestore()
      .collection(PRODUCTS_COLLECTION)
      .where('name',  '==', product_name)
      .where('brand', '==', brand)
      .limit(1)
      .get();

    if (!primarySnap.empty) {
      const doc = primarySnap.docs[0];
      return { id: doc.id, ...(doc.data() as Omit<ScannedProduct, 'id'>) };
    }
  } catch (err) {
    // Log but don't throw — fall through to barcode query
    console.warn('[productService] Primary DB query failed:', err);
  }

  // ── Fallback: barcode ────────────────────────────────────────────────────────
  if (barcode) {
    try {
      const barcodeSnap = await firestore()
        .collection(PRODUCTS_COLLECTION)
        .where('barcode', '==', barcode)
        .limit(1)
        .get();

      if (!barcodeSnap.empty) {
        const doc = barcodeSnap.docs[0];
        return { id: doc.id, ...(doc.data() as Omit<ScannedProduct, 'id'>) };
      }
    } catch (err) {
      console.warn('[productService] Barcode DB query failed:', err);
    }
  }

  return null;
}

// ── analyzeWithGPT4o ──────────────────────────────────────────────────────────

/**
 * Send the product image to GPT-4o Vision and return a sanitized ProductCore.
 * Throws a user-readable Error on network failure, bad status, or parse error.
 */
export async function analyzeWithGPT4o(imageBase64: string): Promise<ProductCore> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
    throw new Error('OpenAI API key not configured. Open src/config/openaiConfig.ts.');
  }

  // ── Network request ──────────────────────────────────────────────────────────
  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model:      'gpt-4o',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: [
              {
                type:      'image_url',
                image_url: {
                  url:    `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'low', // sufficient for label extraction
                },
              },
              { type: 'text', text: GPT4O_PROMPT },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new Error('Network error — check your connection and try again.');
  }

  // ── Parse response ───────────────────────────────────────────────────────────
  const rawText = await response.text();

  let json: any;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`Server error (HTTP ${response.status}). Please try again.`);
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid OpenAI API key.');
    if (response.status === 429) throw new Error('OpenAI rate limit reached. Try again in a moment.');
    throw new Error(json?.error?.message ?? `HTTP ${response.status}`);
  }

  const raw: string = json?.choices?.[0]?.message?.content ?? '';
  const cleaned = stripFences(raw);

  let parsed: RawGPTProduct;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[productService] GPT JSON parse failed. Raw:', raw.slice(0, 300));
    throw new Error('Could not read product details. Try a clearer photo with the label fully visible.');
  }

  return sanitizeGPTProduct(parsed);
}

// ── saveProductToDB ───────────────────────────────────────────────────────────

/**
 * Write a product to the Firestore 'products' collection.
 * Stamps addedBy = 'ai_scan' and createdAt = serverTimestamp().
 * Returns the new document ID.
 */
export async function saveProductToDB(product: ProductCore): Promise<string> {
  const ref = await firestore()
    .collection(PRODUCTS_COLLECTION)
    .add({
      ...product,
      addedBy:   'ai_scan',
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

  return ref.id;
}

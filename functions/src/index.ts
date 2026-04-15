/**
 * analyseSkine — Firebase Cloud Function (Gen 2, asia-south1)
 *
 * Callable function that:
 *   1. Verifies the caller is authenticated
 *   2. Enforces a daily scan limit of 3 per user (via Firestore transaction)
 *   3. Sends the face image to GPT-4o Vision for skin analysis
 *   4. Saves the structured result to Firestore (never stores the image)
 *   5. Returns the parsed JSON result to the client
 *
 * Deploy:
 *   cd functions && npm install && npm run build
 *   firebase deploy --only functions:analyseSkine
 *
 * Secret setup (run once):
 *   firebase functions:secrets:set OPENAI_API_KEY
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import OpenAI from 'openai';

// ── Init ──────────────────────────────────────────────────────────────────────

admin.initializeApp();
const db = admin.firestore();

// ── OpenAI key — read from .env (deployed with the function, never in git) ───

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new HttpsError('internal', 'OpenAI API key not configured on server.');
  return key;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SkinType = 'oily' | 'dry' | 'combination' | 'sensitive' | 'normal';

type SkinConcern =
  | 'acne'
  | 'pigmentation'
  | 'dehydration'
  | 'dark_circles'
  | 'redness'
  | 'fine_lines'
  | 'uneven_texture'
  | 'enlarged_pores';

interface SkinAnalysisResult {
  skinType: SkinType;
  concerns: SkinConcern[];
  advice: string[];
  spfNote: string;
  disclaimer: string;
  products: RecommendedProduct[];
}

type ProductCategoryWithExtras =
  | 'cleanser'
  | 'moisturiser'
  | 'sunscreen'
  | 'serum'
  | 'toner'
  | 'eye_cream'
  | 'exfoliant';

type RoutineSlotWithExtras = 'morning' | 'night' | 'both' | 'weekly';

interface RecommendedProduct {
  id: string;
  name: string;
  brand: string;
  category: ProductCategoryWithExtras;
  whyItWorks: string;
  keyIngredients: string[];
  routineSlot: RoutineSlotWithExtras;
  stepOrder: number;
  amazonProductUrl: string;
  nykaaProductUrl: string;
  estimatedAmazonPriceINR: number;
  estimatedNykaaPriceINR: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD in UTC. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Extracts the first valid JSON object from the model response.
 * Handles: plain JSON, ```json ... ```, leading/trailing prose.
 */
function extractJSON(s: string): string {
  // Strip code fences
  let cleaned = s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  // Find the first { and last } to extract just the JSON object
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  return cleaned;
}

const VALID_SKIN_TYPES: SkinType[] = [
  'oily',
  'dry',
  'combination',
  'sensitive',
  'normal',
];

/** Throws HttpsError if the parsed AI response doesn't match the expected schema. */
function validateResult(r: unknown): SkinAnalysisResult {
  if (!r || typeof r !== 'object') {
    throw new HttpsError('internal', 'AI returned an empty response. Please try again.');
  }

  const obj = r as Record<string, unknown>;

  if (!VALID_SKIN_TYPES.includes(obj.skinType as SkinType)) {
    throw new HttpsError('internal', 'AI returned an unrecognised skin type. Please try again.');
  }

  if (
    !Array.isArray(obj.concerns) ||
    !Array.isArray(obj.advice) ||
    typeof obj.spfNote !== 'string' ||
    typeof obj.disclaimer !== 'string'
  ) {
    throw new HttpsError('internal', 'AI response is incomplete. Please try again.');
  }

  if (!Array.isArray(obj.products) || obj.products.length === 0) {
    throw new HttpsError('internal', 'AI returned invalid response');
  }

  return obj as unknown as SkinAnalysisResult;
}

// ── GPT-4o system prompt ──────────────────────────────────────────────────────

const systemPrompt = `You are a certified skincare advisor. Analyse this face photo carefully. Return ONLY a valid JSON object — no markdown, no explanation, no preamble. Follow this exact schema:

{
  "skinType": "oily" | "dry" | "combination" | "sensitive" | "normal",
  "concerns": [ max 4 strings from: "acne", "pigmentation", "dehydration", "dark_circles", "redness", "fine_lines", "uneven_texture", "enlarged_pores" ],
  "advice": [ exactly 3 safe general skincare tip strings for this skin type ],
  "spfNote": "one sentence on sun protection appropriate for this skin type",
  "disclaimer": "For general guidance only. Consult a dermatologist for medical concerns.",
  "products": [
    {
      "id": "unique string e.g. cerave_cleanser_1",
      "name": "exact product name",
      "brand": "brand name",
      "category": "cleanser" | "moisturiser" | "sunscreen" | "serum" | "toner" | "eye_cream" | "exfoliant",
      "whyItWorks": "one sentence explaining why this suits the detected skin type and concerns",
      "keyIngredients": [ "ingredient1", "ingredient2" ],
      "routineSlot": "morning" | "night" | "both" | "weekly",
      "stepOrder": number between 1 and 8,
      "amazonProductUrl": "direct Amazon India product page URL e.g. https://www.amazon.in/dp/ASIN",
      "nykaaProductUrl": "direct Nykaa product page URL e.g. https://www.nykaa.com/product-name/p/12345",
      "estimatedAmazonPriceINR": number,
      "estimatedNykaaPriceINR": number
    }
  ]
}

Include 6 to 8 products total across all categories. Choose well-known Indian market products (CeraVe, Minimalist, La Roche-Posay, Neutrogena, Dot & Key, Plum, Mamaearth, Biotique) that are genuinely available on Amazon India and Nykaa. Vary the price range — include at least one budget option under ₹400 and one premium option above ₹1000. All products must be safe and appropriate for the detected skin type.

For amazonProductUrl and nykaaProductUrl: provide direct links to the specific product page (not search results). Use the real Amazon ASIN and Nykaa product ID for the exact product. Example Amazon format: https://www.amazon.in/dp/B07XYZ1234. Example Nykaa format: https://www.nykaa.com/minimalist-10-niacinamide-face-serum/p/496599.`;

// ── Cloud Function ────────────────────────────────────────────────────────────

export const analyseSkine = onCall(
  {
    region: 'asia-south1',
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async request => {
    // ── 1. Auth check ──────────────────────────────────────
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'You must be signed in to use this feature.',
      );
    }
    const uid = request.auth.uid;

    // ── 2. Validate input ──────────────────────────────────
    const { imageBase64 } = request.data as { imageBase64?: string };
    if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length < 100) {
      throw new HttpsError('invalid-argument', 'A valid imageBase64 string is required.');
    }

    // ── 3. Rate limiting (max 3 scans per UTC day) ──────────
    const today = todayUTC();
    const userRef = db.collection('users').doc(uid);

    await db.runTransaction(async transaction => {
      const snap = await transaction.get(userRef);
      const data = snap.data() ?? {};

      let scanCount: number = typeof data.scanCount === 'number' ? data.scanCount : 0;
      const scanDate: string = typeof data.scanDate === 'string' ? data.scanDate : '';

      // Reset count at midnight UTC
      if (scanDate !== today) {
        scanCount = 0;
      }

      if (scanCount >= 3) {
        throw new HttpsError(
          'resource-exhausted',
          'Daily scan limit reached. Try again tomorrow.',
        );
      }

      transaction.set(
        userRef,
        { scanCount: scanCount + 1, scanDate: today },
        { merge: true },
      );
    });

    // ── 4. GPT-4o Vision call ──────────────────────────────
    const openai = new OpenAI({ apiKey: getOpenAIKey() });

    let rawContent: unknown;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'low',
                },
              },
            ],
          },
        ],
      });

      if (completion.choices[0]?.finish_reason === 'length') {
        console.error('OpenAI response truncated due to token limit.');
        throw new HttpsError(
          'internal',
          'AI response was truncated. Please try again.',
        );
      }

      rawContent = completion.choices[0]?.message?.content;
    } catch (err: unknown) {
      if (err instanceof HttpsError) {
        throw err;
      }
      console.error('OpenAI call failed:', err);
      throw new HttpsError('internal', 'AI service unavailable. Please try again later.');
    }

    // ── 5. Parse & validate response ───────────────────────
    console.info('Raw AI response:', rawContent);
    let result: SkinAnalysisResult;
    try {
      if (typeof rawContent === 'string') {
        result = validateResult(JSON.parse(extractJSON(rawContent)));
      } else {
        result = validateResult(rawContent);
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error('JSON parse failed. Raw content:', rawContent);
      throw new HttpsError('internal', 'Failed to parse AI response. Please try again.');
    }

    // ── 6. Persist to Firestore (no image stored) ──────────
    const scanTimestamp = Date.now();
    const scanId = scanTimestamp.toString();
    const scanRef = db
      .collection('recommendations')
      .doc(uid)
      .collection('scans')
      .doc(scanId);

    const resultWithScanId = {
      ...result,
      scanId,
    };

    const firestorePayload = {
      ...resultWithScanId,
      analysedAt: FieldValue.serverTimestamp(),
    };

    await Promise.all([
      // Individual scan record
      scanRef.set(firestorePayload),
      // Latest profile on the user doc for quick access
      userRef.set(
        {
          latestSkinProfile: {
            skinType: result.skinType,
            concerns: result.concerns,
            advice: result.advice,
            spfNote: result.spfNote,
            scanId,
            scannedAt: FieldValue.serverTimestamp(),
          },
          latestRecommendations: result.products,
          // Full result — read back by client on next app open (scan persistence)
          latestScanResult: {
            skinType: result.skinType,
            concerns: result.concerns,
            advice: result.advice,
            spfNote: result.spfNote,
            disclaimer: result.disclaimer,
            products: result.products,
            scanId,
            scannedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      ),
    ]);

    console.info(`Skin analysis saved for uid=${uid}, scanId=${scanId}`);

    // ── 7. Return result to client ─────────────────────────
    return resultWithScanId;
  },
);

// ── getRecommendations ────────────────────────────────────────────────────────
//
// Callable Cloud Function (Gen 2, asia-south1).
//
// Reads the caller's latestSkinProfile.skinType from their user document,
// queries the `products` collection for matching skin-type products, then
// groups them by category → tier and returns the structured recommendation map.
//
// Deploy:
//   firebase deploy --only functions:getRecommendations

type ProductCategory = 'cleanser' | 'moisturiser' | 'sunscreen' | 'serum' | 'toner';
type ProductTier = 'best' | 'value' | 'budget';

interface CatalogProduct {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  tier: ProductTier;
  priceINR: number;
  keyIngredients: string[];
  suitableFor: string[];
  routineSlot: string;
  stepOrder: number;
  instructions: string;
  imageUrl: string;
  whyItWorks: string;
}

interface TierGroup {
  best: CatalogProduct[];
  value: CatalogProduct[];
  budget: CatalogProduct[];
}

type RecommendationsResult = Record<ProductCategory, TierGroup>;

const CATEGORIES: ProductCategory[] = [
  'cleanser',
  'moisturiser',
  'sunscreen',
  'serum',
  'toner',
];

const TIERS: ProductTier[] = ['best', 'value', 'budget'];

function emptyResult(): RecommendationsResult {
  const result = {} as RecommendationsResult;
  for (const cat of CATEGORIES) {
    result[cat] = { best: [], value: [], budget: [] };
  }
  return result;
}

// ── identifyProduct ───────────────────────────────────────────────────────────
//
// Callable Cloud Function (Gen 2, asia-south1).
//
// Receives a base64-encoded product image, sends it to GPT-4o Vision, and
// returns { brand, product_name, barcode } as structured JSON.
// The OpenAI key is never exposed to the mobile client.
//
// Deploy:
//   firebase deploy --only functions:identifyProduct

interface ProductIdentifiers {
  brand: string;
  product_name: string;
  barcode: string | null;
}

export const identifyProduct = onCall(
  {
    region: 'asia-south1',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async request => {
    // ── 1. Auth check ──────────────────────────────────────
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to use this feature.');
    }

    // ── 2. Validate input ──────────────────────────────────
    const { imageBase64 } = request.data as { imageBase64?: string };
    if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length < 100) {
      throw new HttpsError('invalid-argument', 'A valid imageBase64 string is required.');
    }

    // ── 3. GPT-4o Vision call ──────────────────────────────
    const openai = new OpenAI({ apiKey: getOpenAIKey() });

    let rawContent: unknown;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'low',
                },
              },
              {
                type: 'text',
                text:
                  'From this skincare product image, extract ONLY:\n' +
                  '{ brand: string, product_name: string, barcode: string | null }\n' +
                  'Return ONLY valid JSON, no extra text.',
              },
            ],
          },
        ],
      });
      rawContent = completion.choices[0]?.message?.content;
    } catch (err: unknown) {
      if (err instanceof HttpsError) throw err;
      console.error('OpenAI identifyProduct failed:', err);
      throw new HttpsError('internal', 'AI service unavailable. Please try again later.');
    }

    // ── 4. Parse & validate response ───────────────────────
    if (typeof rawContent !== 'string' || !rawContent.trim()) {
      throw new HttpsError('internal', 'Empty response from AI. Please try again.');
    }

    const cleaned = extractJSON(rawContent);
    let parsed: Partial<ProductIdentifiers>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('identifyProduct: JSON parse failed. Raw:', rawContent);
      throw new HttpsError(
        'internal',
        'Could not read product details from image. Try a clearer photo.',
      );
    }

    if (!parsed.brand || !parsed.product_name) {
      throw new HttpsError(
        'internal',
        'Product label not clearly visible. Make sure the full label is in frame and try again.',
      );
    }

    const result: ProductIdentifiers = {
      brand:        String(parsed.brand).trim(),
      product_name: String(parsed.product_name).trim(),
      barcode:      parsed.barcode ? String(parsed.barcode).trim() : null,
    };

    console.info(
      `identifyProduct: uid=${request.auth.uid} brand="${result.brand}" product="${result.product_name}"`,
    );

    return result;
  },
);

// ── getRecommendations ────────────────────────────────────────────────────────
//
// Callable Cloud Function (Gen 2, asia-south1).
//
// Reads the caller's latestSkinProfile.skinType from their user document,
// queries the `products` collection for matching skin-type products, then
// groups them by category → tier and returns the structured recommendation map.
//
// Deploy:
//   firebase deploy --only functions:getRecommendations

export const getRecommendations = onCall(
  {
    region: 'asia-south1',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async request => {
    // ── 1. Auth check ──────────────────────────────────────
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'You must be signed in to get recommendations.',
      );
    }
    const uid = request.auth.uid;

    // ── 2. Read skin type from user's latest skin profile ──
    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.data() ?? {};
    const skinType: string | undefined =
      (userData.latestSkinProfile as { skinType?: string } | undefined)?.skinType;

    if (!skinType) {
      throw new HttpsError(
        'failed-precondition',
        'No skin profile found. Please complete a face scan first.',
      );
    }

    // ── 3. Query full catalog and rank by suitability ──────
    const snapshot = await db.collection('products').get();

    const result = emptyResult();
    const grouped = new Map<string, CatalogProduct[]>();

    for (const doc of snapshot.docs) {
      const p = { id: doc.id, ...doc.data() } as CatalogProduct;

      const cat = p.category;
      const tier = p.tier;

      if (!CATEGORIES.includes(cat) || !TIERS.includes(tier)) {
        continue; // skip malformed docs
      }

      const key = `${cat}:${tier}`;
      const current = grouped.get(key) ?? [];
      grouped.set(key, [...current, p]);
    }

    // ── 4. Select one product per tier, preferring skin-type matches ───────
    for (const cat of CATEGORIES) {
      for (const tier of TIERS) {
        const key = `${cat}:${tier}`;
        const candidates = grouped.get(key) ?? [];

        candidates.sort((a, b) => {
          const aMatch = a.suitableFor.includes(skinType) ? 0 : 1;
          const bMatch = b.suitableFor.includes(skinType) ? 0 : 1;
          if (aMatch !== bMatch) {
            return aMatch - bMatch;
          }

          if (tier === 'best') {
            return b.priceINR - a.priceINR;
          }

          if (tier === 'budget') {
            return a.priceINR - b.priceINR;
          }

          return a.priceINR - b.priceINR;
        });

        result[cat][tier] = candidates.slice(0, 1);
      }
    }

    console.info(
      `getRecommendations: uid=${uid} skinType=${skinType} products=${snapshot.size}`,
    );

    return result;
  },
);

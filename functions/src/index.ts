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
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import OpenAI from 'openai';

// Re-exported so each import sees only one admin.initializeApp() call.
// Both functions share the same admin instance initialised below.

// ── Init ──────────────────────────────────────────────────────────────────────

admin.initializeApp();
const db = admin.firestore();

// ── Secret ────────────────────────────────────────────────────────────────────

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

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

  return obj as unknown as SkinAnalysisResult;
}

// ── GPT-4o system prompt ──────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  'You are a certified skincare advisor. Analyse the face photo and return ONLY a valid JSON ' +
  'object with no markdown, no preamble. Schema: { "skinType": "oily|dry|combination|sensitive|' +
  'normal", "concerns": ["max 4 items from: acne, pigmentation, dehydration, dark_circles, ' +
  'redness, fine_lines, uneven_texture, enlarged_pores"], "advice": ["3 safe general skincare ' +
  'tips for this skin type"], "spfNote": "one sentence on sun protection", "disclaimer": ' +
  '"For general guidance only. Consult a dermatologist for medical concerns." }';

// ── Cloud Function ────────────────────────────────────────────────────────────

export const analyseSkine = onCall(
  {
    region: 'asia-south1',
    secrets: [OPENAI_API_KEY],
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
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });

    let rawContent: string;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
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

      rawContent = completion.choices[0]?.message?.content ?? '';
    } catch (err: unknown) {
      console.error('OpenAI call failed:', err);
      throw new HttpsError('internal', 'AI service unavailable. Please try again later.');
    }

    // ── 5. Parse & validate response ───────────────────────
    console.info('Raw AI response:', rawContent);
    let result: SkinAnalysisResult;
    try {
      result = validateResult(JSON.parse(extractJSON(rawContent)));
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error('JSON parse failed. Raw content:', rawContent);
      throw new HttpsError('internal', 'Failed to parse AI response. Please try again.');
    }

    // ── 6. Persist to Firestore (no image stored) ──────────
    const profileId = String(Date.now());
    const scanRef = db
      .collection('skin_profiles')
      .doc(uid)
      .collection('scans')
      .doc(profileId);

    const firestorePayload = {
      ...result,
      analysedAt: FieldValue.serverTimestamp(),
    };

    await Promise.all([
      // Individual scan record
      scanRef.set(firestorePayload),
      // Latest profile on the user doc for quick access
      userRef.set({ latestSkinProfile: result }, { merge: true }),
    ]);

    console.info(`Skin analysis saved for uid=${uid}, scanId=${profileId}`);

    // ── 7. Return result to client ─────────────────────────
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

    // ── 3. Query products suitable for this skin type ──────
    const snapshot = await db
      .collection('products')
      .where('suitableFor', 'array-contains', skinType)
      .get();

    const result = emptyResult();

    for (const doc of snapshot.docs) {
      const p = { id: doc.id, ...doc.data() } as CatalogProduct;

      const cat = p.category;
      const tier = p.tier;

      if (!CATEGORIES.includes(cat) || !TIERS.includes(tier)) {
        continue; // skip malformed docs
      }

      result[cat][tier].push(p);
    }

    // ── 4. Sort each tier group by stepOrder ───────────────
    for (const cat of CATEGORIES) {
      for (const tier of TIERS) {
        result[cat][tier].sort((a, b) => a.stepOrder - b.stepOrder);
      }
    }

    console.info(
      `getRecommendations: uid=${uid} skinType=${skinType} products=${snapshot.size}`,
    );

    return result;
  },
);

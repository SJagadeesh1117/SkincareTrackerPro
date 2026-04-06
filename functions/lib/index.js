"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecommendations = exports.analyseSkine = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const openai_1 = __importDefault(require("openai"));
// Re-exported so each import sees only one admin.initializeApp() call.
// Both functions share the same admin instance initialised below.
// ── Init ──────────────────────────────────────────────────────────────────────
admin.initializeApp();
const db = admin.firestore();
// ── Secret ────────────────────────────────────────────────────────────────────
const OPENAI_API_KEY = (0, params_1.defineSecret)('OPENAI_API_KEY');
// ── Helpers ───────────────────────────────────────────────────────────────────
/** Returns today's date as YYYY-MM-DD in UTC. */
function todayUTC() {
    return new Date().toISOString().slice(0, 10);
}
/**
 * Extracts the first valid JSON object from the model response.
 * Handles: plain JSON, ```json ... ```, leading/trailing prose.
 */
function extractJSON(s) {
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
const VALID_SKIN_TYPES = [
    'oily',
    'dry',
    'combination',
    'sensitive',
    'normal',
];
/** Throws HttpsError if the parsed AI response doesn't match the expected schema. */
function validateResult(r) {
    if (!r || typeof r !== 'object') {
        throw new https_1.HttpsError('internal', 'AI returned an empty response. Please try again.');
    }
    const obj = r;
    if (!VALID_SKIN_TYPES.includes(obj.skinType)) {
        throw new https_1.HttpsError('internal', 'AI returned an unrecognised skin type. Please try again.');
    }
    if (!Array.isArray(obj.concerns) ||
        !Array.isArray(obj.advice) ||
        typeof obj.spfNote !== 'string' ||
        typeof obj.disclaimer !== 'string') {
        throw new https_1.HttpsError('internal', 'AI response is incomplete. Please try again.');
    }
    return obj;
}
// ── GPT-4o system prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = 'You are a certified skincare advisor. Analyse the face photo and return ONLY a valid JSON ' +
    'object with no markdown, no preamble. Schema: { "skinType": "oily|dry|combination|sensitive|' +
    'normal", "concerns": ["max 4 items from: acne, pigmentation, dehydration, dark_circles, ' +
    'redness, fine_lines, uneven_texture, enlarged_pores"], "advice": ["3 safe general skincare ' +
    'tips for this skin type"], "spfNote": "one sentence on sun protection", "disclaimer": ' +
    '"For general guidance only. Consult a dermatologist for medical concerns." }';
// ── Cloud Function ────────────────────────────────────────────────────────────
exports.analyseSkine = (0, https_1.onCall)({
    region: 'asia-south1',
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 60,
    memory: '512MiB',
}, async (request) => {
    var _a, _b, _c;
    // ── 1. Auth check ──────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in to use this feature.');
    }
    const uid = request.auth.uid;
    // ── 2. Validate input ──────────────────────────────────
    const { imageBase64 } = request.data;
    if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length < 100) {
        throw new https_1.HttpsError('invalid-argument', 'A valid imageBase64 string is required.');
    }
    // ── 3. Rate limiting (max 3 scans per UTC day) ──────────
    const today = todayUTC();
    const userRef = db.collection('users').doc(uid);
    await db.runTransaction(async (transaction) => {
        var _a;
        const snap = await transaction.get(userRef);
        const data = (_a = snap.data()) !== null && _a !== void 0 ? _a : {};
        let scanCount = typeof data.scanCount === 'number' ? data.scanCount : 0;
        const scanDate = typeof data.scanDate === 'string' ? data.scanDate : '';
        // Reset count at midnight UTC
        if (scanDate !== today) {
            scanCount = 0;
        }
        if (scanCount >= 3) {
            throw new https_1.HttpsError('resource-exhausted', 'Daily scan limit reached. Try again tomorrow.');
        }
        transaction.set(userRef, { scanCount: scanCount + 1, scanDate: today }, { merge: true });
    });
    // ── 4. GPT-4o Vision call ──────────────────────────────
    const openai = new openai_1.default({ apiKey: OPENAI_API_KEY.value() });
    let rawContent;
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
        rawContent = (_c = (_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) !== null && _c !== void 0 ? _c : '';
    }
    catch (err) {
        console.error('OpenAI call failed:', err);
        throw new https_1.HttpsError('internal', 'AI service unavailable. Please try again later.');
    }
    // ── 5. Parse & validate response ───────────────────────
    console.info('Raw AI response:', rawContent);
    let result;
    try {
        result = validateResult(JSON.parse(extractJSON(rawContent)));
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        console.error('JSON parse failed. Raw content:', rawContent);
        throw new https_1.HttpsError('internal', 'Failed to parse AI response. Please try again.');
    }
    // ── 6. Persist to Firestore (no image stored) ──────────
    const profileId = String(Date.now());
    const scanRef = db
        .collection('skin_profiles')
        .doc(uid)
        .collection('scans')
        .doc(profileId);
    const firestorePayload = Object.assign(Object.assign({}, result), { analysedAt: firestore_1.FieldValue.serverTimestamp() });
    await Promise.all([
        // Individual scan record
        scanRef.set(firestorePayload),
        // Latest profile on the user doc for quick access
        userRef.set({ latestSkinProfile: result }, { merge: true }),
    ]);
    console.info(`Skin analysis saved for uid=${uid}, scanId=${profileId}`);
    // ── 7. Return result to client ─────────────────────────
    return result;
});
const CATEGORIES = [
    'cleanser',
    'moisturiser',
    'sunscreen',
    'serum',
    'toner',
];
const TIERS = ['best', 'value', 'budget'];
function emptyResult() {
    const result = {};
    for (const cat of CATEGORIES) {
        result[cat] = { best: [], value: [], budget: [] };
    }
    return result;
}
exports.getRecommendations = (0, https_1.onCall)({
    region: 'asia-south1',
    timeoutSeconds: 30,
    memory: '256MiB',
}, async (request) => {
    var _a, _b;
    // ── 1. Auth check ──────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in to get recommendations.');
    }
    const uid = request.auth.uid;
    // ── 2. Read skin type from user's latest skin profile ──
    const userSnap = await db.collection('users').doc(uid).get();
    const userData = (_a = userSnap.data()) !== null && _a !== void 0 ? _a : {};
    const skinType = (_b = userData.latestSkinProfile) === null || _b === void 0 ? void 0 : _b.skinType;
    if (!skinType) {
        throw new https_1.HttpsError('failed-precondition', 'No skin profile found. Please complete a face scan first.');
    }
    // ── 3. Query products suitable for this skin type ──────
    const snapshot = await db
        .collection('products')
        .where('suitableFor', 'array-contains', skinType)
        .get();
    const result = emptyResult();
    for (const doc of snapshot.docs) {
        const p = Object.assign({ id: doc.id }, doc.data());
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
    console.info(`getRecommendations: uid=${uid} skinType=${skinType} products=${snapshot.size}`);
    return result;
});
//# sourceMappingURL=index.js.map
/**
 * seedProducts.ts
 *
 * Seeds the Firestore `products` collection with 30 catalog products:
 *   5 categories × 3 tiers × 2 products = 30
 *
 * Prerequisites:
 *   1. Download a Firebase service-account JSON from the Firebase Console
 *      → Project Settings → Service accounts → Generate new private key
 *   2. Save it as  scripts/serviceAccount.json  (already in .gitignore)
 *      OR set the env var: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 *
 * Run:
 *   npx ts-node --project scripts/tsconfig.json scripts/seedProducts.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// ── Firebase init ─────────────────────────────────────────────────────────────

const saPath = path.join(__dirname, 'serviceAccount.json');

if (fs.existsSync(saPath)) {
  const serviceAccount = require(saPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
} else {
  console.error(
    'ERROR: No service account found.\n' +
      '  Option A: Place your Firebase service-account JSON at scripts/serviceAccount.json\n' +
      '  Option B: Set the GOOGLE_APPLICATION_CREDENTIALS env variable.',
  );
  process.exit(1);
}

const db = admin.firestore();

// ── Types ─────────────────────────────────────────────────────────────────────

type SkinType = 'oily' | 'dry' | 'combination' | 'sensitive' | 'normal';
type ProductCategory = 'cleanser' | 'moisturiser' | 'sunscreen' | 'serum' | 'toner';
type ProductTier = 'best' | 'value' | 'budget';
type RoutineSlot = 'morning' | 'night' | 'both' | 'weekly';

interface CatalogProduct {
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

// ── Image placeholder ─────────────────────────────────────────────────────────

const IMG = 'https://placehold.co/200x200';

// ── Seed data — 5 categories × 3 tiers × 2 products = 30 ─────────────────────

const products: CatalogProduct[] = [
  // ── CLEANSERS (stepOrder 1) ──────────────────────────────────────────────
  {
    id: 'cleanser-best-1',
    name: 'CeraVe Foaming Facial Cleanser',
    brand: 'CeraVe',
    category: 'cleanser',
    tier: 'best',
    priceINR: 899,
    keyIngredients: ['Niacinamide', 'Hyaluronic Acid', 'Ceramides'],
    suitableFor: ['oily', 'combination'],
    routineSlot: 'both',
    stepOrder: 1,
    instructions:
      'Wet face with lukewarm water. Apply a small amount and massage gently in circular motions for 30 seconds. Rinse thoroughly and pat dry.',
    imageUrl: IMG,
    whyItWorks:
      'Removes excess oil without disrupting the skin barrier. Niacinamide reduces pore appearance while ceramides lock in moisture.',
  },
  {
    id: 'cleanser-best-2',
    name: 'La Roche-Posay Toleriane Hydrating Gentle Cleanser',
    brand: 'La Roche-Posay',
    category: 'cleanser',
    tier: 'best',
    priceINR: 1499,
    keyIngredients: ['Ceramides', 'Niacinamide', 'Prebiotic Thermal Water'],
    suitableFor: ['dry', 'sensitive', 'normal'],
    routineSlot: 'both',
    stepOrder: 1,
    instructions:
      'Apply to damp skin, massage gently, and rinse with lukewarm water. Can also be used as a no-rinse micellar cleanser on a cotton pad.',
    imageUrl: IMG,
    whyItWorks:
      'pH-balanced formula cleanses without stripping moisture. Prebiotic thermal water soothes reactive skin while ceramides restore the barrier.',
  },
  {
    id: 'cleanser-value-1',
    name: 'Minimalist Salicylic Acid 2% Face Wash',
    brand: 'Minimalist',
    category: 'cleanser',
    tier: 'value',
    priceINR: 349,
    keyIngredients: ['Salicylic Acid 2%', 'Zinc PCA', 'Niacinamide'],
    suitableFor: ['oily', 'combination'],
    routineSlot: 'both',
    stepOrder: 1,
    instructions:
      'Massage onto wet skin for 60 seconds focusing on congested areas. Rinse thoroughly. Start with once daily to assess tolerance.',
    imageUrl: IMG,
    whyItWorks:
      'Salicylic acid penetrates pores to dissolve excess sebum and dead skin cells. Zinc PCA actively controls oil production throughout the day.',
  },
  {
    id: 'cleanser-value-2',
    name: 'Simple Kind To Skin Moisturising Facial Wash',
    brand: 'Simple',
    category: 'cleanser',
    tier: 'value',
    priceINR: 299,
    keyIngredients: ['Pro-Vitamin B5', 'Vitamin E', 'Bisabolol'],
    suitableFor: ['dry', 'sensitive', 'normal'],
    routineSlot: 'both',
    stepOrder: 1,
    instructions:
      'Wet face, apply a small amount, lather gently and rinse well. Suitable for twice-daily use.',
    imageUrl: IMG,
    whyItWorks:
      'No harsh chemicals, perfume or dyes. Pro-Vitamin B5 deeply hydrates while bisabolol calms irritation for a comfortable clean.',
  },
  {
    id: 'cleanser-budget-1',
    name: 'Himalaya Purifying Neem Face Wash',
    brand: 'Himalaya',
    category: 'cleanser',
    tier: 'budget',
    priceINR: 135,
    keyIngredients: ['Neem Leaf Extract', 'Turmeric', 'Aloe Vera'],
    suitableFor: ['oily', 'combination'],
    routineSlot: 'both',
    stepOrder: 1,
    instructions:
      'Squeeze a small amount onto wet hands, work into a lather and massage gently onto face. Rinse off with water.',
    imageUrl: IMG,
    whyItWorks:
      'Neem is a natural antibacterial that fights acne-causing bacteria. Turmeric brightens and reduces inflammation for clearer skin over time.',
  },
  {
    id: 'cleanser-budget-2',
    name: 'Biotique Bio Honey Gel Refreshing Foaming Face Wash',
    brand: 'Biotique',
    category: 'cleanser',
    tier: 'budget',
    priceINR: 119,
    keyIngredients: ['Honey', 'Aloe Vera', 'Wild Turmeric'],
    suitableFor: ['dry', 'sensitive', 'normal'],
    routineSlot: 'both',
    stepOrder: 1,
    instructions:
      'Apply a small amount to wet face, massage gently in circular motions and rinse with water.',
    imageUrl: IMG,
    whyItWorks:
      'Honey is a natural humectant that draws moisture into the skin. Aloe vera soothes and hydrates while wild turmeric gently brightens.',
  },

  // ── TONERS (stepOrder 2) ─────────────────────────────────────────────────
  {
    id: 'toner-best-1',
    name: 'Thayers Witch Hazel Alcohol-Free Toner',
    brand: 'Thayers',
    category: 'toner',
    tier: 'best',
    priceINR: 1299,
    keyIngredients: ['Witch Hazel', 'Aloe Vera', 'Rose Water'],
    suitableFor: ['oily', 'combination', 'sensitive'],
    routineSlot: 'both',
    stepOrder: 2,
    instructions:
      'After cleansing, apply to a cotton pad and sweep gently over face and neck. Allow to dry before next step. No rinsing needed.',
    imageUrl: IMG,
    whyItWorks:
      'Alcohol-free witch hazel tightens pores and removes residual impurities without over-drying. Aloe vera calms post-cleanse sensitivity.',
  },
  {
    id: 'toner-best-2',
    name: 'Minimalist Glycolic Acid 08% Toning Solution',
    brand: 'Minimalist',
    category: 'toner',
    tier: 'best',
    priceINR: 499,
    keyIngredients: ['Glycolic Acid 8%', 'Ginseng Root Extract', 'Tasmanian Pepperberry'],
    suitableFor: ['oily', 'combination', 'normal'],
    routineSlot: 'both',
    stepOrder: 2,
    instructions:
      'Apply with a cotton pad to face and neck avoiding the eye area. Use in the evening. Always follow with SPF in the morning. Start 2-3x per week.',
    imageUrl: IMG,
    whyItWorks:
      'Glycolic acid exfoliates dead skin cells to reveal brighter, smoother skin. Regular use visibly reduces pore size and uneven texture.',
  },
  {
    id: 'toner-value-1',
    name: 'Plum Green Tea Alcohol-Free Toner',
    brand: 'Plum',
    category: 'toner',
    tier: 'value',
    priceINR: 349,
    keyIngredients: ['Green Tea Extract', 'Glycerin', 'Witch Hazel'],
    suitableFor: ['oily', 'combination'],
    routineSlot: 'both',
    stepOrder: 2,
    instructions:
      'Shake well. Apply on face using a cotton pad or spray directly after cleansing. Follow with serum and moisturiser.',
    imageUrl: IMG,
    whyItWorks:
      'Green tea antioxidants neutralise free radicals that trigger oil overproduction. Glycerin provides a hydrating base to prevent rebound oiliness.',
  },
  {
    id: 'toner-value-2',
    name: 'Mamaearth Vitamin C Toner',
    brand: 'Mamaearth',
    category: 'toner',
    tier: 'value',
    priceINR: 299,
    keyIngredients: ['Vitamin C', 'Hyaluronic Acid', 'Niacinamide'],
    suitableFor: ['dry', 'normal'],
    routineSlot: 'both',
    stepOrder: 2,
    instructions:
      'After cleansing, soak a cotton pad with toner and gently swipe across face and neck. Use morning and night.',
    imageUrl: IMG,
    whyItWorks:
      'Vitamin C brightens dull skin and evens tone while hyaluronic acid delivers a burst of hydration to prep skin for serums.',
  },
  {
    id: 'toner-budget-1',
    name: 'WOW Skin Science Apple Cider Vinegar Foaming Toner',
    brand: 'WOW Skin Science',
    category: 'toner',
    tier: 'budget',
    priceINR: 199,
    keyIngredients: ['Apple Cider Vinegar', 'Witch Hazel', 'Aloe Vera'],
    suitableFor: ['oily', 'combination'],
    routineSlot: 'both',
    stepOrder: 2,
    instructions:
      'Pump onto a cotton pad and gently wipe across cleansed face. Avoid the eye area. Follow with moisturiser.',
    imageUrl: IMG,
    whyItWorks:
      'Apple cider vinegar restores skin pH and fights bacteria that cause breakouts. Witch hazel minimises pore appearance for a matte finish.',
  },
  {
    id: 'toner-budget-2',
    name: 'Himalaya Refreshing & Clarifying Toner',
    brand: 'Himalaya',
    category: 'toner',
    tier: 'budget',
    priceINR: 149,
    keyIngredients: ['Aloe Vera', 'Neem', 'Rose Water'],
    suitableFor: ['normal', 'combination'],
    routineSlot: 'both',
    stepOrder: 2,
    instructions:
      'Apply to a cotton ball and gently wipe over face after cleansing. Use twice daily for best results.',
    imageUrl: IMG,
    whyItWorks:
      'Refreshes and tightens pores while neem provides mild antibacterial action. Rose water leaves skin feeling soft and balanced.',
  },

  // ── SERUMS (stepOrder 3) ─────────────────────────────────────────────────
  {
    id: 'serum-best-1',
    name: 'The Ordinary Niacinamide 10% + Zinc 1%',
    brand: 'The Ordinary',
    category: 'serum',
    tier: 'best',
    priceINR: 599,
    keyIngredients: ['Niacinamide 10%', 'Zinc PCA 1%'],
    suitableFor: ['oily', 'combination'],
    routineSlot: 'both',
    stepOrder: 3,
    instructions:
      'Apply a few drops to face after toner. Allow to absorb before applying moisturiser. Suitable for AM and PM routines.',
    imageUrl: IMG,
    whyItWorks:
      'High-strength niacinamide visibly reduces pore size, controls excess oil and fades post-acne marks. Zinc balances sebum production.',
  },
  {
    id: 'serum-best-2',
    name: 'Minimalist Vitamin C 10% + Alpha Arbutin 1%',
    brand: 'Minimalist',
    category: 'serum',
    tier: 'best',
    priceINR: 699,
    keyIngredients: ['Ethyl Ascorbic Acid 10%', 'Alpha Arbutin 1%', 'Ferulic Acid'],
    suitableFor: ['dry', 'normal', 'sensitive'],
    routineSlot: 'both',
    stepOrder: 3,
    instructions:
      'Apply 2-3 drops onto face after cleansing and toning. Use in the morning followed by SPF. Start with every other day.',
    imageUrl: IMG,
    whyItWorks:
      'Stable Vitamin C form fades hyperpigmentation and brightens skin. Alpha arbutin inhibits melanin production for even skin tone.',
  },
  {
    id: 'serum-value-1',
    name: 'Plum 15% Vitamin C Face Serum',
    brand: 'Plum',
    category: 'serum',
    tier: 'value',
    priceINR: 449,
    keyIngredients: ['Vitamin C 15%', 'Mandarin Extract', 'Hyaluronic Acid'],
    suitableFor: ['oily', 'combination', 'normal', 'dry', 'sensitive'],
    routineSlot: 'both',
    stepOrder: 3,
    instructions:
      'After cleansing, take 2-3 drops and massage gently into face and neck. Follow with moisturiser. Use AM for best brightening results.',
    imageUrl: IMG,
    whyItWorks:
      'High Vitamin C concentration visibly brightens skin and fades dark spots. Mandarin extract provides additional antioxidant protection.',
  },
  {
    id: 'serum-value-2',
    name: 'Mamaearth Skin Illuminate Vitamin C Face Serum',
    brand: 'Mamaearth',
    category: 'serum',
    tier: 'value',
    priceINR: 349,
    keyIngredients: ['Vitamin C', 'Turmeric', 'Squalane'],
    suitableFor: ['dry', 'normal'],
    routineSlot: 'both',
    stepOrder: 3,
    instructions:
      'Take 2-3 drops and massage gently on face and neck. Use daily morning and night for visible results in 4 weeks.',
    imageUrl: IMG,
    whyItWorks:
      'Turmeric and Vitamin C synergistically brighten skin and reduce inflammation. Squalane locks in moisture without feeling greasy.',
  },
  {
    id: 'serum-budget-1',
    name: 'WOW Skin Science Vitamin C Serum',
    brand: 'WOW Skin Science',
    category: 'serum',
    tier: 'budget',
    priceINR: 249,
    keyIngredients: ['Vitamin C', 'Vitamin E', 'Hyaluronic Acid'],
    suitableFor: ['oily', 'combination', 'normal', 'dry', 'sensitive'],
    routineSlot: 'both',
    stepOrder: 3,
    instructions:
      'Apply 4-5 drops on face and neck after cleansing. Massage gently in upward strokes. Follow with moisturiser and SPF.',
    imageUrl: IMG,
    whyItWorks:
      'Vitamins C and E together provide powerful antioxidant protection. Hyaluronic acid plumps skin while brightening agents reduce dark spots.',
  },
  {
    id: 'serum-budget-2',
    name: 'Biotique Bio Dandelion Ageless Lightening Serum',
    brand: 'Biotique',
    category: 'serum',
    tier: 'budget',
    priceINR: 199,
    keyIngredients: ['Dandelion Extract', 'Aloe Vera', 'Vetiver'],
    suitableFor: ['dry', 'sensitive', 'normal'],
    routineSlot: 'both',
    stepOrder: 3,
    instructions:
      'Apply a small amount on face and neck and massage gently. Use twice daily for best results.',
    imageUrl: IMG,
    whyItWorks:
      'Dandelion extract is rich in antioxidants that fight free radical damage. Aloe vera deeply hydrates to plump fine lines naturally.',
  },

  // ── MOISTURISERS (stepOrder 4) ───────────────────────────────────────────
  {
    id: 'moisturiser-best-1',
    name: 'CeraVe Moisturising Cream',
    brand: 'CeraVe',
    category: 'moisturiser',
    tier: 'best',
    priceINR: 1299,
    keyIngredients: ['Ceramides 1, 3, 6-II', 'Hyaluronic Acid', 'MVE Technology'],
    suitableFor: ['dry', 'sensitive', 'normal'],
    routineSlot: 'both',
    stepOrder: 4,
    instructions:
      'Apply to face and body morning and night. Can be used on dry patches as a spot treatment. Fragrance-free and non-comedogenic.',
    imageUrl: IMG,
    whyItWorks:
      'Three essential ceramides restore the skin barrier while MVE technology releases moisture over 24 hours for all-day hydration.',
  },
  {
    id: 'moisturiser-best-2',
    name: 'Neutrogena Hydro Boost Water Gel',
    brand: 'Neutrogena',
    category: 'moisturiser',
    tier: 'best',
    priceINR: 999,
    keyIngredients: ['Hyaluronic Acid', 'Olive Extract', 'Dimethicone'],
    suitableFor: ['oily', 'combination'],
    routineSlot: 'both',
    stepOrder: 4,
    instructions:
      'Apply a small amount to face and neck after serum. The lightweight gel absorbs quickly leaving no greasy residue.',
    imageUrl: IMG,
    whyItWorks:
      'Hyaluronic acid holds 1000x its weight in water. The oil-free gel formula provides intense hydration without clogging pores or feeling heavy.',
  },
  {
    id: 'moisturiser-value-1',
    name: 'Minimalist Marula Oil 05% Moisturiser',
    brand: 'Minimalist',
    category: 'moisturiser',
    tier: 'value',
    priceINR: 499,
    keyIngredients: ['Marula Oil 5%', 'Squalane', 'Vitamin E'],
    suitableFor: ['dry', 'normal'],
    routineSlot: 'both',
    stepOrder: 4,
    instructions:
      'Take a pea-sized amount and massage evenly over face. Use morning and night. Ideal for dry and dehydrated skin types.',
    imageUrl: IMG,
    whyItWorks:
      'Marula oil is rich in oleic acid that mimics skin lipids for deep nourishment. Squalane seals moisture without feeling occlusive.',
  },
  {
    id: 'moisturiser-value-2',
    name: 'Plum Green Tea Oil-Free Moisturiser',
    brand: 'Plum',
    category: 'moisturiser',
    tier: 'value',
    priceINR: 399,
    keyIngredients: ['Green Tea Extract', 'Hyaluronic Acid', 'Glycerin'],
    suitableFor: ['oily', 'combination'],
    routineSlot: 'both',
    stepOrder: 4,
    instructions:
      'Take a small amount and massage gently into cleansed face and neck. Use AM and PM. Non-comedogenic.',
    imageUrl: IMG,
    whyItWorks:
      'Green tea antioxidants regulate sebum while hyaluronic acid delivers moisture without weight. The matte finish keeps oily skin shine-free.',
  },
  {
    id: 'moisturiser-budget-1',
    name: 'Nivea Soft Light Moisturiser',
    brand: 'Nivea',
    category: 'moisturiser',
    tier: 'budget',
    priceINR: 199,
    keyIngredients: ['Jojoba Oil', 'Vitamin E', 'Glycerin'],
    suitableFor: ['normal', 'combination', 'dry'],
    routineSlot: 'both',
    stepOrder: 4,
    instructions:
      'Apply a small amount to face and neck and massage gently until absorbed. Use daily morning and evening.',
    imageUrl: IMG,
    whyItWorks:
      'Lightweight jojoba oil closely resembles skin sebum for easy absorption. Vitamin E neutralises free radicals to keep skin looking fresh.',
  },
  {
    id: 'moisturiser-budget-2',
    name: "Pond's Light Moisturiser Non-Oily Fresh Feel",
    brand: "Pond's",
    category: 'moisturiser',
    tier: 'budget',
    priceINR: 149,
    keyIngredients: ['Vitamin E', 'Glycerin', 'Light Mineral Oil'],
    suitableFor: ['oily', 'combination', 'normal'],
    routineSlot: 'both',
    stepOrder: 4,
    instructions:
      'Take a small amount and apply on face. Massage gently until absorbed. Can be used under makeup.',
    imageUrl: IMG,
    whyItWorks:
      'Fast-absorbing formula provides instant hydration without heaviness. Vitamin E protects skin from daily environmental stressors.',
  },

  // ── SUNSCREENS (stepOrder 5) ─────────────────────────────────────────────
  {
    id: 'sunscreen-best-1',
    name: 'La Roche-Posay Anthelios UV Melt-In Cream SPF 50+',
    brand: 'La Roche-Posay',
    category: 'sunscreen',
    tier: 'best',
    priceINR: 1799,
    keyIngredients: ['Mexoryl XL', 'Tinosorb S', 'Thermal Spring Water'],
    suitableFor: ['sensitive', 'dry', 'normal'],
    routineSlot: 'morning',
    stepOrder: 5,
    instructions:
      'Apply generously as the last step of your morning routine. Reapply every 2 hours when outdoors. Do not rinse.',
    imageUrl: IMG,
    whyItWorks:
      'Patented Mexoryl XL provides broad-spectrum UVA/UVB protection. Thermal spring water soothes reactive skin post-application.',
  },
  {
    id: 'sunscreen-best-2',
    name: 'Neutrogena Ultra Sheer Dry-Touch Sunblock SPF 50+',
    brand: 'Neutrogena',
    category: 'sunscreen',
    tier: 'best',
    priceINR: 699,
    keyIngredients: ['Avobenzone', 'Helioplex Technology', 'Octisalate'],
    suitableFor: ['oily', 'combination', 'normal'],
    routineSlot: 'morning',
    stepOrder: 5,
    instructions:
      'Apply liberally 15 minutes before sun exposure. Reapply after 2 hours of sun exposure or after swimming. For daily use, apply after moisturiser.',
    imageUrl: IMG,
    whyItWorks:
      'Helioplex Technology provides superior photostabilised broad-spectrum protection. The dry-touch finish is non-greasy making it ideal for oily skin.',
  },
  {
    id: 'sunscreen-value-1',
    name: 'Minimalist Sunscreen SPF 50 PA++++',
    brand: 'Minimalist',
    category: 'sunscreen',
    tier: 'value',
    priceINR: 399,
    keyIngredients: ['Homosalate', 'Octisalate', 'Avobenzone', 'Octocrylene'],
    suitableFor: ['oily', 'combination', 'normal', 'dry', 'sensitive'],
    routineSlot: 'morning',
    stepOrder: 5,
    instructions:
      'Apply as the final step of morning skincare. Use ¼ teaspoon (1.25ml) for the face. Reapply every 2-3 hours when outdoors.',
    imageUrl: IMG,
    whyItWorks:
      'High PA++++ rating means excellent UVA protection that prevents pigmentation and premature ageing. Suitable for all Indian skin tones.',
  },
  {
    id: 'sunscreen-value-2',
    name: 'Dot & Key Mineral Matte Sunscreen SPF 50 PA++++',
    brand: 'Dot & Key',
    category: 'sunscreen',
    tier: 'value',
    priceINR: 549,
    keyIngredients: ['Zinc Oxide', 'Titanium Dioxide', 'Niacinamide'],
    suitableFor: ['oily', 'combination'],
    routineSlot: 'morning',
    stepOrder: 5,
    instructions:
      'Apply as last step in AM routine. Blend well for a natural matte finish. Reapply every 2 hours under the sun.',
    imageUrl: IMG,
    whyItWorks:
      'Mineral filters provide gentle, reef-safe sun protection. Niacinamide controls oil while mattifying agents keep shine in check all day.',
  },
  {
    id: 'sunscreen-budget-1',
    name: 'Lotus Herbals Safe Sun UV Screen Matte Gel SPF 50',
    brand: 'Lotus Herbals',
    category: 'sunscreen',
    tier: 'budget',
    priceINR: 249,
    keyIngredients: ['Avobenzone', 'Octinoxate', 'Aloe Vera'],
    suitableFor: ['oily', 'combination'],
    routineSlot: 'morning',
    stepOrder: 5,
    instructions:
      'Apply on face and neck 20 minutes before going outdoors. Reapply every 2-3 hours for continued protection.',
    imageUrl: IMG,
    whyItWorks:
      'Gel-based formula provides matte SPF 50 protection without a white cast. Aloe vera soothes and keeps skin comfortable throughout the day.',
  },
  {
    id: 'sunscreen-budget-2',
    name: 'Lakme Sun Expert Tinted Sunscreen SPF 50 PA+++',
    brand: 'Lakme',
    category: 'sunscreen',
    tier: 'budget',
    priceINR: 189,
    keyIngredients: ['Avobenzone', 'Titanium Dioxide', 'Aloe Vera'],
    suitableFor: ['normal', 'dry'],
    routineSlot: 'morning',
    stepOrder: 5,
    instructions:
      'Apply evenly on face and exposed areas before stepping outdoors. Reapply as needed for extended outdoor activity.',
    imageUrl: IMG,
    whyItWorks:
      'Lightweight tinted formula evens skin tone while providing sun protection. Suitable for Indian skin tones without the white cast of untinted sunscreens.',
  },
];

// ── Seed function ─────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const col = db.collection('products');
  const batch = db.batch();

  for (const product of products) {
    const ref = col.doc(product.id);
    batch.set(ref, product);
  }

  await batch.commit();
  console.log(`✅  Seeded ${products.length} products to Firestore 'products' collection.`);

  // Print a quick summary
  const summary: Record<string, Record<string, number>> = {};
  for (const p of products) {
    if (!summary[p.category]) summary[p.category] = {};
    summary[p.category][p.tier] = (summary[p.category][p.tier] ?? 0) + 1;
  }
  console.table(summary);
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  });

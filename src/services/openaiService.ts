/**
 * openaiService.ts
 *
 * Calls GPT-4o Vision directly via fetch (no SDK dependency).
 * The API key is read from src/config/openaiConfig.ts — that file is
 * gitignored and never committed.
 *
 * TO SWITCH BACK TO THE CLOUD FUNCTION (once Firebase billing is enabled):
 *   Replace the entire body of identifyProductFromImage with an
 *   authenticated fetch to:
 *   https://identifyproduct-213529858076.asia-south1.run.app
 *   (same pattern as FaceScanScreen → analyseSkine)
 */

import { OPENAI_API_KEY } from '../config/openaiConfig';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProductIdentifiers {
  brand: string;
  product_name: string;
  barcode: string | null;
}

// ── API call ──────────────────────────────────────────────────────────────────

export async function identifyProductFromImage(
  imageBase64: string,
): Promise<ProductIdentifiers> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
    throw new Error(
      'OpenAI API key not set. Open src/config/openaiConfig.ts and paste your key.',
    );
  }

  // ── Network request ─────────────────────────────────────────────────────────
  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
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
                  detail: 'low', // cheaper + faster for label reads
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
      }),
    });
  } catch {
    throw new Error('Network error — check your internet connection and try again.');
  }

  // ── Parse response ──────────────────────────────────────────────────────────
  const rawText = await response.text();

  let json: any;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`Server error (HTTP ${response.status}). Please try again.`);
  }

  if (!response.ok) {
    const errMsg: string = json?.error?.message ?? `HTTP ${response.status}`;
    // Surface useful messages for common errors
    if (response.status === 401) throw new Error('Invalid API key. Check src/config/openaiConfig.ts.');
    if (response.status === 429) throw new Error('OpenAI rate limit reached. Try again in a moment.');
    throw new Error(errMsg);
  }

  // Strip markdown fences — GPT-4o sometimes wraps JSON in ```json ... ```
  const raw: string = json?.choices?.[0]?.message?.content ?? '';
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  let parsed: Partial<ProductIdentifiers>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      'Could not read product details from image. Try a clearer photo with the label fully visible.',
    );
  }

  if (!parsed.brand || !parsed.product_name) {
    throw new Error(
      'Product label not clearly visible. Make sure the full label is in frame and try again.',
    );
  }

  return {
    brand:        String(parsed.brand).trim(),
    product_name: String(parsed.product_name).trim(),
    barcode:      parsed.barcode ? String(parsed.barcode).trim() : null,
  };
}

/**
 * Translation service.
 *
 * Primary:  DeepL API Free (when DEEPL_API_KEY is set)
 * Fallback: Google Translate's free unofficial endpoint (no key required)
 *
 * DeepL Free tier: 500,000 characters/month, 33 languages, official SLA.
 * Google fallback: unlimited but unofficial, no SLA, may break at any time.
 */

import * as deepl from 'deepl-node';

// ─── DeepL client (lazy-initialised) ────────────────────────────────────────

let deeplTranslator: deepl.Translator | null = null;

function getDeeplTranslator(): deepl.Translator | null {
  if (deeplTranslator) return deeplTranslator;

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return null;

  deeplTranslator = new deepl.Translator(apiKey);
  console.log('[Translator] DeepL API initialised (Free tier)');
  return deeplTranslator;
}

// ─── Language code mapping ──────────────────────────────────────────────────

/**
 * DeepL uses slightly different language codes than ISO 639-1 in some cases.
 * This maps our app's language codes (ISO 639-1) to DeepL target language codes.
 *
 * Notable differences:
 * - English requires a variant: 'en-US' or 'en-GB' (we default to 'en-US')
 * - Portuguese requires a variant: 'pt-BR' or 'pt-PT' (we default to 'pt-BR')
 */
function toDeeplTargetLang(lang: string): deepl.TargetLanguageCode {
  const map: Record<string, deepl.TargetLanguageCode> = {
    'en': 'en-US',
    'pt': 'pt-BR',
  };
  return (map[lang.toLowerCase()] || lang.toLowerCase()) as deepl.TargetLanguageCode;
}

function toDeeplSourceLang(lang: string): deepl.SourceLanguageCode | null {
  // DeepL accepts standard ISO 639-1 codes for source language
  // Return null to let DeepL auto-detect
  if (!lang || lang === 'auto') return null;
  return lang.toLowerCase() as deepl.SourceLanguageCode;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Translate text from one language to another.
 *
 * @param text           The text to translate
 * @param sourceLang     ISO 639-1 language code of the source (e.g. "en")
 * @param targetLang     ISO 639-1 language code of the target (e.g. "es")
 * @returns              The translated text
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  // No translation needed if same language
  if (sourceLang === targetLang) {
    return text;
  }

  // Try DeepL first
  const translator = getDeeplTranslator();
  if (translator) {
    return translateWithDeepL(translator, text, sourceLang, targetLang);
  }

  // Fall back to Google Translate
  console.warn('[Translator] DEEPL_API_KEY not set, using Google Translate fallback');
  return translateWithGoogle(text, sourceLang, targetLang);
}

// ─── DeepL implementation ───────────────────────────────────────────────────

async function translateWithDeepL(
  translator: deepl.Translator,
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  try {
    const result = await translator.translateText(
      text,
      toDeeplSourceLang(sourceLang),
      toDeeplTargetLang(targetLang)
    );

    // translateText returns a single TextResult when given a string
    const translated = (result as deepl.TextResult).text;
    if (translated) {
      return translated;
    }

    console.error('[Translator] DeepL returned empty result, falling back to Google');
    return translateWithGoogle(text, sourceLang, targetLang);
  } catch (err) {
    console.error('[Translator] DeepL error, falling back to Google:', err);
    return translateWithGoogle(text, sourceLang, targetLang);
  }
}

// ─── Google Translate fallback ──────────────────────────────────────────────

async function translateWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  try {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: sourceLang,
      tl: targetLang,
      dt: 't',
      q: text,
    });

    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?${params.toString()}`
    );

    if (!response.ok) {
      console.error(`[Translator] Google API returned ${response.status}`);
      return text; // Return original on failure
    }

    const data = await response.json() as unknown[][];

    // Google returns nested arrays: [[["translated text","original text",null,null,10]],null,"en"]
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const sentences = data[0] as unknown[][];
      const translated = sentences
        .map((sentence: unknown[]) => (sentence && sentence[0]) || '')
        .join('');

      if (translated) {
        return translated;
      }
    }

    console.error('[Translator] Unexpected Google response format:', JSON.stringify(data).slice(0, 200));
    return text;
  } catch (err) {
    console.error('[Translator] Google network error:', err);
    return text; // Return original on failure
  }
}

/**
 * Translation service using Google Translate's free API.
 * Uses the unofficial but reliable translate.googleapis.com endpoint.
 * No API key required.
 */

/**
 * Translate text from one language to another.
 *
 * @param text           The text to translate
 * @param sourceLang     ISO language code of the source (e.g. "en")
 * @param targetLang     ISO language code of the target (e.g. "es")
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
      console.error(`[Translator] API returned ${response.status}`);
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

    console.error('[Translator] Unexpected response format:', JSON.stringify(data).slice(0, 200));
    return text;
  } catch (err) {
    console.error('[Translator] Network error:', err);
    return text; // Return original on failure
  }
}

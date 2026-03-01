/**
 * Translation service using MyMemory free translation API.
 * No API key required. Free tier: 5000 chars/day (anonymous).
 * https://mymemory.translated.net/doc/spec.php
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
      q: text,
      langpair: `${sourceLang}|${targetLang}`,
    });

    const response = await fetch(
      `https://api.mymemory.translated.net/get?${params.toString()}`
    );

    if (!response.ok) {
      console.error(`[Translator] API returned ${response.status}`);
      return `[${sourceLang}→${targetLang}] ${text}`;
    }

    const data = await response.json() as {
      responseStatus: number;
      responseData?: { translatedText: string };
      responseDetails?: string;
    };

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }

    // Fallback if API returns an error
    console.error('[Translator] API error:', data.responseStatus, data.responseDetails);
    return `[${sourceLang}→${targetLang}] ${text}`;
  } catch (err) {
    console.error('[Translator] Network error:', err);
    // Graceful fallback — return original text with language tag
    return `[${sourceLang}→${targetLang}] ${text}`;
  }
}

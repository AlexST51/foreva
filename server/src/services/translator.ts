/**
 * Translation service stub.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  TO INTEGRATE A REAL TRANSLATION API:                              │
 * │                                                                    │
 * │  1. Install the SDK (e.g. `npm install @google-cloud/translate`    │
 * │     or `npm install deepl-node`).                                  │
 * │                                                                    │
 * │  2. Set the API key in your environment:                           │
 * │     TRANSLATION_API_KEY=your-key-here                              │
 * │                                                                    │
 * │  3. Replace the body of translateText() below with the real call.  │
 * │     The function signature stays the same.                         │
 * └─────────────────────────────────────────────────────────────────────┘
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
  // ── STUB: Replace this with a real translation API call ──
  // Example with Google Translate:
  //   const { Translate } = require('@google-cloud/translate').v2;
  //   const translate = new Translate({ key: process.env.TRANSLATION_API_KEY });
  //   const [translation] = await translate.translate(text, targetLang);
  //   return translation;

  // For now, return a clearly marked stub translation
  if (sourceLang === targetLang) {
    return text;
  }

  return `[${sourceLang}→${targetLang}] ${text}`;
}

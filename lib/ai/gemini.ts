import 'server-only';

/**
 * Appel minimal à l'API Gemini (generateContent) avec sortie JSON typée par
 * schéma. La clé reste côté serveur : sans `GEMINI_API_KEY`, l'analyse est
 * simplement désactivée plutôt que d'échouer.
 */
export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function generateJson<T>(prompt: string, responseSchema: object, timeoutMs = 20_000): Promise<T> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('Gemini non configuré.');
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.1 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Gemini ${response.status}`);
  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  return JSON.parse(text) as T;
}

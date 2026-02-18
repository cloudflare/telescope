import { ContentRating } from '@/lib/classes/TestConfig';

/**
 * Fetch the URL, extract visible text, run it through llama-guard-3-8b,
 * and return a ContentRating.
 *
 * llama-guard-3-8b is a conversation classifier: pass the page content as a
 * user message. Use json_object response_format to get { safe: boolean }.
 * https://developers.cloudflare.com/workers-ai/models/llama-guard-3-8b/
 */
export async function rateUrlContent(
  url: string,
  ai: Ai,
): Promise<ContentRating> {
  // Fetch the page and extract visible text
  let pageText: string;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TelescopeBot/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    const html = await response.text();
    pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000); // keep prompt size reasonable
  } catch {
    return ContentRating.UNKNOWN;
  }

  if (!pageText) return ContentRating.UNKNOWN;

  // Pass page content as the user message — llama-guard classifies it.
  // json_object format returns { safe: boolean, categories: string[] }
  try {
    const result = await ai.run('@cf/meta/llama-guard-3-8b', {
      messages: [{ role: 'user', content: pageText }],
      response_format: { type: 'json_object' },
    });

    const json = result as { response?: { safe?: boolean } };
    if (json?.response?.safe === true) return ContentRating.SAFE;
    if (json?.response?.safe === false) return ContentRating.UNSAFE;
    return ContentRating.UNKNOWN;
  } catch {
    return ContentRating.UNKNOWN;
  }
}

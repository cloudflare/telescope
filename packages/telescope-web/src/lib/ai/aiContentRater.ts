import { z } from 'zod';

import { ContentRating } from '@/lib/types/tests';


// helper to extract text from metrics.json
function extractTextFromMetrics(metricsBytes: Uint8Array): string {
  const metricsJson = JSON.parse(new TextDecoder('utf-8').decode(metricsBytes));
  const parts: string[] = [];
  const lcpEvents: Array<{
    element?: { content?: string; outerHTML?: string };
  }> = metricsJson.largestContentfulPaint ?? [];
  for (const lcp of lcpEvents) {
    if (lcp.element?.content) {
      parts.push(lcp.element.content);
    } else if (lcp.element?.outerHTML) {
      parts.push(lcp.element.outerHTML.replace(/<[^>]+>/g, ' ').trim());
    }
  }
  if (metricsJson.navigationTiming?.name) {
    parts.push(metricsJson.navigationTiming.name);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// helper to scrape text from url
async function scrapeUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'TelescopetestBot/1.0' },
    signal: AbortSignal.timeout(10_000),
  });
  const html = await response.text();
  return html;
}

// Zod schemas validate Workers AI responses, which are typed as `unknown` /
// `Record<string, unknown>` by the platform. Schema mismatches fail closed.
const TextRatingSchema = z.object({
  response: z.object({
    safe: z.boolean(),
    categories: z.array(z.string()).optional(),
  }),
});

const VisionRatingSchema = z.object({
  response: z.string(),
});

type SignalResult = 'safe' | 'unsafe' | 'unknown';

async function checkText(
  ai: Ai,
  url: string,
  metricsBytes: Uint8Array | undefined,
): Promise<SignalResult> {
  if (!metricsBytes) return 'unknown';
  try {
    const [metricsText, scrapedText] = await Promise.allSettled([
      Promise.resolve(extractTextFromMetrics(metricsBytes)),
      scrapeUrl(url),
    ]);
    const combined = [
      metricsText.status === 'fulfilled' ? metricsText.value : '',
      scrapedText.status === 'fulfilled' ? scrapedText.value : '',
    ]
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100000);
    if (!combined) return 'unknown';

    const textResult = await ai.run('@cf/meta/llama-guard-3-8b', {
      messages: [{ role: 'user', content: combined }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });
    const parsed = TextRatingSchema.safeParse(textResult);
    if (!parsed.success) {
      console.error('[AI] llama-guard schema mismatch:', textResult);
      return 'unknown';
    }
    // safe === false means at least one S1–S14 category was flagged
    // unsafe categories: https://huggingface.co/meta-llama/Llama-Guard-3-8B
    return parsed.data.response.safe ? 'safe' : 'unsafe';
  } catch (e) {
    console.error('[AI] text classifier failed:', e);
    return 'unknown';
  }
}

async function checkVision(
  ai: Ai,
  screenshotBytes: Uint8Array | undefined,
): Promise<SignalResult> {
  if (!screenshotBytes) return 'unknown';
  try {
    // pass screenshot in as base64 encoding, chunked to prevent overflow
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < screenshotBytes.length; i += chunkSize) {
      binary += String.fromCharCode(
        ...screenshotBytes.subarray(i, i + chunkSize),
      );
    }
    const base64 = btoa(binary);
    const dataUrl = `data:image/png;base64,${base64}`;
    const visionResult = await ai.run(
      '@cf/meta/llama-3.2-11b-vision-instruct',
      {
        messages: [
          {
            role: 'system',
            content:
              'You are a content safety classifier. You must respond with exactly one word: "UNSAFE" if the screenshot contains violence, weapons, sexual content, hate speech, suicide, self-harm, private information, or illegal activity, "SAFE" if the content does not, and "UNSAFE" if you cannot decide. No other words, no punctuation, no explanation.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: dataUrl },
              },
              {
                type: 'text',
                text: 'Does this screenshot contain violence, sexual content, hate speech, self-harm, or illegal activity? Be very strict. One word only: SAFE or UNSAFE.',
              },
            ],
          },
        ],
        max_tokens: 5,
      },
    );
    const parsed = VisionRatingSchema.safeParse(visionResult);
    if (!parsed.success) {
      console.error('[AI] vision schema mismatch:', visionResult);
      return 'unknown';
    }
    const cleaned = parsed.data.response
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
    if (cleaned === 'UNSAFE') return 'unsafe';
    if (cleaned === 'SAFE') return 'safe';
    return 'unknown';
  } catch (e) {
    console.error('[AI] vision classifier failed:', e);
    return 'unknown';
  }
}

export async function rateUrlContent(
  ai: Ai,
  url: string,
  metricsBytes: Uint8Array | undefined,
  screenshotBytes: Uint8Array | undefined,
): Promise<ContentRating> {
  const [text, vision] = await Promise.all([
    checkText(ai, url, metricsBytes),
    checkVision(ai, screenshotBytes),
  ]);
  if (text === 'unsafe' || vision === 'unsafe') return ContentRating.UNSAFE;
  if (text === 'safe' && vision === 'safe') return ContentRating.SAFE;
  // fail closed: any 'unknown', missing signal, or partial result → UNSAFE
  return ContentRating.UNSAFE;
}

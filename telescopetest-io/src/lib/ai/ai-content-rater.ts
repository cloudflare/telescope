import { ContentRating } from '@/lib/classes/TestConfig';

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
  return html
    .replace(/<(script|style|noscript|head|template)[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function rateUrlContent(
  ai: Ai,
  url: string,
  metricsBytes: Uint8Array | undefined,
  screenshotBytes: Uint8Array | undefined,
): Promise<ContentRating> {
  // first check text with llama-guard-3-8b
  // combine metrics LCP text with whatever static HTML scraping can get
  if (metricsBytes) {
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
        .slice(0, 4000);
      // console.log('pageText: ', combined);
      if (combined) {
        const textResult = await ai.run('@cf/meta/llama-guard-3-8b', {
          messages: [{ role: 'user', content: combined }],
          temperature: 0,
          response_format: { type: 'json_object' },
        });
        const textRating = (
          textResult as { response: { safe: boolean; categories: string[] } }
        ).response;
        console.log(
          'ai-content-rater text result: ',
          JSON.stringify(textRating),
        );
        if (textRating?.safe === false) return ContentRating.UNSAFE;
        // safe === false means at least one S1–S14 category was flagged
        // unsafe categories: https://huggingface.co/meta-llama/Llama-Guard-3-8B
      }
    } catch (e) {
      console.log('ERROR in text context check: ', e);
    }
  }
  // then check screenshot with llama-3.2-11b-vision-instruct
  if (screenshotBytes) {
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
      const visionRating = (visionResult as { response: string }).response
        ?.trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
      console.log('ai-content-rater image result: ', visionRating);
      if (visionRating === 'UNSAFE') return ContentRating.UNSAFE;
      if (visionRating === 'SAFE') return ContentRating.SAFE;
    } catch (e) {
      console.log('ERROR in vision check: ', e);
    }
  }
  // if didn't already return SAFE, default to returning UNSAFE
  return ContentRating.UNSAFE;
}

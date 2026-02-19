import { ContentRating } from '@/lib/classes/TestConfig';
import type { Unzipped } from 'fflate';

/**
 * Extract meaningful text from metrics.json.
 * Pulls the LCP element text — this is what the browser actually rendered as
 * the most prominent element on the page after JS ran.
 */
function extractTextFromMetrics(metricsBytes: Uint8Array): string {
  const decoder = new TextDecoder('utf-8');
  const metricsJson = JSON.parse(decoder.decode(metricsBytes));
  const parts: string[] = [];
  // LCP element content — the main rendered headline/hero text
  const lcpEvents: Array<{
    element?: { content?: string; outerHTML?: string };
  }> = metricsJson.largestContentfulPaint ?? [];
  for (const lcp of lcpEvents) {
    if (lcp.element?.content) {
      parts.push(lcp.element.content);
    } else if (lcp.element?.outerHTML) {
      // strip tags from outerHTML as fallback
      parts.push(lcp.element.outerHTML.replace(/<[^>]+>/g, ' ').trim());
    }
  }
  // Final navigated URL — useful context for the model
  if (metricsJson.navigationTiming?.name) {
    parts.push(metricsJson.navigationTiming.name);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
}

export async function rateUrlContent(
  unzipped: Unzipped,
  ai: Ai,
): Promise<ContentRating> {
  let textPassed = false;
  const metricsBytes = unzipped['metrics.json'];
  if (!metricsBytes) {
    console.log('ai-content-rater: no metrics.json in zip');
  } else {
    try {
      const pageText = extractTextFromMetrics(metricsBytes);
      console.log('ai-content-rater pageText: ', pageText);
      if (pageText) {
        const textResult = await ai.run('@cf/meta/llama-guard-3-8b', {
          messages: [{ role: 'user', content: pageText }],
        });
        // response is plain text: "safe" or "unsafe\nS10" etc.
        const textRating = (textResult as { response: string }).response
          ?.trim()
          .toLowerCase();
        console.log('ai-content-rater text result: ', textRating);
        // Return immediately if text is unsafe — no need to run vision
        if (textRating?.startsWith('unsafe')) return ContentRating.UNSAFE;
        if (textRating === 'safe') textPassed = true;
      }
    } catch (e) {
      console.log('ai-content-rater ERROR in text check: ', e);
    }
  }

  // --- Vision check via llama-3.2-11b-vision-instruct ---
  const screenshotBytes = unzipped['screenshot.png'];
  if (!screenshotBytes) {
    console.log('ai-content-rater: no screenshot.png in zip');
  } else {
    try {
      // Convert bytes to base64 data URL — the current (non-deprecated) way to
      // pass images to this model is via messages with image_url content blocks.
      // Use chunked conversion to avoid call stack overflow on large screenshots —
      // spreading all bytes as args to String.fromCharCode exceeds stack limits.
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
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: dataUrl },
                },
                {
                  type: 'text',
                  text: 'Does this screenshot contain any unsafe content such as violence, explicit sexual content, hate speech, self-harm, or illegal activity? Answer only SAFE or UNSAFE.',
                },
              ],
            },
          ],
          max_tokens: 10,
        },
      );
      const visionRating = (visionResult as { response: string }).response
        ?.trim()
        .toUpperCase();
      console.log('ai-content-rater vision result: ', visionRating);
      if (visionRating?.includes('UNSAFE')) return ContentRating.UNSAFE;
      if (visionRating?.includes('SAFE')) return ContentRating.SAFE;
    } catch (e) {
      console.log('ai-content-rater ERROR in vision check: ', e);
    }
  }
  // Text passed but vision was inconclusive or missing — trust text result
  if (textPassed) return ContentRating.SAFE;
  return ContentRating.UNKNOWN;
}

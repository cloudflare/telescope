import * as fs from 'fs';
import * as path from 'path';
import * as ejs from 'ejs';
import { fileURLToPath } from 'url';
import type {
  HarEntry,
  LayoutShift,
  ConsoleMessage,
  Metrics,
  NavigationTiming,
  PaintTiming,
  ServerTiming,
} from '../src/types.js';

interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  size: number;
  type: string;
  start_time: number;
  duration: number;
  mime_type: string;
  timings: {
    dns_time: number;
    connect_time: number;
    ssl_time: number;
    send_time: number;
    wait_time: number;
    receive_time: number;
    total_time: number;
    dns_pct: number;
    connect_pct: number;
    ssl_pct: number;
    send_pct: number;
    wait_pct: number;
    receive_pct: number;
    response_start: number;
    response_end: number;
  };
}

interface TimingPhases {
  dns_time: number;
  tcp_time: number;
  ssl_time: number;
  request_time: number;
  response_time: number;
  dom_processing: number;
  dom_content_loaded: number;
  complete_load: number;
  total_time: number;
  dns_pct: number;
  tcp_pct: number;
  ssl_pct: number;
  request_pct: number;
  response_pct: number;
  processing_pct: number;
  dom_content_pct: number;
  complete_pct: number;
}

interface TimelinePhase {
  colorClass: string;
  label: string;
  timing: string;
  widthPct: string;
}

interface NetworkDataEntry {
  url: string;
  fullUrl: string;
  method: string;
  status: string;
  size: string;
  type: string;
  startTime: string;
  duration: string;
  startPct: string;
  durationPct: string;
  timelinePhases: TimelinePhase[];
}

interface HarLog {
  log?: {
    entries?: HarEntry[];
  };
}

function loadJsonFile<T = unknown>(filepath: string): T {
  let data = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(data) as T;
}

function getResourceTypeFromMime(mimeType: string | null | undefined): string {
  if (!mimeType) return 'other';

  const mime = mimeType.toLowerCase();
  if (mime.includes('html')) return 'document';
  if (mime.includes('css') || mime.includes('stylesheet')) return 'stylesheet';
  if (mime.includes('javascript') || mime.includes('ecmascript'))
    return 'script';
  if (mime.includes('image') || mime.includes('svg')) return 'image';
  if (mime.includes('font') || mime.includes('woff') || mime.includes('ttf'))
    return 'font';
  if (mime.includes('json')) return 'json';
  if (mime.includes('video')) return 'media';

  return 'other';
}

function formatNumber(num: number | string): string {
  if (typeof num === 'number') {
    return Math.floor(num).toLocaleString();
  }
  return String(num);
}

function getRating(metricName: string, value: number): string {
  if (metricName === 'LCP') {
    if (value <= 2500) return 'Good';
    if (value <= 4000) return 'Needs Improvement';
    return 'Poor';
  } else if (metricName === 'CLS') {
    if (value <= 0.1) return 'Good';
    if (value <= 0.25) return 'Needs Improvement';
    return 'Poor';
  } else if (metricName === 'TBT') {
    if (value <= 200) return 'Good';
    if (value <= 600) return 'Needs Improvement';
    return 'Poor';
  }
  return 'N/A';
}

function findFilmstripImages(
  basePath: string,
): Array<{ path: string; filename: string }> {
  const filmstripPath = path.join(basePath, 'filmstrip');
  if (!fs.existsSync(filmstripPath)) {
    return [];
  }

  const images: Array<{ path: string; filename: string }> = [];
  const files = fs
    .readdirSync(filmstripPath)
    .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
    .sort();
  for (let filename of files) {
    images.push({
      path: `filmstrip/${filename}`,
      filename: filename,
    });
  }

  return images;
}

function findFinalScreenshotFile(basePath: string): string | null {
  const screenshotPath = path.join(basePath, 'screenshot.png');
  if (fs.existsSync(screenshotPath)) {
    return 'screenshot.png';
  }
  return null;
}

function findVideoFile(basePath: string): string | null {
  const extensions = ['webm', 'mp4'];
  for (let ext of extensions) {
    let files = fs.readdirSync(basePath).filter(f => f.endsWith(`.${ext}`));
    if (files.length > 0) {
      return files[0];
    }
  }
  return null;
}

function calculateCls(layoutShifts: LayoutShift[]): number {
  if (!layoutShifts || layoutShifts.length === 0) return 0;
  return layoutShifts.reduce((sum, shift) => sum + (shift.value || 0), 0);
}

function parseHarFile(harPath: string): NetworkRequest[] | null {
  if (!fs.existsSync(harPath)) {
    return null;
  }

  try {
    let harData = loadJsonFile<HarLog>(harPath);
    let log = harData.log || {};
    let entries: HarEntry[] = log.entries || [];
    if (entries.length === 0) {
      return null;
    }

    let pageStart: Date | null = null;
    if (entries.length > 0) {
      let pageStartStr = entries[0].startedDateTime;
      if (pageStartStr) {
        pageStart = new Date(pageStartStr);
      }
    }

    let requests: NetworkRequest[] = [];
    for (let entry of entries) {
      let request = entry.request || { url: '', method: 'GET' };
      let response = entry.response || {
        status: 0,
        content: { size: 0, mimeType: '' },
      };
      let url = request.url || '';
      let method = request.method || 'GET';
      let status = response.status || 0;
      let size = response._transferSize || 0;
      if (!size) {
        size = response.content?.size || 0;
      }

      let mimeType = response.content?.mimeType || '';
      let resourceType = getResourceTypeFromMime(mimeType);
      let startedStr = entry.startedDateTime;
      let totalTime = entry.time || 0;
      let relativeStart = 0;
      if (startedStr && pageStart) {
        let started = new Date(startedStr);
        relativeStart = started.getTime() - pageStart.getTime();
      }

      let dnsStart = entry._dns_start || 0;
      let dnsEnd = entry._dns_end || 0;
      let connectStart = entry._connect_start || 0;
      let connectEnd = entry._connect_end || 0;
      let secureStart = entry._secure_start || 0;
      let secureEnd = entry._secure_end || 0;
      let requestStart = entry._request_start || 0;
      let requestEnd = entry._request_end || 0;
      let responseStart = entry._response_start || 0;
      let responseEnd = entry._response_end || 0;
      let dns = dnsEnd - dnsStart;
      let connect = connectEnd - connectStart;
      let ssl = secureEnd - secureStart;
      let send = requestEnd - requestStart;
      let wait = responseStart - requestEnd;
      let receive = responseEnd - responseStart;
      let total = responseEnd - requestStart;
      let dnsPct = total > 0 && dns > 0 ? (dns / total) * 100 : 0;
      let connectPct = total > 0 && connect > 0 ? (connect / total) * 100 : 0;
      let sslPct = total > 0 && ssl > 0 ? (ssl / total) * 100 : 0;
      let sendPct = total > 0 ? (send / total) * 100 : 0;
      let waitPct = total > 0 ? (wait / total) * 100 : 0;
      let receivePct = total > 0 ? (receive / total) * 100 : 0;

      requests.push({
        url,
        method,
        status,
        size,
        type: resourceType,
        start_time: relativeStart,
        duration: totalTime,
        mime_type: mimeType,
        timings: {
          dns_time: dns,
          connect_time: connect,
          ssl_time: ssl,
          send_time: send,
          wait_time: wait,
          receive_time: receive,
          total_time: total,
          dns_pct: dnsPct,
          connect_pct: connectPct,
          ssl_pct: sslPct,
          send_pct: sendPct,
          wait_pct: waitPct,
          receive_pct: receivePct,
          response_start: responseStart,
          response_end: responseEnd,
        },
      });
    }
    return requests;
  } catch (e) {
    console.error(`Error parsing HAR file: ${e}`);
    return null;
  }
}

function calculateTimingPhases(
  navTiming: Partial<NavigationTiming>,
): TimingPhases {
  let dnsTime =
    (navTiming.domainLookupEnd || 0) - (navTiming.domainLookupStart || 0);
  let tcpTime = (navTiming.connectEnd || 0) - (navTiming.connectStart || 0);
  let sslTime =
    (navTiming.connectEnd || 0) - (navTiming.secureConnectionStart || 0);
  let requestTime =
    (navTiming.responseStart || 0) - (navTiming.requestStart || 0);
  let responseTime =
    (navTiming.responseEnd || 0) - (navTiming.responseStart || 0);
  let domProcessing =
    (navTiming.domInteractive || 0) - (navTiming.domLoading || 0);
  let domContentLoaded =
    (navTiming.domContentLoadedEventEnd || 0) - (navTiming.domInteractive || 0);
  let completeLoad =
    (navTiming.domComplete || 0) - (navTiming.domContentLoadedEventEnd || 0);
  let totalTime =
    (navTiming.domComplete || 0) - (navTiming.navigationStart || 0);
  let dnsPct = totalTime > 0 ? (dnsTime / totalTime) * 100 : 0;
  let tcpPct = totalTime > 0 ? (tcpTime / totalTime) * 100 : 0;
  let sslPct = totalTime > 0 ? (sslTime / totalTime) * 100 : 0;
  let requestPct = totalTime > 0 ? (requestTime / totalTime) * 100 : 0;
  let responsePct = totalTime > 0 ? (responseTime / totalTime) * 100 : 0;
  let processingPct = totalTime > 0 ? (domProcessing / totalTime) * 100 : 0;
  let domContentPct = totalTime > 0 ? (domContentLoaded / totalTime) * 100 : 0;
  let completePct = totalTime > 0 ? (completeLoad / totalTime) * 100 : 0;
  return {
    dns_time: dnsTime,
    tcp_time: tcpTime,
    ssl_time: sslTime,
    request_time: requestTime,
    response_time: responseTime,
    dom_processing: domProcessing,
    dom_content_loaded: domContentLoaded,
    complete_load: completeLoad,
    total_time: totalTime,
    dns_pct: dnsPct,
    tcp_pct: tcpPct,
    ssl_pct: sslPct,
    request_pct: requestPct,
    response_pct: responsePct,
    processing_pct: processingPct,
    dom_content_pct: domContentPct,
    complete_pct: completePct,
  };
}

function buildTimelinePhases(timing: TimingPhases) {
  return [
    {
      colorClass: 'dns',
      label: 'DNS Lookup',
      timing: timing.dns_time.toFixed(0),
      widthPct: timing.dns_pct.toFixed(2),
    },
    {
      colorClass: 'tcp',
      label: 'TCP Connection',
      timing: timing.tcp_time.toFixed(0),
      widthPct: timing.tcp_pct.toFixed(2),
    },
    {
      colorClass: 'ssl',
      label: 'SSL/TLS',
      timing: timing.ssl_time.toFixed(0),
      widthPct: timing.ssl_pct.toFixed(2),
    },
    {
      colorClass: 'request',
      label: 'Request',
      timing: timing.request_time.toFixed(0),
      widthPct: timing.request_pct.toFixed(2),
    },
    {
      colorClass: 'response',
      label: 'Response',
      timing: timing.response_time.toFixed(0),
      widthPct: timing.response_pct.toFixed(2),
    },
    {
      colorClass: 'processing',
      label: 'DOM Processing',
      timing: timing.dom_processing.toFixed(0),
      widthPct: timing.processing_pct.toFixed(2),
    },
    {
      colorClass: 'domContentLoaded',
      label: 'DOM Content Loaded',
      timing: timing.dom_content_loaded.toFixed(0),
      widthPct: timing.dom_content_pct.toFixed(2),
    },
    {
      colorClass: 'complete',
      label: 'Complete Load',
      timing: timing.complete_load.toFixed(0),
      widthPct: timing.complete_pct.toFixed(2),
    },
  ];
}

function buildRequestTimelinePhases(timing: NetworkRequest['timings']) {
  return [
    {
      colorClass: 'dns',
      label: 'DNS Lookup',
      timing: timing.dns_time.toFixed(0),
      widthPct: timing.dns_pct.toFixed(2),
    },
    {
      colorClass: 'connect',
      label: 'Connect',
      timing: timing.connect_time.toFixed(0),
      widthPct: timing.connect_pct.toFixed(2),
    },
    {
      colorClass: 'ssl',
      label: 'SSL/TLS',
      timing: timing.ssl_time.toFixed(0),
      widthPct: timing.ssl_pct.toFixed(2),
    },
    {
      colorClass: 'send',
      label: 'Send',
      timing: timing.send_time.toFixed(0),
      widthPct: timing.send_pct.toFixed(2),
    },
    {
      colorClass: 'wait',
      label: 'Wait',
      timing: timing.wait_time.toFixed(0),
      widthPct: timing.wait_pct.toFixed(2),
    },
    {
      colorClass: 'receive',
      label: 'Receive',
      timing: timing.receive_time.toFixed(0),
      widthPct: timing.receive_pct.toFixed(2),
    },
  ];
}

interface LcpEntry {
  startTime?: number;
}

function generateHtml(
  metrics: Partial<Metrics>,
  _requests: unknown,
  consoleMessages: ConsoleMessage[] | null,
  basePath: string,
  outputPath: string,
): void {
  let navTiming: Partial<NavigationTiming> & { serverTiming?: ServerTiming[] } =
    metrics.navigationTiming || {};
  let timing = calculateTimingPhases(navTiming);
  let paintTiming = metrics.paintTiming || [];
  let fpTime =
    paintTiming.find((p: PaintTiming) => p.name?.includes('first-paint'))
      ?.startTime || 0;
  let fcpTime =
    paintTiming.find((p: PaintTiming) =>
      p.name?.includes('first-contentful-paint'),
    )?.startTime || 0;
  let lcpData: LcpEntry = (metrics.largestContentfulPaint || [{}])[0] || {};
  let lcpTime = lcpData.startTime || 0;
  let layoutShifts = metrics.layoutShifts || [];
  let clsScore = calculateCls(layoutShifts);
  let ttfb = timing.response_time;
  let tbt = 0;
  let lcpRating = getRating('LCP', lcpTime);
  let clsRating = getRating('CLS', clsScore);
  let tbtRating = getRating('TBT', tbt);
  let legendData = [
    {
      colorClass: 'dns',
      label: 'DNS Lookup',
      timing: timing.dns_time.toFixed(0),
    },
    {
      colorClass: 'tcp',
      label: 'TCP Connection',
      timing: timing.tcp_time.toFixed(0),
    },
    { colorClass: 'ssl', label: 'SSL/TLS', timing: timing.ssl_time.toFixed(0) },
    {
      colorClass: 'request',
      label: 'Request',
      timing: timing.request_time.toFixed(0),
    },
    {
      colorClass: 'response',
      label: 'Response',
      timing: timing.response_time.toFixed(0),
    },
    {
      colorClass: 'processing',
      label: 'DOM Processing',
      timing: timing.dom_processing.toFixed(0),
    },
    {
      colorClass: 'domContentLoaded',
      label: 'DOM Content Loaded',
      timing: timing.dom_content_loaded.toFixed(0),
    },
    {
      colorClass: 'complete',
      label: 'Complete Load',
      timing: timing.complete_load.toFixed(0),
    },
  ];

  let timelineData = buildTimelinePhases(timing);
  let serverTimings = navTiming.serverTiming || [];
  let hasServerTimings = serverTimings.length > 0;
  let serverTimingData = serverTimings.map((timing: ServerTiming) => ({
    name: timing.name || '',
    description: timing.description || '',
    timing: (timing.duration || 0).toFixed(1),
  }));

  let layoutVisualData = [];
  for (let shift of layoutShifts) {
    let sources = shift.sources || [];
    let viewportWidth = 1920;
    let viewportHeight = 1536;
    for (let source of sources) {
      let prevRect = source.previousRect || {};
      let currRect = source.currentRect || {};
      viewportWidth = Math.max(
        viewportWidth,
        prevRect.right || 0,
        currRect.right || 0,
      );
      viewportHeight = Math.max(
        viewportHeight,
        prevRect.bottom || 0,
        currRect.bottom || 0,
      );
    }

    let sourceVisualData = [];
    for (let source of sources) {
      let prevRect = source.previousRect || {};
      let currRect = source.currentRect || {};
      if ((currRect.width || 0) === 0 || (currRect.height || 0) === 0) {
        continue;
      }

      let prevLeftPct =
        viewportWidth > 0 ? ((prevRect.left || 0) / viewportWidth) * 100 : 0;
      let prevTopPct =
        viewportHeight > 0 ? ((prevRect.top || 0) / viewportHeight) * 100 : 0;
      let prevWidthPct =
        viewportWidth > 0 ? ((prevRect.width || 0) / viewportWidth) * 100 : 0;
      let prevHeightPct =
        viewportHeight > 0
          ? ((prevRect.height || 0) / viewportHeight) * 100
          : 0;
      let currLeftPct =
        viewportWidth > 0 ? ((currRect.left || 0) / viewportWidth) * 100 : 0;
      let currTopPct =
        viewportHeight > 0 ? ((currRect.top || 0) / viewportHeight) * 100 : 0;
      let currWidthPct =
        viewportWidth > 0 ? ((currRect.width || 0) / viewportWidth) * 100 : 0;
      let currHeightPct =
        viewportHeight > 0
          ? ((currRect.height || 0) / viewportHeight) * 100
          : 0;
      sourceVisualData.push({
        prevLeftPct: prevLeftPct.toFixed(2),
        prevTopPct: prevTopPct.toFixed(2),
        prevWidthPct: prevWidthPct.toFixed(2),
        prevHeightPct: prevHeightPct.toFixed(2),
        prevX: Math.floor(prevRect.x || 0),
        prevY: Math.floor(prevRect.y || 0),
        prevWidth: Math.floor(prevRect.width || 0),
        prevHeight: Math.floor(prevRect.height || 0),
        currLeftPct: currLeftPct.toFixed(2),
        currTopPct: currTopPct.toFixed(2),
        currWidthPct: currWidthPct.toFixed(2),
        currHeightPct: currHeightPct.toFixed(2),
        currX: Math.floor(currRect.x || 0),
        currY: Math.floor(currRect.y || 0),
        currWidth: Math.floor(currRect.width || 0),
        currHeight: Math.floor(currRect.height || 0),
      });
    }

    if (sourceVisualData.length > 0) {
      layoutVisualData.push({
        time: (shift.startTime || 0).toFixed(1),
        value: (shift.value || 0).toFixed(6),
        sources: sourceVisualData.length,
        sourceVisualData: sourceVisualData,
      });
    }
  }

  let filmstripImages = findFilmstripImages(basePath);
  let hasFilmstrip = filmstripImages.length > 0;
  let filmstripData = filmstripImages.map(img => ({
    imagePath: img.path,
    timestamp:
      img.filename.replace('.png', '').replace('frame_', '').replace('_', '.') +
      'ms',
  }));

  let finalScreenshotFile = findFinalScreenshotFile(basePath);
  let hasFinalScreenshot = finalScreenshotFile !== null;
  let videoFile = findVideoFile(basePath);
  let hasVideo = videoFile !== null;
  let hasConsole = consoleMessages && consoleMessages.length > 0;
  let consoleData = (consoleMessages || []).map((log: ConsoleMessage) => ({
    type: log.type || '',
    text: log.text || '',
    locationUrl: log.location?.url || '',
    locationLineNumber: log.location?.lineNumber || '',
    locationColumnNumber: log.location?.columnNumber || '',
  }));

  let harFiles = fs.readdirSync(basePath).filter(f => f.endsWith('.har'));
  let harRequests: NetworkRequest[] | null = null;
  if (harFiles.length > 0) {
    harRequests = parseHarFile(path.join(basePath, harFiles[0]));
  }

  let hasNetworkRequests = harRequests && harRequests.length > 0;
  let networkData: NetworkDataEntry[] = [];
  if (hasNetworkRequests && harRequests) {
    let startTime = Math.min(...harRequests.map(entry => entry.start_time));
    let maxEndTime =
      Math.max(
        ...harRequests.map(entry => entry.start_time + entry.duration),
        0,
      ) - startTime;
    networkData = harRequests.map(entry => {
      let urlParts = entry.url.split('?')[0].split('/');
      let filename =
        urlParts[urlParts.length - 1] ||
        (urlParts.length > 1 ? urlParts[urlParts.length - 2] : entry.url);
      filename = filename.substring(0, 60);
      let offset = entry.start_time - startTime;
      let startPct = maxEndTime > 0 ? (offset / maxEndTime) * 100 : 0;
      let durationPct =
        maxEndTime > 0 ? (entry.duration / maxEndTime) * 100 : 0;
      let size = entry.size;
      let suffix = ' B';
      if (entry.size > 1024) {
        size = entry.size / 1024;
        suffix = ' KB';
      } else if (entry.size > 1048576) {
        size = entry.size / 1048576;
        suffix = ' MB';
      } else if (entry.size > 1073741824) {
        size = entry.size / 1073741824;
        suffix = ' GB';
      }

      let sizeStr = formatNumber(size) + suffix;
      let timelinePhases = buildRequestTimelinePhases(entry.timings);
      return {
        url: filename,
        fullUrl: entry.url,
        method: entry.method,
        status: String(entry.status),
        size: sizeStr,
        type: entry.type,
        startTime: entry.start_time.toFixed(0),
        duration: entry.duration.toFixed(0),
        startPct: startPct.toFixed(2),
        durationPct: durationPct.toFixed(2),
        timelinePhases,
      };
    });
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.join(
    scriptDir,
    '..',
    'processors',
    'templates',
    'index.ejs',
  );
  const template = fs.readFileSync(templatePath, 'utf-8');
  const templateDir = path.join(scriptDir, '..', 'processors', 'templates');

  const html = ejs.render(
    template,
    {
      ttfb: ttfb.toFixed(0),
      fp: fpTime.toFixed(0),
      fcp: fcpTime.toFixed(0),
      lcp: lcpTime.toFixed(0),
      cls: clsScore.toFixed(4),
      tbt: tbt.toFixed(0),
      lcpRating,
      clsRating,
      tbtRating,
      lcpRatingClass: lcpRating.toLowerCase().replace(/ /g, '-'),
      clsRatingClass: clsRating.toLowerCase().replace(/ /g, '-'),
      tbtRatingClass: tbtRating.toLowerCase().replace(/ /g, '-'),
      hasServerTimings,
      serverTimingData,
      legendData,
      timelineData,
      layoutVisualData,
      hasFilmstrip,
      filmstripData,
      hasFinalScreenshot,
      finalScreenshotPath: finalScreenshotFile,
      finalScreenshotTimestamp: timing.total_time,
      hasVideo,
      videoPath: videoFile,
      hasConsole,
      consoleData,
      hasNetworkRequests,
      networkData,
    },
    {
      views: [templateDir],
      filename: templatePath,
    },
  );

  if (html && typeof (html as unknown as Promise<string>).then === 'function') {
    (html as unknown as Promise<string>)
      .then((resolved: string) => {
        fs.writeFileSync(outputPath, resolved, 'utf-8');
        console.log(`Visual report generated: ${outputPath}`);
      })
      .catch((err: unknown) => {
        console.error('Error rendering template (async):', err);
      });
  } else {
    fs.writeFileSync(outputPath, html as string, 'utf-8');
    console.log(`Visual report generated: ${outputPath}`);
  }
}

function main() {
  if (process.argv.length < 3) {
    console.log('Usage: node generate_visual_report.js <directory>');
    console.log('Example: node generate_visual_report.js one');
    process.exit(1);
  }

  const directory = process.argv[2];
  const scriptDir = path.dirname(process.argv[1]);
  const basePath = directory.startsWith('/')
    ? directory
    : path.join(scriptDir, '..', directory);

  if (!fs.existsSync(basePath)) {
    console.error(`Error: Directory '${basePath}' does not exist`);
    process.exit(1);
  }

  console.log(`Loading data from ${basePath}...`);

  try {
    let metrics = loadJsonFile<Partial<Metrics>>(
      path.join(basePath, 'metrics.json'),
    );
    let requests: unknown;
    if (fs.existsSync(path.join(basePath, 'resources.json'))) {
      requests = loadJsonFile(path.join(basePath, 'resources.json'));
    } else if (fs.existsSync(path.join(basePath, 'requests.json'))) {
      requests = loadJsonFile(path.join(basePath, 'requests.json'));
    } else {
      throw new Error('Neither resources.json nor requests.json found');
    }

    const consoleMessages = loadJsonFile<ConsoleMessage[] | null>(
      path.join(basePath, 'console.json'),
    );
    const outputPath = path.join(basePath, 'visual_report.html');
    generateHtml(metrics, requests, consoleMessages, basePath, outputPath);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename)
) {
  main();
}

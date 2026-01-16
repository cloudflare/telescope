/**
 * Calculate if a HAR entry is part of the critical path
 * Critical path includes: HTML documents, CSS, and blocking JavaScript
 */
export function isCriticalPathEntry(entry: any, resourceData?: any): boolean {
  const mime = entry?.response?.content?.mimeType || "";
  const url = entry?.request?.url || "";
  
  // Check renderBlockingStatus from resource data
  if (resourceData && resourceData.renderBlockingStatus === 'blocking') {
    return true;
  }

  // Check initiatorType
  if (resourceData && (resourceData.initiatorType === 'script' || resourceData.initiatorType === 'css')) {
    return true;
  }

  // HTML documents are always critical
  if (mime.includes("text/html")) {
    return true;
  }

  // CSS files are render-blocking
  if (mime.includes("text/css")) {
    return true;
  }

  // JavaScript files are typically blocking unless async/defer
  if (mime.includes("javascript")) {
    return true;
  }

  // Check URL patterns
  const urlLower = url.toLowerCase();
  if (urlLower.endsWith('.html') || urlLower.endsWith('.htm')) {
    return true;
  }
  if (urlLower.endsWith('.css')) {
    return true;
  }
  if (urlLower.endsWith('.js')) {
    return true;
  }

  return false;
}

/** Assign colors for each resource type */
function getColorForType(type: string): string {
  const colors: Record<string, string> = {
    HTML: "#ff7f0e",
    CSS: "#1f77b4",
    JS: "#9467bd",
    Font: "#8c564b",
    Image: "#2ca02c",
    Other: "#7f7f7f",
  };
  return colors[type] || "#7f7f7f";
}

/**
 * Draw a waterfall chart for critical path entries
 * with page event markers and a resource-type legend.
 * Note: This function requires D3.js - commented out for now
 */
/*
export function drawCriticalPathChart(entries: any[], log: any) {
  // D3-dependent code commented out
  // This function can be used if D3 is available
}
*/
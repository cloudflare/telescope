/**
 * Lightweight typed DOM element factory for the waterfall renderer.
 * Keeps createElement boilerplate out of the render functions.
 */

/**
 * Create an element, optionally set attributes/className, and optionally
 * set its textContent in one call.
 *
 * @param tag      - Any valid HTML tag name
 * @param props    - Attribute map; `className` is applied via `.className`
 * @param text     - If provided, sets `textContent`
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (k === 'className') node.className = v;
    else node.setAttribute(k, v);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

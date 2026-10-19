/** The smallest SVG builder that keeps the renderers readable. No dependency. */

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type Attrs = Record<string, string | number | undefined>;

export function attrs(a: Attrs): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
    .join('');
}

export function el(tag: string, a: Attrs, children = ''): string {
  return children === '' ? `<${tag}${attrs(a)}/>` : `<${tag}${attrs(a)}>${children}</${tag}>`;
}

export function rect(x: number, y: number, w: number, h: number, a: Attrs = {}): string {
  return el('rect', { x: r(x), y: r(y), width: r(Math.max(w, 0)), height: r(h), ...a });
}

export function line(x1: number, y1: number, x2: number, y2: number, a: Attrs = {}): string {
  return el('line', { x1: r(x1), y1: r(y1), x2: r(x2), y2: r(y2), ...a });
}

/**
 * A rectangle outline as four lines. ImageMagick's internal SVG renderer paints
 * <line> strokes but drops the stroke on <rect> and <path>, so every outline in
 * both renders goes through here.
 */
export function outline(x: number, y: number, w: number, h: number, color: string, width: number): string {
  const hw = width / 2;
  return group({}, [
    line(x, y + hw, x + w, y + hw, { stroke: color, 'stroke-width': width }),
    line(x, y + h - hw, x + w, y + h - hw, { stroke: color, 'stroke-width': width }),
    line(x + hw, y, x + hw, y + h, { stroke: color, 'stroke-width': width }),
    line(x + w - hw, y, x + w - hw, y + h, { stroke: color, 'stroke-width': width }),
  ]);
}

export interface TextOpts extends Attrs {
  size?: number;
  weight?: 400 | 700;
  anchor?: 'start' | 'middle' | 'end';
  fill?: string;
}

export function text(x: number, y: number, s: string, o: TextOpts = {}): string {
  const { size = 16, weight = 400, anchor = 'start', fill = '#e6edf3', ...rest } = o;
  return el(
    'text',
    {
      x: r(x),
      y: r(y),
      'font-family': 'Arial',
      'font-size': size,
      'font-weight': weight,
      'text-anchor': anchor,
      fill,
      ...rest,
    },
    esc(s),
  );
}

export function group(a: Attrs, children: string[]): string {
  return el('g', a, children.join(''));
}

export function svg(width: number, height: number, children: string[], defs = ''): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
    ` viewBox="0 0 ${width} ${height}">\n` +
    (defs ? `<defs>${defs}</defs>\n` : '') +
    children.join('\n') +
    '\n</svg>\n'
  );
}

/** one decimal is plenty for pixels and keeps the file small */
export function r(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Greedy word wrap by an average glyph width. Arial at `size` px runs about
 * 0.5 em per character; `maxChars` is derived from that and the box width.
 */
export function wrap(s: string, maxChars: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** the colour system both renders share, so the strip and the clip read as one */
export const C = {
  bg: '#0b0f14',
  panel: '#121820',
  grid: '#263040',
  text: '#e6edf3',
  muted: '#8b98a5',
  dialogue: '#f2a541',
  gap: '#3ec9b0',
  cue: '#49a9ff',
  cueEdge: '#0b2a4a',
  rejected: '#ff5c5c',
  dropped: '#ff8c42',
  credits: '#2a3340',
  duck: '#b388ff',
} as const;

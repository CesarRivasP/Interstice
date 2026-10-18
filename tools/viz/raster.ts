/**
 * SVG → PNG with what the machine already has. No headless browser.
 *
 * Preference order: `rsvg-convert` (exact SVG), then ImageMagick (`magick`,
 * its own SVG renderer). ImageMagick resolves `font-family` through a type map
 * it does not ship on macOS or in most Linux images, so one is written per run
 * from the fonts found on disk — bold and regular, both needed by the renders.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Rasterizer {
  name: 'rsvg-convert' | 'magick';
  /** render `svgPath` to `pngPath` at the SVG's own pixel size */
  render(svgPath: string, pngPath: string): void;
}

const FONT_CANDIDATES: { regular: string; bold: string }[] = [
  { regular: '/System/Library/Fonts/Supplemental/Arial.ttf', bold: '/System/Library/Fonts/Supplemental/Arial Bold.ttf' },
  { regular: '/Library/Fonts/Arial.ttf', bold: '/Library/Fonts/Arial Bold.ttf' },
  { regular: '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', bold: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf' },
  { regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' },
];

function has(bin: string): boolean {
  return spawnSync('which', [bin], { stdio: 'ignore' }).status === 0;
}

export function findRasterizer(workDir: string): Rasterizer {
  if (has('rsvg-convert')) {
    return {
      name: 'rsvg-convert',
      render: (svgPath, pngPath) => {
        execFileSync('rsvg-convert', ['--format', 'png', '--output', pngPath, svgPath], { stdio: 'inherit' });
      },
    };
  }
  if (has('magick')) {
    const fonts = FONT_CANDIDATES.find((f) => existsSync(f.regular) && existsSync(f.bold));
    if (!fonts) {
      throw new Error('INTERSTICE.viz.noFont: ImageMagick needs a regular and a bold TTF; none of the known paths exist');
    }
    mkdirSync(workDir, { recursive: true });
    writeFileSync(
      join(workDir, 'type.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<typemap>\n` +
        `  <type name="Arial" fullname="Arial" family="Arial" style="normal" stretch="normal" weight="400" glyphs="${fonts.regular}"/>\n` +
        `  <type name="Arial-Bold" fullname="Arial Bold" family="Arial" style="normal" stretch="normal" weight="700" glyphs="${fonts.bold}"/>\n` +
        `</typemap>\n`,
    );
    return {
      name: 'magick',
      render: (svgPath, pngPath) => {
        execFileSync('magick', ['-background', 'none', svgPath, pngPath], {
          stdio: 'inherit',
          env: { ...process.env, MAGICK_CONFIGURE_PATH: workDir },
        });
      },
    };
  }
  throw new Error('INTERSTICE.viz.noRasterizer: install librsvg (rsvg-convert) or ImageMagick (magick)');
}

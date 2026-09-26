import { readFileSync } from 'node:fs';
import type { ContentWindow } from './gaps.js';

/**
 * The per-asset inputs the pipeline reads. Mirrors `_facts.yml
 * contracts.asset_manifest` field for field.
 *
 * It exists because of R21-F5. `worst_case.content_windows` is a MEASUREMENT of
 * one asset recorded in the registry, and the registry is a specification, not a
 * program input. Without this file an implementer has nowhere to read the
 * windows from and inlines Tears of Steel's credits boundary into `gaps.ts`,
 * where the next asset silently inherits it.
 */
export interface AssetManifest {
  version: string;
  asset_id: string;
  media_uri: string;
  subtitles_uri: string;
  duration_ms: number;
  /**
   * The stretches of the asset that may be described. EMPTY MEANS THE WHOLE
   * ASSET IS CONTENT — the pre-R20 behaviour, kept so an asset with no measured
   * windows still produces a track. The price of that default is a track that
   * describes the credits, and it is an asset-authoring gap rather than a silent
   * failure: `validateManifest` warns on it.
   */
  content_windows: ContentWindow[];
  /**
   * Time-to-byte offsets over a fragmented MP4, for seeking (R21-F2). `null`
   * where the app buffers the whole asset, which `limits.mse_buffer` allows only
   * for short clips.
   */
  byte_index: ByteIndexEntry[] | null;
}

/** `_facts.yml contracts.byte_index_entry` */
export interface ByteIndexEntry {
  start_ms: number;
  byte_offset: number;
}

export class ManifestError extends Error {}

/**
 * Parse and validate a manifest. It throws rather than returning a partial
 * object: every downstream phase treats these fields as trustworthy, so a
 * manifest that is wrong must fail here and not three phases later as a cue
 * placed over the credits.
 */
export function parseManifest(source: string, origin: string): AssetManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (err) {
    throw new ManifestError(
      `INTERSTICE.manifest.badJson origin=${origin} err=${(err as Error).message}`,
    );
  }

  const m = raw as Partial<AssetManifest>;
  for (const field of ['version', 'asset_id', 'media_uri', 'subtitles_uri'] as const) {
    if (typeof m[field] !== 'string' || m[field] === '') {
      throw new ManifestError(`INTERSTICE.manifest.missing origin=${origin} field=${field}`);
    }
  }
  if (typeof m.duration_ms !== 'number' || m.duration_ms <= 0) {
    throw new ManifestError(`INTERSTICE.manifest.missing origin=${origin} field=duration_ms`);
  }
  if (!Array.isArray(m.content_windows)) {
    throw new ManifestError(
      `INTERSTICE.manifest.missing origin=${origin} field=content_windows` +
        ' (use [] to declare the whole asset as content)',
    );
  }

  const windows = m.content_windows.map((w, i) => validateWindow(w, i, m.duration_ms!, origin));

  // Overlapping windows would double-describe the overlap: clipToContent emits
  // one clipped gap per window, so a gap inside two windows becomes two cues
  // covering the same seconds.
  const sorted = [...windows].sort((a, b) => a.start_ms - b.start_ms);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.start_ms < sorted[i - 1]!.end_ms) {
      throw new ManifestError(
        `INTERSTICE.manifest.overlap origin=${origin}` +
          ` a=${sorted[i - 1]!.start_ms}-${sorted[i - 1]!.end_ms}` +
          ` b=${sorted[i]!.start_ms}-${sorted[i]!.end_ms}`,
      );
    }
  }

  return {
    version: m.version!,
    asset_id: m.asset_id!,
    media_uri: m.media_uri!,
    subtitles_uri: m.subtitles_uri!,
    duration_ms: m.duration_ms,
    content_windows: sorted,
    byte_index: Array.isArray(m.byte_index) ? m.byte_index : null,
  };
}

function validateWindow(
  w: Partial<ContentWindow>,
  i: number,
  durationMs: number,
  origin: string,
): ContentWindow {
  if (typeof w.start_ms !== 'number' || typeof w.end_ms !== 'number') {
    throw new ManifestError(`INTERSTICE.manifest.badWindow origin=${origin} index=${i}`);
  }
  if (w.end_ms <= w.start_ms) {
    throw new ManifestError(
      `INTERSTICE.manifest.emptyWindow origin=${origin} index=${i}` +
        ` start_ms=${w.start_ms} end_ms=${w.end_ms}`,
    );
  }
  if (w.end_ms > durationMs) {
    throw new ManifestError(
      `INTERSTICE.manifest.windowPastEnd origin=${origin} index=${i}` +
        ` end_ms=${w.end_ms} duration_ms=${durationMs}`,
    );
  }
  return { start_ms: w.start_ms, end_ms: w.end_ms, label: w.label };
}

export function loadManifest(path: string): AssetManifest {
  const manifest = parseManifest(readFileSync(path, 'utf8'), path);
  logManifest(manifest, path);
  return manifest;
}

export function logManifest(manifest: AssetManifest, origin: string): void {
  const describable = manifest.content_windows.reduce(
    (total, w) => total + (w.end_ms - w.start_ms),
    0,
  );
  console.log(
    `INTERSTICE.manifest.loaded origin=${origin} asset=${manifest.asset_id}` +
      ` duration_ms=${manifest.duration_ms} windows=${manifest.content_windows.length}` +
      ` content_ms=${manifest.content_windows.length === 0 ? manifest.duration_ms : describable}` +
      ` byte_index=${manifest.byte_index ? manifest.byte_index.length : 'none'}`,
  );
  if (manifest.content_windows.length === 0) {
    // Not an error — but the one case where a correct-looking run describes the
    // credits, so it says so where someone reading the log will see it.
    console.log(
      `INTERSTICE.manifest.noWindows origin=${origin}` +
        ' whole asset treated as content; credits WILL be described',
    );
  }
}

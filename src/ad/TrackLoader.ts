import type { DescriptionCue, DescriptionTrack, Verbosity } from '../../pipeline/types';
import { MAX_CLIPS_IN_MEMORY } from '../../pipeline/budget';
import {log} from '../diagnostics';

/**
 * `_facts.yml changes[C6]` — load a track file and refuse to believe it.
 *
 * Validation here is not defensive decoration. The loader does not trust that
 * the producer was this pipeline, and a malformed or missing track must end in a
 * STATED visible and spoken state, never in silence (`AC8`). A silent app with
 * nothing to say is indistinguishable from a working app in a quiet scene, which
 * is the failure AC8 exists to forbid.
 */

export type LoadResult =
  | { ok: true; track: DescriptionTrack; loaded_verbosity: Verbosity }
  | { ok: false; reason: 'missing' | 'malformed'; detail: string };

/** exported so a test can check them against contracts.description_cue in the registry */
export const CUE_KEYS = [
  'id',
  'start_ms',
  'end_ms',
  'words',
  'text',
  'audio_uri',
  'source_frames_ms',
  'status',
] as const;

/** exported so a test can check them against contracts.description_track in the registry */
export const TRACK_KEYS = [
  'version',
  'asset_id',
  'generated_at',
  'source_subtitles',
  'verbosity',
  'model_id',
  'cues',
] as const;

/** Validates field for field against `_facts.yml contracts.description_cue`. */
function validCue(v: unknown): v is DescriptionCue {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  if (CUE_KEYS.some((k) => !(k in c))) return false;
  return (
    typeof c.id === 'string' &&
    typeof c.start_ms === 'number' &&
    typeof c.end_ms === 'number' &&
    typeof c.words === 'number' &&
    typeof c.text === 'string' &&
    typeof c.audio_uri === 'string' &&
    Array.isArray(c.source_frames_ms) &&
    c.source_frames_ms.every((n) => typeof n === 'number') &&
    (c.status === 'ok' || c.status === 'failed')
  );
}

/** Validates field for field against `_facts.yml contracts.description_track`. */
export function validateTrack(raw: unknown): LoadResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: 'malformed', detail: 'not an object' };
  }
  const t = raw as Record<string, unknown>;

  const missing = TRACK_KEYS.filter((k) => !(k in t));
  if (missing.length) {
    return { ok: false, reason: 'malformed', detail: `missing ${missing.join(',')}` };
  }
  if (!['concise', 'standard', 'detailed'].includes(t.verbosity as string)) {
    return { ok: false, reason: 'malformed', detail: `verbosity=${String(t.verbosity)}` };
  }
  if (!Array.isArray(t.cues) || !t.cues.every(validCue)) {
    return { ok: false, reason: 'malformed', detail: 'cues' };
  }

  return {
    ok: true,
    track: raw as DescriptionTrack,
    loaded_verbosity: t.verbosity as Verbosity,
  };
}

/**
 * `decisions.verbosity_levels` LOOKUP RULE: `<asset_id>.<verbosity>.track.json`
 * beside the asset; a level switch resolves by that name and FALLS BACK to
 * `standard`. The fallback is what stops a missing `detailed` file from turning
 * the feature off.
 */
export async function loadTrack(
  readJson: (path: string) => Promise<unknown>,
  assetDir: string,
  assetId: string,
  verbosity: Verbosity,
): Promise<LoadResult> {
  const levels: Verbosity[] =
    verbosity === 'standard' ? [verbosity] : [verbosity, 'standard'];

  for (const level of levels) {
    const path = `${assetDir}/${assetId}.${level}.track.json`;
    let raw: unknown;
    try {
      raw = await readJson(path);
    } catch {
      log(`INTERSTICE.loader.miss path=${path}`);
      continue;
    }

    const result = validateTrack(raw);
    log(
      `INTERSTICE.loader.load path=${path} ok=${result.ok}` +
        (result.ok ? ` cues=${result.track.cues.length}` : ` reason=${result.reason}`),
    );

    // A malformed file is an error, not a reason to fall back: something
    // produced a file that is not a track, and silently loading a different one
    // would hide it.
    return result;
  }

  return { ok: false, reason: 'missing', detail: `${assetId}.${verbosity}.track.json` };
}

/**
 * `limits.clip_cache.max_clips_in_memory` (8). A Fire TV Stick is a 32-bit
 * process with a small heap, so only the next N clips are resident.
 *
 * It holds BYTES, not URIs, and that is forced rather than chosen: there is no
 * URI a player will fetch (`limits.vega_media.url_mode_broken`), so every clip
 * is read by the app and appended through a MediaSource.
 */
export class ClipCache {
  private order: string[] = [];
  private held = new Map<string, ArrayBuffer>();

  constructor(private readonly max: number = MAX_CLIPS_IN_MEMORY) {}

  put(uri: string, bytes: ArrayBuffer): void {
    if (this.held.has(uri)) this.order = this.order.filter((u) => u !== uri);
    this.held.set(uri, bytes);
    this.order.push(uri);
    while (this.order.length > this.max) {
      const evicted = this.order.shift()!;
      this.held.delete(evicted);
      log(`INTERSTICE.cache.evict uri=${evicted} size=${this.held.size}`);
    }
  }

  get(uri: string): ArrayBuffer | undefined {
    return this.held.get(uri);
  }

  get size(): number {
    return this.held.size;
  }
}

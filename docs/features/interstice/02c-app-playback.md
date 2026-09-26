# Implementation (3 of 7) — Interstice — the platform seam and the playback layer

> Complements `01-master-plan.md`. Part A, **Phases 7–9**: `MediaAdapter`, `C6` `TrackLoader`, `C3` `CueScheduler`. Phases 10–11 live in `02c2-audio-and-controls.md`.

- **Date:** 2026-09-19
- **Branch:** `main`
- **Test baseline:** `aborted_no_conditions` until `02` Phase 1 measures it. Every `Phase N verification:` below resolves through `_profile.yml`, never through a command invented for this document.

> **The preamble of `02-implementation-and-e2e.md` governs this file too** — language and layout, the `⟨commands.*⟩` notation, the logging convention, the "registry keys are the contract" rule, and the three deferred components (`C11`, `C15`, `C16`) that appear in none of the five halves. It is not repeated here.
> Split per `references/doc-pattern.md` §Splitting an oversized doc. No technical content differs from a single-file version.

**The set of seven:** `02` (preamble, Phases 0–3: spike gate, scaffold, contracts in code, gap detection) · `02b` (Phases 4–5: frames, description) · `02b2` (Phase 6: synthesis and the track files) · `02c` (Phases 7–9: the platform seam, the loader, the scheduler) · `02c2` (Phases 10–11: description audio, the control surface) · `02d` (Phases 12–17: screens, shell, the `[MANUAL]` deliverables) · `02e` (Part B test plan, Part C manual E2E, the Definition of Done, and the coverage map against `01-master-plan.md` §7).

---

## Changelog

Same tag + date spine as `01-master-plan.md` and `02`. Only entries that change what is built below.

### 2026-09-21 — v7: doc 02 written, split in four

`implement` round R8. This is a greenfield build — every phase carries a full-file code block — so the implementation document is four files cut on top-level phase boundaries, not one.

### 2026-09-19 — v5: review R5 dispositions

`contracts.description_track.verbosity` is a field and `decisions.verbosity_levels` states the file-naming rule — Phase 8 resolves a level switch by that rule and Phase 11 drives it. `C11` (`src/ad/LiveCapture.ts`) stays `kind: deferred`: **no phase below creates it or leaves a hook for it.**

### 2026-09-19 — v3: verbosity levels, VoiceView

Phase 11 gains the three-level selector (`AC17`) and the VoiceView-announced state on every control (`AC15`).

---

# Part A — Implementation plan (continued)

---

## Phase 7 — `src/platform/MediaAdapter.ts` — the seam, rewritten against a platform we have now measured

**Files:** `src/platform/MediaAdapter.ts` (new), `src/platform/vega/index.ts` (new)
**Anchor:** new files, full contents below. The Vega implementation is an **extraction** — the working code already exists in `src/screens/PlayerScreen.tsx` and `src/ad/DescriptionAudio.ts` as of R20/R21, and this phase moves it behind the interface rather than inventing it.
**Maps to:** `_facts.yml limits.vega_media` (every sub-key), `changes[C12]`, `limits.ad.duck_target_pct`, `limits.ad.duck_ramp_ms`, `limits.mse_buffer`

**What changes:** the app gains the one interface that every other `src/` file talks to, and the only directory in the repository that names a Vega API.

### 7.1 — The justification changed, and saying so is the point

This phase used to be justified by `defects[D3]` being open: if the Vega simulator would not run, `alternatives[A4]` (a Fire OS Android build) reopened immediately and the seam turned a six-file rewrite into one new directory.

**`D3` is resolved and `A4` is discarded.** That justification is gone, and a seam kept out of momentum is exactly what the gap sweep's *"is this worth building today?"* question exists to catch. It is kept for a different and now stronger reason:

**`changes[C12]` is a committed deliverable** — `react-native-tv-audio-description`, public, licensed, with a runnable example (`AC10`, the open-source mini challenge). A package named for TV audio description that only works on one TV platform is not the package it claims to be, and `related_docs[R-MULTI-TV]` is Amazon's own demonstration that one codebase spans Vega, Android TV and Apple TV. **`MediaAdapter` is that package's public API.** The seam is no longer insurance against a platform that might not work; it is the shape of the thing being published.

A second reason, smaller but real: `limits.vega_media.url_mode_broken` is a **platform defect, not a design**. If a later SDK fixes URL mode, the change is confined to one directory.

### 7.2 — What the interface says now, and the three things that changed

**Code:**

`src/platform/MediaAdapter.ts` (new file, full contents):

```ts
/**
 * The only surface the app uses to reach the platform. Implementations live in
 * src/platform/<platform>/. No file outside src/platform/ may import a platform
 * module directly — that is what makes changes[C12] a real package rather than a
 * Vega app with a package-shaped README.
 */

export type Unsubscribe = () => void;

export interface VideoPlayer {
  /** current playback position, ms */
  positionMs(): number;
  durationMs(): number;
  isPlaying(): boolean;
  /**
   * Set the main track volume as a percentage of full, EFFECTIVE IMMEDIATELY.
   *
   * There is no ramp parameter, and its absence is measured rather than chosen:
   * limits.vega_media.no_volume_ramp — the W3C volume setter is instantaneous
   * and the platform exposes no fade. limits.ad.duck_ramp_ms is implemented in
   * JS, ONCE, in src/ad/duck.ts (Phase 10), and never per platform. An interface
   * that accepted `rampMs` would invite every implementation to reimplement the
   * same loop, and would imply a capability no platform here has.
   */
  setVolumePct(pct: number): void;
  /** fires on every position update the platform emits ('timeupdate') */
  onPosition(cb: (ms: number) => void): Unsubscribe;
  /** fires after a seek settles, with the new position ('seeked') */
  onSeek(cb: (ms: number) => void): Unsubscribe;
  /**
   * Fires when playback cannot continue because the buffer ran dry
   * ('waiting' / 'stalled').
   *
   * R21-F3: with the app owning byte delivery this is a REACHABLE state and it
   * is NOT an error — no `error` event follows it. A UI that only listens for
   * onError shows a frozen picture and says nothing, which for this app's users
   * is indistinguishable from the film having stopped being interesting.
   */
  onStalled(cb: () => void): Unsubscribe;
  /**
   * Fires when playback is actually running ('playing').
   *
   * The counterpart to `onStalled`, and not optional: MSE emits `waiting` at the
   * START of normal playback while the first frames decode, so a screen that
   * treats stalling as terminal shows "Buffering" over a film that is playing
   * fine. Measured on the device in R28 — 2 ms after `play()` resolved.
   */
  onPlaying(cb: () => void): Unsubscribe;
  onEnded(cb: () => void): Unsubscribe;
  onError(cb: (err: Error) => void): Unsubscribe;
}

export interface ClipPlayer {
  /**
   * Plays one description clip to completion; rejects if it cannot be played.
   *
   * The argument is a URI, but no implementation may assume the platform will
   * fetch it: on Vega it does not (limits.vega_media.url_mode_broken), and the
   * implementation reads the bytes itself. That is an implementation detail
   * deliberately kept out of this interface — a caller that had to know would
   * make changes[C12] leak Vega's defect into every other platform.
   */
  play(uri: string): Promise<void>;
  stop(): void;
}

export interface AppLifecycle {
  /** fires when the app leaves the foreground */
  onBackground(cb: () => void): Unsubscribe;
}

export interface MediaAdapter {
  video: VideoPlayer;
  clips: ClipPlayer;
  lifecycle: AppLifecycle;
}
```

| what changed | why |
|---|---|
| `setVolumePct(pct, rampMs)` → `setVolumePct(pct)` | `limits.vega_media.no_volume_ramp`, measured. The ramp is JS, written once in Phase 10. |
| `onStalled` added | `R21-F3`. The app owns byte delivery now, so running dry is reachable — and it raises no `error`. |
| `onPlaying` added | `R28-F3`, found by the device rather than by a test. MSE emits `waiting` **at the start of normal playback**, 2 ms after `play()` resolved, so `stalled` has to be a state playback can leave. |
| `open(uri)` / `play()` / `pause()` / `destroy()` added | the interface as first written had no way to say *play this asset* — it described observation and volume, and the screen still had to reach the platform to start anything. |
| `VideoSurface` added | mounting the surface IS platform code: on Vega it is `KeplerVideoSurfaceView`, and the handle it returns has to reach the player. A screen importing it directly would put a platform symbol straight back into `src/screens/`. |
| `play(uri)` keeps its shape | but its contract now says implementations must not assume the platform fetches. Vega's defect stays inside Vega's directory. |

### 7.3 — The Vega implementation is an extraction, not a spike

`src/platform/vega/index.ts` was previously `[MANUAL]` with a `throw`, because `D3` was open and **no Vega API name in this set had ever been observed**. That is no longer true: every symbol is measured and recorded in `limits.vega_media`, and working code that uses all of them is already in the repository.

So this file is written by **moving** code, and the move is what makes it testable:

| moves from | what it becomes |
|---|---|
| `src/screens/PlayerScreen.tsx` — `VideoPlayer` + `MediaSource` + `KeplerVideoSurfaceView` | `video`, plus the windowed byte delivery of `limits.mse_buffer` |
| `src/ad/DescriptionAudio.ts` — `AudioPlayer(CONTENT_TYPE_SPEECH, USAGE_ACCESSIBILITY)` + `MediaSource` | `clips` |
| — | `lifecycle`, the one piece with no incumbent code; `useKeplerAppStateManager` |

> **Do not rewrite these from the interface down.** Both files carry behaviour that was expensive to learn and looks removable: the dual readiness tracking for `limits.vega_media.surface_races_init` (a 26 ms race that presents as `MEDIA_ERR_SRC_NOT_SUPPORTED`), `srcObject` instead of `src`, the fragmented-MP4 requirement, and restoring the main volume in a `finally` so a failed cue cannot leave the film at 25% forever. Every one of those is a bug someone already paid for.

**Contracts implemented:** `limits.vega_media` (`url_mode_broken`, `mse_path`, `no_volume_ramp`, `surface_races_init`, `concurrent_streams`, `audio_usage_accessibility`), `limits.ad.duck_target_pct`, `limits.ad.duck_ramp_ms`, `limits.mse_buffer`, `changes[C12]`

**Phase 7 verification:** `⟨commands.lint⟩` → exit 0. The structural assertion is `rg -n "@amazon-devices/react-native-w3cmedia" src/ --glob '!src/platform/**'` returning **nothing** — no file outside `src/platform/` names the platform. That command is the seam, stated as something a program can check, and it **fails today**: `PlayerScreen.tsx` and `DescriptionAudio.ts` both import it. Making it pass is this phase.

---

## Phase 8 — `src/ad/TrackLoader.ts` (`C6`) — load, validate, and bound the cache

**File:** `src/ad/TrackLoader.ts` (new)
**Anchor:** new file, full contents below.
**Maps to:** `_facts.yml changes[C6]`, `contracts.description_track`, `contracts.description_cue`, `limits.clip_cache.max_clips_in_memory`, `decisions.verbosity_levels`, `AC8`

**What changes:** the app reads a track file and refuses to believe it. Validation here is not defensive decoration: the loader does not trust that the producer was this pipeline, and a malformed or missing track must end in a **stated** visible and spoken state, never in silence (`AC8`). A silent app with nothing to say is indistinguishable from a working app in a quiet scene, which is the failure `AC8` exists to forbid.

**Code:**

`src/ad/TrackLoader.ts` (new file, full contents):

```ts
import type { DescriptionCue, DescriptionTrack, Verbosity } from '../../pipeline/types.js';
import { MAX_CLIPS_IN_MEMORY } from '../../pipeline/budget.js';

export type LoadResult =
  | { ok: true; track: DescriptionTrack }
  | { ok: false; reason: 'missing' | 'malformed'; detail: string };

const CUE_KEYS = [
  'id', 'start_ms', 'end_ms', 'words', 'text', 'audio_uri', 'source_frames_ms', 'status',
] as const;

const TRACK_KEYS = [
  'version', 'asset_id', 'generated_at', 'source_subtitles', 'verbosity', 'model_id', 'cues',
] as const;

/** Validates field for field against _facts.yml contracts.description_cue. */
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

/** Validates field for field against _facts.yml contracts.description_track. */
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

  return { ok: true, track: raw as DescriptionTrack };
}

/**
 * decisions.verbosity_levels LOOKUP RULE: `<asset_id>.<verbosity>.track.json`
 * beside the asset; a level switch resolves by that name and FALLS BACK to
 * `standard`. The fallback is what stops a missing `detailed` file from turning
 * the feature off.
 */
export async function loadTrack(
  readJson: (path: string) => Promise<unknown>,
  assetDir: string,
  assetId: string,
  verbosity: Verbosity,
): Promise<LoadResult & { loaded_verbosity?: Verbosity }> {
  for (const level of verbosity === 'standard' ? [verbosity] : [verbosity, 'standard' as const]) {
    const path = `${assetDir}/${assetId}.${level}.track.json`;
    let raw: unknown;
    try {
      raw = await readJson(path);
    } catch {
      console.log(`INTERSTICE.loader.miss path=${path}`);
      continue;
    }
    const result = validateTrack(raw);
    console.log(
      `INTERSTICE.loader.load path=${path} ok=${result.ok}` +
        (result.ok ? ` cues=${result.track.cues.length}` : ` reason=${result.reason}`),
    );
    if (result.ok) return { ...result, loaded_verbosity: level };
    return result; // a malformed file is an error, not a reason to fall back
  }
  return { ok: false, reason: 'missing', detail: `${assetId}.${verbosity}.track.json` };
}

/**
 * limits.clip_cache.max_clips_in_memory (8). A Fire TV Stick is a 32-bit process
 * with a small heap, so only the next N clips are resident.
 *
 * It holds BYTES, not URIs, and that is forced rather than chosen: there is no
 * URI a player will fetch (limits.vega_media.url_mode_broken), so every clip is
 * read by the app and appended through a MediaSource. "Streaming from disk" is
 * not available on this platform — an earlier draft of limits.clip_cache said it
 * was, and R21-F4 corrected it.
 */
export class ClipCache {
  private order: string[] = [];
  private held = new Map<string, ArrayBuffer>();

  constructor(private readonly max = MAX_CLIPS_IN_MEMORY) {}

  put(uri: string, bytes: ArrayBuffer): void {
    if (this.held.has(uri)) this.order = this.order.filter((u) => u !== uri);
    this.held.set(uri, bytes);
    this.order.push(uri);
    while (this.order.length > this.max) {
      const evicted = this.order.shift()!;
      this.held.delete(evicted);
      console.log(`INTERSTICE.cache.evict uri=${evicted} size=${this.held.size}`);
    }
  }

  get(uri: string): ArrayBuffer | undefined {
    return this.held.get(uri);
  }

  get size(): number {
    return this.held.size;
  }
}
```

> **Who fills the cache, and how far ahead.** The loader does not prefetch on its own — `C3` (Phase 9) knows the playhead and the cue list, so it asks for the next clips as the playhead approaches them. Two bounds meet here and they are different: `limits.clip_cache.max_clips_in_memory` (**8**) bounds the description clips, and `limits.mse_buffer` bounds the **film**. They are separate buffers in separate players and neither's headroom pays for the other's.

> **A malformed file does not fall back; a missing one does.** The distinction is deliberate. A missing `detailed` track means that level was never generated — falling back to `standard` keeps description working. A malformed track means something produced a file that is not a track, and silently loading a different one would hide it. Both end in a state `C5` announces (Phase 11), neither ends in silence.

**Contracts implemented:** `changes[C6]`, `contracts.description_track`, `contracts.description_cue`, `limits.clip_cache.max_clips_in_memory`, `decisions.verbosity_levels`, `AC8`

**Phase 8 verification:** `⟨commands.tests⟩` → a line containing `⟨commands.tests_expect⟩`. Assertions in `02e` §B.1, including the eviction bound and the malformed-vs-missing split, each with its `Fails if:` line.

---

## Phase 9 — `src/ad/CueScheduler.ts` (`C3`) — position to cue, across seeks and key repeat

**File:** `src/ad/CueScheduler.ts` (new)
**Anchor:** new file, full contents below.
**Maps to:** `_facts.yml changes[C3]`, `AC4`, `AC6`

**What changes:** playback position becomes "fire this cue now, once". Two failure modes from the `mobile-tv` gap sweep are handled here and nowhere else:

- **Held-direction key repeat** (`F3`). A held D-pad direction emits a stream of key events, and a seek per event means a resync per event. The scheduler **coalesces**: it does not act on intermediate positions, only on the settled one.
- **Seek desync.** After a seek the cursor is stale and the next tick would fire every cue between the old and new position. A seek resets the cursor by binary search and marks everything before it as already played.

**The invariant this file exists to hold is `AC4`:** a cue fires only while position is inside its own gap. A cue whose window has already passed is **dropped, never played late** — a late cue is a cue playing over dialogue, which is the one thing worse than no description.

**Code:**

`src/ad/CueScheduler.ts` (new file, full contents):

```ts
import type { DescriptionCue } from '../../pipeline/types.js';

export interface SchedulerEvents {
  onFire: (cue: DescriptionCue) => void;
}

export class CueScheduler {
  private cues: DescriptionCue[] = [];
  private cursor = 0;
  private firing: DescriptionCue | null = null;
  private enabled = true;

  constructor(private readonly events: SchedulerEvents) {}

  /** `failed` cues carry no audio; they never enter the schedule. */
  load(cues: DescriptionCue[]): void {
    this.cues = cues
      .filter((c) => c.status === 'ok' && c.audio_uri !== '')
      .sort((a, b) => a.start_ms - b.start_ms);
    this.cursor = 0;
    this.firing = null;
    console.log(`INTERSTICE.scheduler.load cues=${this.cues.length}`);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.firing = null;
  }

  /** Called on every position update from the platform. */
  tick(positionMs: number): void {
    if (!this.enabled) return;

    // Advance past every cue whose window closed while we were elsewhere.
    while (this.cursor < this.cues.length && this.cues[this.cursor]!.end_ms <= positionMs) {
      const skipped = this.cues[this.cursor]!;
      if (skipped !== this.firing) {
        console.log(`INTERSTICE.scheduler.skip id=${skipped.id} pos_ms=${positionMs}`);
      }
      this.cursor++;
    }

    const next = this.cues[this.cursor];
    if (!next) return;

    // AC4: fire only INSIDE the gap. Never before it, never after it.
    if (positionMs >= next.start_ms && positionMs < next.end_ms && this.firing !== next) {
      this.firing = next;
      this.cursor++;
      console.log(
        `INTERSTICE.scheduler.fire id=${next.id} pos_ms=${positionMs}` +
          ` window=[${next.start_ms},${next.end_ms})`,
      );
      this.events.onFire(next);
    }
  }

  /**
   * AC6. Called with the SETTLED position after a seek — not with each
   * intermediate position a held direction produces. Resets the cursor to the
   * first cue that has not closed yet, so no backlog fires.
   */
  resync(positionMs: number): void {
    let lo = 0;
    let hi = this.cues.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cues[mid]!.end_ms <= positionMs) lo = mid + 1;
      else hi = mid;
    }
    this.cursor = lo;
    this.firing = null;
    console.log(`INTERSTICE.scheduler.resync pos_ms=${positionMs} cursor=${this.cursor}`);
  }
}

/**
 * AC6, the input half. A held D-pad direction emits a stream of key events;
 * acting on each one produces a seek storm and a resync per event. This defers
 * the action until the stream stops for `quietMs`.
 */
export function coalesce(fn: (value: number) => void, quietMs = 250) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = 0;
  let events = 0;

  return (value: number): void => {
    pending = value;
    events++;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`INTERSTICE.scheduler.coalesced events=${events} settled_ms=${pending}`);
      events = 0;
      timer = null;
      fn(pending);
    }, quietMs);
  };
}
```

> **`quietMs = 250` is not a registry limit.** It appears once, in this file, and describes an input-device behaviour rather than a shared fact — `references/doc-pattern.md`: prose-only detail that lives in a single place does not enter the registry. If a second component ever needs it, it does.

**Contracts implemented:** `changes[C3]`, `contracts.description_cue.status`, `AC4`, `AC6`

**Phase 9 verification:** `⟨commands.tests⟩` → a line containing `⟨commands.tests_expect⟩`. `02e` §B.1 carries the late-cue drop, the seek backlog, and the coalescing count, each with `Fails if:`.

---

---

---

## Continues in `02c2-audio-and-controls.md`

**Phases 10 and 11 moved there in R22**, when this file passed the 600-line split threshold. They hold `C4` DescriptionAudio with its JS volume fade, and `C5` ADControls. Nothing was summarised — the cut is on the phase boundary.

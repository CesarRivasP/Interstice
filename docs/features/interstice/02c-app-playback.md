# Implementation (3 of 4) — Interstice — the platform seam and the playback layer

> Complements `01-master-plan.md`. Part A, **Phases 7–11**: `MediaAdapter`, `C6` `TrackLoader`, `C3` `CueScheduler`, `C4` `DescriptionAudio`, `C5` `ADControls`.

- **Date:** 2026-09-19
- **Branch:** `main`
- **Test baseline:** `aborted_no_conditions` until `02` Phase 1 measures it. Every `Phase N verification:` below resolves through `_profile.yml`, never through a command invented for this document.

> **The preamble of `02-implementation-and-e2e.md` governs this file too** — language and layout, the `⟨commands.*⟩` notation, the logging convention, the "registry keys are the contract" rule, and the three deferred components (`C11`, `C15`, `C16`) that appear in none of the five halves. It is not repeated here.
> Split per `references/doc-pattern.md` §Splitting an oversized doc. No technical content differs from a single-file version.

**The set of five:** `02` (preamble, Phases 0–3: spike gate, scaffold, contracts in code, gap detection) · `02b` (Phases 4–6: frames, description, synthesis) · `02c` (Phases 7–11: the platform seam and the playback layer) · `02d` (Phases 12–17: screens, shell, the `[MANUAL]` deliverables) · `02e` (Part B test plan, Part C manual E2E, the Definition of Done, and the coverage map against `01-master-plan.md` §7).

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

## Phase 7 — `src/platform/MediaAdapter.ts` — the seam the platform lives behind

**File:** `src/platform/MediaAdapter.ts` (new), `src/platform/vega/index.ts` (new, `[MANUAL]` body)
**Anchor:** new files, full contents below.
**Maps to:** `_facts.yml defects[D3]`, `defects[D2]`, `alternatives[A4]`, `limits.ad.duck_target_pct`, `limits.ad.duck_ramp_ms`

**What changes:** the app gains the one interface that every other `src/` file talks to, and the only directory in the repository that names a Vega API. Nothing else in `src/` imports a platform module.

**Why this seam is not over-engineering here.** `D3` is `basis: asserted` and `status: open` — the Vega simulator has not been shown to run on this machine — and `alternatives[A4]` (the Fire OS Android build) reopens **immediately** if it dies (`01-master-plan.md` §3.3). With this seam, that reopen is one new directory under `src/platform/`; without it, it is a rewrite of six files under deadline. The seam is the price of `D3` being open, and `D3` is open because it has not been measured, not because nobody thought about it.

**Code:**

`src/platform/MediaAdapter.ts` (new file, full contents):

```ts
/**
 * The only surface the app uses to reach the platform. Implementations live in
 * src/platform/<platform>/. No file outside src/platform/ may import a platform
 * module directly — that is what makes alternatives[A4] a swap and not a rewrite.
 */

export type Unsubscribe = () => void;

export interface VideoPlayer {
  /** current playback position, ms */
  positionMs(): number;
  durationMs(): number;
  isPlaying(): boolean;
  /**
   * Set the main track volume as a percentage of full, ramped over rampMs.
   * limits.ad.duck_target_pct / limits.ad.duck_ramp_ms.
   * Resolves when the ramp has completed.
   */
  setVolumePct(pct: number, rampMs: number): Promise<void>;
  /** fires on every position update the platform emits */
  onPosition(cb: (ms: number) => void): Unsubscribe;
  /** fires after a seek settles, with the new position */
  onSeek(cb: (ms: number) => void): Unsubscribe;
  onEnded(cb: () => void): Unsubscribe;
  onError(cb: (err: Error) => void): Unsubscribe;
}

export interface ClipPlayer {
  /** plays a local audio file to completion; rejects if the file is missing */
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

`src/platform/vega/index.ts` (new file) — **`[MANUAL]`**:

```ts
// [MANUAL] — the body of this file is written from the output of `02` Phase 0.1.
// Do NOT write it before that spike has run: every symbol here is a Vega OS API
// name, and defects[D3] is `basis: asserted` precisely because none of them has
// been observed on this machine yet. A guessed import here is an invented fact
// that the executor will build six files on top of.
//
// What Phase 0.1 must hand back, and this file then implements:
//   - the video component/handle and how position is read
//   - the volume API and whether it accepts a ramp (defects[D2])
//   - the audio API for a second, concurrent stream (defects[D2])
//   - the background/foreground lifecycle event
//
// If Phase 0.1 killed D3, this directory is not written at all: alternatives[A4]
// reopens and the implementation goes in src/platform/firetv/ against React
// Native for Android TV, behind the same MediaAdapter interface.

import type { MediaAdapter } from '../MediaAdapter.js';

export function createVegaAdapter(): MediaAdapter {
  throw new Error('INTERSTICE.platform.unimplemented — see 02 Phase 0.1');
}
```

**Contracts implemented:** `defects[D2]` (the `setVolumePct` shape is what `D2` confirms or kills), `alternatives[A4]`, `limits.ad.duck_target_pct`, `limits.ad.duck_ramp_ms`

**Phase 7 verification:** `⟨commands.lint⟩` → exit 0. The structural assertion is `rg -n "from '.*platform/vega" src/ --glob '!src/platform/**'` returning **nothing** — no file outside `src/platform/` names the platform. That command is the seam, stated as something a program can check.

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
 * with a small heap; clips stream from disk and only the next N are resident.
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

> **A malformed file does not fall back; a missing one does.** The distinction is deliberate. A missing `detailed` track means that level was never generated — falling back to `standard` keeps description working. A malformed track means something produced a file that is not a track, and silently loading a different one would hide it. Both end in a state `C5` announces (Phase 11), neither ends in silence.

**Contracts implemented:** `changes[C6]`, `contracts.description_track`, `contracts.description_cue`, `limits.clip_cache.max_clips_in_memory`, `decisions.verbosity_levels`, `AC8`

**Phase 8 verification:** `⟨commands.tests⟩ src/ad/__tests__/TrackLoader.test.ts` → a line containing `⟨commands.tests_expect⟩`. Assertions in `02e` §B.1, including the eviction bound and the malformed-vs-missing split, each with its `Fails if:` line.

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

**Phase 9 verification:** `⟨commands.tests⟩ src/ad/__tests__/CueScheduler.test.ts` → a line containing `⟨commands.tests_expect⟩`. `02e` §B.1 carries the late-cue drop, the seek backlog, and the coalescing count, each with `Fails if:`.

---

## Phase 10 — `src/ad/DescriptionAudio.ts` (`C4`) — duck, speak, restore

**File:** `src/ad/DescriptionAudio.ts` (new)
**Anchor:** new file, full contents below.
**Maps to:** `_facts.yml changes[C4]`, `defects[D2]`, `decisions.d2_fallback`, `limits.ad.duck_target_pct`, `limits.ad.duck_ramp_ms`, `AC5`

**What changes:** a cue becomes audible. The main track ramps down to **25%** over **200 ms**, the clip plays, the main track ramps back to full. The restore runs in a `finally`: a clip that fails to play must not leave the film ducked for the rest of the runtime, which is the single worst failure this component can produce.

**This phase depends on `D2`, which `02` Phase 0.2 resolves.** If `D2` came back false, this file is not what ships: `decisions.d2_fallback` applies and description is toggled by **audio-track switching** over a pre-mixed track (`02b` Phase 6.3), with `DescriptionAudio` reducing to a track-index change. Build this version only against a confirmed `D2`.

**Code:**

`src/ad/DescriptionAudio.ts` (new file, full contents):

```ts
import type { MediaAdapter } from '../platform/MediaAdapter.js';
import { AD } from '../../pipeline/budget.js';
import type { DescriptionCue } from '../../pipeline/types.js';

export class DescriptionAudio {
  private active = false;

  constructor(private readonly media: MediaAdapter) {
    // mobile-tv gap sweep F5: backgrounding during playback must stop the clip
    // and restore the main level, or the app returns ducked and silent.
    this.media.lifecycle.onBackground(() => {
      if (!this.active) return;
      console.log('INTERSTICE.audio.background active=true');
      void this.stop();
    });
  }

  async speak(cue: DescriptionCue): Promise<void> {
    if (this.active) return; // a cue already speaking is never interrupted by another
    this.active = true;

    try {
      console.log(
        `INTERSTICE.audio.duck id=${cue.id} to_pct=${AD.DUCK_TARGET_PCT}` +
          ` ramp_ms=${AD.DUCK_RAMP_MS}`,
      );
      await this.media.video.setVolumePct(AD.DUCK_TARGET_PCT, AD.DUCK_RAMP_MS);
      await this.media.clips.play(cue.audio_uri);
      console.log(`INTERSTICE.audio.spoke id=${cue.id} words=${cue.words}`);
    } catch (err) {
      console.log(`INTERSTICE.audio.failed id=${cue.id} err=${(err as Error).message}`);
    } finally {
      // AC5: the main track ALWAYS returns to full, including on failure.
      await this.media.video.setVolumePct(100, AD.DUCK_RAMP_MS);
      this.active = false;
    }
  }

  async stop(): Promise<void> {
    this.media.clips.stop();
    await this.media.video.setVolumePct(100, AD.DUCK_RAMP_MS);
    this.active = false;
  }
}
```

**Contracts implemented:** `changes[C4]`, `limits.ad.duck_target_pct`, `limits.ad.duck_ramp_ms`, `defects[D2]`, `AC5`

**Phase 10 verification:** `⟨commands.tests⟩ src/ad/__tests__/DescriptionAudio.test.ts` → a line containing `⟨commands.tests_expect⟩` (adapter faked, `02e` §B.0). The **audible** assertion is `[MANUAL]` and lives in `02e` §C.2 — a test proves `setVolumePct` was called, and `02` Phase 0.2 already recorded that the call returning is not evidence the platform honoured it.

---

## Phase 11 — `src/ad/ADControls.tsx` (`C5`) — the remote surface, and every failure said out loud

**File:** `src/ad/ADControls.tsx` (new)
**Anchor:** new file, full contents below.
**Maps to:** `_facts.yml changes[C5]`, `decisions.verbosity_levels`, `AC3`, `AC8`, `AC15`, `AC17`

**What changes:** the viewer gets control. Three things, and the third is the one that is usually forgotten:

1. **Toggle description on and off** without interrupting playback (`AC3`). The video never pauses, never seeks, never reloads — only the scheduler is enabled or disabled.
2. **Three verbosity levels**, D-pad reachable, switching between the three generated tracks at runtime without a restart (`AC17`, `decisions.verbosity_levels`).
3. **Every failure branch of the loader has a state that is both visible and spoken** (`AC8`). This is an app for blind users; a control surface that shows an error and says nothing is the same as silence.

**On VoiceView:** the accessibility props below are the standard React Native surface (`accessible`, `accessibilityLabel`, `accessibilityRole`, `accessibilityState`, `AccessibilityInfo.announceForAccessibility`). Vega OS is React Native-based, so they are expected to map to VoiceView — **expected, not verified**. `02` Phase 0.1 is where that is confirmed on the simulator; if the surface differs, it is one more thing that belongs behind `src/platform/` (Phase 7) rather than sprinkled through this component. `AC15` is the acceptance criterion that makes this real, and it is checked in Phase 16.3, not here.

**Code:**

`src/ad/ADControls.tsx` (new file, full contents):

```tsx
import React, { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import type { Verbosity } from '../../pipeline/types.js';
import { VERBOSITY_LEVELS } from '../../pipeline/types.js';

export type ADState =
  | { kind: 'ready'; enabled: boolean; verbosity: Verbosity; cues: number }
  | { kind: 'missing'; detail: string }
  | { kind: 'malformed'; detail: string };

export interface ADControlsProps {
  state: ADState;
  onToggle: (enabled: boolean) => void;
  onVerbosity: (v: Verbosity) => void;
  /** Phase 12 hands focus here when the player screen mounts. */
  focusRef?: React.Ref<View>;
}

/** AC8 — every branch has a sentence, and the sentence is spoken, not only shown. */
export function stateMessage(state: ADState): string {
  switch (state.kind) {
    case 'ready':
      return state.enabled
        ? `Audio description on, ${state.verbosity}, ${state.cues} descriptions`
        : 'Audio description off';
    case 'missing':
      return 'No description track was found for this title. Playback continues without description.';
    case 'malformed':
      return 'The description track for this title could not be read. Playback continues without description.';
  }
}

export function ADControls({ state, onToggle, onVerbosity, focusRef }: ADControlsProps) {
  const lastSpoken = useRef<string>('');

  // AC8 + AC15: announce on entry and on every state change, once each.
  useEffect(() => {
    const message = stateMessage(state);
    if (message === lastSpoken.current) return;
    lastSpoken.current = message;
    AccessibilityInfo.announceForAccessibility(message);
    console.log(`INTERSTICE.controls.announce kind=${state.kind}`);
  }, [state]);

  const toggle = useCallback(() => {
    if (state.kind !== 'ready') return;
    console.log(`INTERSTICE.controls.toggle to=${!state.enabled}`);
    onToggle(!state.enabled); // AC3: the scheduler flips; the video is untouched
  }, [state, onToggle]);

  if (state.kind !== 'ready') {
    return (
      <View accessible accessibilityRole="alert" accessibilityLabel={stateMessage(state)}>
        <Text>{stateMessage(state)}</Text>
      </View>
    );
  }

  return (
    <View>
      <Pressable
        ref={focusRef}
        accessible
        accessibilityRole="switch"
        accessibilityLabel="Audio description"
        accessibilityState={{ checked: state.enabled }}
        onPress={toggle}
        hasTVPreferredFocus
      >
        <Text>{state.enabled ? 'Description: on' : 'Description: off'}</Text>
      </Pressable>

      {/* AC17 — three levels, each its own focusable, each announcing its state */}
      {VERBOSITY_LEVELS.map((level) => (
        <Pressable
          key={level}
          accessible
          accessibilityRole="radio"
          accessibilityLabel={`${level} description`}
          accessibilityState={{ selected: state.verbosity === level, disabled: !state.enabled }}
          disabled={!state.enabled}
          onPress={() => {
            console.log(`INTERSTICE.controls.verbosity to=${level}`);
            onVerbosity(level);
          }}
        >
          <Text>{level}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

> **`stateMessage` is exported for one reason.** `02e` §B.1 asserts the spoken string, and the test must assert the *same* string the component announces. Two copies of that sentence — one in the component, one in the test — is a test that passes while the app says something else.

**Contracts implemented:** `changes[C5]`, `decisions.verbosity_levels`, `AC3`, `AC8`, `AC17`, `AC15` (the surface; the pass itself is Phase 16.3)

**Phase 11 verification:** `⟨commands.tests⟩ src/ad/__tests__/ADControls.test.ts` → a line containing `⟨commands.tests_expect⟩`. `02e` §B.1 asserts each announcement by the exported `stateMessage`, and the selector's `accessibilityState` per level.

---

---

## Continues in `02d-screens-and-delivery.md`

Nothing was truncated. This file ends with the playback layer complete and nothing yet composing it into a screen. `02d-screens-and-delivery.md` holds Phases 12–17; `02e-tests-and-done.md` holds every test section this file's verification lines refer to.

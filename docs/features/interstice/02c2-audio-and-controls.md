# Implementation (3b of 7) — Interstice — the audible half: ducking and the remote surface

> Complements `01-master-plan.md`. Part A, **Phases 10–11**: description audio with its JS fade, and the control surface that says every failure out loud.

- **Date:** 2026-09-25
- **Branch:** `main`
- **Test baseline:** `⟨commands.tests_expect⟩`, per `_facts.yml tests_baseline`. Every `Phase N verification:` below resolves through `_profile.yml`, never through a command invented for this document.

> **The preamble of `02-implementation-and-e2e.md` governs this file too.** It is not repeated here.
> Split out of `02c` in R22 per `references/doc-pattern.md` §Splitting an oversized doc, when `02c` passed 600 lines. No technical content differs from a single-file version.

**The set of seven:** `02` (preamble, Phases 0–3) · `02b` (Phases 4–5) · `02b2` (Phase 6) · `02c` (Phases 7–9: the seam, the loader, the scheduler) · `02c2` (Phases 10–11: description audio, the control surface) · `02d` (Phases 12–17) · `02e` (Part B, Part C, the Definition of Done).

---

# Part A — Implementation plan (continued)

---

## Phase 10 — `src/ad/DescriptionAudio.ts` (`C4`) + `src/ad/duck.ts` — duck, speak, restore

**Files:** `src/ad/DescriptionAudio.ts` (exists since R21 — **rewire**, do not rewrite), `src/ad/duck.ts` (new)
**Anchor:** `src/ad/DescriptionAudio.ts` currently talks to `@amazon-devices/react-native-w3cmedia` directly. This phase moves it behind `MediaAdapter` (Phase 7) and adds the JS fade.
**Maps to:** `_facts.yml changes[C4]`, `defects[D2]`, `limits.ad.duck_target_pct`, `limits.ad.duck_ramp_ms`, `limits.vega_media.no_volume_ramp`, `AC5`

**What changes:** a cue becomes audible. The main track fades to **25%** over **200 ms**, the clip plays, the main track fades back to full. The restore runs in a `finally`: a clip that fails to play must not leave the film ducked for the rest of the runtime, which is the single worst failure this component can produce.

### 10.1 — `D2` holds, and the fallback branch does not run

This phase used to open by saying it depended on `D2`, with `decisions.d2_fallback` waiting behind it. **`D2` resolved TRUE on 2026-09-25** on the Virtual Device: a cue played its full 4.50 s while the film kept decoding, `dropped=0`, sampled mid-cue, with the main player at `0.25` and restored afterwards. Concurrent playback is real; the pre-mixed-track branch (`02b2` §6.3) does not run.

Two things that measurement did **not** settle, and which this phase must not claim:

- **The audible level.** There is no audio capture path off the Virtual Device. What was measured is that both pipelines ran and that the volume property was applied — not that a listener heard the film get quieter. `AC5` closes on hardware or during the `AC14` watch, and `02e` §C.2 is where that lives.
- **Concurrency on physical hardware.** Untested. `decisions.d2_fallback` stays in the registry for exactly that branch.

### 10.2 — The ramp is ours, written once

`limits.vega_media.no_volume_ramp`, measured by reading the API: the W3C volume setter is **instantaneous** and the platform exposes no fade. `limits.ad.duck_ramp_ms` (**200**) is therefore a JS-stepped fade — and it lives in its own module, called by the adapter's consumers, **never** reimplemented per platform. Phase 7 deliberately removed `rampMs` from the interface so that this cannot drift into three copies.

`src/ad/duck.ts` (new file, full contents):

```ts
import type { VideoPlayer } from '../platform/MediaAdapter.js';
import { AD } from '../../pipeline/budget.js';

/** one step per frame at 60 Hz, near enough for a 200 ms fade */
const STEP_MS = 16;

/**
 * Fade the main track between two volume percentages over rampMs.
 *
 * limits.vega_media.no_volume_ramp: the platform setter is instantaneous, so the
 * ramp is stepped here. Written once, in one place, because a fade duplicated
 * per platform is a fade that differs per platform.
 */
export async function rampVolumePct(
  video: VideoPlayer,
  fromPct: number,
  toPct: number,
  rampMs: number = AD.DUCK_RAMP_MS,
): Promise<void> {
  const steps = Math.max(1, Math.round(rampMs / STEP_MS));
  for (let i = 1; i <= steps; i++) {
    video.setVolumePct(fromPct + ((toPct - fromPct) * i) / steps);
    if (i < steps) await new Promise((r) => setTimeout(r, STEP_MS));
  }
  // Land exactly on the target: accumulated rounding must never leave the film
  // at 99% forever, and AC5 is asserted against the final value.
  video.setVolumePct(toPct);
}
```

### 10.3 — The component

`src/ad/DescriptionAudio.ts` — **the existing file, rewired**:

```ts
import type { MediaAdapter } from '../platform/MediaAdapter.js';
import { AD } from '../../pipeline/budget.js';
import type { DescriptionCue } from '../../pipeline/types.js';
import { rampVolumePct } from './duck.js';

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
      console.log(`INTERSTICE.audio.duck id=${cue.id} to_pct=${AD.DUCK_TARGET_PCT}`);
      await rampVolumePct(this.media.video, 100, AD.DUCK_TARGET_PCT);
      await this.media.clips.play(cue.audio_uri);
      console.log(`INTERSTICE.audio.spoke id=${cue.id} words=${cue.words}`);
    } catch (err) {
      console.log(`INTERSTICE.audio.failed id=${cue.id} err=${(err as Error).message}`);
    } finally {
      // AC5: the main track ALWAYS returns to full, including on failure.
      await rampVolumePct(this.media.video, AD.DUCK_TARGET_PCT, 100);
      this.active = false;
    }
  }

  async stop(): Promise<void> {
    this.media.clips.stop();
    await rampVolumePct(this.media.video, AD.DUCK_TARGET_PCT, 100);
    this.active = false;
  }
}
```

> **Duck when the clip is ready to speak, not when it is requested.** The R21 implementation ducks on the clip player's `canplay`, not before fetching and appending. The gap between *"we decided to speak"* and *"sound comes out"* was ~90 ms on the Virtual Device; ducking at request time spends that as dead air at 25%, every cue, all film long. When the fetch is moved behind `ClipPlayer.play()`, that ordering has to survive the move — which is why `play()` resolves on **ended** and the duck is driven from here in two steps rather than wrapped around one opaque call.

**Contracts implemented:** `changes[C4]`, `limits.ad.duck_target_pct`, `limits.ad.duck_ramp_ms`, `limits.vega_media.no_volume_ramp`, `limits.vega_media.concurrent_streams`, `defects[D2]`, `AC5`

**Phase 10 verification:** `⟨commands.tests⟩` → a line containing `⟨commands.tests_expect⟩` (adapter faked, `02e` §B.0). Two assertions carry `Fails if:` lines: the `finally` restore (fails if a rejecting clip leaves the volume at 25) and the fade landing exactly on its target (fails if rounding leaves it at 99). The **audible** assertion is `[MANUAL]` and lives in `02e` §C.2 — a test proves `setVolumePct` was called, and R21 already recorded that the call being applied is not evidence anyone heard it.

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

Phases 12–17: `C2` PlayerScreen, `C1` App, the `[MANUAL]` deliverables `C12`/`C13`/`C14`, and the removal of the Phase 0 instrumentation.

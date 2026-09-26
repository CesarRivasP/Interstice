# Implementation (4 of 5) — Interstice — screens, shell, and the deliverables that are not code

> Complements `01-master-plan.md`. Part A, **Phases 12–17**: `C2` `PlayerScreen`, `C1` `App`, then the `[MANUAL]` deliverables `C12`/`C13`/`C14` and the removal of the Phase 0 instrumentation.

- **Date:** 2026-09-19
- **Branch:** `main`
- **Test baseline:** `aborted_no_conditions` until `02` Phase 1 measures it. Every verification below resolves through `_profile.yml`, never through a command invented for this document.

> **The preamble of `02-implementation-and-e2e.md` governs this file too** — language and layout, the `⟨commands.*⟩` notation, the logging convention, the "registry keys are the contract" rule, and the three deferred components (`C11`, `C15`, `C16`) that appear in none of the five halves. It is not repeated here.
> Split per `references/doc-pattern.md` §Splitting an oversized doc. No technical content differs from a single-file version.

**The set of seven:** `02` (preamble, Phases 0–3: spike gate, scaffold, contracts in code, gap detection) · `02b` (Phases 4–5: frames, description) · `02b2` (Phase 6: synthesis and the track files) · `02c` (Phases 7–9: the platform seam, the loader, the scheduler) · `02c2` (Phases 10–11: description audio, the control surface) · `02d` (Phases 12–17: screens, shell, the `[MANUAL]` deliverables) · `02e` (Part B test plan, Part C manual E2E, the Definition of Done, and the coverage map against `01-master-plan.md` §7).

---

## Changelog

Same tag + date spine as `01-master-plan.md` and `02`.

### 2026-09-21 — v7: doc 02 written, split in five

`implement` round R8. This file holds the two phases that compose the playback layer into a running app, and the four deliverables that are judged rather than executed.

### 2026-09-19 — v6: owner confirmed — `status: draft -> reviewed`

Docs 02 and 03 come into scope.

### 2026-09-19 — v3: user validation, gap visualization, quality gate

Phase 16 gains the gap visualization (`AC19`), the validation session (`AC20`) and the full-length 1–5 quality watch (`AC14`).

### 2026-09-19 — v2: focus hosts

Phase 12 names a focus host in every screen state (`AC2`).

---

# Part A — Implementation plan (continued)

---

## Phase 12 — `src/screens/PlayerScreen.tsx` (`C2`) — a focus host in every state

**File:** `src/screens/PlayerScreen.tsx` (exists since R20 — **extend and rewire**, do not start from a blank file)
**Anchor:** the file on disk already holds the byte-delivery increment described in §12.1. This phase moves it behind `MediaAdapter` (`02c` Phase 7), adds the window, and adds the states §12.2 lists.
**Maps to:** `_facts.yml changes[C2]`, `limits.mse_buffer`, `limits.vega_media.url_mode_broken`, `AC1`, `AC2`, `AC8`, `AC23`, `AC24`

**What changes:** the screen that wires everything together —  and, since R20, **the screen that delivers the film's bytes**. The `mobile-tv` gap sweep finding it answers (`F2`) is specific and fatal: **a screen state whose only focusable element unmounts leaves the D-pad dead** — no focus, no key events, and the only way out is force-stopping the app. Every one of the four states below therefore names its focus host explicitly, and `BACK` during playback has a stated destination rather than whatever the navigator defaults to.

| state | focus host | `BACK` goes to |
|---|---|---|
| loading / buffering | the loading `View` itself (`accessible`, focusable) | the title list |
| playing | the `ADControls` toggle (`hasTVPreferredFocus`) | the title list, playback stopped |
| **stalled** | the stalled `View` (`accessibilityRole="alert"`) | the title list |
| error | the error `View` (`accessibilityRole="alert"`) | the title list |
| empty (track missing) | the `ADControls` alert `View` | the title list |

### 12.1 — This screen owns byte delivery, and that is scope rather than detail

`limits.vega_media.url_mode_broken`: there is no URI you can give the player that will make it fetch anything. The app creates a `MediaSource`, attaches it with `srcObject`, and appends the bytes itself. Three obligations follow, and each was a `review` finding in R21 rather than something the first version anticipated:

- **`R21-F1` — bound what is resident.** The first increment reads the whole file with one `arrayBuffer()`. That is correct for the 2.6 MB demo clip and an **OOM for the real asset**, which is a 12.24-minute, 117 MB transcode on a device that `limits.clip_cache` already describes as a 32-bit process with a small heap — and `SourceBuffer` carries its own quota besides, raising `QuotaExceededError` independently of the heap. Append in `limits.mse_buffer.chunk_bytes` slices against `SourceBuffer.updating`, keep `ahead_s` buffered forward, drop anything more than `behind_s` behind the playhead with `SourceBuffer.remove()`. **`AC23` is what turns those three numbers from `decided` into measured**, and it runs on the worst device in the matrix, not here.
- **`R21-F2` — a seek outside the window has no bytes.** URL mode used to let the platform fetch byte ranges; now the app must, and a fragmented MP4 carries no index to find them with. `contracts.asset_manifest.byte_index` supplies one. A seek the app cannot serve resolves into the stalled state below rather than into a frozen picture.
- **`R21-F3` — a stall is not an error.** When bytes run short the player emits `waiting`/`stalled` and **never** `error`. A screen that listens only for `onError` leaves the viewer with a still frame and silence. For this app's users that is indistinguishable from the film simply not being interesting any more, which is the precise failure `AC8` forbids one layer up. `AC24` is the criterion.
- **`R21-F6` — abort on unmount.** The in-flight `fetch` is tied to an `AbortController`, so leaving the screen mid-buffer stops the transfer instead of finishing it into a component that no longer exists.


**Code:**

`src/screens/PlayerScreen.tsx` (new file, full contents):

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { ADControls, type ADState } from '../ad/ADControls.js';
import { CueScheduler, coalesce } from '../ad/CueScheduler.js';
import { DescriptionAudio } from '../ad/DescriptionAudio.js';
import { loadTrack } from '../ad/TrackLoader.js';
import type { MediaAdapter } from '../platform/MediaAdapter.js';
import type { Verbosity } from '../../pipeline/types.js';

export interface PlayerScreenProps {
  media: MediaAdapter;
  readJson: (path: string) => Promise<unknown>;
  assetDir: string;
  assetId: string;
  onExit: () => void; // AC2: BACK's stated destination — the title list
}

type ScreenState = 'loading' | 'playing' | 'stalled' | 'error';

export function PlayerScreen({
  media, readJson, assetDir, assetId, onExit,
}: PlayerScreenProps) {
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [ad, setAd] = useState<ADState>({ kind: 'missing', detail: 'not loaded' });
  const [verbosity, setVerbosity] = useState<Verbosity>('standard');

  const audio = useRef<DescriptionAudio | null>(null);
  const scheduler = useRef<CueScheduler | null>(null);
  const focusRef = useRef<View>(null);

  // --- track load, and re-load on a verbosity switch (AC17, no restart) ---
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await loadTrack(readJson, assetDir, assetId, verbosity);
      if (cancelled) return;

      if (!result.ok) {
        // AC8: a stated state, never silence.
        setAd({ kind: result.reason, detail: result.detail });
        setScreen('playing'); // the film still plays; only description is absent
        return;
      }

      scheduler.current!.load(result.track.cues);
      setAd({
        kind: 'ready',
        enabled: true,
        verbosity: result.loaded_verbosity ?? verbosity,
        cues: result.track.cues.filter((c) => c.status === 'ok').length,
      });
      setScreen('playing');
    })();

    return () => { cancelled = true; };
  }, [readJson, assetDir, assetId, verbosity]);

  // --- wiring: position -> scheduler -> audio; seek -> coalesced resync ---
  useEffect(() => {
    audio.current = new DescriptionAudio(media);
    scheduler.current = new CueScheduler({
      onFire: (cue) => { void audio.current!.speak(cue); },
    });

    const resync = coalesce((ms: number) => scheduler.current!.resync(ms));

    const offPosition = media.video.onPosition((ms) => scheduler.current!.tick(ms));
    const offSeek = media.video.onSeek(resync);          // AC6
    // AC22 / R21-F3: running dry raises no error, so it needs its own listener
    // and its own state. Without this the screen stays in `playing` forever.
    const offStalled = media.video.onStalled(() => {
      console.log('INTERSTICE.player.stalled');
      void audio.current?.stop();  // never leave the film ducked under a stall
      setScreen('stalled');
    });
    const offError = media.video.onError((err) => {
      console.log(`INTERSTICE.player.error msg=${err.message}`);
      setScreen('error');
    });

    return () => {
      offPosition(); offSeek(); offStalled(); offError();
      void audio.current?.stop();
    };
  }, [media]);

  // --- AC2: BACK has one stated destination from every state ---
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      console.log(`INTERSTICE.player.back from=${screen}`);
      void audio.current?.stop();
      onExit();
      return true;
    });
    return () => sub.remove();
  }, [screen, onExit]);

  if (screen === 'loading') {
    // AC2: the loading state's own focus host — without this the D-pad is dead
    // for as long as the load takes.
    return (
      <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading title">
        <Text>Loading…</Text>
      </View>
    );
  }

  if (screen === 'stalled') {
    // AC22: spoken, not just shown. A frozen picture says nothing to this app's
    // users, and a stall raises no error for anything else to report.
    return (
      <View accessible accessibilityRole="alert" accessibilityLabel="The video paused while it loads more. Press back to return to the list.">
        <Text>Buffering…</Text>
      </View>
    );
  }

  if (screen === 'error') {
    return (
      <View accessible accessibilityRole="alert" accessibilityLabel="This title could not be played. Press back to return to the list.">
        <Text>This title could not be played.</Text>
      </View>
    );
  }

  return (
    <View>
      {/* the platform video surface is mounted by src/platform/ — Phase 7 */}
      <ADControls
        state={ad}
        focusRef={focusRef}
        onToggle={(enabled) => {
          scheduler.current!.setEnabled(enabled);          // AC3: video untouched
          if (!enabled) void audio.current!.stop();
          setAd((s) => (s.kind === 'ready' ? { ...s, enabled } : s));
        }}
        onVerbosity={(v) => setVerbosity(v)}                // AC17: re-runs the loader
      />
    </View>
  );
}
```

> **The verbosity switch re-runs the loader and nothing else.** The video keeps playing, the position is untouched, and the scheduler is reloaded with the new track's cues. That is what "switches verbosity between three levels without restart" means in `AC17`, and it is also why `TrackLoader` falls back to `standard` rather than failing — a missing level must not stop the film.

**Contracts implemented:** `changes[C2]`, `limits.mse_buffer`, `limits.vega_media.url_mode_broken`, `limits.vega_media.surface_races_init`, `AC1`, `AC2`, `AC3`, `AC6`, `AC8`, `AC17`, `AC23`, `AC24`

> **Do not lose the surface race while rewiring.** `limits.vega_media.surface_races_init`: `initialize()` and the platform handing over the video surface are independent async signals with no guaranteed order, and on the Virtual Device the surface won by **26 ms**. Starting playback from the surface callback alone plays a player with nothing attached and yields `MEDIA_ERR_SRC_NOT_SUPPORTED`, which reads exactly like an unsupported file and is not one. The dual readiness tracking in the file on disk exists for that, and it is invisible until it is removed.

**Phase 12 verification:** `⟨commands.tests⟩` → a line containing `⟨commands.tests_expect⟩`. The suite already pins two of this phase's invariants (`test/App.spec.tsx`): that a surface-created handler is registered before playback, and that `.src` stays **empty** while media is attached through `srcObject`. The focus-host claim per state is only fully verifiable on a device — `02e` §C.3 is the `[MANUAL]` D-pad walk that closes `AC2`, and `AC23`'s memory bound needs the worst device in the matrix.

---

## Phase 13 — `src/App.tsx` (`C1`) — shell, navigation, and the rest of the profile

**File:** `src/App.tsx` (new) + `docs/features/_profile.yml:14` (existing)
**Anchor:** new file; the profile edit anchors at `docs/features/_profile.yml:14` — `commands:`
**Maps to:** `_facts.yml changes[C1]`, `AC1`, `_profile.yml commands.build`, `commands.device_log`, `commands.force_stop`

**What changes:** the app becomes an app — a title list and the player screen — and `_profile.yml` loses its last three `null`s, because by now the Vega build and log commands are known from `02` Phase 0.1 and from having actually run this.

**Code:**

`src/App.tsx` (new file, full contents):

```tsx
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PlayerScreen } from './screens/PlayerScreen.js';
import { createVegaAdapter } from './platform/vega/index.js';

const media = createVegaAdapter();

// One asset. decisions.demo_asset_licensing — openly licensed, dialogue-bearing,
// chosen in `02` Phase 0.6 and recorded with its license in README.md.
const TITLES = [{ id: 'demo', label: 'Demo title' }];

async function readJson(path: string): Promise<unknown> {
  // [MANUAL] — the file-read API comes from `02` Phase 0.1, like every other
  // platform call. It belongs behind src/platform/ if it is not the standard
  // React Native one.
  throw new Error(`INTERSTICE.app.readJson unimplemented path=${path}`);
}

export default function App() {
  const [playing, setPlaying] = useState<string | null>(null);

  if (playing) {
    return (
      <PlayerScreen
        media={media}
        readJson={readJson}
        assetDir="assets"
        assetId={playing}
        onExit={() => setPlaying(null)}
      />
    );
  }

  return (
    <View>
      {TITLES.map((t) => (
        <Pressable
          key={t.id}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Play ${t.label}`}
          hasTVPreferredFocus
          onPress={() => setPlaying(t.id)}
        >
          <Text>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

**13.1 — Finish `_profile.yml`.** Replace the last three `null`s with what is now known, each **copied from a command that ran**, never typed from memory:

```yaml
  build:        "<the Vega build command, from `02` Phase 0.1>"
  device_log:   "<the simulator log command, filtered to {log_tag}>"
  force_stop:   "<the simulator stop command, for {app_id}>"
```

`{log_tag}` is `INTERSTICE` and `{app_id}` is `com.cesarrivasp.interstice`. If Phase 0.1 showed the simulator has no log command and output is read from a console window instead, write `null` and say where the output is read — `references/implementable.md` §Diagnostic log lines: a profile that names a command nobody can run is worse than one that names none.

**Contracts implemented:** `changes[C1]`, `AC1`, `_profile.yml commands.build`, `commands.device_log`, `commands.force_stop`, `decisions.product_name` (`app_id`)

**Phase 13 verification:** `⟨commands.build⟩` → a build that installs on the simulator, then the app launches and plays the demo asset end to end — that observation **is** `AC1`, and it is `[MANUAL]`. `rg -n 'null' docs/features/_profile.yml` should now return only lines carrying an explanatory comment.

---

## Phase 14 — [MANUAL] `C12` — `react-native-tv-audio-description`

**File:** `github.com/CesarRivasP/react-native-tv-audio-description` *(external)*
**Anchor:** new repository.
**Maps to:** `_facts.yml changes[C12]`, `decisions.oss_package_scope`, `AC10`, `limits.hackathon.friction_log_bonus_pct` (no), `01-master-plan.md` §3.2 Phase 3

**What changes:** the Open Source mini-challenge entry. **What goes in** (`decisions.oss_package_scope`): the TV-side description layer — `CueScheduler` (Phase 9), `DescriptionAudio` (Phase 10), `ADControls` (Phase 11), `TrackLoader` (Phase 8), and the `MediaAdapter` interface (Phase 7). **What stays out:** the pipeline and the app. The pipeline is asset-specific glue and nobody would install it; the reusable half is the TV integration, which is also where the entrant's edge is.

The extraction is a real one, and the `MediaAdapter` seam is what makes it possible at all: the five files above import the interface, never a platform. A consumer supplies their own adapter.

**Checklist (each item is `AC10`):**
- public repository, MIT or Apache-2.0, `LICENSE` file present
- `README.md` with install, the `MediaAdapter` interface, and a worked example
- a runnable example **verifiable in one command** — `npm run example` from a clean clone, stated in the README and actually executed from a fresh clone before it is claimed
- every commit lands **inside the submission window**; a repository whose history predates it does not count for the mini challenge
- the main repository links to it and it links back

**Phase 14 verification:** `[MANUAL]`, from a **clean clone into an empty directory**: `git clone … && cd … && npm install && npm run example` → the example runs. Verifying this in the working copy proves nothing — the working copy has state a judge will not have.

---

## Phase 15 — [MANUAL] `C13` — `FRICTION-LOG.md`, written since Phase 0

**File:** `FRICTION-LOG.md`
**Anchor:** created in `02` Phase 0.7. This phase closes it, it does not start it.
**Maps to:** `_facts.yml changes[C13]`, `decisions.friction_log_shape`, `limits.hackathon.friction_log_bonus_pct`, `AC11`

**What changes:** nothing, if Phase 0.7 was done. The entries were written as they happened; this phase reviews, dates and closes them.

**The shape** (`decisions.friction_log_shape`), 5–8 real entries covering Vega, Bedrock and Polly setup:

```markdown
### 2026-09-19 — Vega simulator install
- **tool:** Vega OS SDK <version>
- **expected:** …
- **happened:** …
- **workaround:** …
- **time_lost:** 45 min
```

> **A log reconstructed at the end reads as fabricated and scores zero**, which is the whole reason `decisions.friction_log_shape` exists and the reason the file is opened in Phase 0. The bonus is up to `limits.hackathon.friction_log_bonus_pct` (**10%**) of a five-criteria score and nothing guarantees the entry earns all of it — an accepted risk in `01-master-plan.md` §8 — but a log written as a by-product costs near zero regardless.

**Phase 15 verification:** `[MANUAL]`. `AC11`: every entry carries a date that falls inside the build, and the dates are spread across phases rather than clustered on one day. Clustering is the signature of reconstruction, and it is visible to a judge.

---

## Phase 16 — [MANUAL] `C14` — `SUBMISSION.md`, the video, and the four things that are not code

**File:** `SUBMISSION.md`
**Anchor:** new file.
**Maps to:** `_facts.yml changes[C14]`, `decisions.gap_visualization`, `decisions.user_validation`, `limits.ad.quality_gate`, `AC12`, `AC13`, `AC14`, `AC15`, `AC16`, `AC19`, `AC20`

**16.1 — [MANUAL] The gap visualization** (`decisions.gap_visualization`, `AC19`). **A gap is silence, and silence is invisible to a sighted judge watching a 3-minute video.** If the mechanism is not visualized it does not exist in the judging room. Two renders, both offline, both from `C7` data (`02` Phase 3) — which is why `findGaps` returns `duration_ms`, `before` and `after` rather than just timestamps:

- a **timeline strip**: dialogue blocks against gaps across the runtime, with a marker per placed cue, and the sub-threshold gaps visibly rejected
- a **split-screen before/after**: the same 30 seconds with silence, then with ducking and description

If the clock runs out this is the **first** thing to degrade — to a static diagram, not to nothing — per `decisions.schedule_risk_accepted`.

**16.2 — [MANUAL] The quality watch** (`AC14`, `limits.ad.quality_gate`, `AC18`). Watch the demo asset **end to end** with the description track and rate **every cue 1–5** against the picture. Record the track mean and the percentage `failed`. Regenerate the worst cues and re-watch those. This is also where `AC18` is checked: naming coherence across the film — does the cast stay named the same way from the first cue to the last, or does it drift back to "the woman"?

This cannot be automated and it was already ruled out once: `decisions.typesafe_judgment_layer` records that Jev/System One is **text-only** and cannot see a frame, so it cannot score visual fidelity. Do not re-propose it. If the clock runs out, this degrades from every cue to a stratified sample — the third and last sacrifice in `decisions.schedule_risk_accepted`.

**16.3 — [MANUAL] The VoiceView pass** (`AC15`). Turn VoiceView on and reach every control with the D-pad alone. Every control announces what it is and what state it is in. **This is an app for blind users and its own control surface is the first thing that has to work for them** — and the demo video must show it, because a claim about accessibility that the video does not demonstrate is a claim a judge cannot score.

**16.4 — [MANUAL] The validation session** (`AC20`, `decisions.user_validation`). 20–30 minutes with the participant recruited in `02` Phase 0.5: with description and without, consent recorded, an anonymized quote retained for `SUBMISSION.md` and the video if permission is given. **No PII in the repository** — not a name, not a contact, not a recording. If nobody was confirmed by **10-16** this is dropped and the submission says so, per `decisions.user_validation`; it is the second sacrifice in `decisions.schedule_risk_accepted`.

**16.5 — [MANUAL] The sourced figure** (`AC16`). At least one sourced figure on audio-description coverage. **The figure and its source enter `_facts.yml` before they enter the prose** — a number that appears first in a document has no home and no source, and the "potential impact" criterion is scored on a claim a judge can check.

**16.6 — [MANUAL] The video** (`AC12`). Under **3 minutes**, in **English**, showing the app running on the target platform. Contents, in the order that survives a 3-minute budget: the problem, the gap mechanism visualized (16.1), the app running with description on, the verbosity switch (`AC17`), VoiceView (16.3), the validation quote (16.4). No unauthorized third-party copyrighted material — the asset is the openly licensed one from `02` Phase 0.6 and the video is published publicly.

**16.7 — [MANUAL] Product feedback**, written for every Amazon tool and API used — Vega OS and its SDK, Bedrock, Polly. Distinct from the friction log: the friction log is what went wrong, the product feedback is what should change.

**16.8 — [MANUAL] Submit** (`AC13`). Every Devpost field, before **2026-10-23 12:00 PT**, with the primary track (Fire TV) and **both** mini challenges (AWS Builder, Open Source) declared. Target **10-22** — one day early. `decisions.schedule_risk_accepted` records that this buffer is already spent, which means 10-22 is the date, not the cushion.

> **Re-read the rules page by hand before submitting.** Every value in `limits.hackathon` is `basis: asserted` against `https://amazonappdev2026.devpost.com/rules`, not measured: `curl` against Devpost returns HTTP 202 with an empty body, so no command reproduces them. The deadline, the video length and the credit amount are all facts nobody in this set has re-verified since 2026-09-19.

**Phase 16 verification:** `[MANUAL]`, item by item against §C and against the Definition of Done below.

---

## Phase 17 — Remove the Phase 0 instrumentation

**File:** `spikes/` (delete), plus any `INTERSTICE.frame` / `INTERSTICE.duck from=` line left in `src/`
**Anchor:** the blocks marked `[TEMPORARY INSTRUMENTATION — removed in Phase 17]` in `02` Phase 0.2 and 0.3.
**Maps to:** `_facts.yml defects[D1].log_line`, `defects[D2].log_line`

**What changes:** the two diagnostic lines that existed to settle `D1` and `D2` are removed.

**This phase runs after Phase 16, not after Phase 13.** The last code phase is not the last phase. `D2`'s line is the oracle for the duck behaviour, and the last run that reads it is the `[MANUAL]` audible check in `02e` §C.2 — which happens during the Phase 16 video recording, not when `DescriptionAudio` was written. Removing at the end of the code phases takes the oracle away from the only run that can close `AC5` on a device.

`INTERSTICE.audio.duck` (Phase 10) is **not** instrumentation and stays: it is the component's own operational logging, it names its emitter, and it is what makes a failed cue diagnosable after the fact.

**Phase 17 verification:** `rg -n 'INTERSTICE\.frame |INTERSTICE\.duck from=' src/ spikes/ 2>/dev/null` returns nothing, and `⟨commands.tests⟩` → a line containing `⟨commands.tests_expect⟩` with the same count as before the removal.

---

---

## Continues in `02e-tests-and-done.md`

Nothing was truncated. Part A ends here — every component exists and every deliverable is named. `02e-tests-and-done.md` holds Part B (the test plan, including the `02e` §B.0 mock preamble every phase in `02`, `02b`, `02c` and `02d` refers to), Part C (the manual E2E walks), the Definition of Done against all twenty `acceptance[]` criteria, and the coverage map against `01-master-plan.md` §7.

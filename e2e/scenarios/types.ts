import type { Fault } from '../collector.js';
import type { Key } from '../input.js';
import type { Assertion, Match } from '../trace.js';

export type Step =
  | { do: 'keys'; keys: Key[] }
  | { do: 'wait'; for: Match; timeout_ms?: number }
  | { do: 'shot'; caption: string }
  /** record for a fixed time from here; the wrapper cannot be stopped early */
  | { do: 'clip_start'; seconds: number }
  | { do: 'clip_stop'; caption: string }
  /** answer the requests a `hold` fault is sitting on */
  | { do: 'release' };

export interface Scenario {
  id: string;
  name: string;
  suite: 'release' | 'variant';
  use_case: string;
  /** ids in docs/features/interstice/_facts.yml acceptance[] */
  covers: string[];
  fixture: boolean;
  /** a registry id or a missing capability. A blocked scenario has no steps. */
  blocked_by?: string;
  faults?: Fault[];
  steps: Step[];
  assertions: Assertion[];
  /** cue windows on the playhead, for the timeline strip */
  windows_ms?: [number, number][];
  /** rendered beside the verdict: the limit of what a pass means */
  cannot_show?: string;
}

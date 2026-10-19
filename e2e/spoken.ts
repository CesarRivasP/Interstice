// Imported by path: the package's entry point loads React Native, which Node
// cannot. Same route the app set's contract-parity test takes.
import { stateMessage, type ADState } from '../node_modules/react-native-tv-audio-description/lib/messages.js';
import type { TraceEvent } from './trace.js';

/**
 * What the app said, in order. Overlay sentences come from the trace as
 * emitted; description-state sentences are produced by the package's OWN
 * stateMessage from the state the app logged, so the report never carries a
 * copy of the wording.
 */
export function spokenFrom(events: TraceEvent[]): string[] {
  const out: string[] = [];
  const say = (sentence: string) => {
    // the package does not repeat an unchanged sentence; neither does this
    if (sentence && out[out.length - 1] !== sentence) out.push(sentence);
  };
  for (const e of events) {
    if (e.name === 'overlay.shown') say(e.fields.spoken ?? '');
    if (e.name === 'ad.state') {
      const f = e.fields;
      const state: ADState =
        f.kind === 'ready'
          ? { kind: 'ready', enabled: f.enabled === 'true', verbosity: f.verbosity as never, cues: Number(f.cues) }
          : { kind: f.kind as 'missing' | 'malformed', detail: '' };
      say(stateMessage(state));
    }
  }
  return out;
}

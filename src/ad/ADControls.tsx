import React, { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import type { Verbosity } from '../../pipeline/types';
import { VERBOSITY_LEVELS } from '../../pipeline/types';
import {log} from '../diagnostics';

/**
 * `_facts.yml changes[C5]` — the remote surface, and every failure said out loud.
 *
 * This is an app for blind and low-vision viewers. A control surface that shows
 * an error and says nothing is the same as silence, which is the failure `AC8`
 * exists to forbid. Every assertion in the test suite is therefore about what is
 * ANNOUNCED, not about what is rendered.
 */

export type ADState =
  | { kind: 'ready'; enabled: boolean; verbosity: Verbosity; cues: number }
  | { kind: 'missing'; detail: string }
  | { kind: 'malformed'; detail: string };

export interface ADControlsProps {
  state: ADState;
  onToggle: (enabled: boolean) => void;
  onVerbosity: (v: Verbosity) => void;
  /** `02d` Phase 12 hands focus here when the player screen mounts. */
  focusRef?: React.Ref<View>;
}

/** `AC8` — every branch has a sentence, and the sentence is spoken, not only shown. */
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

  // AC8 + AC15: announce on entry and on every state change, once each. The
  // guard is not an optimisation — re-announcing an unchanged state talks over
  // the film for no reason, and this screen is already competing for the one
  // channel its users have.
  useEffect(() => {
    const message = stateMessage(state);
    if (message === lastSpoken.current) return;
    lastSpoken.current = message;
    AccessibilityInfo.announceForAccessibility(message);
    log(`INTERSTICE.controls.announce kind=${state.kind}`);
  }, [state]);

  const toggle = useCallback(() => {
    if (state.kind !== 'ready') return;
    log(`INTERSTICE.controls.toggle to=${!state.enabled}`);
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
            log(`INTERSTICE.controls.verbosity to=${level}`);
            onVerbosity(level);
          }}
        >
          <Text>{level}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Mirrors _facts.yml contracts.* field for field. Changing a field here without
// changing the registry is the drift this whole spec set exists to prevent.

/** _facts.yml contracts.description_track.verbosity */
export type Verbosity = 'concise' | 'standard' | 'detailed';

/** _facts.yml contracts.description_cue.status */
export type CueStatus = 'ok' | 'failed';

/** _facts.yml contracts.description_cue */
export interface DescriptionCue {
  id: string;
  start_ms: number;
  end_ms: number;
  words: number;
  text: string;
  audio_uri: string;
  source_frames_ms: number[];
  status: CueStatus;
}

/** _facts.yml contracts.description_track */
export interface DescriptionTrack {
  version: string;
  asset_id: string;
  generated_at: string;
  source_subtitles: string;
  verbosity: Verbosity;
  model_id: string;
  cues: DescriptionCue[];
}

export const VERBOSITY_LEVELS: readonly Verbosity[] = ['concise', 'standard', 'detailed'];

/**
 * decisions.verbosity_levels LOOKUP RULE: one track file per level, named
 * `<asset_id>.<verbosity>.track.json` beside the asset. The app resolves a level
 * switch by this name and falls back to `standard`.
 */
export function trackFileName(assetId: string, verbosity: Verbosity): string {
  return `${assetId}.${verbosity}.track.json`;
}

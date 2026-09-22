/**
 * Manual mock for @amazon-devices/react-native-w3cmedia.
 *
 * The real package reaches a native TurboModule (`KeplerW3CMediaTurboModule`)
 * that exists only on a Vega device, so importing it under jest throws an
 * Invariant Violation before a single assertion runs. Wired in through
 * jest.config.json `moduleNameMapper`.
 *
 * The surface mirrored here is the measured one — see `_facts.yml
 * limits.vega_media`, taken from the package's own type declarations. Keeping it
 * honest matters: a mock richer than the real API lets a test pass against a
 * method the device does not have.
 */
import * as React from 'react';
import { View, ViewProps } from 'react-native';

export const surfaceCallbacks: {
  created: Array<(handle: string) => void>;
  destroyed: Array<(handle: string) => void>;
} = { created: [], destroyed: [] };

export class VideoPlayer {
  src = '';
  currentTime = 0;
  duration = 0;
  paused = true;
  volume = 1;
  muted = false;
  videoWidth = 0;
  videoHeight = 0;
  error: { code: number } | null = null;

  readonly calls: string[] = [];
  private listeners = new Map<string, Array<() => void>>();

  initialize = jest.fn(async () => { this.calls.push('initialize'); });
  deinitialize = jest.fn(async () => { this.calls.push('deinitialize'); });
  setSurfaceHandle = jest.fn((h: string) => { this.calls.push(`setSurfaceHandle:${h}`); });
  clearSurfaceHandle = jest.fn((h: string) => { this.calls.push(`clearSurfaceHandle:${h}`); });
  load = jest.fn(() => { this.calls.push('load'); });
  play = jest.fn(async () => { this.calls.push('play'); this.paused = false; });
  pause = jest.fn(() => { this.calls.push('pause'); this.paused = true; });

  addEventListener(type: string, fn: () => void): void {
    const l = this.listeners.get(type) ?? [];
    l.push(fn);
    this.listeners.set(type, l);
  }

  /** test helper — fire a media event the component listens for */
  emit(type: string): void {
    (this.listeners.get(type) ?? []).forEach((fn) => fn());
  }
}

export class AudioPlayer extends VideoPlayer {}

export enum AudioContentType {
  CONTENT_TYPE_NONE = 0,
  CONTENT_TYPE_SPEECH = 1,
  CONTENT_TYPE_MUSIC = 2,
  CONTENT_TYPE_MOVIE = 3,
  CONTENT_TYPE_SONIFICATION = 4,
}

export enum AudioUsageType {
  USAGE_NONE = 0,
  USAGE_MEDIA = 1,
  USAGE_ACCESSIBILITY = 5,
}

interface SurfaceProps extends ViewProps {
  scalingmode?: string;
  onSurfaceViewCreated?: (handle: string) => void;
  onSurfaceViewDestroyed?: (handle: string) => void;
}

export function KeplerVideoSurfaceView({
  onSurfaceViewCreated,
  onSurfaceViewDestroyed,
  ...rest
}: SurfaceProps) {
  React.useEffect(() => {
    if (onSurfaceViewCreated) surfaceCallbacks.created.push(onSurfaceViewCreated);
    if (onSurfaceViewDestroyed) surfaceCallbacks.destroyed.push(onSurfaceViewDestroyed);
  }, [onSurfaceViewCreated, onSurfaceViewDestroyed]);
  return <View testID="kepler-video-surface" {...rest} />;
}

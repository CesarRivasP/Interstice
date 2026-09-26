import type {MediaSource} from '@amazon-devices/react-native-w3cmedia';
import type {AssetSegment, AssetSource} from '../MediaAdapter';
import {log} from '../../diagnostics';

/**
 * `limits.mse_buffer` in code: keep a bounded window of the asset in the
 * SourceBuffer, and never the whole thing.
 *
 * Two platform facts shape this and neither was guessable:
 *   - `limits.vega_media.url_mode_broken` — the player fetches nothing, so the
 *     app delivers every byte;
 *   - `limits.vega_media.no_range_requests` — a Range request returns the WHOLE
 *     file with status 200, so the app cannot read part of one. The window is
 *     therefore made of whole segments cut at build time.
 *
 * The window is measured in TIME, never in segment count. ffmpeg cuts on
 * keyframes, so the demo clip's segments run 9.94s, 4.17s, 5.29s and 0.65s —
 * "keep five segments" would mean anything between 3 and 50 seconds of media.
 */

/**
 * Only what this class actually uses, declared structurally.
 *
 * `MediaSource.addSourceBuffer` is typed as returning the W3C `SourceBuffer`
 * interface, which does not declare `addEventListener` — but the implementation
 * behind it does, and R18 measured that it works on the device. Naming the
 * concrete `SourceBufferImpl` here would bind this file to two dozen internals
 * it never touches; naming the five members it does touch says what it needs and
 * fails loudly if any of them disappears.
 */
export interface AppendTarget {
  readonly updating: boolean;
  appendBuffer(data: Uint8Array): void;
  remove(start: number, end: number): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/** `limits.mse_buffer.ahead_s` */
const AHEAD_MS = 30_000;
/** `limits.mse_buffer.behind_s` */
const BEHIND_MS = 10_000;

export class SegmentBuffer {
  private appended = new Set<number>();
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(
    private readonly source: MediaSource,
    private readonly buffer: AppendTarget,
    private readonly asset: AssetSource,
  ) {}

  /** Append the init segment, then enough of the asset to start playing. */
  async start(): Promise<void> {
    if (this.asset.initUri) {
      await this.append(await this.fetchBytes(this.asset.initUri), 'init');
    }
    await this.ensure(0);
  }

  /**
   * Bring the window up to date for a playhead position.
   *
   * Safe to call on every `timeupdate`: segments already appended are skipped,
   * and the work is serialised behind one promise chain because a SourceBuffer
   * accepts exactly one operation at a time. Calling `appendBuffer` while
   * `updating` is true throws `InvalidStateError`, which on this platform
   * surfaces as a media error indistinguishable from a bad file.
   */
  ensure(positionMs: number): Promise<void> {
    this.queue = this.queue.then(() => this.sync(positionMs)).catch(err => {
      log(`INTERSTICE.buffer.failed err=${(err as Error).message}`);
    });
    return this.queue;
  }

  private async sync(positionMs: number): Promise<void> {
    if (this.disposed) return;

    for (const segment of this.wanted(positionMs)) {
      if (this.appended.has(segment.index)) continue;
      const bytes = await this.fetchBytes(segment.uri);
      if (this.disposed) return;
      await this.append(bytes, `seg${segment.index}`);
      this.appended.add(segment.index);
    }

    await this.evict(positionMs);

    // `endOfStream` only once the last segment is in, or the player waits
    // forever for media that is not coming.
    const last = this.asset.segments[this.asset.segments.length - 1];
    if (last && this.appended.has(last.index) && this.source.readyState === 'open') {
      this.source.endOfStream();
      log(`INTERSTICE.buffer.complete segments=${this.appended.size}`);
    }
  }

  /** every segment overlapping [position, position + AHEAD_MS] */
  private wanted(positionMs: number): AssetSegment[] {
    return this.asset.segments.filter(
      s => s.end_ms > positionMs && s.start_ms <= positionMs + AHEAD_MS,
    );
  }

  private async evict(positionMs: number): Promise<void> {
    const cutoff = positionMs - BEHIND_MS;
    if (cutoff <= 0) return;

    const stale = this.asset.segments.filter(
      s => this.appended.has(s.index) && s.end_ms < cutoff,
    );
    if (stale.length === 0) return;

    const end = Math.max(...stale.map(s => s.end_ms));
    await this.operation(() => this.buffer.remove(0, end / 1000));
    for (const s of stale) this.appended.delete(s.index);

    log(`INTERSTICE.buffer.evicted n=${stale.length} up_to_ms=${end} held=${this.appended.size}`);
  }

  private async fetchBytes(uri: string): Promise<Uint8Array> {
    const response = await fetch(uri);
    return new Uint8Array(await response.arrayBuffer());
  }

  private async append(bytes: Uint8Array, label: string): Promise<void> {
    await this.operation(() => this.buffer.appendBuffer(bytes));
    log(`INTERSTICE.buffer.appended ${label} bytes=${bytes.byteLength} held=${this.appended.size}`);
  }

  /** run one SourceBuffer operation and wait for `updateend` */
  private operation(run: () => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const done = () => {
        this.buffer.removeEventListener('updateend', done);
        resolve();
      };
      this.buffer.addEventListener('updateend', done);
      try {
        run();
      } catch (err) {
        this.buffer.removeEventListener('updateend', done);
        reject(err as Error);
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    this.appended.clear();
  }
}

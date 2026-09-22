/**
 * Diagnostic channel for the Vega device.
 *
 * `console.log` is not readable on this platform: it reaches neither
 * `vega device start-log-stream` (Release or Debug) nor the Metro terminal,
 * which since React Native 0.73 routes JavaScript logs to React Native
 * DevTools. Every INTERSTICE.* line the specification calls for would be
 * written and never read.
 *
 * So lines go over HTTP to tools/beacon-server.mjs on the host, reachable
 * because the device already reverse-forwards to it. console.log is kept as
 * well, so the lines are there for anyone who does attach DevTools.
 *
 * TEMPORARY DIAGNOSTIC TRANSPORT — remove when a platform logging API is
 * confirmed, and not before the D2 runtime test has read its lines.
 */
const BEACON = 'http://localhost:8099/';

export function log(line: string): void {
  console.log(line);
  try {
    void fetch(`${BEACON}?m=${encodeURIComponent(line)}`).catch(() => {});
  } catch {
    // the beacon is diagnostic only: never let it break playback
  }
}

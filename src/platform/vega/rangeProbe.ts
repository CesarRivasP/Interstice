import {log} from '../../diagnostics';

/**
 * TEMPORARY DIAGNOSTIC — delete with the rest of the Phase 0 instrumentation
 * (`02d` Phase 17), and not before `AC23` has read its result.
 *
 * `limits.mse_buffer` needs to append a WINDOW of the asset rather than all of
 * it, and there are two ways to obtain part of a file. This measures whether the
 * first one is available:
 *
 *   - a byte-range `fetch` over the packaged path, which needs the platform to
 *     honour a `Range` header and answer `206 Partial Content`;
 *   - otherwise the asset must be split into segments at build time, which
 *     always works but moves the problem into `contracts.asset_manifest` and the
 *     pipeline.
 *
 * A 200 with the WHOLE body is the dangerous answer: it looks like success and
 * means the window would silently hold the entire file, which is exactly the
 * out-of-memory that `AC23` exists to prevent. So the byte length is logged, not
 * just the status.
 */
export async function probeRangeSupport(uri: string): Promise<void> {
  const FIRST = 65_536;

  try {
    const full = await fetch(uri);
    const fullBytes = (await full.arrayBuffer()).byteLength;
    log(`INTERSTICE.range.full status=${full.status} bytes=${fullBytes}`);

    const partial = await fetch(uri, {headers: {Range: `bytes=0-${FIRST - 1}`}});
    const partialBytes = (await partial.arrayBuffer()).byteLength;
    const contentRange = partial.headers.get('content-range') ?? 'none';

    log(
      `INTERSTICE.range.partial status=${partial.status} bytes=${partialBytes}` +
        ` asked=${FIRST} content_range=${contentRange}` +
        ` honoured=${partial.status === 206 || partialBytes === FIRST}`,
    );
  } catch (err) {
    log(`INTERSTICE.range.failed err=${(err as Error).message}`);
  }
}

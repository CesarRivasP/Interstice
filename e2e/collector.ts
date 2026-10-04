import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve, sep } from 'node:path';
import { matches, ordered, parseLine, type Match, type TraceEvent } from './trace.js';

/** what the fixture server does instead of serving a file */
export type Fault =
  /** 404 — a file that is not there */
  | { path: RegExp; kind: 'missing' }
  /** the first half of the body, then end — a file cut short */
  | { path: RegExp; kind: 'truncate' }
  /** destroy the socket — `fetch` REJECTS, which a status code never makes it do */
  | { path: RegExp; kind: 'drop' }
  /** do not answer until `release()` is called */
  | { path: RegExp; kind: 'hold' };

export interface Collector {
  /** everything received so far, in emission order */
  events(): TraceEvent[];
  /** how many events exist now — a scenario's slice starts here */
  mark(): number;
  /**
   * launch ids that STARTED since a mark: those whose seq 0 arrived after it.
   * Not "every id seen since": a terminated app keeps emitting for a second or
   * two, and its late lines arrive after the next scenario's mark.
   */
  bootsSince(from: number): Set<string>;
  waitFor(m: Match, timeoutMs: number, from: number): Promise<TraceEvent | null>;
  /** the arrival index just past an event `waitFor` returned */
  after(e: TraceEvent): number;
  arm(faults: Fault[]): void;
  disarm(): void;
  /** answer every held request */
  release(): void;
  /** fixture paths requested since the last arm(), for the run record */
  served(): string[];
  close(): Promise<void>;
}

export function createCollector(opts: { port: number; fixtureRoot: string }): Promise<Collector> {
  const root = resolve(opts.fixtureRoot);
  const received: TraceEvent[] = [];
  let faults: Fault[] = [];
  let held: Array<() => void> = [];
  let served: string[] = [];
  const waiters = new Set<() => void>();

  const sendFile = (res: ServerResponse, file: string, half: boolean) => {
    const size = statSync(file).size;
    const end = half ? Math.max(0, Math.floor(size / 2) - 1) : size - 1;
    res.writeHead(200, { 'Content-Length': end + 1 });
    // a file that vanishes mid-read must end the response, not the process
    createReadStream(file, { start: 0, end })
      .on('error', () => res.destroy())
      .pipe(res);
  };

  /**
   * Who may talk to this server: the app on the device, through the reverse
   * port forward, and nothing else.
   *
   * Binding to loopback is not enough. A page open in a browser on this
   * machine can also reach 127.0.0.1, and with it could inject trace lines —
   * forging the evidence a verdict is computed from — or read the fixtures.
   * So: no CORS header is ever sent, a request carrying an Origin (which a
   * browser adds and the app's fetch does not) is refused, and the Host must
   * be this server's own, which closes DNS rebinding.
   */
  const allowed = (req: IncomingMessage): boolean => {
    if (req.headers.origin !== undefined) return false;
    const host = req.headers.host ?? '';
    return host === `localhost:${opts.port}` || host === `127.0.0.1:${opts.port}`;
  };

  const handle = (req: IncomingMessage, res: ServerResponse): void => {
    if (!allowed(req)) return void res.writeHead(403).end();
    const url = new URL(req.url ?? '/', `http://localhost:${opts.port}`);

    // endpoints.fixtures
    if (url.pathname.startsWith('/fx/')) {
      const rel = decodeURIComponent(url.pathname.slice('/fx/'.length));
      const file = resolve(root, rel);
      served.push(rel);
      // loopback only, and never outside the fixture directory (01 §5)
      if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404).end();
        return;
      }
      const fault = faults.find((f) => f.path.test(rel));
      if (fault?.kind === 'missing') return void res.writeHead(404).end();
      if (fault?.kind === 'drop') return void req.socket.destroy();
      if (fault?.kind === 'hold') return void held.push(() => sendFile(res, file, false));
      return sendFile(res, file, fault?.kind === 'truncate');
    }

    // endpoints.beacon
    const line = url.searchParams.get('m');
    if (line) {
      received.push({
        boot: url.searchParams.get('b') ?? '',
        seq: Number(url.searchParams.get('s') ?? -1),
        t_dev_ms: Number(url.searchParams.get('t') ?? 0),
        t_host: new Date().toISOString(),
        line,
        ...parseLine(line),
      });
      for (const wake of waiters) wake();
    }
    res.writeHead(204).end();
  };

  // A malformed request — a bad percent-escape, an unparseable URL — throws
  // inside the handler. Uncaught, one such request would take the collector
  // down mid-run and every scenario after it would read as the app going silent.
  const server = createServer((req, res) => {
    try {
      handle(req, res);
    } catch {
      if (!res.headersSent) res.writeHead(400);
      res.end();
    }
  });

  const api: Collector = {
    events: () => ordered(received),
    mark: () => received.length,
    after: (e) => received.indexOf(e) + 1,
    bootsSince: (from) => new Set(received.slice(from).filter((e) => e.seq === 0).map((e) => e.boot)),
    waitFor(m, timeoutMs, from) {
      return new Promise((done) => {
        const check = () => {
          // arrival order here on purpose: `from` is an arrival index
          const hit = received.slice(from).find((e) => matches(e, m));
          if (!hit) return false;
          cleanup();
          done(hit);
          return true;
        };
        const timer = setTimeout(() => {
          cleanup();
          done(null);
        }, timeoutMs);
        const cleanup = () => {
          clearTimeout(timer);
          waiters.delete(check);
        };
        if (!check()) waiters.add(check);
      });
    },
    arm(next) {
      faults = next;
      served = [];
    },
    disarm() {
      faults = [];
      api.release();
    },
    release() {
      const pending = held;
      held = [];
      for (const answer of pending) answer();
    },
    served: () => [...served],
    close: () => new Promise((done) => server.close(() => done())),
  };

  return new Promise((ready, refuse) => {
    // A stale reader on this port silently eats every line the app sends: the
    // beacon is fire-and-forget, so nothing on the device would say so.
    server.once('error', (err: NodeJS.ErrnoException) =>
      refuse(
        err.code === 'EADDRINUSE'
          ? new Error(`port ${opts.port} is taken — another beacon reader is running (lsof -nP -iTCP:${opts.port} -sTCP:LISTEN)`)
          : err,
      ),
    );
    server.listen(opts.port, '127.0.0.1', () => ready(api));
  });
}

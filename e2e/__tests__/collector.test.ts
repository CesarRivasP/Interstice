import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createCollector, type Collector } from '../collector.js';

let port = 8199;
let open: Collector | null = null;
const start = async () => {
  const root = mkdtempSync(join(tmpdir(), 'e2e-fx-'));
  writeFileSync(join(root, 'a.json'), '{"hello":"fixture-a"}');
  writeFileSync(join(root, 'b.json'), '{"b":1}');
  writeFileSync(join(root, '..', 'secret-e2e.txt'), 'outside');
  port += 1;
  open = await createCollector({ port, fixtureRoot: root });
  return { c: open, url: `http://127.0.0.1:${port}` };
};
afterEach(async () => {
  open?.disarm();
  await open?.close();
  open = null;
});

describe('collector — beacon', () => {
  it('stores a line as contracts.trace_event', async () => {
    const { c, url } = await start();
    const res = await fetch(`${url}/?m=${encodeURIComponent('INTERSTICE.x.y a=1')}&b=k&s=0&t=5`);
    expect(res.status).toBe(204);
    expect(c.events()[0]).toMatchObject({ boot: 'k', seq: 0, t_dev_ms: 5, line: 'INTERSTICE.x.y a=1', name: 'x.y', fields: { a: '1' } });
  });

  it('waitFor resolves on arrival and returns null at the timeout', async () => {
    const { c, url } = await start();
    const waiting = c.waitFor({ name: 'late' }, 2000, c.mark());
    await fetch(`${url}/?m=INTERSTICE.late&b=k&s=0&t=1`);
    expect((await waiting)?.name).toBe('late');
    expect(await c.waitFor({ name: 'never' }, 50, c.mark())).toBeNull();
  });

  // Fails if: every launch id seen since the mark counts. A terminated app
  // keeps emitting for a second or two — measured on the first device run,
  // where the previous scenario's lines were attributed to the next one.
  it('bootsSince names only launches whose seq 0 arrived after the mark', async () => {
    const { c, url } = await start();
    await fetch(`${url}/?m=INTERSTICE.a&b=old&s=0&t=1`);
    const mark = c.mark();
    await fetch(`${url}/?m=INTERSTICE.b&b=old&s=1&t=2`);
    await fetch(`${url}/?m=INTERSTICE.a&b=new&s=0&t=3`);
    expect([...c.bootsSince(mark)]).toEqual(['new']);
  });

  it('says so when the port is already taken', async () => {
    await start();
    await expect(createCollector({ port, fixtureRoot: tmpdir() })).rejects.toThrow(/is taken/);
  });
});

describe('collector — fixtures and faults', () => {
  // Fails if: the root check goes. The server would read any file the user can.
  it('serves the fixture directory and nothing outside it', async () => {
    const { url } = await start();
    expect(await (await fetch(`${url}/fx/a.json`)).text()).toContain('fixture-a');
    expect((await fetch(`${url}/fx/..%2Fsecret-e2e.txt`)).status).toBe(404);
    expect((await fetch(`${url}/fx/nope.json`)).status).toBe(404);
  });

  it('missing is a 404 for the armed path only', async () => {
    const { c, url } = await start();
    c.arm([{ path: /a\.json$/, kind: 'missing' }]);
    expect((await fetch(`${url}/fx/a.json`)).status).toBe(404);
    expect((await fetch(`${url}/fx/b.json`)).status).toBe(200);
  });

  it('truncate serves half the body with status 200', async () => {
    const { c, url } = await start();
    c.arm([{ path: /a\.json$/, kind: 'truncate' }]);
    const res = await fetch(`${url}/fx/a.json`);
    expect(res.status).toBe(200);
    expect((await res.text()).length).toBe(10);
  });

  // Fails if: drop is a status code. The package never checks response.ok, so
  // an error body would be appended as media.
  it('drop makes fetch reject', async () => {
    const { c, url } = await start();
    c.arm([{ path: /a\.json$/, kind: 'drop' }]);
    await expect(fetch(`${url}/fx/a.json`)).rejects.toThrow();
  });

  it('hold answers only on release, and disarm releases too', async () => {
    const { c, url } = await start();
    c.arm([{ path: /a\.json$/, kind: 'hold' }]);
    let done = false;
    const pending = fetch(`${url}/fx/a.json`).then((r) => r.text()).then((t) => ((done = true), t));
    await new Promise((r) => setTimeout(r, 150));
    expect(done).toBe(false);
    c.release();
    expect(await pending).toContain('fixture-a');

    c.arm([{ path: /b\.json$/, kind: 'hold' }]);
    const second = fetch(`${url}/fx/b.json`).then((r) => r.status);
    await new Promise((r) => setTimeout(r, 50));
    c.disarm();
    expect(await second).toBe(200);
  });
});

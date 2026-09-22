/**
 * Diagnostic beacon receiver.
 *
 * Vega + React Native 0.83 has no readable JavaScript console: `console.log`
 * does not reach `vega device start-log-stream` in Release or Debug, and since
 * RN 0.73 Metro prints "JavaScript logs have moved" and routes them to React
 * Native DevTools, which needs a browser. That leaves an app that can run but
 * cannot report.
 *
 * This is the channel instead. The device already reaches the host through the
 * reverse port forwarding Metro uses, so the app sends one GET per event and
 * this prints it. Same shape as the INTERSTICE.* lines the spec specifies.
 *
 *   node tools/beacon-server.mjs
 *   vega device start-port-forwarding --port 8099 --forward false
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.BEACON_PORT ?? 8099);

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const msg = url.searchParams.get('m');
  if (msg) {
    const ts = new Date().toISOString().slice(11, 23);
    console.log(`${ts}  ${msg}`);
  }
  res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
  res.end();
}).listen(PORT, '127.0.0.1', () => {
  console.log(`beacon listening on http://127.0.0.1:${PORT}`);
});

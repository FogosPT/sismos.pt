// Records a few real messages from the EMSC realtime WebSocket (used to build
// tests/fixtures/emsc-ws.json). Usage: node scripts/ws-record.mjs out.json [count]
import { writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'emsc-ws.json';
const count = Number(process.argv[3] ?? 3);
const msgs = [];
const ws = new WebSocket('wss://www.seismicportal.eu/standing_order/websocket');
const done = () => {
  writeFileSync(out, JSON.stringify(msgs, null, 1));
  console.log('saved', msgs.length);
  process.exit(0);
};
ws.onopen = () => console.log('open');
ws.onerror = (e) => console.log('error', e.message);
ws.onmessage = (e) => {
  msgs.push(JSON.parse(e.data));
  console.log('msg', msgs.length);
  if (msgs.length >= count) done();
};
setTimeout(done, 150000);

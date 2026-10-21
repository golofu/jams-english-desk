// Dev check: echo gate timing with a fake clock.  node dev/check-echo-gate.mjs
import { ECHO_TAIL_MS, makeGate } from '../src/lib/echoGate.ts';
let t = 0, lag = 0, fails = 0;
const gate = makeGate(() => lag, () => t);
const step = (ms, playing, want, name) => { t += ms; const got = gate(playing); if (got !== want) fails++; console.log(`${got === want ? 'PASS' : 'FAIL'}  ${name} (t=${t})`); };
step(0, false, false, 'first quiet chunk still waits out a tail');
step(ECHO_TAIL_MS, false, true, 'opens after the tail');
step(100, true, false, 'shut while sound plays');
step(100, false, false, 'still shut right after');
step(ECHO_TAIL_MS - 200, false, false, 'still shut just before the tail ends');
step(200, false, true, 'opens when the tail ends');
lag = 300;
step(100, true, false, 'shut while sound plays (Bluetooth lag 300 ms)');
step(100, false, false, 'quiet starts');
step(ECHO_TAIL_MS, false, false, 'Bluetooth: still shut at the normal tail');
step(300, false, true, 'Bluetooth: opens after tail + lag');
step(100, true, false, 'a new sentence shuts it again');
process.exit(fails ? 1 : 0);

// Measures the room's machines (public/js/machines.js) in Chrome: for each, on the bare test page
// (public/mame/test.html), how long it takes to start, how fast MAME runs it (its steps of 1/60 s a
// second, ms a step) and what the page's frames cost, with the CPU as it is and slowed down 4× and
// 6× (Chrome's CPU throttling, standing in for a TV's); then in 3D in an emulated Quest 3's VR
// session (?xr=emulate, IWER); and what MAME is to download, as it is and gzipped, as GitHub Pages
// sends it. The room itself in emulated VR too, for what it leaves a machine. Prints a table; --json
// writes the figures, and --shots each machine's screen as it was after the run at full speed
// (<dir>/<id>.png). The page gets its frames at the display's rate, which a remote desktop session
// may hold to 30 a second: then MAME runs two steps a frame, and a step's cost is the figure to go by.
//   node tools/measure-machines.mjs [--visible] [--seconds 8] [--only nes,breakout] [--rates 1,4,6]
//     [--json file] [--shots dir]
// Headless by default. --visible opens a Chrome window of its own instead, which draws with the GPU
// (headless Chrome may draw WebGL on the CPU). Either way common's launchChrome starts it on a new
// profile set up so that Windows sees no failed logon.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { launchChrome, sleep } from 'common/tools/chrome.mjs';
import { serve, PUBLIC } from './serve.mjs';
import { MACHINES } from '../public/js/machines.js';

const { values: opts } = parseArgs({
  options: {
    visible: { type: 'boolean' },
    seconds: { type: 'string', default: '8' },
    only: { type: 'string' },
    rates: { type: 'string', default: '1,4,6' },
    json: { type: 'string' },
    shots: { type: 'string' },
  },
});
const seconds = Number(opts.seconds);
const rates = opts.rates.split(',').map(Number);
const machines = opts.only ? MACHINES.filter((m) => opts.only?.split(',').includes(m.id)) : MACHINES;

/** MAME's own files, as they are and gzipped (level 6, as a web server would). */
function downloads() {
  return ['arcade.wasm', 'arcade.js'].map((name) => {
    const data = readFileSync(join(PUBLIC, 'mame', name));
    return { name, bytes: data.length, gzipped: gzipSync(data, { level: 6 }).length };
  });
}

const server = await serve(PUBLIC);
const address = server.address();
const base = `http://127.0.0.1:${address && typeof address === 'object' ? address.port : 0}/`;
const chrome = await launchChrome({
  headless: !opts.visible,
  args: [
    '--window-size=1280,900',
    '--autoplay-policy=no-user-gesture-required', // the machines' sound starts with no click
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
  ],
});
/** @type {any[]} */
const results = [];
try {
  const page = await chrome.newPage();
  await page.send('Performance.enable');
  const busy = async () => (await page.send('Performance.getMetrics')).metrics.find((/** @type {any} */ m) => m.name === 'TaskDuration').value;
  /** @param {string} expression @param {number} ms */
  const until = async (expression, ms) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) {
      if (await page.evaluate(expression).catch(() => false)) return true;
    }
    return false;
  };
  /**
   * The main thread's busy share over `seconds`, and what `figures` (a page expression) gives after
   * it, `reset` evaluated first.
   * @param {string} reset @param {string} figures
   */
  const measure = async (reset, figures) => {
    await page.evaluate(reset);
    const t0 = Date.now(), b0 = await busy();
    await sleep(seconds * 1000);
    const b1 = await busy(), t1 = Date.now();
    return { busy: (b1 - b0) / ((t1 - t0) / 1000), ...(await page.evaluate(figures)) };
  };
  const gpu = async () => page.evaluate(`(() => { const gl = document.createElement('canvas').getContext('webgl2'); const x = gl && gl.getExtension('WEBGL_debug_renderer_info'); return x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'no WebGL'; })()`);

  // The machines, on the test page, at each CPU rate, flat; then in 3D in emulated VR.
  const scenarios = [
    ...machines.flatMap((m) => rates.map((rate) => ({ m, rate, query: `?m=${m.id}`, vr: false }))),
    ...machines.map((m) => ({ m, rate: 1, query: `?m=${m.id}&xr=emulate`, vr: true })),
  ];
  for (const s of scenarios) {
    await page.send('Emulation.setCPUThrottlingRate', { rate: s.rate });
    const t0 = Date.now();
    await page.goto(`${base}mame/test.html${s.query}`, 0);
    const running = await until(`window.test?.emulator.state === 'running'`, 90000);
    // From opening the page to MAME's first step: loading it (from this machine: no download),
    // compiling it, and starting the machine.
    const start = (Date.now() - t0) / 1000;
    const row = { machine: s.m.id, rate: s.rate, vr: s.vr, running, start, error: running ? '' : await page.evaluate(`window.test?.emulator.error || window.test?.emulator.state`).catch(() => '?') };
    if (!running) console.log((await page.evaluate(`(window.test?.emulator.mame?.log ?? []).slice(-15).join('\\n')`).catch(() => '')) || '(MAME said nothing)');
    if (running) {
      if (s.vr) {
        await page.evaluate('window.test.enterVR()').catch((/** @type {Error} */ e) => (row.error = `VR: ${e.message}`));
        row.presenting = await until('window.test.presenting()', 10000);
      }
      await sleep(3000); // started: settle
      Object.assign(row, await measure('window.test.stats()', 'window.test.stats()'));
      if (opts.shots && s.rate === 1 && !s.vr) {
        const png = await page.evaluate(`window.test.emulator.canvas.toDataURL('image/png')`);
        mkdirSync(opts.shots, { recursive: true });
        writeFileSync(join(opts.shots, `${s.m.id}.png`), Buffer.from(png.slice(png.indexOf(',') + 1), 'base64'));
      }
    }
    results.push(row);
    const f = /** @type {any} */ (row);
    console.log(
      `${s.m.id.padEnd(9)} ${s.vr ? 'VR (IWER)' : `CPU ÷${s.rate}`.padEnd(9)} ` +
        (running
          ? `running after ${f.start.toFixed(1)} s · ${f.stepsPerSecond.toFixed(1).padStart(5)} steps/s · a step ${f.step.median.toFixed(1)} ms (95% ${f.step.p95.toFixed(1)}) · ` +
            `page ${f.pageFramesPerSecond.toFixed(1)} frames/s, a frame ${f.frame.median.toFixed(1)} ms (95% ${f.frame.p95.toFixed(1)}) · main thread ${(f.busy * 100).toFixed(0)}% busy` +
            (s.vr ? (f.presenting ? '' : ' · NOT in VR') : '')
          : `did not run: ${row.error}`),
    );
  }

  // The room alone, in emulated VR: what its frames cost before any machine.
  await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.goto(`${base}?xr=emulate`, 300);
  if (await until('window.__room?.ready', 30000)) {
    await page.evaluate('window.__room.enterVR()').catch(() => {});
    const presenting = await until('window.__room.renderer.xr.isPresenting', 10000);
    await sleep(2000);
    const room = await measure(
      `(() => { window.__frames = 0; const tick = () => { window.__frames++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); window.__since = performance.now(); })()`,
      `({ framesPerSecond: window.__frames * 1000 / (performance.now() - window.__since) })`,
    );
    results.push({ machine: 'room', vr: true, presenting, ...room });
    console.log(`room      VR (IWER) page ${room.framesPerSecond.toFixed(1)} frames/s · main thread ${(room.busy * 100).toFixed(0)}% busy${presenting ? '' : ' · NOT in VR'}`);
  }
  const renderer = await gpu();
  console.log(`WebGL: ${renderer}`);
  const files = downloads();
  for (const d of files) console.log(`${d.name.padEnd(12)} ${(d.bytes / 1e6).toFixed(1)} MB, gzipped ${(d.gzipped / 1e6).toFixed(1)} MB`);
  if (opts.json) writeFileSync(opts.json, JSON.stringify({ at: new Date().toISOString(), seconds, renderer, downloads: files, results }, null, 2));
  page.close();
} finally {
  await chrome.close();
  server.close();
}

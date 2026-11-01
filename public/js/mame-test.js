// The test page (public/mame/test.html): the room's machines without the room, one at a time, run
// as the room runs them (emulator.js), to see that each runs and how fast. Its screen is MAME's
// frame as it is, or with ?view=3d a picture in 3D copied from it each time it changes, as the room
// will show it, with Enter VR where there is VR (?xr=emulate: a Quest 3 emulated, IWER). Then the
// keys it takes, MAME's figures, the page's own, and what was loaded. ?m=<id> starts that machine at
// once (with no gesture, its sound may wait for one). window.test is the page, for
// tools/measure-machines.mjs.
import { MACHINES, codesOf, machineById } from './machines.js';
import { Emulator } from './emulator.js';

const params = new URLSearchParams(location.search);
const emulated = params.get('xr') === 'emulate';
const in3d = params.get('view') === '3d' || emulated;

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const screen = $('screen');
const stopButton = /** @type {HTMLButtonElement} */ ($('stop'));
const soundBox = /** @type {HTMLInputElement} */ ($('sound'));
const stateLine = $('state');
const keysLine = $('keys');
const statsList = $('stats');
const logBox = $('log');

const emulator = new Emulator({ host: screen });
document.documentElement.classList.toggle('three', in3d);

// ── Choosing a machine ───────────────────────────────────────────────────────

for (const m of MACHINES) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = m.title;
  b.addEventListener('click', () => {
    start(m.id);
    screen.focus();
  });
  li.append(b, ` ${m.maker}, ${m.year}`);
  $('machines').append(li);
}
stopButton.addEventListener('click', () => emulator.stop());
soundBox.addEventListener('change', () => emulator.setSound(soundBox.checked));

let started = 0; // performance.now() when the machine was started
/** @param {string} id */
function start(id) {
  const m = machineById(id);
  if (!m) return;
  emulator.start(m);
  started = performance.now();
  screen.style.aspectRatio = String(m.aspect);
  if (in3d && emulator.frame) {
    emulator.frame.style.width = `${m.screen.width}px`;
    emulator.frame.style.height = `${m.screen.height}px`;
  }
  keysLine.textContent = `Keys, with the screen focused: ${m.help} · Escape: stop.`;
  view?.show(m);
}

emulator.onState = (state) => {
  const m = emulator.machine;
  stopButton.disabled = state === 'stopped';
  if (state === 'stopped') {
    stateLine.textContent = 'No machine is running.';
    keysLine.textContent = '';
    view?.show(null);
  } else if (state === 'loading' || state === 'starting') {
    stateLine.textContent = `The ${m?.title}: starting MAME…`;
  } else if (state === 'running') {
    stateLine.textContent = `The ${m?.title} is running, ${((performance.now() - started) / 1000).toFixed(1)} s after it was started.`;
  } else {
    stateLine.textContent = `The ${m?.title} stopped: ${emulator.error}`;
  }
};

// The machine's keys, while its screen has the focus (the frame itself never has it), so that the
// page's own controls keep theirs: Tab leaves the screen, Escape stops the machine.
screen.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && emulator.machine) {
    e.preventDefault();
    emulator.stop();
    return;
  }
  const to = codesOf(emulator.machine?.keys[e.code]);
  if (!to.length || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();
  if (!e.repeat) for (const code of to) emulator.key(code, true);
});
screen.addEventListener('keyup', (e) => {
  const to = codesOf(emulator.machine?.keys[e.code]);
  if (!to.length) return;
  e.preventDefault();
  for (const code of to) emulator.key(code, false);
});
screen.addEventListener('blur', () => emulator.release());

// ── The page's frames: MAME stepped, and in 3D its screen drawn ──────────────

const frameTimes = new Float64Array(600); // ms each of the page's frames took, the last 600
let pageFrames = 0;
/** @param {number} t0 */
function frameDone(t0) {
  frameTimes[pageFrames++ % frameTimes.length] = performance.now() - t0;
}

/** @type {{ show(m: import('./machines.js').Machine | null): void, enterVR(): Promise<void>, presenting(): boolean } | null} */
let view = null;
if (in3d) view = await make3d();
else {
  const loop = () => {
    const t0 = performance.now();
    emulator.step(t0);
    frameDone(t0);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/**
 * The 3D view: MAME's screen on a plane in front of the viewer, its texture copied from MAME's canvas
 * each time MAME draws, stepped from the renderer's loop (in VR, the session's frames).
 */
async function make3d() {
  const THREE = await import('three');
  if (emulated) {
    try {
      const { XRDevice, metaQuest3 } = await import(new URL('../vendor/iwer/iwer.module.js', import.meta.url).href);
      new XRDevice(metaQuest3).installRuntime({ forceInstall: true });
    } catch (err) {
      console.warn(`No WebXR emulation: ${/** @type {Error} */ (err).message}`);
    }
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'The machine\'s screen, in 3D');
  screen.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1d1720');
  const camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.05, 50);
  camera.position.set(0, 1.5, 0);
  const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  plane.position.set(0, 1.5, -1.4);
  scene.add(plane);
  /** @type {import('three').CanvasTexture | null} */
  let texture = null;
  let shown = -1; // MAME's pictures copied so far
  const fit = () => {
    const w = screen.clientWidth, h = screen.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(fit).observe(screen);
  renderer.setAnimationLoop(() => {
    const t0 = performance.now();
    emulator.step(t0);
    const mame = emulator.mame;
    if (mame && mame.state === 'running' && mame.frames !== shown) {
      if (texture?.image !== mame.canvas) {
        texture?.dispose();
        texture = new THREE.CanvasTexture(mame.canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      }
      texture.needsUpdate = true;
      shown = mame.frames;
    }
    renderer.render(scene, camera);
    frameDone(t0);
  });
  // VR, where there is any.
  const SESSION_INIT = { optionalFeatures: ['local-floor'] };
  async function enterVR() {
    if (renderer.xr.isPresenting) return renderer.xr.getSession()?.end();
    const session = await navigator.xr?.requestSession('immersive-vr', SESSION_INIT);
    if (session) await renderer.xr.setSession(session);
  }
  if (await navigator.xr?.isSessionSupported('immersive-vr').catch(() => false)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Enter VR';
    b.addEventListener('click', () => enterVR().catch((err) => (stateLine.textContent = `Could not start VR: ${err.message}`)));
    renderer.xr.addEventListener('sessionstart', () => (b.textContent = 'Exit VR'));
    renderer.xr.addEventListener('sessionend', () => (b.textContent = 'Enter VR'));
    $('vr').append(b);
  }
  return {
    /** @param {import('./machines.js').Machine | null} m */
    show(m) {
      texture?.dispose();
      texture = null;
      shown = -1;
      material.map = null;
      material.color.set(0x000000);
      material.needsUpdate = true;
      if (m) plane.scale.set(1.0 * m.aspect, 1.0, 1);
    },
    enterVR,
    presenting: () => renderer.xr.isPresenting,
  };
}

// ── The figures ──────────────────────────────────────────────────────────────

/** MAME's steps and pictures so far, the page's frames so far, and when: for stats(since). */
function counts() {
  const s = emulator.stats();
  return { at: performance.now(), steps: s.steps, frames: s.frames, pageFrames };
}

/**
 * The page and the machine now: MAME's steps and pictures a second and the page's frames a second
 * since `since` (counts() then), ms a step (MAME's) and ms a frame (the page's, MAME's step
 * included) over the last 600, and what the machine's frame loaded.
 * @param {ReturnType<typeof counts>} since
 */
function stats(since) {
  const now = counts(), s = emulator.stats();
  const ms = now.at - since.at;
  // Never below 0: a machine started since has counted from 0 again.
  const rate = (/** @type {number} */ n, /** @type {number} */ before) => (ms > 0 ? Math.max(0, ((n - before) * 1000) / ms) : 0);
  const n = Math.min(pageFrames, frameTimes.length);
  const sorted = Array.from(frameTimes.subarray(0, n)).sort((a, b) => a - b);
  const at = (/** @type {number} */ q) => (n ? sorted[Math.min(n - 1, Math.floor(q * n))] : 0);
  return {
    machine: emulator.machine?.id ?? null,
    state: emulator.state,
    stepsPerSecond: rate(now.steps, since.steps),
    picturesPerSecond: rate(now.frames, since.frames),
    pageFramesPerSecond: rate(now.pageFrames, since.pageFrames),
    step: { median: s.median, p95: s.p95, max: s.max },
    frame: { median: at(0.5), p95: at(0.95), max: n ? sorted[n - 1] : 0 },
    loaded: loaded(),
  };
}

/** What the machine's frame loaded: name, bytes over the wire, bytes. */
function loaded() {
  const entries = /** @type {PerformanceResourceTiming[]} */ (emulator.frame?.contentWindow?.performance.getEntriesByType('resource') ?? []);
  return entries.map((e) => ({ name: new URL(e.name).pathname.split('/').pop() ?? e.name, transfer: e.transferSize, size: e.decodedBodySize }));
}

const mb = (/** @type {number} */ bytes) => `${(bytes / 1e6).toFixed(bytes < 1e5 ? 3 : 1)} MB`;
const ms1 = (/** @type {number} */ x) => `${x.toFixed(1)} ms`;
let shown = counts();
setInterval(() => {
  const f = stats(shown);
  shown = counts();
  const rows = [];
  if (f.state === 'running') {
    rows.push(['MAME', `${f.stepsPerSecond.toFixed(1)} steps of 1/60 s a second, ${f.picturesPerSecond.toFixed(1)} pictures`]);
    rows.push(['A step', `${ms1(f.step.median)} (95%: ${ms1(f.step.p95)}, at most ${ms1(f.step.max)})`]);
  }
  rows.push(['The page', `${f.pageFramesPerSecond.toFixed(1)} frames a second; a frame ${ms1(f.frame.median)} (95%: ${ms1(f.frame.p95)})`]);
  for (const l of f.loaded) rows.push([l.name, `${mb(l.size)} (${mb(l.transfer)} over the wire)`]);
  statsList.replaceChildren(...rows.flatMap(([k, v]) => {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = k;
    dd.textContent = v;
    return [dt, dd];
  }));
  logBox.textContent = emulator.mame?.log.join('\n') ?? '';
}, 1000);

const first = params.get('m');
if (first) start(first);

window.test = { emulator, start, counts, stats, enterVR: () => view?.enterVR() ?? Promise.resolve(), presenting: () => view?.presenting() ?? false };

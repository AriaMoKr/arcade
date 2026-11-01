// The page a machine runs in, public/mame/machine.html: a frame of its own inside the page that
// shows it, holding MAME (arcade.js and arcade.wasm, built by tools/build-mame.sh) running the
// machine its address names (?m=<id>, machines.js). Stopping the machine is removing the frame,
// which takes MAME with it.
//
// The page that holds the frame runs it through `window.mame` (emulator.js). MAME's loop asks for an
// animation frame after each 1/60 s it emulates; here those requests wait until the page steps it,
// so the page sets the pace (60 steps a second whatever the display's rate), in VR too, where the
// page's own animation frames may stop. MAME's sound (its js_sound.js) makes an AudioContext of its
// own when it first plays; here it gets the page's instead (the frame element's `machineAudio`),
// started by the gesture that started the machine, through a node of the machine's own. Keys reach
// MAME only from the page (emulator.js's key()): the frame never has the focus, and a key pressed in
// it all the same is dropped, so nothing reaches MAME's own controls (Escape would end it, Tab open
// its menu). Opened on its own, the page paces itself on its animation frames and makes a context of
// its own.
import { machineById, mameArgs } from './machines.js';

/**
 * What the page gives the frame for sound: its context, the node the machine's sound goes into, and
 * the nodes MAME makes on the context, for the page to disconnect when it stops the machine.
 * @typedef {{ context: AudioContext, output: AudioNode, nodes: AudioNode[] }} MachineAudio
 */

/**
 * The machine in this frame, for the page.
 * @typedef {object} MameFrame
 * @property {'loading' | 'starting' | 'running' | 'failed'} state
 * @property {string} error why it failed, in words
 * @property {string[]} log MAME's last lines of output
 * @property {number} steps how many 1/60 s it has emulated
 * @property {number} frames how many pictures it has drawn
 * @property {(now?: number) => boolean} step runs MAME for 1/60 s if it is waiting to; whether it ran
 * @property {() => { steps: number, frames: number, median: number, p95: number, max: number }} stats
 *   ms a step, over the last 600
 * @property {HTMLCanvasElement} canvas MAME's screen
 */

const realFrame = window.requestAnimationFrame.bind(window);
/** @type {FrameRequestCallback[]} */
let waiting = [];
window.requestAnimationFrame = (cb) => {
  waiting.push(cb);
  return waiting.length;
};
window.cancelAnimationFrame = () => {};

// Each picture MAME draws (SDL's software renderer puts it on the canvas whole), counted, so the
// page copies the screen only when it has changed.
const putImageData = CanvasRenderingContext2D.prototype.putImageData;
/** @this {CanvasRenderingContext2D} @param {any[]} args */
CanvasRenderingContext2D.prototype.putImageData = function (...args) {
  mame.frames++;
  return putImageData.apply(this, /** @type {any} */ (args));
};

// A key pressed in the frame itself, not sent by the page: dropped before MAME's listeners (SDL's,
// on the window) hear it.
for (const type of ['keydown', 'keyup', 'keypress']) {
  window.addEventListener(type, (e) => {
    if (!e.isTrusted) return;
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);
}

const times = new Float64Array(600);
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas'));

/** @type {MameFrame} */
const mame = {
  state: 'loading',
  error: '',
  log: [],
  steps: 0,
  frames: 0,
  canvas,
  step(now = performance.now()) {
    if (!waiting.length || mame.state === 'failed') return false;
    const due = waiting;
    waiting = [];
    const t0 = performance.now();
    for (const cb of due) cb(now);
    times[mame.steps++ % times.length] = performance.now() - t0;
    if (mame.state === 'starting') {
      mame.state = 'running';
      // Only now may the canvas be sized to the frame: SDL, making MAME's window, takes a canvas
      // sized by CSS for a window that size, and MAME would draw its screen that large.
      document.documentElement.classList.add('running');
    }
    return true;
  },
  stats() {
    const n = Math.min(mame.steps, times.length);
    const sorted = Array.from(times.subarray(0, n)).sort((a, b) => a - b);
    const at = (/** @type {number} */ q) => (n ? sorted[Math.min(n - 1, Math.floor(q * n))] : 0);
    return { steps: mame.steps, frames: mame.frames, median: at(0.5), p95: at(0.95), max: n ? sorted[n - 1] : 0 };
  },
};
window.mame = mame;

/** @param {string} line */
function note(line) {
  mame.log.push(line);
  if (mame.log.length > 50) mame.log.shift();
}

/** @param {string} why */
function fail(why) {
  if (mame.state === 'failed') return;
  mame.state = 'failed';
  mame.error = why;
  note(why);
}

window.addEventListener('error', (e) => fail(e.message || 'an error'));

/** @type {MachineAudio | undefined} */
const audio = /** @type {HTMLIFrameElement | null} */ (window.frameElement)?.machineAudio ?? ownAudio();
function ownAudio() {
  if (typeof AudioContext === 'undefined') return undefined;
  const context = new AudioContext();
  return { context, output: context.destination, nodes: [] };
}
// What MAME's js_sound.js asks of `new AudioContext()`: its sample rate, nodes made on the given
// context (and kept, to disconnect), and for its destination the machine's own node. Its watchdog
// makes its node again (disconnecting the old one) whenever it hasn't been asked for sound for half
// a second, as it isn't while the context waits for a gesture to start: then it gets the same one
// back, so nodes don't pile up. And it asks the context to start each time: the page's starts at
// the visitor's next click, tap or key (emulator.js), so only a context of the frame's own is asked.
if (audio) {
  const { context, output, nodes } = audio;
  const own = !(/** @type {HTMLIFrameElement | null} */ (window.frameElement)?.machineAudio);
  /** @template {AudioNode} N @param {N} node */
  const kept = (node) => {
    nodes.push(node);
    return node;
  };
  /** @type {ScriptProcessorNode | null} */
  let processor = null;
  /** @type {any} */ (window).AudioContext = function MachineAudioContext() {
    return {
      get sampleRate() {
        return context.sampleRate;
      },
      get destination() {
        return output;
      },
      createGain: () => kept(context.createGain()),
      createScriptProcessor: (/** @type {number} */ size, /** @type {number} */ inputs, /** @type {number} */ outputs) => {
        if (processor && context.state !== 'running') return processor;
        if (processor) nodes.splice(nodes.indexOf(processor), 1); // disconnected by js_sound.js
        processor = kept(context.createScriptProcessor(size, inputs, outputs));
        return processor;
      },
      resume: () => (own ? context.resume() : Promise.resolve()),
    };
  };
}

const machine = machineById(new URLSearchParams(location.search).get('m'));
if (!machine) fail('There is no such machine.');
else start(machine);

/** @param {import('./machines.js').Machine} m */
async function start(m) {
  document.title = `${m.title} (MAME)`;
  canvas.setAttribute('aria-label', `${m.title}'s screen`);
  /** @type {{ path: string, data: Uint8Array }[]} */
  let files;
  try {
    files = await Promise.all(
      m.files.map(async (f) => {
        const r = await fetch(f.url);
        if (!r.ok) throw new Error(`${f.url}: ${r.status}`);
        return { path: f.path, data: new Uint8Array(await r.arrayBuffer()) };
      }),
    );
  } catch (e) {
    fail(`Its files did not load (${/** @type {Error} */ (e).message}).`);
    return;
  }
  window.Module = {
    canvas,
    arguments: mameArgs(m, { sampleRate: audio?.context.sampleRate }),
    preRun: [
      () => {
        const fs = /** @type {any} */ (window).FS;
        for (const f of files) {
          fs.mkdirTree(f.path.slice(0, f.path.lastIndexOf('/')));
          fs.writeFile(f.path, f.data);
        }
      },
    ],
    print: note,
    printErr: note,
    onAbort: (/** @type {unknown} */ what) => fail(`MAME stopped: ${String(what)}`),
    onExit: (/** @type {number} */ code) => fail(`MAME ended (${code}).`),
  };
  const script = document.createElement('script');
  script.src = 'arcade.js';
  script.onerror = () => fail('MAME did not load.');
  script.onload = () => {
    if (mame.state === 'loading') mame.state = 'starting';
  };
  document.body.append(script);
  // On its own, with no page to step it: its own animation frames, at 60 steps a second.
  if (!window.frameElement) {
    let last = performance.now(), owed = 0;
    const tick = (/** @type {number} */ now) => {
      owed = Math.min(owed + (now - last) / (1000 / 60), 2);
      last = now;
      for (; owed >= 1; owed--) mame.step(now);
      realFrame(tick);
    };
    realFrame(tick);
  }
}

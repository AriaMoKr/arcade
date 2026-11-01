// Runs the room's machines (machines.js), one at a time: MAME in a frame of its own
// (public/mame/machine.html, mame-frame.js), stepped from the page's own frame loop at 60 steps a
// second whatever the display's rate (in VR, the session's frames: the page's own may stop there),
// heard through the page's AudioContext, and pressed with the keys the page sends it. The frame
// never has the focus, so nothing else reaches MAME (not Escape, which would end it). Stopping a
// machine disconnects its sound and removes its frame.

/** @typedef {import('./machines.js').Machine} Machine */
/** @typedef {import('./mame-frame.js').MameFrame} MameFrame */
/** @typedef {import('./mame-frame.js').MachineAudio} MachineAudio */
/** @typedef {'stopped' | MameFrame['state']} EmulatorState */

const STEP = 1000 / 60; // ms of the machine's time a step emulates (MAME's loop on the web)

/** A KeyboardEvent's `key` for its `code`, as a US keyboard gives it. @param {string} code */
export function keyOf(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (code === 'Space') return ' ';
  if (code.startsWith('Arrow')) return code;
  return code.replace(/(Left|Right)$/, '');
}

/**
 * How many steps to run now, and what is still owed after them, `owed` steps owed before and `ms`
 * gone by since: a frame a little early still runs its step (on a 60 Hz display, one a frame
 * whatever its jitter), and at most three are owed (a page that was away does not race to catch up).
 * @param {number} owed
 * @param {number} ms
 */
export function pace(owed, ms) {
  const due = Math.min(owed + ms / STEP, 3);
  const run = Math.max(0, Math.floor(due + 0.25));
  return { run, owed: due - run };
}

export class Emulator {
  /**
   * @param {{ host?: HTMLElement, base?: string | URL }} [o] host: where the machine's frame goes;
   *   base: where MAME is (public/mame/)
   */
  constructor({ host = document.body, base = new URL('../mame/', import.meta.url) } = {}) {
    this.host = host;
    this.base = new URL(base);
    /** @type {Machine | null} the machine running, or starting */
    this.machine = null;
    /** @type {HTMLIFrameElement | null} */
    this.frame = null;
    /** @type {AudioContext | null} made by the first machine started */
    this.context = null;
    /** @type {GainNode | null} every machine's sound goes through it: Sound on or off */
    this.volume = null;
    /** @type {MachineAudio | null} */
    this.audio = null;
    this.sound = true;
    /** @type {EmulatorState} */
    this.state = 'stopped';
    this.error = '';
    /** @type {(state: EmulatorState) => void} */
    this.onState = () => {};
    /** @type {Set<string>} MAME's keys held down */
    this.held = new Set();
    /** @type {Map<string, number>} keys pressed by tap(), and how many more steps each is held */
    this.taps = new Map();
    this.owed = 0;
    this.last = -1;
    /** Waiting for a gesture to start the sound (none was allowed yet). */
    this.waking = false;
  }

  /** The machine's frame's MAME, once its page has made it. @returns {MameFrame | undefined} */
  get mame() {
    return this.frame?.contentWindow?.mame;
  }

  /** MAME's screen, while a machine runs. */
  get canvas() {
    return this.mame?.canvas ?? null;
  }

  /**
   * The page's sound, made, or started again, now: call it from the gesture (a click, a tap, a key)
   * that chose a machine started later, after a walk up to it, so its sound may start then.
   */
  prime() {
    this.#context();
  }

  /**
   * Starts machine m, stopping the one running. Call it from the gesture that chose it (or prime()
   * from that gesture): that lets its sound start.
   * @param {Machine} m
   */
  start(m) {
    this.stop();
    this.machine = m;
    this.audio = this.#audio();
    const frame = document.createElement('iframe');
    frame.className = 'machine-frame';
    frame.title = `${m.title}'s screen`;
    frame.tabIndex = -1;
    if (this.audio) frame.machineAudio = this.audio;
    frame.src = new URL(`machine.html?m=${encodeURIComponent(m.id)}`, this.base).href;
    this.frame = frame;
    this.host.append(frame);
    this.owed = 0;
    this.last = -1;
    this.#set('loading');
  }

  /** Stops the machine running, if one is. */
  stop() {
    if (!this.frame) return;
    this.release();
    if (this.audio) {
      for (const node of this.audio.nodes) {
        node.disconnect();
        if (node instanceof ScriptProcessorNode) node.onaudioprocess = null;
      }
      this.audio.output.disconnect();
    }
    this.frame.remove();
    this.frame = null;
    this.machine = null;
    this.audio = null;
    this.#set('stopped');
  }

  /** Sound on or off, for every machine. @param {boolean} on */
  setSound(on) {
    this.sound = on;
    this.volume?.gain.setValueAtTime(on ? 1 : 0, this.context?.currentTime ?? 0);
  }

  /**
   * Runs MAME for the steps of 1/60 s owed since the last call (pace): call it once a frame, from the
   * page's frame loop. Returns how many it ran.
   * @param {number} [now] the frame's time, in ms
   */
  step(now = performance.now()) {
    const mame = this.mame;
    if (!mame) return 0;
    let ran = 0;
    if (this.last >= 0) {
      const p = pace(this.owed, now - this.last);
      this.owed = p.owed;
      for (let i = 0; i < p.run; i++) {
        if (!mame.step(now)) {
          this.owed = 0; // not yet started: nothing is owed for the time it took
          break;
        }
        ran++;
        for (const [code, left] of this.taps) {
          if (left > 1) this.taps.set(code, left - 1);
          else {
            this.taps.delete(code);
            this.key(code, false);
          }
        }
      }
    }
    this.last = now;
    if (mame.state !== this.state) {
      this.error = mame.error;
      this.#set(mame.state);
    }
    return ran;
  }

  /**
   * Presses (down) or lets go of MAME's key `code` (a KeyboardEvent.code, as machines.js's keys
   * give it), as a key event in its frame.
   * @param {string} code
   * @param {boolean} down
   */
  key(code, down) {
    const mame = this.mame;
    const win = this.frame?.contentWindow;
    if (!mame || !win || down === this.held.has(code)) return;
    if (down) this.held.add(code);
    else this.held.delete(code);
    const side = code.startsWith('Arrow') ? '' : code.match(/(Left|Right)$/)?.[1];
    // The frame's own KeyboardEvent, as its listeners expect one from their window.
    const FrameKeyboardEvent = /** @type {typeof KeyboardEvent} */ (/** @type {any} */ (win).KeyboardEvent);
    mame.canvas.dispatchEvent(new FrameKeyboardEvent(down ? 'keydown' : 'keyup', {
      code,
      key: keyOf(code),
      location: side === 'Left' ? 1 : side === 'Right' ? 2 : 0,
      bubbles: true,
      cancelable: true,
    }));
  }

  /**
   * Presses MAME's key `code` for `steps` of its steps of 1/60 s, then lets it go: a button pressed
   * in the card or on a panel, held long enough for the machine to see it however the page's frames
   * come.
   * @param {string} code
   */
  tap(code, steps = 6) {
    this.key(code, true);
    if (this.held.has(code)) this.taps.set(code, steps);
  }

  /** Lets go of every key held (the page lost the focus, the machine stopped). */
  release() {
    for (const code of [...this.held]) this.key(code, false);
    this.held.clear();
    this.taps.clear();
  }

  /** How MAME is keeping up: its steps and pictures, and ms a step over the last 600. */
  stats() {
    return this.mame?.stats() ?? { steps: 0, frames: 0, median: 0, p95: 0, max: 0 };
  }

  /** @param {EmulatorState} state */
  #set(state) {
    if (state === this.state) return;
    this.state = state;
    this.onState(state);
  }

  /**
   * The page's sound for a machine: its context, and a node of the machine's own on it. None where
   * the browser has no Web Audio.
   * @returns {MachineAudio | null}
   */
  #audio() {
    const context = this.#context();
    if (!context) return null;
    const output = context.createGain();
    output.connect(/** @type {GainNode} */ (this.volume));
    return { context, output, nodes: [] };
  }

  /**
   * The page's one AudioContext: made by the first machine (or prime()), and started, or started
   * again, by the gesture that starts each. Without one (a gamepad's press is no gesture to a
   * browser), it starts at the next click, tap or key.
   */
  #context() {
    if (!this.context) {
      if (typeof AudioContext === 'undefined') return null;
      this.context = new AudioContext();
      this.volume = this.context.createGain();
      this.volume.gain.value = this.sound ? 1 : 0;
      this.volume.connect(this.context.destination);
    }
    const context = this.context;
    if (context.state !== 'running') {
      context.resume().catch(() => {});
      if (!this.waking) {
        this.waking = true;
        const wake = () => {
          context.resume().catch(() => {});
          this.waking = false;
          for (const type of GESTURES) removeEventListener(type, wake, true);
        };
        for (const type of GESTURES) addEventListener(type, wake, true);
      }
    }
    return context;
  }
}

/** What a browser lets start sound: these, but not a gamepad's buttons. */
const GESTURES = ['pointerdown', 'keydown'];

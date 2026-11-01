// Playing the room's machines (README, "The machines"), one at a time, each on its stand
// (stands.js). Chosen (its screen or its panel's Play in the room, its button in the card), the
// visitor walks up to it, in VR steps there, and it starts (emulator.js). On a screen its picture
// then fills the view beside the card or under it, the room behind it not drawn and still, and it has the keys,
// a gamepad, the pad on a phone's screen and a TV's remote: Escape, a gamepad's shoulder buttons and
// a TV's Back (main.js's stepBack) stop it. In VR its screen in the room shows it, and the
// controllers play it (the left stick its pad, A and B its own, X and Y Select and Start), until a
// move away (a teleport: controls.js's stand). The card's buttons and the panel beside it on the
// wall press its Start and Select (on a TV, A and B too), reset it and stop it.
//
// MAME's frame (mame-frame.js) is never seen: it stays the machine's own size, as a larger one
// would have MAME draw a larger picture, and each picture it draws is copied to a canvas of the
// page's, which the view shows scaled up, and in VR the screen in the room.
import { Emulator } from './emulator.js';
import { RESET, machineById } from './machines.js';
import { firstPad, held } from 'common/gamepad.js';
import { keyOf } from 'common/tv.js';

/** @typedef {import('./machines.js').Machine} Machine */
/** @typedef {import('./machines.js').Pad} Pad */
/** @typedef {import('common/controls.js').Hand<import('./stands.js').ArcadeHit>} Hand */

/** The D-pad's directions, as bits (dpadDirections). */
export const DPAD = Object.freeze({ up: 1, down: 2, left: 4, right: 8 });
const DIRECTIONS = /** @type {const} */ (['up', 'down', 'left', 'right']);
// The eight ways round from the right, y down: right, down-right, down, … up-right.
const SECTORS = [DPAD.right, DPAD.right | DPAD.down, DPAD.down, DPAD.down | DPAD.left, DPAD.left, DPAD.left | DPAD.up, DPAD.up, DPAD.up | DPAD.right];

/**
 * The directions a finger at (dx, dy) from the D-pad's middle holds (DPAD's bits), the pad
 * `radius` across: one within 22.5° of an arrow, two on a diagonal, none near the middle.
 * @param {number} dx
 * @param {number} dy pixels, down
 * @param {number} radius
 */
export function dpadDirections(dx, dy, radius) {
  if (Math.hypot(dx, dy) < radius * 0.15) return 0;
  return SECTORS[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
}

/**
 * The largest box `aspect` wide to high in the space from (x0, y0) to (x1, y1), in its middle;
 * nothing (0 × 0) where there is no space.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} aspect
 */
export function fitIn(x0, y0, x1, y1, aspect) {
  const width = Math.max(0, Math.min(x1 - x0, (y1 - y0) * aspect));
  const height = width / aspect;
  return { x: x0 + (x1 - x0 - width) / 2, y: y0 + (y1 - y0 - height) / 2, width, height };
}

/**
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @param {(Node | string)[]} children
 */
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  e.append(...children);
  return e;
}

// The gamepad's buttons (the standard mapping): A, B, the shoulders, Back (or View) and Start, the D-pad.
const PAD_A = 0, PAD_B = 1, PAD_LB = 4, PAD_RB = 5, PAD_BACK = 8, PAD_START = 9, PAD_UP = 12, PAD_DOWN = 13, PAD_LEFT = 14, PAD_RIGHT = 15;
// A VR controller's (xr-standard): A or X, B or Y.
const XR_LOWER = 4, XR_UPPER = 5;

export class Play {
  /**
   * @param {object} o
   * @param {import('./stands.js').Stands} o.stands where the stands are (stands.js layoutStands)
   * @param {ReturnType<typeof import('./stands-scene.js').buildStands>} o.scene them in 3D: their screens and panels
   * @param {import('./controls.js').Controls} o.controls the walking, which walks up to one
   * @param {import('./overlay.js').Overlay} o.overlay the card, with the machines' buttons
   * @param {{ xr: { isPresenting: boolean } }} o.renderer
   * @param {HTMLElement} o.host the layer over the view a machine is played in on a screen (#play)
   * @param {boolean} [o.tv] the TV app's page (common's tv.js tvMode)
   */
  constructor({ stands, scene, controls, overlay, renderer, host, tv = false }) {
    this.stands = stands;
    this.scene = scene;
    this.controls = controls;
    this.overlay = overlay;
    this.renderer = renderer;
    this.tv = tv;
    /** The TV's remote (main.js), whose card has the keys while the focus is in it. @type {import('common/tv.js').Remote | null} */
    this.remote = null;
    /** The stand whose machine runs, or is starting, else -1. */
    this.at = -1;
    /** @type {Machine | null} */
    this.machine = null;
    /** @type {string[]} MAME's keys the machine running takes */
    this.codes = [];
    // On a screen: the machine's picture, what it is doing while it starts, and on a touch screen its pad.
    this.canvas = /** @type {HTMLCanvasElement} */ (el('canvas', { class: 'machine-screen', role: 'img', 'aria-label': "The machine's screen" }));
    this.ctx = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d'));
    this.status = el('p', { class: 'play-status' });
    this.area = el('div', { class: 'play-area' }, this.canvas, this.status);
    /** @type {Map<string, HTMLElement>} the pad's buttons by its control's name */
    this.padButtons = new Map();
    this.touchPad = this.#buildPad();
    overlay.hintClear.push(this.touchPad);
    this.holder = el('div', { class: 'machine-host', 'aria-hidden': 'true' });
    host.append(this.area, this.touchPad, this.holder);
    this.emulator = new Emulator({ host: this.holder });
    this.emulator.onState = (state) => this.#state(state);
    /** MAME's keys held by each way of playing: the keyboard's (by the visitor's key), a gamepad's, the screen's pad's, the VR controllers'. */
    this.keys = new Map();
    /** @type {Set<string>} */
    this.padHeld = new Set();
    /** @type {Set<string>} */
    this.touchHeld = new Set();
    /** @type {Set<string>} refilled by hand() each frame in VR */
    this.handHeld = new Set();
    /** @type {Set<number>} a gamepad's buttons held when the machine started: none of its until let go */
    this.stale = new Set();
    this.frames = -1; // MAME's pictures copied so far
    this.shown = false; // the layer over the view: playing on a screen
    this.padHint = false; // the hint has said how to play with the gamepad
    this.touch = !tv && matchMedia('(pointer: coarse)').matches;
    /** @type {number | null} the finger on the D-pad */
    this.dpadFinger = null;
    this.dpad = 0;
    // The keys before anything else of the page's (the remote's OK, walking): main.js makes this first.
    addEventListener('keydown', (e) => this.#key(e, true), true);
    addEventListener('keyup', (e) => this.#key(e, false), true);
    addEventListener('blur', () => this.#letGo());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.#letGo();
    });
    // The pad shows for a finger, and goes for the mouse.
    addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'pen') return;
      const touch = e.pointerType === 'touch';
      if (touch === this.touch || tv) return;
      this.touch = touch;
      this.#showPad();
    }, { capture: true, passive: true });
    addEventListener('resize', () => this.#fit());
    const refit = new ResizeObserver(() => this.#fit());
    refit.observe(overlay.card);
    refit.observe(overlay.buttons);
  }

  /** Whether a machine is played on a screen, filling the view: it has the keys and the gamepad. */
  get onScreen() {
    return this.at >= 0 && !this.renderer.xr.isPresenting;
  }

  /**
   * Stand i's machine chosen (in the room or the card): the visitor walks up to it (in VR, a step
   * there) and it starts. Call it from the gesture that chose it, so its sound may start.
   * @param {number} i
   */
  choose(i) {
    this.emulator.prime();
    if (this.at === i) return;
    this.stop();
    this.controls.walkUpToStand(i, () => this.start(i));
  }

  /**
   * Starts stand i's machine, there and then (choose walks up to it first).
   * @param {number} i
   */
  start(i) {
    const m = machineById(this.stands[i]?.machine ?? null);
    if (!m?.pad) return;
    this.stop();
    this.at = i;
    this.machine = m;
    this.codes = [...new Set([...Object.values(m.keys), ...Object.values(m.pad)])];
    this.frames = -1;
    this.canvas.width = m.screen.width;
    this.canvas.height = m.screen.height;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, m.screen.width, m.screen.height);
    this.canvas.setAttribute('aria-label', `The ${m.title}'s screen: ${this.stands[i].about}`);
    this.padHint = false;
    this.stale.clear();
    const pad = firstPad(navigator.getGamepads?.());
    if (pad) for (let b = 0; b < pad.buttons.length; b++) if (held(pad, b)) this.stale.add(b);
    this.emulator.start(m);
    const frame = /** @type {HTMLIFrameElement} */ (this.emulator.frame);
    frame.style.width = `${m.screen.width}px`;
    frame.style.height = `${m.screen.height}px`;
    this.overlay.setPlaying(i, m);
    this.#show(!this.renderer.xr.isPresenting);
    // On a TV, started from the card: the remote plays it now (Menu goes back to its buttons).
    if (this.remote?.inCard) this.remote.walk();
  }

  /** Stops the machine running, if one is: its screen in the room holds its last picture. Whether one was. */
  stop() {
    const i = this.at;
    if (i < 0) return false;
    this.scene.still(i, this.frames >= 0 ? this.canvas : null);
    this.emulator.stop();
    this.at = -1;
    this.machine = null;
    this.codes = [];
    this.keys.clear();
    this.padHeld.clear();
    this.touchHeld.clear();
    this.handHeld.clear();
    this.#setDpad(0);
    this.status.textContent = '';
    this.overlay.setPlaying(-1);
    this.#show(false);
    this.controls.resume();
    this.remote?.forget();
    return true;
  }

  /** Back on a TV: the machine running stops. Whether one did. */
  stepBack() {
    return this.stop();
  }

  /**
   * A button for stand i's machine, in the card or on its panel on the wall: 'play', its own
   * ('start', 'select', on a TV 'a' and 'b'), 'reset' or 'stop'.
   * @param {number} i
   * @param {string} id
   */
  button(i, id) {
    if (id === 'play') {
      this.choose(i);
      return;
    }
    const pad = this.machine?.pad;
    if (this.at !== i || !pad) return;
    if (id === 'stop') this.stop();
    else if (id === 'reset') this.emulator.tap(RESET);
    else if (Object.hasOwn(pad, id)) this.emulator.tap(pad[/** @type {keyof Pad} */ (id)]);
  }

  /** Sound on or off. @param {boolean} on */
  setSound(on) {
    this.emulator.setSound(on);
  }

  /** Where Menu goes on a TV while a machine runs: its buttons in the card. */
  first() {
    return this.at >= 0 ? this.overlay.machineControls[this.at] : null;
  }

  /**
   * A VR controller, each frame while a machine runs (controls.js's onHand): the left one's stick is
   * the machine's pad and its X and Y its Select and Start, taking the stick from walking; the right
   * one's A and B are its own, and its stick still turns.
   * @param {Hand} hand
   * @param {Gamepad} pad
   * @param {number} ax
   * @param {number} ay
   */
  hand(hand, pad, ax, ay) {
    const p = this.machine?.pad;
    if (!p || !this.renderer.xr.isPresenting) return false;
    const h = this.handHeld;
    if (hand.source?.handedness === 'left') {
      if (ay < -0.5) h.add(p.up);
      if (ay > 0.5) h.add(p.down);
      if (ax < -0.5) h.add(p.left);
      if (ax > 0.5) h.add(p.right);
      if (held(pad, XR_LOWER)) h.add(p.select);
      if (held(pad, XR_UPPER)) h.add(p.start);
      return true;
    }
    if (held(pad, XR_LOWER)) h.add(p.a);
    if (held(pad, XR_UPPER)) h.add(p.b);
    return false;
  }

  /**
   * Each frame, from the page's frame loop, after the walking's (which reads the VR controllers):
   * steps the machine, shows its picture, reads a gamepad while it plays on a screen, and keeps the
   * panels on the walls showing what runs and what is pointed at.
   * @param {number} [now] the frame's time, in ms
   */
  frame(now = performance.now()) {
    const vr = this.renderer.xr.isPresenting;
    if (this.at >= 0) {
      this.emulator.step(now);
      const mame = this.emulator.mame;
      if (mame && this.emulator.state === 'running' && mame.frames !== this.frames) {
        this.frames = mame.frames;
        this.ctx.drawImage(mame.canvas, 0, 0, this.canvas.width, this.canvas.height);
        if (vr) this.scene.live(this.at, this.canvas);
      }
      if (vr) this.padHeld.clear();
      else this.#readPad();
      this.#syncAll();
      this.handHeld.clear();
    }
    // Into VR or out of it while one runs: in the room, or over it.
    if (this.shown !== (this.at >= 0 && !vr)) this.#show(!this.shown);
    const panels = this.scene.panels, c = this.controls;
    for (let i = 0; i < panels.length; i++) panels[i].set(this.at === i, c.hoverStand === i ? c.hoverStandButton : null);
  }

  /** @param {import('./emulator.js').EmulatorState} state */
  #state(state) {
    const m = this.machine;
    if (!m) return;
    if (state === 'loading' || state === 'starting') this.status.textContent = `Starting the ${m.title}…`;
    else if (state === 'running') this.status.textContent = '';
    else if (state === 'failed') {
      this.overlay.toast(`The ${m.title} did not start: ${this.emulator.error}`, 8);
      this.stop();
    }
  }

  /**
   * Playing on a screen, or not: the layer over the view (style.css html.playing), the pad on a touch
   * screen, and where the picture goes.
   * @param {boolean} on
   */
  #show(on) {
    this.shown = on;
    document.documentElement.classList.toggle('playing', on);
    this.#showPad();
  }

  /** The pad on a touch screen while one plays there, the hint clear of it (overlay.js hintClear). */
  #showPad() {
    this.touchPad.hidden = !(this.shown && this.touch);
    this.overlay._placeHint();
    this.#fit();
  }

  /**
   * The picture as large as it goes at its aspect beside the card or under it (whichever is
   * larger), above the buttons at the foot of the view and above the pad's controls below it,
   * covering none of them.
   */
  #fit() {
    if (!this.shown || !this.machine) return;
    const tv = this.tv;
    const mx = tv ? 48 : 12, my = tv ? 27 : 12, gap = tv ? 24 : 12;
    const card = this.overlay.card.getBoundingClientRect();
    const buttons = this.overlay.buttons.offsetHeight;
    const foot = innerHeight - (buttons ? 16 + buttons + 8 : my);
    const aspect = this.machine.aspect;
    /** The space from x0 to x1 down from y0, to the foot or to the first of the pad's controls under it. @type {(x0: number, y0: number, x1: number) => ReturnType<typeof fitIn>} */
    const space = (x0, y0, x1) => {
      let y1 = foot;
      if (!this.touchPad.hidden) {
        for (const c of this.touchPad.children) {
          const r = c.getBoundingClientRect();
          if (r.left < x1 && r.right > x0) y1 = Math.min(y1, r.top - gap);
        }
      }
      return fitIn(x0, y0, x1, y1, aspect);
    };
    const beside = space(card.right + gap, my, innerWidth - mx);
    const under = space(mx, card.bottom + gap, innerWidth - mx);
    const r = beside.width >= under.width ? beside : under;
    const s = this.area.style;
    s.left = `${r.x}px`;
    s.top = `${r.y}px`;
    s.width = `${r.width}px`;
    s.height = `${r.height}px`;
  }

  /**
   * A key while a machine plays on a screen: one of its keys pressed or let go (on a TV, OK is its
   * A), Escape stops it, and no key goes on to walking or to the remote's OK. Not one that a
   * control of the page keeps (a text box's, a button's Enter or Space), nor any while the remote
   * is in the card.
   * @param {KeyboardEvent} e
   * @param {boolean} down
   */
  #key(e, down) {
    const m = this.machine;
    if (!this.shown || !m?.pad) return;
    const name = keyOf(e);
    if (!down) {
      const code = this.keys.get(name);
      if (code === undefined) return;
      this.keys.delete(name);
      this.#sync(code);
      e.stopImmediatePropagation();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || this.remote?.inCard) return;
    const target = /** @type {Element | null} */ (e.target);
    if (target?.closest?.('input, textarea, select, [contenteditable], [data-own-keys]')) return;
    if ((name === 'Enter' || name === 'NumpadEnter' || name === 'Space' || name === ' ') && target?.closest?.('button, a[href]')) return;
    e.stopImmediatePropagation();
    if (name === 'Escape') {
      this.stop();
      return;
    }
    const code = this.tv && name === 'Enter' ? m.pad.a : Object.hasOwn(m.keys, name) ? m.keys[name] : undefined;
    if (code === undefined) return;
    e.preventDefault(); // the arrows don't scroll, Space doesn't press
    if (e.repeat) return;
    this.keys.set(name, code);
    this.#sync(code);
  }

  /** Every key let go: the page lost the focus, or was hidden. */
  #letGo() {
    this.keys.clear();
    this.touchHeld.clear();
    this.#setDpad(0);
    this.#syncAll();
  }

  /** A gamepad, while a machine plays on a screen: its pad, A and B, Start and Back (Select), and a shoulder button stops it. */
  #readPad() {
    const h = this.padHeld;
    h.clear();
    const pad = firstPad(navigator.getGamepads?.());
    const p = this.machine?.pad;
    if (!pad || !p) return;
    for (const b of this.stale) if (!held(pad, b)) this.stale.delete(b);
    const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
    if (this.#pressed(pad, PAD_UP) || ay < -0.5) h.add(p.up);
    if (this.#pressed(pad, PAD_DOWN) || ay > 0.5) h.add(p.down);
    if (this.#pressed(pad, PAD_LEFT) || ax < -0.5) h.add(p.left);
    if (this.#pressed(pad, PAD_RIGHT) || ax > 0.5) h.add(p.right);
    if (this.#pressed(pad, PAD_A)) h.add(p.a);
    if (this.#pressed(pad, PAD_B)) h.add(p.b);
    if (this.#pressed(pad, PAD_BACK)) h.add(p.select);
    if (this.#pressed(pad, PAD_START)) h.add(p.start);
    const stop = this.#pressed(pad, PAD_LB) || this.#pressed(pad, PAD_RB);
    if ((h.size || stop) && !this.padHint) {
      this.padHint = true;
      this.overlay.setHint('gamepad');
    }
    if (stop) this.stop();
  }

  /**
   * @param {Gamepad} pad
   * @param {number} b
   */
  #pressed(pad, b) {
    return held(pad, b) && !this.stale.has(b);
  }

  /** @param {string} code */
  #holds(code) {
    for (const c of this.keys.values()) if (c === code) return true;
    return this.padHeld.has(code) || this.touchHeld.has(code) || this.handHeld.has(code);
  }

  /**
   * MAME's key `code` held while any way of playing holds it; a button's press (tap) runs its course.
   * @param {string} code
   */
  #sync(code) {
    const down = this.#holds(code);
    if (down) this.emulator.taps.delete(code);
    else if (this.emulator.taps.has(code)) return;
    this.emulator.key(code, down);
  }

  #syncAll() {
    for (const code of this.codes) this.#sync(code);
  }

  /**
   * The pad on a touch screen: the D-pad (a finger on it holds the way it points, sliding round
   * it), B and A, Select and Start. A button pressed some other way (a keyboard, a screen reader)
   * presses it for a moment.
   */
  #buildPad() {
    /**
     * @param {string} control
     * @param {string} label
     * @param {string} [shown]
     */
    const button = (control, label, shown = label) => {
      const b = el('button', { class: `pad-button pad-${control}`, type: 'button', 'aria-label': label }, el('span', { 'aria-hidden': 'true' }, shown));
      this.padButtons.set(control, b);
      b.addEventListener('click', (e) => {
        if (e.detail === 0) this.#tapControl(control); // not a finger's: those press and let go below
      });
      return b;
    };
    const dpad = el('div', { class: 'dpad' }, button('up', 'Up', '▲'), button('left', 'Left', '◀'), button('right', 'Right', '▶'), button('down', 'Down', '▼'));
    const at = (/** @type {PointerEvent} */ e) => {
      const r = dpad.getBoundingClientRect();
      this.#setDpad(dpadDirections(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width / 2));
    };
    dpad.addEventListener('pointerdown', (e) => {
      if (this.dpadFinger !== null) return;
      e.preventDefault();
      dpad.setPointerCapture?.(e.pointerId);
      this.dpadFinger = e.pointerId;
      at(e);
    });
    dpad.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.dpadFinger) at(e);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      dpad.addEventListener(type, (e) => {
        if (/** @type {PointerEvent} */ (e).pointerId !== this.dpadFinger) return;
        this.dpadFinger = null;
        this.#setDpad(0);
      });
    }
    const [select, start, b, a] = [['select', 'Select'], ['start', 'Start'], ['b', 'B'], ['a', 'A']].map(([control, label]) => {
      const pressed = button(control, label);
      pressed.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pressed.setPointerCapture?.(e.pointerId);
        this.#hold(control, true);
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pressed.addEventListener(type, () => this.#hold(control, false));
      return pressed;
    });
    return el('div', { class: 'touch-pad', role: 'group', 'aria-label': "The machine's pad", hidden: '' },
      dpad, el('div', { class: 'pad-mid' }, select, start), el('div', { class: 'pad-ab' }, b, a));
  }

  /**
   * One of the screen's pad's controls held, or let go.
   * @param {string} control
   * @param {boolean} on
   */
  #hold(control, on) {
    this.padButtons.get(control)?.classList.toggle('held', on);
    const pad = this.machine?.pad;
    if (!pad || !Object.hasOwn(pad, control)) return;
    const code = pad[/** @type {keyof Pad} */ (control)];
    if (on) this.touchHeld.add(code);
    else this.touchHeld.delete(code);
    this.#sync(code);
  }

  /** @param {number} bits the D-pad's directions held (DPAD) */
  #setDpad(bits) {
    if (bits === this.dpad) return;
    this.dpad = bits;
    for (const d of DIRECTIONS) this.#hold(d, (bits & DPAD[d]) !== 0);
  }

  /** @param {string} control a press of a moment, as the card's buttons make */
  #tapControl(control) {
    const pad = this.machine?.pad;
    if (pad && Object.hasOwn(pad, control)) this.emulator.tap(pad[/** @type {keyof Pad} */ (control)]);
  }
}

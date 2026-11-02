// Playing the room's machines (README, "The machines"), one at a time, each on its stand
// (stands.js). Chosen (its screen or its panel's Play in the room, its button in the card), the
// visitor walks up to it, in VR steps there, and it starts (emulator.js). On a screen its picture
// then fills the view beside the card or under it, the room behind it not drawn and still, and it
// takes the keys, a gamepad and a TV's remote: a console's pad is on a touch screen too, a computer's
// keyboard on every screen, under its picture (screen-keys.js), where a gamepad or the remote goes
// from key to key. Escape, a gamepad's shoulder buttons and a TV's Back (main.js's stepBack) stop it.
// In VR its screen in the room shows it, and the controllers play it: a console's pad on the left
// stick, its A and B the right's, X and Y its Select and Start; a computer's keys on the panel beside
// it, pointed at, its shifts on the left's X and Y, ENTER and DELETE the right's A and B; until a
// move away (a teleport: controls.js's stand). The card's buttons and the panel on the wall press a
// console's Start and Select (on a TV, A and B too), reset the machine and stop it; each goes by the
// console's own name for it (machines.js buttonName: the Vectrex's 1 to 4, the Atari 2600's Game
// Select and Game Reset), on the screen's pad too, where the 2600's one fire button is its A alone.
// A computer's shift pressed on the screen or the panel stays down for the next key.
//
// MAME's frame (mame-frame.js) is never seen: it stays the machine's own size, as a larger one
// would have MAME draw a larger picture, and each picture it draws is copied to a canvas of the
// page's, which the view shows scaled up (pixel for pixel, a vector screen's lines smoothed), and
// in VR the screen in the room.
import { Emulator } from './emulator.js';
import { RESET, buttonName, codesOf, machineById, machineCodes, oneButton } from './machines.js';
import { keyByCode } from './keyboards.js';
import { ScreenKeys, keysIn } from './screen-keys.js';
import { firstPad, held } from 'common/gamepad.js';
import { keyOf } from 'common/tv.js';

/** @typedef {import('./machines.js').Machine} Machine */
/** @typedef {import('./machines.js').Pad} Pad */
/** @typedef {import('./keyboards.js').Key} Key */
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

/** @param {Set<string>} set @param {string[]} codes */
const addAll = (set, codes) => {
  for (let i = 0; i < codes.length; i++) set.add(codes[i]);
};

// The gamepad's buttons (the standard mapping): A, B, X, Y, the shoulders, Back (or View) and Start, the D-pad.
const PAD_A = 0, PAD_B = 1, PAD_X = 2, PAD_Y = 3, PAD_LB = 4, PAD_RB = 5, PAD_BACK = 8, PAD_START = 9, PAD_UP = 12, PAD_DOWN = 13, PAD_LEFT = 14, PAD_RIGHT = 15;
// A VR controller's (xr-standard): A or X, B or Y.
const XR_LOWER = 4, XR_UPPER = 5;
/** The arrows (and a TV's spare keys, which keyOf reads as them) as steps across a keyboard. */
const STEPS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
/** The same, for a gamepad's directions. */
const PAD_STEPS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
/** How long a gamepad's direction held waits before it steps again, and then between steps (ms). */
const REPEAT_FIRST = 400, REPEAT = 110;
/**
 * How many of the machine's steps a key pressed for a moment is held (emulator.js's tap), and one
 * let go is held after: the machine sees even the quickest press.
 */
const TAP = 6, AFTER = 2;

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
    this.host = host;
    this.tv = tv;
    /** The TV's remote (main.js), whose card has the keys while the focus is in it. @type {import('common/tv.js').Remote | null} */
    this.remote = null;
    /** The stand whose machine runs, or is starting, else -1. */
    this.at = -1;
    /** @type {Machine | null} */
    this.machine = null;
    /** @type {string[]} MAME's keys the machine running takes */
    this.codes = [];
    // On a screen: the machine's picture, what it is doing while it starts, on a touch screen a
    // console's pad, and a computer's keyboard (made for the first one played).
    this.canvas = /** @type {HTMLCanvasElement} */ (el('canvas', { class: 'machine-screen', role: 'img', 'aria-label': "The machine's screen", tabindex: '-1' }));
    this.ctx = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d'));
    this.status = el('p', { class: 'play-status' });
    this.area = el('div', { class: 'play-area' }, this.canvas, this.status);
    /** @type {Map<string, HTMLElement>} the pad's buttons by its control's name */
    this.padButtons = new Map();
    this.touchPad = this.#buildPad();
    overlay.hintClear.push(this.touchPad);
    /** @type {ScreenKeys | null} */
    this.screenKeys = null;
    this.holder = el('div', { class: 'machine-host', 'aria-hidden': 'true' });
    host.append(this.area, this.touchPad, this.holder);
    this.emulator = new Emulator({ host: this.holder });
    this.emulator.onState = (state) => this.#state(state);
    /**
     * MAME's keys held by each way of playing: the keyboard's (by the visitor's key), a gamepad's,
     * the screen's (its pad or keys: a finger, the mouse, a TV's OK), the VR controllers', and a
     * computer's shifts down for the next key.
     * @type {Map<string, string[]>}
     */
    this.keys = new Map();
    /** @type {Set<string>} */
    this.padHeld = new Set();
    /** @type {Set<string>} */
    this.screenHeld = new Set();
    /** @type {Set<string>} refilled by hand() each frame in VR */
    this.handHeld = new Set();
    /** @type {Set<string>} */
    this.latched = new Set();
    this.latchBits = 0; // the same, for the panels: a bit for each of the keyboard's shifts
    /** @type {Key | null} the key a TV's OK holds down */
    this.okKey = null;
    /** @type {Key | null} the key a gamepad's A holds down */
    this.padKey = null;
    /** @type {'' | keyof typeof PAD_STEPS} the way a gamepad holds across a computer's keys */
    this.padStep = '';
    this.padNext = 0; // when it next steps (ms)
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
    // A phone turned, or its browser's bar come or gone: the picture placed again, and the machine's
    // buttons in the card's view (overlay.js).
    addEventListener('resize', () => {
      this.#fit();
      this.overlay._scrollToButtons();
    });
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
    if (!m || (!m.pad && !m.keyboard)) return;
    this.stop();
    this.at = i;
    this.machine = m;
    this.codes = machineCodes(m);
    this.frames = -1;
    this.canvas.width = m.screen.width;
    this.canvas.height = m.screen.height;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, m.screen.width, m.screen.height);
    this.canvas.setAttribute('aria-label', `The ${m.title}'s screen: ${this.stands[i].about}`);
    this.canvas.classList.toggle('vector', !!m.vector);
    if (m.pad) this.#namePad(m);
    this.padHint = false;
    this.stale.clear();
    const pad = firstPad(navigator.getGamepads?.());
    if (pad) for (let b = 0; b < pad.buttons.length; b++) if (held(pad, b)) this.stale.add(b);
    if (m.keyboard) this.#keysFor(m);
    this.emulator.start(m);
    const frame = /** @type {HTMLIFrameElement} */ (this.emulator.frame);
    frame.style.width = `${m.screen.width}px`;
    frame.style.height = `${m.screen.height}px`;
    this.#show(!this.renderer.xr.isPresenting);
    // Started from its button in the card, the focus goes to its buttons there; a computer's, and a
    // console's that takes Space (the Atari 2600's fire), to its screen, so that Enter and Space are
    // its own and press none of its buttons in the card.
    this.overlay.setPlaying(i, m, (m.keyboard || Object.hasOwn(m.keys, 'Space')) && !this.tv ? this.canvas : null);
    // On a TV, started from the card: the remote plays it now (Menu goes back to its buttons).
    if (this.remote?.inCard) this.remote.walk();
  }

  /** Stops the machine running, if one is: its screen in the room holds its last picture. Whether one was. */
  stop() {
    const i = this.at;
    if (i < 0) return false;
    const focused = this.host.contains(document.activeElement);
    this.scene.still(i, this.frames >= 0 ? this.canvas : null);
    this.emulator.stop();
    this.at = -1;
    this.machine = null;
    this.codes = [];
    this.keys.clear();
    this.padHeld.clear();
    this.screenHeld.clear();
    this.handHeld.clear();
    this.latched.clear();
    this.latchBits = 0;
    this.okKey = this.padKey = null;
    this.padStep = '';
    this.screenKeys?.reset();
    this.#setDpad(0);
    this.status.textContent = '';
    this.overlay.setPlaying(-1);
    this.#show(false);
    // The focus on its screen or its keys, which go: back to its button in the card.
    if (focused) /** @type {HTMLElement | undefined} */ (this.overlay.machineButtons[i])?.focus();
    this.controls.resume();
    this.remote?.forget();
    return true;
  }

  /** Back on a TV: the machine running stops. Whether one did. */
  stepBack() {
    return this.stop();
  }

  /**
   * A button for stand i's machine, in the card or on its panel on the wall: 'play', a console's
   * own ('start', 'select', on a TV 'a' and 'b'), a computer's key ('key:' and MAME's key, on the
   * panel), 'reset' or 'stop'.
   * @param {number} i
   * @param {string} id
   */
  button(i, id) {
    if (id === 'play') {
      this.choose(i);
      return;
    }
    const m = this.machine;
    if (this.at !== i || !m) return;
    if (id === 'stop') this.stop();
    else if (id === 'reset') this.emulator.tap(RESET);
    else if (id.startsWith('key:')) {
      const key = keyByCode(m.keyboard, id.slice(4));
      if (key) this.#press(key);
    } else if (m.pad && Object.hasOwn(m.pad, id)) this.emulator.tap(m.pad[/** @type {keyof Pad} */ (id)]);
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
   * A VR controller, each frame while a machine runs (controls.js's onHand). A console: the left
   * one's stick is its pad and its X and Y its Select and Start, taking the stick from walking; the
   * right one's A and B are its own, and its stick still turns. A computer: the left one's X and Y
   * hold its shifts, and its stick is still (a nudge of it doesn't walk away); the right one's A and B
   * are ENTER and DELETE.
   * @param {Hand} hand
   * @param {Gamepad} pad
   * @param {number} ax
   * @param {number} ay
   */
  hand(hand, pad, ax, ay) {
    const m = this.machine;
    if (!m || !this.renderer.xr.isPresenting) return false;
    const h = this.handHeld, left = hand.source?.handedness === 'left';
    const p = m.pad;
    if (p) {
      if (left) {
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
    const c = m.keyboard?.chords;
    if (!c) return false;
    if (left) {
      if (held(pad, XR_LOWER)) addAll(h, c.caps);
      if (held(pad, XR_UPPER)) addAll(h, c.symbol);
      return true;
    }
    if (held(pad, XR_LOWER)) addAll(h, c.enter);
    if (held(pad, XR_UPPER)) addAll(h, c.delete);
    return false;
  }

  /**
   * Each frame, from the page's frame loop, after the walking's (which reads the VR controllers):
   * steps the machine, shows its picture, reads a gamepad while it plays on a screen, and keeps the
   * panels on the walls showing what runs, what is pointed at, and a computer's shifts down.
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
      else this.#readPad(now);
      this.#syncAll();
      this.handHeld.clear();
    }
    // Into VR or out of it while one runs: in the room, or over it.
    if (this.shown !== (this.at >= 0 && !vr)) this.#show(!this.shown);
    const panels = this.scene.panels, c = this.controls;
    for (let i = 0; i < panels.length; i++) panels[i].set(this.at === i, c.hoverStand === i ? c.hoverStandButton : null, this.at === i ? this.latchBits : 0);
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
   * A computer's keyboard on the screen, for machine m: made for the first one played, and again
   * for another's.
   * @param {Machine} m
   */
  #keysFor(m) {
    const keyboard = /** @type {import('./keyboards.js').Keyboard} */ (m.keyboard);
    const label = `The ${m.title}'s keyboard`;
    if (this.screenKeys?.keyboard === keyboard) {
      this.screenKeys.root.setAttribute('aria-label', label);
      return;
    }
    const old = this.screenKeys?.root;
    if (old) {
      old.remove();
      this.overlay.hintClear = this.overlay.hintClear.filter((e) => e !== old);
    }
    const keys = new ScreenKeys(keyboard, label);
    keys.onKey = (key, down) => {
      if (down === null) this.#press(key);
      else this.#holdKey(key, down);
    };
    this.holder.before(keys.root);
    this.overlay.hintClear.push(keys.root);
    this.screenKeys = keys;
  }

  /**
   * Playing on a screen, or not: the layer over the view (style.css html.playing, and html.console
   * for a console, whose card leaves its pad room on a touch screen, shown or not), a console's pad
   * on a touch screen or a computer's keys, and where the picture goes.
   * @param {boolean} on
   */
  #show(on) {
    this.shown = on;
    const html = document.documentElement;
    html.classList.toggle('playing', on);
    html.classList.toggle('console', on && !!this.machine?.pad);
    this.#showPad();
  }

  /**
   * A console's pad on a touch screen and a computer's keys on any, while one plays there (the current
   * key ringed on a TV, or once a gamepad has played), then the picture placed and the hint clear of
   * them (overlay.js hintClear).
   */
  #showPad() {
    const m = this.machine;
    this.touchPad.hidden = !(this.shown && this.touch && !!m?.pad);
    const keys = this.screenKeys;
    if (keys) {
      keys.root.hidden = !(this.shown && m?.keyboard === keys.keyboard);
      keys.setNav(this.tv || this.padHint);
    }
    this.#fit();
    this.overlay._placeHint();
  }

  /**
   * The picture as large as it goes at its aspect beside the card or under it (whichever is larger),
   * above the buttons at the foot of the view, above the pad's controls below it, and above a
   * computer's keys, which go under it, covering none of them.
   */
  #fit() {
    const m = this.machine;
    if (!this.shown || !m) return;
    const tv = this.tv;
    const mx = tv ? 48 : 12, my = tv ? 27 : 12, gap = tv ? 24 : 12;
    const card = this.overlay.card.getBoundingClientRect();
    const buttons = this.overlay.buttons.offsetHeight;
    const foot = innerHeight - (buttons ? 16 + buttons + 8 : my);
    const keys = m.keyboard && this.screenKeys && !this.screenKeys.root.hidden ? this.screenKeys : null;
    /**
     * The space from x0 to x1 down from y0, to the foot or to the first of the pad's controls under
     * it: a computer's keys at its foot, and the picture in what is left.
     * @type {(x0: number, y0: number, x1: number) => { picture: ReturnType<typeof fitIn>, keys: ReturnType<typeof keysIn> | null }}
     */
    const space = (x0, y0, x1) => {
      let y1 = foot;
      if (!this.touchPad.hidden) {
        for (const c of this.touchPad.children) {
          const r = c.getBoundingClientRect();
          if (r.left < x1 && r.right > x0) y1 = Math.min(y1, r.top - gap);
        }
      }
      const k = keys ? keysIn(x0, y0, x1, y1, keys.cols, keys.keys.length / keys.cols) : null;
      if (k) y1 = k.y - gap;
      return { picture: fitIn(x0, y0, x1, y1, m.aspect), keys: k };
    };
    const beside = space(card.right + gap, my, innerWidth - mx);
    const under = space(mx, card.bottom + gap, innerWidth - mx);
    const { picture: r, keys: k } = beside.picture.width >= under.picture.width ? beside : under;
    const s = this.area.style;
    s.left = `${r.x}px`;
    s.top = `${r.y}px`;
    s.width = `${r.width}px`;
    s.height = `${r.height}px`;
    if (keys && k) keys.place(k);
  }

  /**
   * A key while a machine plays on a screen: one of its keys pressed or let go, Escape stops it, and
   * no key goes on to walking or to the remote's OK. On a TV, OK is a console's A, and with a
   * computer the arrows go from key to key on its keys on the screen and OK presses the one there, as
   * the arrows do there with the focus in them (Tab). Not one that a control of the page keeps (a text
   * box's, a button's Enter or Space), nor any while the remote is in the card.
   * @param {KeyboardEvent} e
   * @param {boolean} down
   */
  #key(e, down) {
    const m = this.machine;
    if (!this.shown || !m) return;
    const name = keyOf(e);
    if (!down) {
      if (this.okKey && (name === 'Enter' || name === 'NumpadEnter')) {
        const key = this.okKey;
        this.okKey = null;
        this.#holdKey(key, false);
        e.stopImmediatePropagation();
        return;
      }
      const codes = this.keys.get(name);
      if (codes === undefined) return;
      this.keys.delete(name);
      // A computer's key let go is held a little after, as the screen's are, so that it sees even the
      // quickest press; a shift down for it from the screen or the panel goes up with it.
      const shifts = m.keyboard?.shifts;
      for (const code of codes) {
        if (shifts && !this.#holds(code)) this.emulator.tap(code, AFTER);
        else this.#sync(code);
      }
      if (shifts && !codes.every((code) => shifts.includes(code))) this.#unlatch(AFTER);
      e.stopImmediatePropagation();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || this.remote?.inCard) return;
    const target = /** @type {Element | null} */ (e.target);
    if (target?.closest?.('input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable], [data-own-keys]')) return;
    const step = Object.hasOwn(STEPS, name) ? STEPS[/** @type {keyof typeof STEPS} */ (name)] : null;
    const onKeys = !!target?.closest?.('.machine-keys');
    if (onKeys && step && this.screenKeys) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.screenKeys.move(step[0], step[1], true);
      return;
    }
    // A control's own Enter or Space; a key's on the screen only where Tab put the focus, not the mouse.
    if ((name === 'Enter' || name === 'NumpadEnter' || name === 'Space' || name === ' ') && target?.closest?.('button, a[href], input') && !(onKeys && !target.matches(':focus-visible'))) return;
    e.stopImmediatePropagation();
    if (name === 'Escape') {
      this.stop();
      return;
    }
    if (this.tv && m.keyboard && this.screenKeys) {
      if (step) {
        e.preventDefault();
        this.screenKeys.move(step[0], step[1]);
        return;
      }
      if (name === 'Enter' || name === 'NumpadEnter') {
        e.preventDefault();
        if (!e.repeat && !this.okKey) {
          this.okKey = this.screenKeys.current;
          this.#holdKey(this.okKey, true);
        }
        return;
      }
    }
    const to = this.tv && m.pad && name === 'Enter' ? m.pad.a : Object.hasOwn(m.keys, name) ? m.keys[name] : undefined;
    if (to === undefined) return;
    e.preventDefault(); // the arrows don't scroll, Space doesn't press
    if (e.repeat) return;
    const codes = codesOf(to);
    this.keys.set(name, codes);
    for (const code of codes) this.#sync(code);
  }

  /** Every key let go: the page lost the focus, or was hidden. */
  #letGo() {
    this.keys.clear();
    this.screenHeld.clear();
    this.latched.clear();
    this.#showLatched();
    this.okKey = this.padKey = null;
    this.screenKeys?.reset();
    this.#setDpad(0);
    this.#syncAll();
  }

  /**
   * A gamepad, while a machine plays on a screen: a console's pad, A and B, Start and Back (Select);
   * a computer's keys (padKeys); and a shoulder button stops it.
   * @param {number} now
   */
  #readPad(now) {
    const h = this.padHeld;
    h.clear();
    const pad = firstPad(navigator.getGamepads?.());
    const m = this.machine;
    if (!pad || !m) return;
    for (const b of this.stale) if (!held(pad, b)) this.stale.delete(b);
    const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
    const up = this.#pressed(pad, PAD_UP) || ay < -0.5, down = this.#pressed(pad, PAD_DOWN) || ay > 0.5;
    const left = this.#pressed(pad, PAD_LEFT) || ax < -0.5, right = this.#pressed(pad, PAD_RIGHT) || ax > 0.5;
    const stop = this.#pressed(pad, PAD_LB) || this.#pressed(pad, PAD_RB);
    let used = stop;
    const p = m.pad;
    if (p) {
      if (up) h.add(p.up);
      if (down) h.add(p.down);
      if (left) h.add(p.left);
      if (right) h.add(p.right);
      if (this.#pressed(pad, PAD_A)) h.add(p.a);
      if (this.#pressed(pad, PAD_B)) h.add(p.b);
      if (this.#pressed(pad, PAD_BACK)) h.add(p.select);
      if (this.#pressed(pad, PAD_START)) h.add(p.start);
      used ||= h.size > 0;
    } else if (m.keyboard) {
      used = this.#padKeys(pad, now, up ? 'up' : down ? 'down' : left ? 'left' : right ? 'right' : '') || used;
    }
    if (used && !this.padHint) {
      this.padHint = true;
      this.overlay.setHint('gamepad');
      this.screenKeys?.setNav(true);
    }
    if (stop) this.stop();
  }

  /**
   * A gamepad on a computer's keys on the screen: its D-pad or left stick from key to key (a step at
   * once, then again and again while it is held), A holding the key there down (a shift: down for the
   * next key), X and Y its shifts, B DELETE and Start ENTER. Whether it was used.
   * @param {Gamepad} pad
   * @param {number} now
   * @param {'' | keyof typeof PAD_STEPS} way
   */
  #padKeys(pad, now, way) {
    const keys = this.screenKeys, keyboard = this.machine?.keyboard;
    if (!keys || !keyboard) return false;
    const h = this.padHeld;
    if (way !== this.padStep) {
      this.padStep = way;
      this.padNext = now + REPEAT_FIRST;
      if (way) keys.move(PAD_STEPS[way][0], PAD_STEPS[way][1]);
    } else if (way && now >= this.padNext) {
      this.padNext = now + REPEAT;
      keys.move(PAD_STEPS[way][0], PAD_STEPS[way][1]);
    }
    const a = this.#pressed(pad, PAD_A);
    const key = this.padKey;
    if (a && !key) {
      this.padKey = keys.current;
      if (!this.#shift(this.padKey)) keys.setHeld(this.padKey.code, true);
    } else if (!a && key) {
      this.padKey = null;
      if (!keyboard.shifts.includes(key.code)) {
        keys.setHeld(key.code, false);
        this.#letGoAfter(key.code);
      }
    }
    if (this.padKey && !keyboard.shifts.includes(this.padKey.code)) h.add(this.padKey.code);
    const c = keyboard.chords;
    if (this.#pressed(pad, PAD_X)) addAll(h, c.caps);
    if (this.#pressed(pad, PAD_Y)) addAll(h, c.symbol);
    if (this.#pressed(pad, PAD_B)) addAll(h, c.delete);
    if (this.#pressed(pad, PAD_START)) addAll(h, c.enter);
    return way !== '' || a || h.size > 0;
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
    for (const codes of this.keys.values()) if (codes.includes(code)) return true;
    return this.padHeld.has(code) || this.screenHeld.has(code) || this.handHeld.has(code) || this.latched.has(code);
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
   * A computer's key pressed for a moment (on the panel in VR, or on the screen without a finger or
   * the mouse), with the shifts down for it.
   * @param {Key} key
   */
  #press(key) {
    if (this.#shift(key)) return;
    this.emulator.tap(key.code, TAP);
    this.#unlatch(TAP);
  }

  /**
   * A computer's key held down by a finger, the mouse or a TV's OK (down), or let go (held a little
   * after, and the shifts down for it with it). A shift's press puts it down for the next key, or
   * takes it up again.
   * @param {Key} key
   * @param {boolean} down
   */
  #holdKey(key, down) {
    if (down) {
      if (this.#shift(key)) return;
      this.screenHeld.add(key.code);
      this.#sync(key.code);
      this.screenKeys?.setHeld(key.code, true);
      return;
    }
    if (!this.screenHeld.delete(key.code)) return; // a shift: nothing to let go
    this.screenKeys?.setHeld(key.code, false);
    this.#letGoAfter(key.code);
  }

  /** MAME's key `code` let go a little after now (AFTER), so that the machine sees even the quickest press, and the shifts down for it with it. @param {string} code */
  #letGoAfter(code) {
    this.emulator.tap(code, AFTER);
    this.#unlatch(AFTER);
  }

  /**
   * A computer's shift pressed on the screen or the panel: down for the next key, or up again; with
   * the other one down, the two pressed together for a moment (the Spectrum's E mode). Whether `key`
   * is one.
   * @param {Key} key
   */
  #shift(key) {
    const shifts = this.machine?.keyboard?.shifts;
    if (!shifts?.includes(key.code)) return false;
    if (this.latched.has(key.code)) {
      this.latched.delete(key.code);
      this.#sync(key.code);
    } else if (this.latched.size) {
      this.emulator.tap(key.code, TAP);
      this.#unlatch(TAP);
    } else {
      this.latched.add(key.code);
      this.#sync(key.code);
    }
    this.#showLatched();
    return true;
  }

  /** The shifts down for the next key let go `steps` of the machine's steps from now, with that key. @param {number} steps */
  #unlatch(steps) {
    if (!this.latched.size) return;
    for (const code of this.latched) this.emulator.tap(code, steps);
    this.latched.clear();
    this.#showLatched();
  }

  /** The shifts down for the next key, on the screen's keys and (latchBits) the panel. */
  #showLatched() {
    const shifts = this.machine?.keyboard?.shifts ?? [];
    let bits = 0;
    shifts.forEach((code, i) => {
      if (this.latched.has(code)) bits |= 1 << i;
    });
    this.latchBits = bits;
    this.screenKeys?.setLatched(this.latched);
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
   * The screen's pad for machine m: its buttons named as m names them (a Nintendo's A, B, Select and
   * Start; the Vectrex's 1 to 4), each showing its name, and B only where it is another button than
   * A (not the Atari 2600's one fire button).
   * @param {Machine} m
   */
  #namePad(m) {
    this.touchPad.setAttribute('aria-label', `The ${m.title}'s ${m.stick ? 'stick and buttons' : 'pad'}`);
    for (const id of ['select', 'start', 'b', 'a']) {
      const b = this.padButtons.get(id);
      if (!b) continue;
      const name = buttonName(m, id);
      b.setAttribute('aria-label', name);
      /** @type {HTMLElement} */ (b.firstElementChild).textContent = name;
      b.hidden = id === 'b' && oneButton(m);
    }
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
    if (on) this.screenHeld.add(code);
    else this.screenHeld.delete(code);
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

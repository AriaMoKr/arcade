// A computer's keyboard on the page (play.js), while it is played on a screen: its keys as buttons
// with their legends (keyboards.js), for a mouse, a finger, a screen reader, a gamepad and a TV's
// remote. A finger or the mouse holds a key down while it is on it; a key pressed another way (Enter
// or Space on it, a screen reader's press) is pressed for a moment; what a press does is play.js's
// (onKey), which keeps its shifts down for the next key (setLatched). The current key, which a
// gamepad or a remote moves (move) and presses, is ringed while one is in use (setNav). Tab reaches
// the keys as one stop, where the arrows move the current key too (play.js). A key the mouse presses
// doesn't take the focus, which would take Enter and Space from the machine.

/** @typedef {import('./keyboards.js').Keyboard} Keyboard */
/** @typedef {import('./keyboards.js').Key} Key */

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

/**
 * Below TIGHT pixels from one key to the next, a key shows its legend alone (CAPS SHIFT's short);
 * from ROOMY, E mode's too, in taller rows. At most MOST: ten keys about 720 pixels across.
 */
const TIGHT = 52, ROOMY = 58, MOST = 72;

/**
 * Where a computer's keys go on a screen, `cols` to a row and `rows` rows, at the foot of the space
 * from (x0, y0) to (x1, y1), in its middle: as large as they go across it, up to MOST pixels from one
 * key to the next, but no higher than a third of it, leaving the rest to the picture. A row is 0.74
 * of that high (0.95 from ROOMY, for E mode's legends above and below), never under 28 pixels, a
 * finger's target with the space round it.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} cols
 * @param {number} rows
 */
export function keysIn(x0, y0, x1, y1, cols, rows) {
  const high = (/** @type {number} */ p) => rows * Math.max(28, p * (p >= ROOMY ? 0.95 : 0.74));
  const most = (y1 - y0) / 3;
  let pitch = Math.max(0, Math.min(MOST, (x1 - x0) / cols));
  if (high(pitch) > most) {
    // As large as a third of the height holds: with E mode's legends while they fit, else without.
    const roomy = most / rows / 0.95;
    pitch = roomy >= ROOMY ? Math.min(pitch, roomy) : Math.min(pitch, ROOMY - 0.5, Math.max(28, most / rows) / 0.74);
  }
  const width = pitch * cols, height = high(pitch);
  return { x: x0 + (x1 - x0 - width) / 2, y: y1 - height, width, height, pitch };
}

export class ScreenKeys {
  /**
   * @param {Keyboard} keyboard
   * @param {string} label its name, for a screen reader
   */
  constructor(keyboard, label) {
    this.keyboard = keyboard;
    this.cols = keyboard.rows[0].length;
    /** Its keys, row after row. */
    this.keys = keyboard.rows.flat();
    /** @type {HTMLElement[]} */
    this.buttons = [];
    /** (key, down) a key pressed (true) or let go (false) by a finger or the mouse; (key, null) one pressed for a moment. @type {(key: Key, down: boolean | null) => void} */
    this.onKey = () => {};
    /** The current key's index, which a gamepad or a remote moves and presses. */
    this.at = 0;
    this.root = el('div', { class: 'machine-keys', role: 'group', 'aria-label': label, hidden: '' }, ...this.keys.map((k) => this.#button(k)));
    this.root.style.setProperty('--cols', String(this.cols));
    this.buttons[0].tabIndex = 0;
    this.buttons[0].classList.add('current');
    // A press of the mouse leaves the focus where it was; one from Tab moves the current key.
    this.root.addEventListener('mousedown', (e) => e.preventDefault());
    this.root.addEventListener('focusin', (e) => {
      const i = this.buttons.indexOf(/** @type {HTMLElement} */ (e.target));
      if (i >= 0) this.#current(i, false);
    });
  }

  /** The current key. */
  get current() {
    return this.keys[this.at];
  }

  /**
   * The current key `dx` keys along and `dy` rows down, stopping at the edges; with `focus`, the
   * focus with it (the arrows, the keys having it).
   * @param {number} dx
   * @param {number} dy
   * @param {boolean} [focus]
   */
  move(dx, dy, focus = false) {
    const rows = this.keys.length / this.cols;
    const r = Math.min(rows - 1, Math.max(0, Math.floor(this.at / this.cols) + dy));
    const c = Math.min(this.cols - 1, Math.max(0, (this.at % this.cols) + dx));
    this.#current(r * this.cols + c, focus);
  }

  /** The current key ringed (a gamepad's or a remote's), or not. @param {boolean} on */
  setNav(on) {
    this.root.classList.toggle('nav', on);
  }

  /** The shifts down for the next key, shown pressed. @param {Set<string>} codes MAME's keys */
  setLatched(codes) {
    this.buttons.forEach((b, i) => {
      if (!this.keyboard.shifts.includes(this.keys[i].code)) return;
      const on = codes.has(this.keys[i].code);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  /** A key shown held down, or let go. @param {string} code MAME's key @param {boolean} on */
  setHeld(code, on) {
    const i = this.keys.findIndex((k) => k.code === code);
    if (i >= 0) this.buttons[i].classList.toggle('held', on);
  }

  /** No key held or down for the next. */
  reset() {
    for (const b of this.buttons) b.classList.remove('held');
    this.setLatched(new Set());
  }

  /**
   * Where the keys go on the page (keysIn), with how large a key is (`pitch`, pixels from one to the
   * next): small keys show their legends alone, large ones E mode's too.
   * @param {ReturnType<typeof keysIn>} r
   */
  place(r) {
    const s = this.root.style;
    s.left = `${r.x}px`;
    s.top = `${r.y}px`;
    s.width = `${r.width}px`;
    s.height = `${r.height}px`;
    s.setProperty('--pitch', `${r.pitch}px`);
    this.root.classList.toggle('tight', r.pitch < TIGHT);
    this.root.classList.toggle('roomy', r.pitch >= ROOMY);
  }

  /**
   * @param {number} i
   * @param {boolean} focus
   */
  #current(i, focus) {
    if (i !== this.at) {
      const was = this.buttons[this.at];
      was.tabIndex = -1;
      was.classList.remove('current');
      this.at = i;
      this.buttons[i].tabIndex = 0;
      this.buttons[i].classList.add('current');
    }
    if (focus) this.buttons[i].focus();
  }

  /**
   * A key's button: its legend (shortened where keys are small), its word and its symbol, and E
   * mode's where they are large; the order a screen reader reads them in, the CSS placing them.
   * @param {Key} key
   */
  #button(key) {
    const shift = this.keyboard.shifts.includes(key.code);
    /** @type {Record<string, string>} */
    const attrs = { class: `machine-key${key.label.length > 1 ? ' long' : ''}${key.code === 'ShiftRight' ? ' symbol' : ''}`, type: 'button', tabindex: '-1' };
    if (shift) attrs['aria-pressed'] = 'false';
    if (key.short) attrs['aria-label'] = key.label;
    const part = (/** @type {string} */ cls, /** @type {string | undefined} */ text) => (text ? [el('span', { class: cls }, text)] : []);
    const b = el('button', attrs,
      ...(key.short ? [el('span', { class: 'k-label k-long' }, key.label), el('span', { class: 'k-label k-short' }, key.short)] : part('k-label', key.label)),
      ...part('k-word', key.word),
      ...part('k-symbol', key.symbol),
      ...part('k-ext', key.ext),
      ...part('k-ext-symbol', key.extSymbol));
    this.buttons.push(b);
    let held = false;
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || held) return;
      e.preventDefault(); // no text selected, no focus taken
      b.setPointerCapture?.(e.pointerId);
      held = true;
      this.onKey(key, true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      b.addEventListener(type, () => {
        if (!held) return;
        held = false;
        this.onKey(key, false);
      });
    }
    b.addEventListener('click', (e) => {
      if (/** @type {MouseEvent} */ (e).detail === 0) this.onKey(key, null); // not a finger's or the mouse's: those press and let go above
    });
    return b;
  }
}

// The machines' stands in 3D (stands.js): every stand's parts as boxes in one mesh, with the room's
// light baked into them (scene.js's lit); each machine's screen (sharp pixels up close, a vector
// screen's lines smoothed); a computer's keys on its top; an
// arcade cabinet's marquee; and the panel of its buttons on the wall beside it (a computer's keys
// among them), redrawn only when what it shows changes, the button pointed at lit by a pane over it.
// A screen shows the machine's own picture while it runs (MAME's canvas, copied each time it
// changes while the room is drawn: play.js), what it last showed once it stops, and before it has
// run, a screen switched off.
import * as THREE from 'three';
import { Builder } from './builder.js';
import { buttonName, machineById } from './machines.js';
import { PANEL_KEYS } from './stands.js';
import { GOLD, SANS, SERIF, enamel } from './textures.js';

/** @typedef {import('./keyboards.js').Keyboard} Keyboard */
/** @typedef {import('./keyboards.js').Key} Key */

/** @param {string} hex */
const lin = (hex) => {
  const c = new THREE.Color(hex); // three converts sRGB hex to its linear working space
  return [c.r, c.g, c.b];
};

/** A box's face against the wall, by the wall's normal into the room: not drawn. */
const BACK = { '-1,0': '+x', '1,0': '-x', '0,1': '-z' };

/**
 * @param {import('./stands.js').Stands} S the stands (stands.js layoutStands)
 * @param {object} o
 * @param {(b: Builder) => THREE.BufferGeometry} o.lit the room's light baked into a builder's boxes (scene.js)
 * @param {(p: number[], n: number[]) => THREE.Color} o.lightColor the room's light at a point facing n
 * @param {number} [o.anisotropy]
 */
export function buildStands(S, { lit, lightColor, anisotropy = 1 }) {
  const group = new THREE.Group();
  group.name = 'stands';
  const body = new Builder();
  for (const s of S) {
    const back = BACK[/** @type {keyof typeof BACK} */ (`${s.nx},${s.nz}`)];
    for (const b of s.boxes) body.box(b.min, b.max, { albedo: lin(b.color), seg: 0.3, skip: b.against ? ['-y', back] : ['-y'] });
  }
  const mesh = new THREE.Mesh(lit(body), new THREE.MeshBasicMaterial({ vertexColors: true }));
  mesh.name = 'stands';
  group.add(mesh);

  const screens = S.map((s) => {
    const m = /** @type {import('./machines.js').Machine} */ (machineById(s.machine));
    const still = document.createElement('canvas');
    still.width = m.screen.width;
    still.height = m.screen.height;
    switchedOff(/** @type {CanvasRenderingContext2D} */ (still.getContext('2d')), still.width, still.height);
    const smooth = !!m.vector;
    const stillTexture = screenTexture(still, smooth);
    const material = new THREE.MeshBasicMaterial({ map: stillTexture });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(s.screen.width, s.screen.height), material);
    screen.name = `screen ${s.machine}`;
    screen.position.set(s.screen.x, s.screen.y, s.screen.z);
    screen.rotation.y = Math.atan2(s.nx, s.nz);
    group.add(screen);
    return { material, still, stillTexture, smooth, /** @type {THREE.CanvasTexture | null} */ live: null };
  });

  // A computer's keys, on its top: its rows along the wall, the first row furthest from the room.
  for (const s of S) {
    const keyboard = machineById(s.machine)?.keyboard;
    const k = s.keys;
    if (!k || !keyboard) continue;
    const texture = new THREE.CanvasTexture(computerTop(keyboard));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    const mid = s.at((k.a[0] + k.a[1]) / 2, k.y, (k.d[0] + k.d[1]) / 2);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(k.a[1] - k.a[0], k.d[1] - k.d[0]), new THREE.MeshBasicMaterial({ map: texture, color: lightColor(mid, [0, 1, 0]) }));
    top.name = `keys ${s.machine}`;
    top.position.set(mid[0], mid[1], mid[2]);
    top.rotation.order = 'YXZ';
    top.rotation.set(-Math.PI / 2, Math.atan2(s.nx, s.nz), 0);
    group.add(top);
  }

  // An arcade cabinet's marquee: lit from within, so in its own light, not the room's.
  for (const s of S) {
    const q = s.marquee;
    if (!q) continue;
    const texture = new THREE.CanvasTexture(marqueeArt(q.text));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    const mid = s.at((q.a[0] + q.a[1]) / 2, (q.y[0] + q.y[1]) / 2, q.d);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(q.a[1] - q.a[0], q.y[1] - q.y[0]), new THREE.MeshBasicMaterial({ map: texture }));
    sign.name = `marquee ${s.machine}`;
    sign.position.set(mid[0], mid[1], mid[2]);
    sign.rotation.y = Math.atan2(s.nx, s.nz);
    group.add(sign);
  }

  const panels = S.map((s) => {
    const p = s.panel;
    const a = (p.a[0] + p.a[1]) / 2, y = (p.y[0] + p.y[1]) / 2;
    const at = s.at(a, y, p.d);
    const panel = new StandPanel({
      machine: /** @type {import('./machines.js').Machine} */ (machineById(s.machine)),
      about: s.about,
      layout: s.buttons,
      width: p.a[1] - p.a[0],
      height: p.y[1] - p.y[0],
      color: lightColor(at, [s.nx, 0, s.nz]),
      anisotropy,
    });
    panel.mesh.position.set(at[0], at[1], at[2]);
    panel.mesh.rotation.y = Math.atan2(s.nx, s.nz);
    group.add(panel.mesh);
    return panel;
  });

  return {
    group, panels,
    /**
     * Stand i's screen shows `canvas` (MAME's, while its machine runs): call it again each time
     * MAME has drawn a new picture.
     * @param {number} i
     * @param {HTMLCanvasElement} canvas
     */
    live(i, canvas) {
      const s = screens[i];
      if (s.live?.image !== canvas) {
        s.live?.dispose();
        s.live = screenTexture(canvas, s.smooth);
        s.material.map = s.live;
        s.material.needsUpdate = true;
      }
      s.live.needsUpdate = true;
    },
    /**
     * Stand i's screen holds still: on what `canvas` shows now (its machine stopping), else on what
     * it held before.
     * @param {number} i
     * @param {HTMLCanvasElement | null} [canvas]
     */
    still(i, canvas = null) {
      const s = screens[i];
      if (canvas && canvas.width && canvas.height) {
        const g = /** @type {CanvasRenderingContext2D} */ (s.still.getContext('2d'));
        g.drawImage(canvas, 0, 0, s.still.width, s.still.height);
        s.stillTexture.needsUpdate = true;
      }
      if (s.material.map !== s.stillTexture) {
        s.material.map = s.stillTexture;
        s.material.needsUpdate = true;
      }
      s.live?.dispose();
      s.live = null;
    },
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {boolean} [smooth] a vector screen's lines, smoothed up close (a raster screen's pixels stay sharp)
 */
function screenTexture(canvas, smooth = false) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** A screen switched off: dark glass, a little lighter in its middle, with the room's light on it. */
function switchedOff(/** @type {CanvasRenderingContext2D} */ g, /** @type {number} */ w, /** @type {number} */ h) {
  const glass = g.createRadialGradient(w * 0.5, h * 0.48, h * 0.05, w * 0.5, h * 0.5, w * 0.7);
  glass.addColorStop(0, '#2b302f');
  glass.addColorStop(1, '#0d0f0f');
  g.fillStyle = glass;
  g.fillRect(0, 0, w, h);
  const shine = g.createRadialGradient(w * 0.28, h * 0.22, 0, w * 0.28, h * 0.22, w * 0.3);
  shine.addColorStop(0, 'rgba(255,240,250,0.10)');
  shine.addColorStop(1, 'rgba(255,240,250,0)');
  g.fillStyle = shine;
  g.fillRect(0, 0, w, h);
}

/**
 * The ZX Spectrum's top, as one looks down on it: black, its name over its grey rubber keys, which
 * step to the right row by row as a typewriter's do, and the rainbow across its corner.
 * @param {Keyboard} keyboard
 */
function computerTop(keyboard) {
  const W = 512, H = 316;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.fillStyle = '#121114';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#e9e6df';
  g.font = `600 22px ${SANS}`;
  g.textBaseline = 'alphabetic';
  g.fillText('sinclair', 24, 38);
  const pitch = 43, key = 35, rowPitch = 48, stagger = [0, 0.5, 0.75, 0.25];
  keyboard.rows.forEach((row, r) => {
    row.forEach((k, i) => {
      const x = 22 + (i + stagger[r % 4]) * pitch, y = 56 + r * rowPitch;
      g.fillStyle = '#7d838b';
      g.beginPath();
      g.roundRect(x, y, key, key - 4, 5);
      g.fill();
      g.fillStyle = k.code === 'ShiftRight' ? '#ff5a4e' : '#ffffff';
      const text = k.short ?? k.label;
      g.font = `700 ${text.length > 1 ? 9 : 16}px ${SANS}`;
      g.fillText(text, x + 4, y + (text.length > 1 ? 13 : 17));
    });
  });
  // The rainbow: red, yellow, green and cyan, across the bottom right corner, and its name over it.
  const bands = ['#e8312a', '#f2c418', '#3caa3c', '#21a8d8'];
  bands.forEach((color, i) => {
    g.fillStyle = color;
    g.beginPath();
    const x = W - 150 + i * 16;
    g.moveTo(x, H);
    g.lineTo(x + 16, H);
    g.lineTo(x + 16 + 60, H - 60);
    g.lineTo(x + 60, H - 60);
    g.fill();
  });
  g.fillStyle = '#e9e6df';
  g.font = `italic 600 20px ${SANS}`;
  g.fillText('ZX Spectrum', 24, H - 22);
  return c;
}

/**
 * An arcade cabinet's marquee, 1024 × 370: its name in lights over a night sky, with fireworks
 * bursting in it (Thwaite's, against the missiles).
 * @param {string} text
 */
function marqueeArt(text) {
  const W = 1024, H = 370;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a0f2e');
  sky.addColorStop(1, '#2a1250');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // Stars, the same each time.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#d9dcff';
  for (let i = 0; i < 70; i++) g.fillRect(rand() * W, rand() * H, 2, 2);
  // Fireworks: rays out from a middle, brightest at their tips.
  for (const [x, y, r, color] of /** @type {[number, number, number, string][]} */ ([[140, 112, 74, '#ff6fae'], [895, 96, 64, '#6fe3ff'], [800, 286, 52, '#ffd34d'], [222, 290, 40, '#9dff8a']])) {
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = 3;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      g.globalAlpha = 0.55;
      g.beginPath();
      g.moveTo(x + ca * r * 0.35, y + sa * r * 0.35);
      g.lineTo(x + ca * r * 0.85, y + sa * r * 0.85);
      g.stroke();
      g.globalAlpha = 1;
      g.fillRect(x + ca * r - 3, y + sa * r - 3, 6, 6);
    }
  }
  // Its name, glowing.
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, text, W - 160, 170, SANS, '900 ');
  g.shadowColor = '#ff8a2e';
  g.shadowBlur = 28;
  g.lineWidth = 10;
  g.strokeStyle = '#ff6a1f';
  g.strokeText(text, W / 2, H / 2 + 6);
  g.shadowBlur = 0;
  g.fillStyle = '#ffe27a';
  g.fillText(text, W / 2, H / 2 + 6);
  // Its frame of light.
  g.strokeStyle = 'rgba(255,138,46,0.7)';
  g.lineWidth = 6;
  g.strokeRect(10, 10, W - 20, H - 20);
  return c;
}

/**
 * How to play console m in VR, its buttons by its own names for them (machines.js buttonName).
 * @param {import('./machines.js').Machine} m
 */
const vrPad = (m) => {
  const name = (/** @type {string} */ id) => buttonName(m, id);
  return [`Left stick: its ${m.stick ? 'stick' : 'pad'} · A and B: its ${name('a')} and ${name('b')}`, `X: its ${name('select')} · Y: its ${name('start')}`];
};
/** How to type on a computer in VR. */
const VR_KEYS = ['Trigger: the key pointed at · CAPS SHIFT and SYMBOL SHIFT stay down for the next', 'Left X, Y: CAPS SHIFT, SYMBOL SHIFT · Right A: ENTER · B: DELETE'];
const VR_STOPPED = ['Or point at its screen and pull the trigger'];
/** The red of the Spectrum's SYMBOL SHIFT legends, and the green of its E mode's. */
const RED = '#ff6b5e', GREEN = '#76d671';

/**
 * The panel of a machine's buttons on the wall beside it, in the control panel's enamel (panel.js):
 * its name and what runs on it, Play, or while it runs a console's Select and Start (by its own
 * names for them: the Vectrex's 1 and 2), Reset and Stop, or a computer's Reset and Stop and its keys
 * (its shifts lit while they are down for the next key); and how to play it in VR. Redrawn only when that changes; the button pointed at is lit by a pane
 * over it, which moves.
 */
export class StandPanel {
  /**
   * @param {{ machine: import('./machines.js').Machine, about: string, layout: import('./stands.js').PanelLayout, width: number, height: number, color: THREE.Color, anisotropy?: number }} o
   */
  constructor({ machine, about, layout, width, height, color, anisotropy = 1 }) {
    this.machine = machine;
    this.about = about;
    this.layout = layout;
    this.canvas = document.createElement('canvas');
    this.canvas.width = layout.width;
    this.canvas.height = layout.height;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d'));
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = anisotropy;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: this.texture, color }));
    this.mesh.name = `panel ${machine.id}`;
    // The button pointed at: a pane of the gold light over it, a canvas pixel being this many metres.
    this.px = { x: width / layout.width, y: height / layout.height };
    this.lit = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiply(color), transparent: true, opacity: 0.32, depthWrite: false }));
    this.lit.name = `pointed at ${machine.id}`;
    this.lit.position.z = 0.002;
    this.lit.visible = false;
    this.mesh.add(this.lit);
    this.running = false;
    /** @type {string | null} */
    this.hover = null;
    this.latched = 0;
    this._draw();
  }

  /**
   * What it shows: whether its machine runs, the button pointed at (or null), and which of a
   * computer's shifts are down for the next key (bits, in the order of its keyboard's shifts). Each
   * frame, so nothing is made for it.
   * @param {boolean} running
   * @param {string | null} hover
   * @param {number} [latched]
   */
  set(running, hover, latched = 0) {
    const redraw = running !== this.running || latched !== this.latched;
    if (!redraw && hover === this.hover) return;
    this.running = running;
    this.latched = latched;
    this.hover = hover;
    if (redraw) this._draw();
    this._light();
  }

  /** The pane over the button pointed at, or none. */
  _light() {
    const b = this.hover === null ? undefined : this.layout[this.running ? 'running' : 'stopped'].find((b) => b[0] === this.hover);
    this.lit.visible = !!b;
    if (!b) return;
    const [, x0, y0, x1, y1] = b;
    this.lit.scale.set((x1 - x0) * this.px.x, (y1 - y0) * this.px.y, 1);
    this.lit.position.x = ((x0 + x1) / 2 - this.layout.width / 2) * this.px.x;
    this.lit.position.y = (this.layout.height / 2 - (y0 + y1) / 2) * this.px.y;
  }

  _draw() {
    const g = this.ctx, { width: W, height: H } = this.layout;
    enamel(g, W, H, 8);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    const keyboard = this.machine.keyboard;
    if (keyboard) {
      // Its name on the left, its buttons on the right, its keys under them.
      g.textAlign = 'left';
      g.fillStyle = GOLD;
      fitText(g, this.machine.title, 536, 30, SERIF, '600 ');
      g.fillText(this.machine.title, 34, 56);
      g.fillStyle = '#b9a98d';
      fitText(g, this.about, 536, 20, SANS);
      g.fillText(this.about, 34, 86);
      g.textAlign = 'center';
      this._drawKeys(keyboard);
    } else {
      g.fillStyle = GOLD;
      fitText(g, this.machine.title, W - 72, 28, SERIF, '600 ');
      g.fillText(this.machine.title, W / 2, 62);
      g.fillStyle = '#b9a98d';
      fitText(g, this.about, W - 72, 21, SANS);
      g.fillText(this.about, W / 2, 96);
    }
    for (const [id, x0, y0, x1, y1] of this.layout[this.running ? 'running' : 'stopped']) {
      if (id.startsWith('key:')) continue; // a key, drawn above
      g.beginPath();
      g.roundRect(x0, y0, x1 - x0, y1 - y0, 12);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = GOLD;
      g.stroke();
      g.fillStyle = '#efe5cf';
      g.font = `600 ${id === 'play' ? 30 : 26}px ${SANS}`;
      g.textBaseline = 'middle';
      g.fillText(buttonName(this.machine, id), (x0 + x1) / 2, (y0 + y1) / 2 + 1);
      g.textBaseline = 'alphabetic';
    }
    g.fillStyle = '#b9a98d';
    const lines = !this.running ? VR_STOPPED : keyboard ? VR_KEYS : vrPad(this.machine);
    const top = keyboard ? H - 68 : 318;
    lines.forEach((line, i) => {
      fitText(g, line, W - 72, 20, SANS);
      g.fillText(line, W / 2, top + i * 30);
    });
    this.texture.needsUpdate = true;
  }

  /**
   * A computer's keys, as on it: each with its legend and keyword in white, what SYMBOL SHIFT types
   * in red on it, E mode's in green over that and in red under it. Dimmed while it is stopped (only
   * Play is a button then); a shift down for the next key lit.
   * @param {Keyboard} keyboard
   */
  _drawKeys(keyboard) {
    const g = this.ctx, k = PANEL_KEYS;
    g.save();
    if (!this.running) g.globalAlpha = 0.5;
    keyboard.rows.forEach((row, r) => {
      row.forEach((key, c) => {
        const x = k.x + c * k.pitchX, y = k.y + r * k.pitchY, w = k.width, h = k.height;
        const shift = keyboard.shifts.indexOf(key.code);
        const down = shift >= 0 && (this.latched & (1 << shift)) !== 0;
        g.beginPath();
        g.roundRect(x, y, w, h, 10);
        g.fillStyle = down ? 'rgba(224,187,114,0.55)' : '#25242a';
        g.fill();
        g.lineWidth = 1.5;
        g.strokeStyle = '#55525e';
        g.stroke();
        legends(g, key, x, y, w, h);
      });
    });
    g.restore();
  }
}

/**
 * A key's legends in the box (x, y, w, h): E mode's over the rest, its own and its symbol, its word,
 * and E mode's with SYMBOL SHIFT under them; a long legend (ENTER, CAPS SHIFT) in the middle.
 * @param {CanvasRenderingContext2D} g
 * @param {Key} key
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
function legends(g, key, x, y, w, h) {
  const small = (/** @type {string | undefined} */ text, /** @type {string} */ color, /** @type {number} */ at, size = 14) => {
    if (!text) return;
    g.fillStyle = color;
    fitText(g, text, w - 8, size, SANS, '600 ');
    g.fillText(text, x + w / 2, at);
  };
  small(key.ext, GREEN, y + 18, 13);
  if (key.label.length > 1) {
    g.fillStyle = key.code === 'ShiftRight' ? RED : '#f4f1ea';
    const words = key.label.split(' ');
    const size = 16;
    g.font = `700 ${size}px ${SANS}`;
    words.forEach((word, i) => g.fillText(word, x + w / 2, y + h / 2 + 6 + (i - (words.length - 1) / 2) * (size + 2)));
  } else {
    g.textAlign = 'left';
    g.fillStyle = '#f4f1ea';
    g.font = `700 30px ${SANS}`;
    g.fillText(key.label, x + 10, y + 52);
    g.textAlign = 'right';
    if (key.symbol) {
      // In the space right of its legend: a word (STOP, THEN) smaller.
      const from = x + 10 + g.measureText(key.label).width + 5;
      g.fillStyle = RED;
      fitText(g, key.symbol, x + w - 8 - from, 20, SANS, '700 ');
      g.fillText(key.symbol, x + w - 8, y + 50);
    }
    g.textAlign = 'center';
  }
  small(key.word, '#dcd6c8', y + 74, 13);
  small(key.extSymbol, RED, y + 94, 13);
}

/** Sets the largest font, from `size` px down, at which `text` fits `width`. */
function fitText(/** @type {CanvasRenderingContext2D} */ g, /** @type {string} */ text, /** @type {number} */ width, /** @type {number} */ size, family = SANS, weight = '') {
  for (let s = size; s >= 9; s--) {
    g.font = `${weight}${s}px ${family}`;
    if (g.measureText(text).width <= width) return;
  }
}

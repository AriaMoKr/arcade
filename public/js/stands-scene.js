// The machines' stands in 3D (stands.js): every stand's parts as boxes in one mesh, with the room's
// light baked into them (scene.js's lit); each machine's screen; and the panel of its buttons on the
// wall beside it, redrawn only when what it shows changes. A screen shows the machine's own picture
// while it runs (MAME's canvas, copied each time it changes while the room is drawn: play.js), what
// it last showed once it stops, and before it has run, a screen switched off.
import * as THREE from 'three';
import { Builder } from './builder.js';
import { machineById } from './machines.js';
import { STAND_BUTTONS, STAND_PANEL_PX } from './stands.js';
import { GOLD, SANS, SERIF, enamel } from './textures.js';

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
    const stillTexture = screenTexture(still);
    const material = new THREE.MeshBasicMaterial({ map: stillTexture });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(s.screen.width, s.screen.height), material);
    screen.name = `screen ${s.machine}`;
    screen.position.set(s.screen.x, s.screen.y, s.screen.z);
    screen.rotation.y = Math.atan2(s.nx, s.nz);
    group.add(screen);
    return { material, still, stillTexture, /** @type {THREE.CanvasTexture | null} */ live: null };
  });

  const panels = S.map((s) => {
    const p = s.panel;
    const a = (p.a[0] + p.a[1]) / 2, y = (p.y[0] + p.y[1]) / 2;
    const at = s.at(a, y, p.d);
    const panel = new StandPanel({
      machine: /** @type {import('./machines.js').Machine} */ (machineById(s.machine)),
      about: s.about,
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
        s.live = screenTexture(canvas);
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

/** @param {HTMLCanvasElement} canvas */
function screenTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; // sharp pixels up close
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

const LABELS = { play: 'Play', select: 'Select', start: 'Start', reset: 'Reset', stop: 'Stop' };
const VR_HINTS = ['Left stick: the pad · A and B: A and B', 'X: Select · Y: Start'];

/**
 * The panel of a machine's buttons on the wall beside it, in the control panel's enamel
 * (panel.js): its name and what runs on it, Play, or while it runs Select, Start, Reset and Stop,
 * and how to play it in VR. Redrawn only when it changes.
 */
export class StandPanel {
  /**
   * @param {{ machine: import('./machines.js').Machine, about: string, width: number, height: number, color: THREE.Color, anisotropy?: number }} o
   */
  constructor({ machine, about, width, height, color, anisotropy = 1 }) {
    this.machine = machine;
    this.about = about;
    this.canvas = document.createElement('canvas');
    this.canvas.width = STAND_PANEL_PX.width;
    this.canvas.height = STAND_PANEL_PX.height;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d'));
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = anisotropy;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: this.texture, color }));
    this.mesh.name = `panel ${machine.id}`;
    this.running = false;
    /** @type {string | null} */
    this.hover = null;
    this._draw();
  }

  /**
   * What it shows: whether its machine runs, and the button pointed at (or null). Each frame, so
   * nothing is made for it.
   * @param {boolean} running
   * @param {string | null} hover
   */
  set(running, hover) {
    if (running === this.running && hover === this.hover) return;
    this.running = running;
    this.hover = hover;
    this._draw();
  }

  _draw() {
    const g = this.ctx, W = STAND_PANEL_PX.width;
    enamel(g, W, STAND_PANEL_PX.height, 8);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = GOLD;
    fitText(g, this.machine.title, W - 72, 28, SERIF, '600 ');
    g.fillText(this.machine.title, W / 2, 62);
    g.fillStyle = '#b9a98d';
    fitText(g, this.about, W - 72, 21, SANS);
    g.fillText(this.about, W / 2, 96);
    for (const [id, x0, y0, x1, y1] of STAND_BUTTONS[this.running ? 'running' : 'stopped']) {
      const hover = this.hover === id;
      g.beginPath();
      g.roundRect(x0, y0, x1 - x0, y1 - y0, 12);
      g.fillStyle = hover ? 'rgba(224,187,114,0.32)' : 'rgba(255,255,255,0.06)';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = GOLD;
      g.stroke();
      g.fillStyle = '#efe5cf';
      g.font = `600 ${id === 'play' ? 30 : 26}px ${SANS}`;
      g.textBaseline = 'middle';
      g.fillText(LABELS[/** @type {keyof typeof LABELS} */ (id)], (x0 + x1) / 2, (y0 + y1) / 2 + 1);
      g.textBaseline = 'alphabetic';
    }
    g.fillStyle = '#b9a98d';
    const lines = this.running ? VR_HINTS : ['Or point at its screen and pull the trigger'];
    lines.forEach((line, i) => {
      fitText(g, line, W - 72, 20, SANS);
      g.fillText(line, W / 2, 318 + i * 30);
    });
    this.texture.needsUpdate = true;
  }
}

/** Sets the largest font, from `size` px down, at which `text` fits `width`. */
function fitText(/** @type {CanvasRenderingContext2D} */ g, /** @type {string} */ text, /** @type {number} */ width, /** @type {number} */ size, family = SANS, weight = '') {
  for (let s = size; s >= 12; s--) {
    g.font = `${weight}${s}px ${family}`;
    if (g.measureText(text).width <= width) return;
  }
}

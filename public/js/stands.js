// Where the room's machines stand (README, "The machines"): each on the floor against a wall, its
// parts boxes a ray meets and a visitor walks round, its screen, a panel of its buttons on the wall
// beside it (a computer's has its keys), and where to stand to play it. Pure, as room.js is, so the
// tests run it in Node; the page builds the stands from it (stands-scene.js) and asks it what a ray
// meets (controls.js).
//
// A stand is laid out in its wall's own terms: `a` along the wall, to the right facing it, from the
// stand's middle; `y` up from the floor; `d` out from the wall into the room. Metres.
import { MARGIN } from './room.js';
import { machineById } from './machines.js';

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * A machine's stand.
 * @typedef {object} Stand
 * @property {string} machine the machine on it (machines.js's id)
 * @property {'left' | 'right' | 'far'} wall the wall it stands against, facing in from the doorway
 * @property {number} at its middle along the wall, from the wall's middle, to the right facing it
 *   (as a piece's, config.js)
 * @property {Part[]} parts its boxes: what is drawn, what a ray meets and what one walks round
 * @property {{ a: number, y: number, d: number, width: number, height: number }} screen the machine's
 *   screen: its middle, on the face it is on, and its size
 * @property {{ a: [number, number], y: [number, number], d: number }} panel the panel of its buttons,
 *   on the wall, as wide over high as its canvas (panelLayout)
 * @property {{ a: number, d: number }} front where one stands to play it, facing the wall: in front
 *   of its screen, or between the screen and a computer's keys on the panel
 * @property {{ a: [number, number], y: number, d: [number, number] }} [keys] a computer's keyboard,
 *   drawn on the top of the part it is
 * @property {{ a: [number, number], y: [number, number], d: number, text: string }} [marquee] an
 *   arcade cabinet's marquee, lit from within: its name, on the face of a part
 * @property {string} about what runs on it, on the panel and in the card
 */
/**
 * A box of a stand, in its wall's terms, and its colour.
 * @typedef {{ part: string, a: [number, number], y: [number, number], d: [number, number], color: string }} Part
 */

/** @type {Stand[]} */
export const STANDS = [
  {
    // The NES on a TV cabinet against the right-hand wall, past the window: the TV on the cabinet,
    // the console beside it.
    machine: 'nes',
    wall: 'right',
    at: -2.5,
    parts: [
      { part: 'cabinet', a: [-0.55, 0.55], y: [0, 0.72], d: [0, 0.48], color: '#4a3326' },
      { part: 'tv', a: [-0.47, 0.23], y: [0.72, 1.28], d: [0.03, 0.47], color: '#2c2a2e' },
      { part: 'console', a: [0.26, 0.52], y: [0.72, 0.765], d: [0.2, 0.4], color: '#6b6a6e' },
      { part: 'console-top', a: [0.26, 0.52], y: [0.765, 0.81], d: [0.2, 0.4], color: '#c9c6bd' },
    ],
    screen: { a: -0.12, y: 1.0, d: 0.471, width: 0.54, height: 0.405 },
    panel: { a: [0.25, 0.55], y: [1.09, 1.35], d: 0.012 },
    front: { a: -0.12, d: 1.471 },
    about: 'Concentration Room, a memory game',
  },
  {
    // The ZX Spectrum on a desk against the left-hand wall, across the room from the NES: a portable
    // TV on the desk, the computer in front of it, and its keyboard large on the wall beside them, to
    // type on in VR. One plays it between the two.
    machine: 'spectrum',
    wall: 'left',
    at: 2.5,
    parts: [
      { part: 'desk', a: [-0.85, 0.85], y: [0.68, 0.72], d: [0, 0.7], color: '#5e412e' },
      { part: 'desk-left', a: [-0.85, -0.8], y: [0, 0.68], d: [0.02, 0.68], color: '#4c3426' },
      { part: 'desk-right', a: [0.8, 0.85], y: [0, 0.68], d: [0.02, 0.68], color: '#4c3426' },
      { part: 'desk-back', a: [-0.8, 0.8], y: [0.3, 0.68], d: [0.02, 0.05], color: '#4c3426' },
      { part: 'tv', a: [-0.8, -0.24], y: [0.72, 1.2], d: [0.06, 0.5], color: '#2c2a2e' },
      // 233 × 144 × 30 mm, as the 48K is.
      { part: 'computer', a: [-0.64, -0.407], y: [0.72, 0.75], d: [0.52, 0.664], color: '#1b1a1d' },
    ],
    screen: { a: -0.52, y: 0.97, d: 0.501, width: 0.4, height: 0.3 },
    keys: { a: [-0.64, -0.407], y: 0.751, d: [0.52, 0.664] },
    panel: { a: [-0.14, 0.82], y: [0.9, 1.5], d: 0.012 },
    front: { a: -0.09, d: 1.4 },
    about: 'Sinclair BASIC, to write programs in',
  },
  {
    // An arcade cabinet against the far wall, facing the doorway, with a Nintendo inside running
    // Thwaite: its sides stepped back over the control panel (the stick and two buttons, the pad's B
    // and A) to the screen, set in black, and out again under the marquee.
    machine: 'thwaite',
    wall: 'far',
    at: 0,
    parts: [
      { part: 'side-left', a: [-0.34, -0.31], y: [0, 0.95], d: [0, 0.66], color: '#1c2440' },
      { part: 'side-left-upper', a: [-0.34, -0.31], y: [0.95, 1.52], d: [0, 0.45], color: '#1c2440' },
      { part: 'side-left-top', a: [-0.34, -0.31], y: [1.52, 1.78], d: [0, 0.62], color: '#1c2440' },
      { part: 'side-right', a: [0.31, 0.34], y: [0, 0.95], d: [0, 0.66], color: '#1c2440' },
      { part: 'side-right-upper', a: [0.31, 0.34], y: [0.95, 1.52], d: [0, 0.45], color: '#1c2440' },
      { part: 'side-right-top', a: [0.31, 0.34], y: [1.52, 1.78], d: [0, 0.62], color: '#1c2440' },
      { part: 'base', a: [-0.31, 0.31], y: [0, 0.84], d: [0, 0.6], color: '#151a2e' },
      { part: 'coin-door', a: [-0.12, 0.12], y: [0.34, 0.66], d: [0.6, 0.615], color: '#34303b' },
      { part: 'coin-slot-left', a: [-0.08, -0.03], y: [0.53, 0.6], d: [0.615, 0.622], color: '#e8892c' },
      { part: 'coin-slot-right', a: [0.03, 0.08], y: [0.53, 0.6], d: [0.615, 0.622], color: '#e8892c' },
      { part: 'control-panel', a: [-0.335, 0.335], y: [0.84, 0.955], d: [0.3, 0.82], color: '#121216' },
      { part: 'stick', a: [-0.165, -0.15], y: [0.955, 1.05], d: [0.6, 0.615], color: '#2a2a2e' },
      { part: 'ball', a: [-0.185, -0.13], y: [1.05, 1.1], d: [0.58, 0.635], color: '#d8322a' },
      { part: 'button-b', a: [0.02, 0.075], y: [0.955, 0.972], d: [0.585, 0.64], color: '#d8322a' },
      { part: 'button-a', a: [0.11, 0.165], y: [0.955, 0.972], d: [0.585, 0.64], color: '#d8322a' },
      { part: 'button-start', a: [0.22, 0.25], y: [0.955, 0.963], d: [0.7, 0.73], color: '#e8e4da' },
      { part: 'monitor', a: [-0.31, 0.31], y: [0.84, 1.52], d: [0, 0.4], color: '#0e0e12' },
      { part: 'marquee', a: [-0.31, 0.31], y: [1.52, 1.78], d: [0, 0.62], color: '#151a2e' },
    ],
    screen: { a: 0, y: 1.24, d: 0.401, width: 0.48, height: 0.36 },
    marquee: { a: [-0.29, 0.29], y: [1.545, 1.755], d: 0.621, text: 'THWAITE' },
    panel: { a: [0.55, 0.85], y: [1.12, 1.38], d: 0.012 },
    front: { a: 0, d: 1.3 },
    about: 'Thwaite, fireworks against falling missiles, whose explosions flicker',
  },
  {
    // The Vectrex on a plinth against the left-hand wall, across the room from the window: upright,
    // its screen in its face, and its controller in front of it, the stick on the left and the four
    // buttons in a row. A plinth as high as a bar, so that its small screen is near the eye.
    machine: 'vectrex',
    wall: 'left',
    at: 0,
    parts: [
      { part: 'plinth', a: [-0.3, 0.3], y: [0, 1.03], d: [0, 0.5], color: '#4c3426' },
      { part: 'plinth-top', a: [-0.32, 0.32], y: [1.03, 1.07], d: [0, 0.52], color: '#5e412e' },
      // 24 × 38 × 30 cm, as the Vectrex is: its foot, which holds the controller when it is put
      // away, a little proud of its face; its knob on its right.
      { part: 'foot', a: [-0.12, 0.12], y: [1.07, 1.17], d: [0.1, 0.42], color: '#1c1c20' },
      { part: 'body', a: [-0.12, 0.12], y: [1.17, 1.45], d: [0.12, 0.4], color: '#141417' },
      { part: 'knob', a: [0.12, 0.135], y: [1.38, 1.41], d: [0.3, 0.33], color: '#2c2c31' },
      { part: 'controller', a: [-0.11, 0.11], y: [1.07, 1.1], d: [0.43, 0.5], color: '#1c1c20' },
      { part: 'stick', a: [-0.085, -0.069], y: [1.1, 1.135], d: [0.458, 0.474], color: '#2c2c31' },
      { part: 'button-1', a: [-0.01, 0.006], y: [1.1, 1.106], d: [0.458, 0.474], color: '#8e8c96' },
      { part: 'button-2', a: [0.018, 0.034], y: [1.1, 1.106], d: [0.458, 0.474], color: '#8e8c96' },
      { part: 'button-3', a: [0.046, 0.062], y: [1.1, 1.106], d: [0.458, 0.474], color: '#8e8c96' },
      { part: 'button-4', a: [0.074, 0.09], y: [1.1, 1.106], d: [0.458, 0.474], color: '#8e8c96' },
    ],
    // A 9-inch tube, turned upright: 3:4.
    screen: { a: 0, y: 1.31, d: 0.401, width: 0.15, height: 0.2 },
    panel: { a: [0.42, 0.72], y: [1.12, 1.38], d: 0.012 },
    front: { a: 0, d: 0.92 },
    about: 'Mine Storm, built into it: a ship among drifting mines',
  },
  {
    // The Atari 2600 on a console TV of its time against the right-hand wall, between the doorway
    // and the window: the TV in walnut on its legs, its screen on the left and its speaker and knobs
    // on the right, and on it the 2600 (its wood-grain front, 2048's cartridge in its slot) and its
    // joystick.
    machine: 'a2600',
    wall: 'right',
    at: 2.5,
    parts: [
      { part: 'leg-front-left', a: [-0.44, -0.4], y: [0, 0.3], d: [0.44, 0.48], color: '#3e2a1d' },
      { part: 'leg-front-right', a: [0.4, 0.44], y: [0, 0.3], d: [0.44, 0.48], color: '#3e2a1d' },
      { part: 'leg-back-left', a: [-0.44, -0.4], y: [0, 0.3], d: [0.06, 0.1], color: '#3e2a1d' },
      { part: 'leg-back-right', a: [0.4, 0.44], y: [0, 0.3], d: [0.06, 0.1], color: '#3e2a1d' },
      { part: 'tv', a: [-0.48, 0.48], y: [0.3, 1.1], d: [0.02, 0.52], color: '#6a4630' },
      { part: 'bezel', a: [-0.42, 0.16], y: [0.43, 0.97], d: [0.52, 0.53], color: '#1e1c1f' },
      { part: 'grille', a: [0.21, 0.43], y: [0.45, 0.8], d: [0.52, 0.524], color: '#3b322b' },
      { part: 'knob-1', a: [0.25, 0.29], y: [0.86, 0.9], d: [0.52, 0.545], color: '#c8b48a' },
      { part: 'knob-2', a: [0.35, 0.39], y: [0.86, 0.9], d: [0.52, 0.545], color: '#c8b48a' },
      // 34 × 23 × 9 cm, its black top over its wood-grain front, as the first 2600s were.
      { part: 'console', a: [-0.3, 0.04], y: [1.1, 1.19], d: [0.17, 0.4], color: '#19181b' },
      { part: 'console-front', a: [-0.3, 0.04], y: [1.1, 1.155], d: [0.4, 0.408], color: '#7a5434' },
      { part: 'cartridge', a: [-0.18, -0.08], y: [1.19, 1.25], d: [0.23, 0.26], color: '#1d1c20' },
      // Its joystick: the base, the stick and the red button at its far left.
      { part: 'joystick', a: [0.15, 0.23], y: [1.1, 1.135], d: [0.3, 0.38], color: '#19181b' },
      { part: 'joystick-stick', a: [0.183, 0.197], y: [1.135, 1.21], d: [0.333, 0.347], color: '#19181b' },
      { part: 'joystick-button', a: [0.155, 0.175], y: [1.135, 1.145], d: [0.305, 0.325], color: '#c8302a' },
    ],
    // A 24-inch tube: 4:3.
    screen: { a: -0.13, y: 0.7, d: 0.531, width: 0.48, height: 0.36 },
    panel: { a: [0.6, 0.9], y: [1.12, 1.38], d: 0.012 },
    front: { a: -0.13, d: 1.38 },
    about: '2048: its tiles slid together, two of a number making the next',
  },
  {
    // The Sega Mega Drive against the left-hand wall, across the room from the Atari 2600: a TV on a
    // black stand of its time, a video recorder on the shelf under it, and beside the TV the console,
    // Alex vs Bus's cartridge upright in its slot, and its pad in front of it.
    machine: 'megadrive',
    wall: 'left',
    at: -2.5,
    parts: [
      { part: 'stand-left', a: [-0.55, -0.52], y: [0, 0.6], d: [0, 0.48], color: '#1f1e23' },
      { part: 'stand-right', a: [0.52, 0.55], y: [0, 0.6], d: [0, 0.48], color: '#1f1e23' },
      { part: 'stand-back', a: [-0.52, 0.52], y: [0.09, 0.6], d: [0, 0.02], color: '#1f1e23' },
      { part: 'stand-shelf', a: [-0.52, 0.52], y: [0.06, 0.09], d: [0, 0.46], color: '#38373e' },
      { part: 'stand-top', a: [-0.55, 0.55], y: [0.6, 0.64], d: [0, 0.5], color: '#38373e' },
      { part: 'video', a: [-0.22, 0.22], y: [0.09, 0.18], d: [0.08, 0.42], color: '#56555c' },
      { part: 'tv', a: [-0.48, 0.2], y: [0.64, 1.18], d: [0.04, 0.47], color: '#2f2e34' },
      // 28 × 21 × 6 cm, as the first Mega Drive is: black, the cartridge upright in the slot in its
      // top, its red light at the front.
      { part: 'console', a: [0.24, 0.52], y: [0.64, 0.7], d: [0.1, 0.31], color: '#151417' },
      { part: 'cartridge', a: [0.31, 0.45], y: [0.7, 0.79], d: [0.15, 0.17], color: '#2a2930' },
      { part: 'light', a: [0.26, 0.28], y: [0.672, 0.682], d: [0.31, 0.312], color: '#d8302a' },
      // Its pad of three buttons, black.
      { part: 'pad', a: [0.3, 0.47], y: [0.64, 0.665], d: [0.36, 0.45], color: '#151417' },
    ],
    // A 20-inch tube: 4:3.
    screen: { a: -0.14, y: 0.91, d: 0.471, width: 0.48, height: 0.36 },
    panel: { a: [0.25, 0.55], y: [1.12, 1.38], d: 0.012 },
    front: { a: -0.14, d: 1.45 },
    about: 'Alex vs Bus: a race to catch the bus',
  },
  {
    // The Game Boy against the far wall, to the right of the cabinet: six times its size, as a shop
    // might have stood one in its window, upright on a plinth, Tobu Tobu Girl's cartridge in its top.
    // Its face as on the real one, 90 × 148 mm: the screen in its grey surround with the red light to
    // its left, the pad, B and A, Select and Start, and the speaker's slots.
    machine: 'gameboy',
    wall: 'far',
    at: 2,
    parts: [
      { part: 'plinth', a: [-0.33, 0.33], y: [0, 0.6], d: [0, 0.44], color: '#2b2a31' },
      { part: 'plinth-top', a: [-0.35, 0.35], y: [0.6, 0.64], d: [0, 0.46], color: '#3c3b43' },
      { part: 'support', a: [-0.1, 0.1], y: [0.64, 1.1], d: [0.06, 0.12], color: '#3c3b43' },
      { part: 'body', a: [-0.27, 0.27], y: [0.64, 1.528], d: [0.12, 0.312], color: '#c9c5bf' },
      { part: 'cartridge', a: [-0.17, 0.17], y: [1.48, 1.56], d: [0.125, 0.173], color: '#8f8b87' },
      { part: 'surround', a: [-0.228, 0.228], y: [1.084, 1.456], d: [0.312, 0.316], color: '#5a5b6c' },
      { part: 'light', a: [-0.198, -0.18], y: [1.264, 1.282], d: [0.316, 0.318], color: '#d8302a' },
      { part: 'pad-across', a: [-0.213, -0.063], y: [0.916, 0.964], d: [0.312, 0.328], color: '#1e1d21' },
      { part: 'pad-up-down', a: [-0.162, -0.114], y: [0.865, 1.015], d: [0.312, 0.328], color: '#1e1d21' },
      { part: 'button-b', a: [0.06, 0.12], y: [0.874, 0.934], d: [0.312, 0.33], color: '#8c2050' },
      { part: 'button-a', a: [0.156, 0.216], y: [0.922, 0.982], d: [0.312, 0.33], color: '#8c2050' },
      { part: 'button-select', a: [-0.084, -0.012], y: [0.76, 0.784], d: [0.312, 0.318], color: '#86848c' },
      { part: 'button-start', a: [0, 0.072], y: [0.76, 0.784], d: [0.312, 0.318], color: '#86848c' },
      // The speaker's six slots, slanting up to the right.
      ...[0, 1, 2, 3, 4, 5].map((i) => /** @type {Part} */ ({
        part: `speaker-${i + 1}`, a: [0.1 + 0.024 * i, 0.112 + 0.024 * i], y: [0.69 + 0.012 * i, 0.78 + 0.012 * i], d: [0.312, 0.313], color: '#8f8b86',
      })),
    ],
    // Its LCD, 47 × 43 mm and 160 × 144 pixels: 10:9.
    screen: { a: 0, y: 1.261, d: 0.317, width: 0.28, height: 0.252 },
    panel: { a: [0.45, 0.75], y: [1.12, 1.38], d: 0.012 },
    front: { a: 0, d: 0.97 },
    about: 'Tobu Tobu Girl, a chase into the sky, whose screen flashes',
  },
];

/**
 * A button on a panel: its id and its corners in the panel's canvas pixels (y down).
 * @typedef {[id: string, x0: number, y0: number, x1: number, y1: number]} PanelButton
 */
/**
 * The panel beside a machine: its canvas's size, and its buttons while the machine is stopped and
 * while it runs.
 * @typedef {{ width: number, height: number, stopped: PanelButton[], running: PanelButton[] }} PanelLayout
 */

/** A console's panel: Play while it is stopped; while it runs, its own Select and Start, Reset, and Stop. @type {PanelLayout} */
const CONSOLE_PANEL = {
  width: 480,
  height: 416,
  stopped: [['play', 32, 118, 448, 196]],
  running: [
    ['select', 32, 118, 232, 184],
    ['start', 248, 118, 448, 184],
    ['reset', 32, 200, 232, 266],
    ['stop', 248, 200, 448, 266],
  ],
};
/** The same for a console with no Select (the Mega Drive): its Start across the row. @type {PanelLayout} */
const START_PANEL = { ...CONSOLE_PANEL, running: [['start', 32, 118, 448, 184], ...CONSOLE_PANEL.running.slice(2)] };

/** On a computer's panel, its keys: ten to a row, four rows, from (x, y), each width × height. */
export const PANEL_KEYS = { x: 32, y: 112, pitchX: 96, pitchY: 108, width: 88, height: 100 };

/**
 * The panel beside machine m: a console's (its Start alone in the row, where it has no Select), or a
 * computer's, 1024 × 640: its name and Play at the top, or while it runs Reset and Stop there, and
 * its keys below (PANEL_KEYS), each a button while it runs ('key:' and MAME's key).
 * @param {import('./machines.js').Machine | undefined} m
 * @returns {PanelLayout}
 */
export function panelLayout(m) {
  if (!m?.keyboard) return m?.pad && !m.pad.select ? START_PANEL : CONSOLE_PANEL;
  const k = PANEL_KEYS;
  const keys = m.keyboard.rows.flatMap((row, r) => row.map((key, c) => {
    const x = k.x + c * k.pitchX, y = k.y + r * k.pitchY;
    return /** @type {PanelButton} */ ([`key:${key.code}`, x, y, x + k.width, y + k.height]);
  }));
  return { width: 1024, height: 640, stopped: [['play', 592, 24, 992, 88]], running: [['reset', 592, 24, 784, 88], ['stop', 800, 24, 992, 88], ...keys] };
}

/**
 * A panel's button at (u, v) (0…1 from its bottom left, as castStands reports), or null.
 * @param {PanelLayout} layout the stand's (layoutStands's buttons)
 * @param {number} u
 * @param {number} v
 * @param {boolean} running
 */
export function standButtonAt(layout, u, v, running) {
  const x = u * layout.width, y = (1 - v) * layout.height;
  for (const b of layout[running ? 'running' : 'stopped']) {
    if (x >= b[1] && x <= b[3] && y >= b[2] && y <= b[4]) return b[0];
  }
  return null;
}

/**
 * A wall's own terms, for a stand at `at` along it: its middle on the wall (cx, cz), the way to the
 * right facing the wall (rx, rz) and out from it into the room (nx, nz).
 * @param {import('./room.js').Layout} L
 * @param {'left' | 'right' | 'far'} wall
 * @param {number} at
 */
export function wallTerms(L, wall, at) {
  if (wall === 'far') return { cx: at, cz: L.z1, rx: 1, rz: 0, nx: 0, nz: 1 };
  if (wall === 'left') return { cx: L.x0, cz: -L.depth / 2 - at, rx: 0, rz: -1, nx: 1, nz: 0 };
  return { cx: L.x1, cz: -L.depth / 2 + at, rx: 0, rz: 1, nx: -1, nz: 0 };
}

/**
 * The stands in the room: each with its wall's terms, its parts as boxes in the room's coordinates
 * (min and max corners), its footprint on the floor, its screen's middle, where to stand to play it
 * (facing the wall), its panel and the buttons on it, and a computer's keys on its top.
 * @param {import('./room.js').Layout} L
 * @param {Stand[]} [stands]
 */
export function layoutStands(L, stands = STANDS) {
  return stands.map((s) => {
    const w = wallTerms(L, s.wall, s.at);
    /** A point given in the wall's terms, in the room's. @type {(a: number, y: number, d: number) => [number, number, number]} */
    const at = (a, y, d) => [w.cx + w.rx * a + w.nx * d, y, w.cz + w.rz * a + w.nz * d];
    const boxes = s.parts.map((p) => {
      const p0 = at(p.a[0], p.y[0], p.d[0]), p1 = at(p.a[1], p.y[1], p.d[1]);
      return {
        part: p.part, color: p.color, against: p.d[0] === 0,
        min: [Math.min(p0[0], p1[0]), p.y[0], Math.min(p0[2], p1[2])], max: [Math.max(p0[0], p1[0]), p.y[1], Math.max(p0[2], p1[2])],
      };
    });
    const foot = {
      x0: Math.min(...boxes.map((b) => b.min[0])), x1: Math.max(...boxes.map((b) => b.max[0])),
      z0: Math.min(...boxes.map((b) => b.min[2])), z1: Math.max(...boxes.map((b) => b.max[2])),
    };
    const sc = at(s.screen.a, s.screen.y, s.screen.d);
    const fp = at(s.front.a, 0, s.front.d);
    const m = MARGIN + 0.05;
    return {
      machine: s.machine, wall: s.wall, about: s.about, ...w, at, boxes, foot,
      screen: { x: sc[0], y: sc[1], z: sc[2], width: s.screen.width, height: s.screen.height },
      panel: s.panel,
      buttons: panelLayout(machineById(s.machine)),
      keys: s.keys ?? null,
      marquee: s.marquee ?? null,
      front: { x: clamp(fp[0], L.x0 + m, L.x1 - m), z: clamp(fp[2], L.z1 + m, -m), yaw: Math.atan2(w.nx, w.nz) },
    };
  });
}

/** The stands as layoutStands lays them out. @typedef {ReturnType<typeof layoutStands>} Stands */

/**
 * What castRay writes in the arcade: room.js's RoomHit, with the stand it is on (else -1).
 * @typedef {import('./room.js').RoomHit & { stand: number }} ArcadeHit
 */

/**
 * What a ray meets first among the stands, if nearer than `tMax` (what it meets in the room): a
 * stand's part ('machine') or the panel of its buttons ('stand-panel', with u and v on it, 0…1 from
 * its bottom left). Writes into out, as room.js's castRay does, and returns it; else null, leaving
 * out as it was.
 * @param {Stands} S
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {ArcadeHit} out
 * @param {number} [tMax]
 * @returns {ArcadeHit | null}
 */
export function castStands(S, ox, oy, oz, dx, dy, dz, out, tMax = Infinity) {
  let best = tMax, found = false;
  for (let i = 0; i < S.length; i++) {
    const s = S[i];
    for (const b of s.boxes) {
      // The slab method: where the ray enters the box, and through which face.
      let t0 = 0, t1 = best, axis = -1, sign = 0;
      for (let k = 0; k < 3; k++) {
        const o = k === 0 ? ox : k === 1 ? oy : oz, d = k === 0 ? dx : k === 1 ? dy : dz;
        if (Math.abs(d) < 1e-12) {
          if (o < b.min[k] || o > b.max[k]) t0 = Infinity;
          continue;
        }
        let ta = (b.min[k] - o) / d, tb = (b.max[k] - o) / d;
        let s0 = -1;
        if (ta > tb) {
          [ta, tb] = [tb, ta];
          s0 = 1;
        }
        if (ta > t0) {
          t0 = ta;
          axis = k;
          sign = s0;
        }
        if (tb < t1) t1 = tb;
      }
      if (axis < 0 || t0 > t1 || !(t0 < best)) continue;
      best = t0;
      found = true;
      write(out, 'machine', t0, ox + dx * t0, oy + dy * t0, oz + dz * t0, i);
      out.nx = axis === 0 ? sign : 0;
      out.ny = axis === 1 ? sign : 0;
      out.nz = axis === 2 ? sign : 0;
    }
    // The panel, a little out from the wall.
    const p = s.panel;
    const den = s.nx * dx + s.nz * dz;
    if (den < 0) {
      const t = (p.d - (s.nx * (ox - s.cx) + s.nz * (oz - s.cz))) / den;
      if (t > 0 && t < best) {
        const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
        const a = s.rx * (x - s.cx) + s.rz * (z - s.cz);
        if (a >= p.a[0] && a <= p.a[1] && y >= p.y[0] && y <= p.y[1]) {
          best = t;
          found = true;
          write(out, 'stand-panel', t, x, y, z, i);
          out.nx = s.nx;
          out.ny = 0;
          out.nz = s.nz;
          out.u = (a - p.a[0]) / (p.a[1] - p.a[0]);
          out.v = (y - p.y[0]) / (p.y[1] - p.y[0]);
        }
      }
    }
  }
  return found ? out : null;
}

/**
 * @param {ArcadeHit} out
 * @param {string} kind
 * @param {number} t
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} stand
 */
function write(out, kind, t, x, y, z, stand) {
  out.kind = kind;
  out.t = t;
  out.x = x;
  out.y = y;
  out.z = z;
  out.u = out.v = 0;
  out.walkable = false;
  out.piece = -1;
  out.stand = stand;
}

/**
 * The nearest place to (x, z) that keeps a head `MARGIN` clear of every stand's footprint, the way
 * out from its wall, else along it: writes { x, z } into out.
 * @param {Stands} S
 * @param {number} x
 * @param {number} z
 * @param {{ x: number, z: number }} [out]
 */
export function clampStands(S, x, z, out = { x: 0, z: 0 }) {
  for (const s of S) {
    const f = s.foot, m = MARGIN;
    if (x <= f.x0 - m || x >= f.x1 + m || z <= f.z0 - m || z >= f.z1 + m) continue;
    // Out of the footprint by the shortest way that isn't into the wall behind it.
    const ways = [
      [f.x0 - m - x, 0], [f.x1 + m - x, 0],
      [0, f.z0 - m - z], [0, f.z1 + m - z],
    ].filter(([wx, wz]) => wx * s.nx + wz * s.nz >= 0);
    let best = ways[0];
    for (const w of ways) if (Math.hypot(w[0], w[1]) < Math.hypot(best[0], best[1])) best = w;
    x += best[0];
    z += best[1];
  }
  out.x = x;
  out.z = z;
  return out;
}

/**
 * What is wrong with the stands in this room, in words (none: []): each for a machine there is,
 * on a wall a stand can be against, inside the room and off its doorway's wall, clear of the window
 * and of the others, with its screen on a face of its parts, its panel on the wall clear of them and
 * the shape of its canvas, a computer's keys on the top of a part, and the place to play it
 * somewhere to stand.
 * @param {import('./room.js').Layout} L
 * @param {string[]} machines the machines' ids (machines.js)
 * @param {Stand[]} [stands]
 */
export function standProblems(L, machines, stands = STANDS) {
  /** @type {string[]} */
  const problems = [];
  const S = layoutStands(L, stands);
  S.forEach((s, i) => {
    const say = (/** @type {string} */ what) => problems.push(`${s.machine}: ${what}`);
    if (!machines.includes(s.machine)) say('there is no such machine');
    if (!['left', 'right', 'far'].includes(s.wall)) say('it is not against a side wall or the far wall');
    const f = s.foot;
    if (f.x0 < L.x0 - 1e-9 || f.x1 > L.x1 + 1e-9 || f.z0 < L.z1 - 1e-9 || f.z1 > -MARGIN) say('it is not inside the room');
    for (const b of s.boxes) if (b.max[1] > L.height - 0.1) say(`its ${b.part} is up in the ceiling`);
    // The window, with its casing, and the floor under it.
    const W = L.window;
    if (W.wall === s.wall) {
      const span = s.wall === 'far' ? [f.x0, f.x1] : [f.z0, f.z1];
      if (span[0] < W.along + W.width / 2 + 0.15 && span[1] > W.along - W.width / 2 - 0.15) say('it is in front of the window');
    }
    S.forEach((o, j) => {
      if (j > i && o.foot.x0 < f.x1 && o.foot.x1 > f.x0 && o.foot.z0 < f.z1 && o.foot.z1 > f.z0) say(`it is over ${o.machine}'s stand`);
    });
    const st = stands[i];
    if (!st.parts.some((p) => Math.abs(p.d[1] - st.screen.d) < 0.01 && st.screen.a - st.screen.width / 2 >= p.a[0] && st.screen.a + st.screen.width / 2 <= p.a[1] && st.screen.y - st.screen.height / 2 >= p.y[0] && st.screen.y + st.screen.height / 2 <= p.y[1])) say('its screen is not on the face of one of its parts');
    if (st.parts.some((p) => p.a[0] < st.panel.a[1] && p.a[1] > st.panel.a[0] && p.y[0] < st.panel.y[1] && p.y[1] > st.panel.y[0])) say('its panel is behind one of its parts');
    if (Math.abs((st.panel.a[1] - st.panel.a[0]) / (st.panel.y[1] - st.panel.y[0]) - s.buttons.width / s.buttons.height) > 0.01) say("its panel is not the shape of its buttons' canvas");
    const keys = st.keys;
    if (keys && !st.parts.some((p) => Math.abs(p.y[1] - keys.y) < 0.01 && keys.a[0] >= p.a[0] && keys.a[1] <= p.a[1] && keys.d[0] >= p.d[0] && keys.d[1] <= p.d[1])) say('its keys are not on the top of one of its parts');
    const mq = st.marquee;
    if (mq && !st.parts.some((p) => Math.abs(p.d[1] - mq.d) < 0.01 && mq.a[0] >= p.a[0] && mq.a[1] <= p.a[1] && mq.y[0] >= p.y[0] && mq.y[1] <= p.y[1])) say('its marquee is not on the face of one of its parts');
    const c = clampStands(S, s.front.x, s.front.z);
    if (Math.hypot(c.x - s.front.x, c.z - s.front.z) > 1e-9 || s.front.x < L.x0 + MARGIN || s.front.x > L.x1 - MARGIN || s.front.z < L.z1 + MARGIN || s.front.z > -MARGIN) say('where one plays it is not somewhere to stand');
  });
  return problems;
}

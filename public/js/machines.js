// The room's machines (README, "The machines"): what MAME runs for each, the files it reads, the
// command line it starts with, and the keys it takes. MAME itself is public/mame/arcade.js and
// .wasm (tools/build-mame.sh), which runs a machine in a frame of its own (mame-frame.js);
// emulator.js drives that frame from the page's. Pure, for the page, the machine's frame and the
// tests.
import { SPECTRUM } from './keyboards.js';

/**
 * A machine in the room, as MAME runs it.
 * @typedef {object} Machine
 * @property {string} id its own, 1–32 of a–z, 0–9 and -: the frame's ?m=, and its place in the card
 * @property {string} title its name, in the card and on its label
 * @property {string} maker
 * @property {number} year
 * @property {string} driver MAME's name for the machine (the set it runs)
 * @property {MachineFile[]} files what MAME reads: its ROMs and the software, fetched into its file system
 * @property {string[]} args MAME's options for this machine, after the common ones (mameArgs)
 * @property {{ width: number, height: number }} screen MAME's window in pixels: the machine's screen
 *   as it makes it, one pixel to one, which the room scales to `aspect`
 * @property {number} aspect the screen's width over its height as it is shown (a TV's 4:3)
 * @property {Record<string, string | string[]>} keys a visitor's key (KeyboardEvent.code) and the
 *   key of MAME's it presses (or keys, pressed together): MAME's own for the control it stands for
 *   (its default keys), a computer's own keys
 * @property {string} help those keys, in words
 * @property {Pad} [pad] a game console's pad: its controls by name and the key of MAME's each
 *   presses, for every way of playing it in the room (play.js: a gamepad, a phone's screen, VR's
 *   controllers, a TV's remote, the card)
 * @property {Partial<Record<PadButton, string>>} [names] what the console's own buttons are called,
 *   where they aren't a Nintendo's (BUTTON_NAMES), in the order the card shows them
 * @property {boolean} [stick] its directions are a stick, not a pad
 * @property {boolean} [vector] its screen is drawn in lines, shown smoothed rather than in pixels
 * @property {import('./keyboards.js').Keyboard} [keyboard] a computer's keyboard, for every way of
 *   typing on it in the room (play.js: its keys on a screen, the panel beside it in VR, a gamepad,
 *   a TV's remote)
 */
/**
 * A game console's pad: the key of MAME's each of its controls presses.
 * @typedef {{ up: string, down: string, left: string, right: string, a: string, b: string, select: string, start: string }} Pad
 */
/** A pad's buttons, by the names play.js knows them by: a gamepad's A, B, Back and Start. @typedef {'a' | 'b' | 'select' | 'start'} PadButton */
/**
 * A file MAME reads: fetched from `url` (relative to public/mame/) and written to `path` in its file
 * system before it starts.
 * @typedef {object} MachineFile
 * @property {string} url
 * @property {string} path
 */

const ARROWS = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' };
/** A Nintendo's pad: MAME's A is Left Alt and its B Left Ctrl, Start 1 and Select 5. @type {Pad} */
const NES_PAD = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'AltLeft', b: 'ControlLeft', select: 'Digit5', start: 'Digit1' };
/** And the keys for it: the arrows, X and Z its A and B, Enter Start and either Shift Select. */
const NES_KEYS = { ...ARROWS, KeyX: 'AltLeft', KeyZ: 'ControlLeft', Enter: 'Digit1', ShiftLeft: 'Digit5', ShiftRight: 'Digit5' };
/** A computer's keyboard: its letters, digits, Enter, Space and both Shifts, each itself. */
const KEYBOARD = Object.fromEntries(
  [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => `Key${c}`)
    .concat([...'0123456789'].map((d) => `Digit${d}`), ['Enter', 'Space', 'ShiftLeft', 'ShiftRight'])
    .map((code) => [code, code]),
);

/** @type {Machine[]} */
export const MACHINES = [
  {
    id: 'nes',
    title: 'Nintendo Entertainment System',
    maker: 'Nintendo',
    year: 1985,
    driver: 'nes',
    files: [{ url: 'software/croom/croom.nes', path: '/software/croom.nes' }],
    args: ['-cart', '/software/croom.nes'],
    screen: { width: 256, height: 240 },
    aspect: 4 / 3,
    keys: NES_KEYS,
    help: 'Arrows: the pad · X: A · Z: B · Enter: Start · Shift: Select',
    pad: NES_PAD,
  },
  {
    id: 'spectrum',
    title: 'ZX Spectrum 48K',
    maker: 'Sinclair Research',
    year: 1982,
    driver: 'spectrum',
    files: [{ url: 'roms/spectrum/spectrum.rom', path: '/roms/spectrum/spectrum.rom' }],
    args: [],
    // 256 × 192 inside its border (MAME's spectrum.h).
    screen: { width: 352, height: 296 },
    aspect: 4 / 3,
    // Its keyboard: CAPS SHIFT is Left Shift, SYMBOL SHIFT Right Shift; and as on its successors'
    // keyboards, DELETE and the cursor keys (CAPS SHIFT with 0, and with 5 to 8) have keys of their own.
    keys: {
      ...KEYBOARD,
      Backspace: ['ShiftLeft', 'Digit0'],
      ArrowLeft: ['ShiftLeft', 'Digit5'], ArrowDown: ['ShiftLeft', 'Digit6'], ArrowUp: ['ShiftLeft', 'Digit7'], ArrowRight: ['ShiftLeft', 'Digit8'],
    },
    help: 'Letters, digits, Enter, Space · Left Shift: CAPS SHIFT · Right Shift: SYMBOL SHIFT · Backspace: DELETE · arrows: the cursor',
    keyboard: SPECTRUM,
  },
  {
    // A Nintendo in an arcade cabinet, as Nintendo's own Vs. System and PlayChoice-10 were, running
    // Thwaite: the cabinet's stick and buttons are its pad. B fires from the left silo, A from the
    // right; Start pauses.
    id: 'thwaite',
    title: 'Arcade cabinet',
    maker: 'Nintendo',
    year: 1985,
    driver: 'nes',
    files: [{ url: 'software/thwaite/thwaite.nes', path: '/software/thwaite.nes' }],
    args: ['-cart', '/software/thwaite.nes'],
    screen: { width: 256, height: 240 },
    aspect: 4 / 3,
    keys: NES_KEYS,
    help: 'Arrows: aim · Z: fire left · X: fire right · Enter: Start · Shift: Select',
    pad: NES_PAD,
  },
  {
    // The Vectrex, its screen drawn in lines (MAME's vector screen, upright: ROT270), and Mine Storm,
    // the game built into it. Its controller's stick, and its four buttons in a row, 1 to 4: MAME's
    // Left Ctrl, Left Alt, Space and Left Shift. A gamepad's A and B are its 4 and 3 (Mine Storm's
    // fire and thrust), Back and Start its 1 and 2. Its settings (cfg/) keep MAME from drawing the
    // light pen's crosshair, as the arrows move that too.
    id: 'vectrex',
    title: 'Vectrex',
    maker: 'General Consumer Electronics',
    year: 1982,
    driver: 'vectrex',
    files: [
      { url: 'roms/vectrex/exec_rom.bin', path: '/roms/vectrex/exec_rom.bin' },
      { url: 'cfg/vectrex.cfg', path: '/cfg/vectrex.cfg' },
    ],
    args: [],
    // Its lines drawn into 240 × 320 pixels, smoothed when scaled: more pixels cost a slow
    // computer more each frame (README, "How fast") than they add to the lines.
    screen: { width: 240, height: 320 },
    aspect: 3 / 4,
    keys: { ...ARROWS, Digit1: 'ControlLeft', Digit2: 'AltLeft', Digit3: 'Space', Digit4: 'ShiftLeft', KeyZ: 'ControlLeft', KeyX: 'AltLeft', KeyC: 'Space', KeyV: 'ShiftLeft' },
    help: 'Arrows: the stick · 1 to 4, or Z, X, C, V: its buttons · Mine Storm: 4 fires, 3 thrusts, 2 escapes',
    pad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'ShiftLeft', b: 'Space', select: 'ControlLeft', start: 'AltLeft' },
    names: { select: '1', start: '2', b: '3', a: '4' },
    stick: true,
    vector: true,
  },
];

/**
 * MAME's soft reset (its own control, as the console's Reset button): sent only by the room's Reset
 * button (play.js), never by a key of the visitor's.
 */
export const RESET = 'F3';

/** The machine with that id, or undefined. @param {string | null} id */
export function machineById(id) {
  return MACHINES.find((m) => m.id === id);
}

/**
 * The keys of MAME's a visitor's key presses (Machine's keys), as a list.
 * @param {string | string[] | undefined} to
 * @returns {string[]}
 */
export function codesOf(to) {
  return to === undefined ? [] : typeof to === 'string' ? [to] : to;
}

/**
 * Every key of MAME's that machine m takes, once: its visitor's keys', its pad's and its keyboard's.
 * @param {Machine} m
 */
export function machineCodes(m) {
  return [...new Set([
    ...Object.values(m.keys).flatMap(codesOf),
    ...(m.pad ? Object.values(m.pad) : []),
    ...(m.keyboard ? m.keyboard.rows.flat().map((k) => k.code) : []),
  ])];
}

/** The room's buttons for a machine, by play.js's names, as a Nintendo's are called. */
const BUTTON_NAMES = /** @type {Record<string, string | undefined>} */ ({
  play: 'Play', start: 'Start', select: 'Select', a: 'A', b: 'B', reset: 'Reset', stop: 'Stop',
});

/**
 * What button `id` (play.js's name: a pad's, or play, reset or stop) is called on machine m: its
 * own name for it (Machine's names), else a Nintendo's.
 * @param {Machine | undefined} m
 * @param {string} id
 */
export function buttonName(m, id) {
  const names = /** @type {Record<string, string | undefined>} */ (m?.names ?? {});
  return names[id] ?? BUTTON_NAMES[id] ?? id;
}

/**
 * The buttons machine m has in the card while it runs, by play.js's names: a console's Start and
 * Select, or its own buttons in their order (Machine's names), with A and B only on a TV, whose
 * remote's OK is its A; then Reset and Stop. A computer's keys are on the screen instead.
 * @param {Machine} m
 * @param {boolean} [tv]
 */
export function machineButtons(m, tv = false) {
  if (!m.pad) return ['reset', 'stop'];
  const own = m.names ? Object.keys(m.names) : ['start', 'select', 'a', 'b'];
  return [...own.filter((id) => tv || (id !== 'a' && id !== 'b')), 'reset', 'stop'];
}

/**
 * MAME's command line for machine m: its driver, where its files are, a window the size of its
 * screen filled one pixel to one, drawn by SDL's software renderer (MAME's `soft` video isn't in
 * its web build: its SDL renderer, `accel`, with SDL's `software` driver, which puts each picture
 * on a 2D canvas), with no information screen or .ini files in the way, a machine's own settings
 * from /cfg where it has them (Machine's files), never waiting on its own for the time to catch up
 * (the page paces it: emulator.js), and sound through Web Audio at `sampleRate`.
 * @param {Machine} m
 * @param {{ sampleRate?: number }} [o]
 */
export function mameArgs(m, { sampleRate = 48000 } = {}) {
  return [
    m.driver,
    '-rompath', '/roms',
    '-cfg_directory', '/cfg',
    '-noreadconfig',
    '-skip_gameinfo',
    '-window',
    '-nomaximize',
    '-nokeepaspect',
    '-resolution', `${m.screen.width}x${m.screen.height}`,
    '-video', 'accel',
    '-renderdriver', 'software',
    '-nothrottle',
    '-sound', 'js',
    '-samplerate', String(Math.round(sampleRate)),
    ...m.args,
  ];
}

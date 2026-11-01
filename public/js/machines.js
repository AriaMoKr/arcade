// The room's machines (README, "The machines"): what MAME runs for each, the files it reads, the
// command line it starts with, and the keys it takes. MAME itself is public/mame/arcade.js and
// .wasm (tools/build-mame.sh), which runs a machine in a frame of its own (mame-frame.js);
// emulator.js drives that frame from the page's. Pure, for the page, the machine's frame and the
// tests.

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
 * @property {Record<string, string>} keys a visitor's key (KeyboardEvent.code) and the key of MAME's
 *   it presses: MAME's own for the control it stands for (its default keys), a computer's own keys
 * @property {string} help those keys, in words
 */
/**
 * A file MAME reads: fetched from `url` (relative to public/mame/) and written to `path` in its file
 * system before it starts.
 * @typedef {object} MachineFile
 * @property {string} url
 * @property {string} path
 */

const ARROWS = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' };
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
    // The pad: MAME's A is Left Alt and its B Left Ctrl, Start 1 and Select 5.
    keys: { ...ARROWS, KeyX: 'AltLeft', KeyZ: 'ControlLeft', Enter: 'Digit1', ShiftLeft: 'Digit5', ShiftRight: 'Digit5' },
    help: 'Arrows: the pad · X: A · Z: B · Enter: Start · Shift: Select',
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
    // Its keyboard: CAPS SHIFT is Left Shift, SYMBOL SHIFT Right Shift.
    keys: KEYBOARD,
    help: 'Its keyboard: letters, digits, Enter and Space; Left Shift is CAPS SHIFT, Right Shift SYMBOL SHIFT',
  },
  {
    id: 'breakout',
    title: 'Breakout',
    maker: 'Atari',
    year: 1976,
    driver: 'breakout',
    files: [],
    args: [],
    screen: { width: 240, height: 320 },
    aspect: 3 / 4,
    // The paddle on ←/→, Serve MAME's Button 1 (Left Ctrl), Coin 5 and Start 1.
    keys: { ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Space: 'ControlLeft', Digit5: 'Digit5', Digit1: 'Digit1' },
    help: '5: a coin · 1: Start · ←/→: the paddle · Space: Serve',
  },
];

/** The machine with that id, or undefined. @param {string | null} id */
export function machineById(id) {
  return MACHINES.find((m) => m.id === id);
}

/**
 * MAME's command line for machine m: its driver, where its files are, a window the size of its
 * screen filled one pixel to one, drawn by SDL's software renderer (MAME's `soft` video isn't in
 * its web build: its SDL renderer, `accel`, with SDL's `software` driver, which puts each picture
 * on a 2D canvas), with no information or settings files in the way, never waiting on its own for
 * the time to catch up (the page paces it: emulator.js), and sound through Web Audio at
 * `sampleRate`.
 * @param {Machine} m
 * @param {{ sampleRate?: number }} [o]
 */
export function mameArgs(m, { sampleRate = 48000 } = {}) {
  return [
    m.driver,
    '-rompath', '/roms',
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

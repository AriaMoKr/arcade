// The computers' keyboards, as the room shows them (on a screen, screen-keys.js; in VR, the panel
// beside the machine, stands-scene.js) and presses them (play.js): each key's legends, on it and
// round it as on the machine, and the key of MAME's it presses. Pure, for the page and the tests.

/**
 * A key: what is printed on it and round it, and MAME's key it presses.
 * @typedef {object} Key
 * @property {string} code MAME's key it presses: a KeyboardEvent.code, as machines.js's keys give it
 * @property {string} label its own legend: 'P', '1', 'ENTER'
 * @property {string} [short] that legend where keys are small: 'CAPS' for 'CAPS SHIFT'
 * @property {string} [word] in white on it, under its legend: what a letter types in K mode (its
 *   keyword), what a digit or SPACE does with CAPS SHIFT
 * @property {string} [symbol] in red on it: what it types with SYMBOL SHIFT
 * @property {string} [ext] in green over it: what it types in E mode (a digit: its colour)
 * @property {string} [extSymbol] in red under it: what it types in E mode with SYMBOL SHIFT
 */
/**
 * A computer's keyboard.
 * @typedef {object} Keyboard
 * @property {Key[][]} rows its keys, row by row from the top, as many in each
 * @property {string[]} shifts MAME's keys of its shifts: pressed on a screen or on the panel, one stays
 *   down for the next key, and the two together are a key of their own (the Spectrum's E mode)
 * @property {{ caps: string[], symbol: string[], enter: string[], delete: string[] }} chords MAME's keys
 *   that a gamepad's or a VR controller's buttons press: its two shifts, ENTER, and DELETE
 */

/**
 * The ZX Spectrum 48K's: its forty rubber keys in four rows, each with what the Spectrum types for it
 * in each of its modes, as the keyboard and the case round it say (the ROM's own tables:
 * test/keyboards.test.js reads them). MAME's names for the keys (spectrum.cpp) give 8 and 9 under E
 * mode with SYMBOL SHIFT the other way round; the ROM gives POINT and CAT, as the case does.
 * @type {Keyboard}
 */
export const SPECTRUM = {
  rows: [
    [
      { code: 'Digit1', label: '1', word: 'EDIT', symbol: '!', ext: 'BLUE', extSymbol: 'DEF FN' },
      { code: 'Digit2', label: '2', word: 'CAPS LOCK', symbol: '@', ext: 'RED', extSymbol: 'FN' },
      { code: 'Digit3', label: '3', word: 'TRUE VIDEO', symbol: '#', ext: 'MAGENTA', extSymbol: 'LINE' },
      { code: 'Digit4', label: '4', word: 'INV. VIDEO', symbol: '$', ext: 'GREEN', extSymbol: 'OPEN #' },
      { code: 'Digit5', label: '5', word: '←', symbol: '%', ext: 'CYAN', extSymbol: 'CLOSE #' },
      { code: 'Digit6', label: '6', word: '↓', symbol: '&', ext: 'YELLOW', extSymbol: 'MOVE' },
      { code: 'Digit7', label: '7', word: '↑', symbol: "'", ext: 'WHITE', extSymbol: 'ERASE' },
      { code: 'Digit8', label: '8', word: '→', symbol: '(', extSymbol: 'POINT' },
      { code: 'Digit9', label: '9', word: 'GRAPHICS', symbol: ')', extSymbol: 'CAT' },
      { code: 'Digit0', label: '0', word: 'DELETE', symbol: '_', ext: 'BLACK', extSymbol: 'FORMAT' },
    ],
    [
      { code: 'KeyQ', label: 'Q', word: 'PLOT', symbol: '<=', ext: 'SIN', extSymbol: 'ASN' },
      { code: 'KeyW', label: 'W', word: 'DRAW', symbol: '<>', ext: 'COS', extSymbol: 'ACS' },
      { code: 'KeyE', label: 'E', word: 'REM', symbol: '>=', ext: 'TAN', extSymbol: 'ATN' },
      { code: 'KeyR', label: 'R', word: 'RUN', symbol: '<', ext: 'INT', extSymbol: 'VERIFY' },
      { code: 'KeyT', label: 'T', word: 'RAND', symbol: '>', ext: 'RND', extSymbol: 'MERGE' },
      { code: 'KeyY', label: 'Y', word: 'RETURN', symbol: 'AND', ext: 'STR$', extSymbol: '[' },
      { code: 'KeyU', label: 'U', word: 'IF', symbol: 'OR', ext: 'CHR$', extSymbol: ']' },
      { code: 'KeyI', label: 'I', word: 'INPUT', symbol: 'AT', ext: 'CODE', extSymbol: 'IN' },
      { code: 'KeyO', label: 'O', word: 'POKE', symbol: ';', ext: 'PEEK', extSymbol: 'OUT' },
      { code: 'KeyP', label: 'P', word: 'PRINT', symbol: '"', ext: 'TAB', extSymbol: '©' },
    ],
    [
      { code: 'KeyA', label: 'A', word: 'NEW', symbol: 'STOP', ext: 'READ', extSymbol: '~' },
      { code: 'KeyS', label: 'S', word: 'SAVE', symbol: 'NOT', ext: 'RESTORE', extSymbol: '|' },
      { code: 'KeyD', label: 'D', word: 'DIM', symbol: 'STEP', ext: 'DATA', extSymbol: '\\' },
      { code: 'KeyF', label: 'F', word: 'FOR', symbol: 'TO', ext: 'SGN', extSymbol: '{' },
      { code: 'KeyG', label: 'G', word: 'GO TO', symbol: 'THEN', ext: 'ABS', extSymbol: '}' },
      { code: 'KeyH', label: 'H', word: 'GO SUB', symbol: '↑', ext: 'SQR', extSymbol: 'CIRCLE' },
      { code: 'KeyJ', label: 'J', word: 'LOAD', symbol: '-', ext: 'VAL', extSymbol: 'VAL$' },
      { code: 'KeyK', label: 'K', word: 'LIST', symbol: '+', ext: 'LEN', extSymbol: 'SCREEN$' },
      { code: 'KeyL', label: 'L', word: 'LET', symbol: '=', ext: 'USR', extSymbol: 'ATTR' },
      { code: 'Enter', label: 'ENTER' },
    ],
    [
      { code: 'ShiftLeft', label: 'CAPS SHIFT', short: 'CAPS' },
      { code: 'KeyZ', label: 'Z', word: 'COPY', symbol: ':', ext: 'LN', extSymbol: 'BEEP' },
      { code: 'KeyX', label: 'X', word: 'CLEAR', symbol: '£', ext: 'EXP', extSymbol: 'INK' },
      { code: 'KeyC', label: 'C', word: 'CONT', symbol: '?', ext: 'LPRINT', extSymbol: 'PAPER' },
      { code: 'KeyV', label: 'V', word: 'CLS', symbol: '/', ext: 'LLIST', extSymbol: 'FLASH' },
      { code: 'KeyB', label: 'B', word: 'BORDER', symbol: '*', ext: 'BIN', extSymbol: 'BRIGHT' },
      { code: 'KeyN', label: 'N', word: 'NEXT', symbol: ',', ext: 'INKEY$', extSymbol: 'OVER' },
      { code: 'KeyM', label: 'M', word: 'PAUSE', symbol: '.', ext: 'PI', extSymbol: 'INVERSE' },
      { code: 'ShiftRight', label: 'SYMBOL SHIFT', short: 'SYM' },
      { code: 'Space', label: 'SPACE', word: 'BREAK' },
    ],
  ],
  shifts: ['ShiftLeft', 'ShiftRight'],
  chords: { caps: ['ShiftLeft'], symbol: ['ShiftRight'], enter: ['Enter'], delete: ['ShiftLeft', 'Digit0'] },
};

/**
 * The key of `keyboard` that presses MAME's `code`, or undefined.
 * @param {Keyboard | undefined} keyboard
 * @param {string} code
 */
export function keyByCode(keyboard, code) {
  if (!keyboard) return undefined;
  for (const row of keyboard.rows) for (const k of row) if (k.code === code) return k;
  return undefined;
}

// The computers' keyboards (keyboards.js): the Spectrum's legends are what its ROM types for each
// key in each mode, read from the ROM's own tables (The Complete Spectrum ROM Disassembly), and every
// key presses one of MAME's keys for it, once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECTRUM, keyByCode } from '../public/js/keyboards.js';
import { MACHINES, codesOf } from '../public/js/machines.js';

const rom = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'mame', 'roms', 'spectrum', 'spectrum.rom'));

// The ROM's keywords, from its token table (TKN-TABLE, 0x0095): each one's last letter has bit 7
// set; the first, '?', is no keyword, and RND is 0xA5.
const tokens = new Map();
{
  let at = 0x95, word = '';
  for (let code = 0xa4; code <= 0xff; at++) {
    word += String.fromCharCode(rom[at] & 0x7f);
    if (rom[at] & 0x80) {
      tokens.set(code++, word);
      word = '';
    }
  }
}
/** What the Spectrum shows for a code its tables hold: a keyword, else its own character (↑, £ and © where ASCII has ^, ` and DEL). */
const shown = (/** @type {number} */ c) => tokens.get(c) ?? ({ 0x5e: '↑', 0x60: '£', 0x7f: '©' })[c] ?? String.fromCharCode(c);
const table = (/** @type {number} */ at, /** @type {number} */ n) => [...rom.subarray(at, at + n)].map(shown);
// Letters A–Z: in E mode (E-UNSHIFT), in E mode with SYMBOL SHIFT (EXT-SHIFT), with SYMBOL SHIFT
// (SYM-CODES); digits 0–9 in E mode with SYMBOL SHIFT (E-DIGITS), and with CAPS SHIFT (CTL-CODES: the
// editor's controls, by name).
const E = table(0x22c, 26), EXT_SHIFT = table(0x246, 26), SYM = table(0x26a, 26), E_DIGITS = table(0x284, 10);
const CONTROLS = { 0x0c: 'DELETE', 0x07: 'EDIT', 0x06: 'CAPS LOCK', 0x04: 'TRUE VIDEO', 0x05: 'INV. VIDEO', 0x08: '←', 0x0a: '↓', 0x0b: '↑', 0x09: '→', 0x0f: 'GRAPHICS' };
const CAPS_DIGITS = [...rom.subarray(0x260, 0x26a)].map((c) => CONTROLS[/** @type {keyof typeof CONTROLS} */ (c)]);
// What a digit types with SYMBOL SHIFT and in E mode (the ROM works these out rather than keep a table).
const SYMBOL_DIGITS = ['_', '!', '@', '#', '$', '%', '&', "'", '(', ')'];
const COLOURS = ['BLACK', 'BLUE', 'RED', 'MAGENTA', 'GREEN', 'CYAN', 'YELLOW', 'WHITE', undefined, undefined];

test("the ROM's tables are where the disassembly says", () => {
  assert.equal(tokens.get(0xa5), 'RND');
  assert.equal(tokens.get(0xff), 'COPY');
  assert.deepEqual([E[0], EXT_SHIFT[0], SYM[0], E_DIGITS[0]], ['READ', '~', 'STOP', 'FORMAT']);
  assert.ok(CAPS_DIGITS.every(Boolean), String(CAPS_DIGITS));
});

test("the Spectrum's keys say what it types for each in each mode: its keyword, its symbol, and E mode's", () => {
  for (const row of SPECTRUM.rows) {
    for (const k of row) {
      const letter = /^Key([A-Z])$/.exec(k.code)?.[1];
      const digit = /^Digit([0-9])$/.exec(k.code)?.[1];
      if (letter) {
        const i = letter.charCodeAt(0) - 65;
        assert.equal(k.label, letter);
        // K mode: the letter's keyword (CONT and RAND as the key shortens them).
        const keyword = tokens.get(0xe6 + i);
        assert.ok(keyword?.startsWith(/** @type {string} */ (k.word)) && (k.word === keyword || /^(CONT|RAND)$/.test(k.word ?? '')), `${letter}: ${k.word}, not ${keyword}`);
        assert.equal(k.symbol, SYM[i], letter);
        assert.equal(k.ext, E[i], letter);
        assert.equal(k.extSymbol, EXT_SHIFT[i], letter);
      } else if (digit) {
        const d = Number(digit);
        assert.equal(k.label, digit);
        assert.equal(k.word, CAPS_DIGITS[d], digit);
        assert.equal(k.symbol, SYMBOL_DIGITS[d], digit);
        assert.equal(k.ext, COLOURS[d], digit);
        assert.equal(k.extSymbol, E_DIGITS[d], digit);
      }
    }
  }
  assert.equal(keyByCode(SPECTRUM, 'Digit8')?.extSymbol, 'POINT');
  assert.equal(keyByCode(SPECTRUM, 'Space')?.word, 'BREAK');
});

test("the Spectrum's forty keys, in its four rows of ten, each pressing MAME's key for it once", () => {
  assert.deepEqual(SPECTRUM.rows.map((r) => r.length), [10, 10, 10, 10]);
  const codes = SPECTRUM.rows.flat().map((k) => k.code);
  assert.equal(new Set(codes).size, 40);
  assert.deepEqual(SPECTRUM.rows.map((r) => r.map((k) => k.label[0]).join('')), ['1234567890', 'QWERTYUIOP', 'ASDFGHJKLE', 'CZXCVBNMSS']);
  for (const s of SPECTRUM.shifts) assert.ok(codes.includes(s), s);
  for (const chord of Object.values(SPECTRUM.chords)) for (const c of chord) assert.ok(codes.includes(c), c);
  // A visitor's keys press every one of them (machines.js), the same key for the same key.
  const spectrum = MACHINES.find((m) => m.keyboard === SPECTRUM);
  assert.ok(spectrum);
  for (const c of codes) assert.deepEqual(codesOf(spectrum.keys[c]), [c], c);
  assert.equal(keyByCode(SPECTRUM, 'Tab'), undefined);
});

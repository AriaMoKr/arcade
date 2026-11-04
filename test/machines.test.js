// The machines (machines.js) and what runs them (emulator.js, public/mame/): each with what MAME
// reads, served and with its licence beside it; MAME's command line; only the machine's own keys
// ever sent to MAME; and the steps paced at 60 a second whatever the display's rate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ID } from '../public/js/config.js';
import { MACHINES, RESET, buttonName, codesOf, machineButtons, machineById, machineCodes, mameArgs, oneButton } from '../public/js/machines.js';
import { keyOf, pace } from '../public/js/emulator.js';

const mame = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'mame');

test('each machine has an id of its own, a name, a maker and a year', () => {
  assert.equal(new Set(MACHINES.map((m) => m.id)).size, MACHINES.length);
  for (const m of MACHINES) {
    assert.match(m.id, ID, m.id);
    assert.ok(m.title && m.maker && m.help, m.id);
    assert.ok(Number.isInteger(m.year) && m.year > 1970 && m.year < 2000, m.id);
    assert.equal(machineById(m.id), m);
  }
  assert.equal(machineById('nothing'), undefined);
});

test("what MAME reads for each machine is served, under MAME's own folder, with its licence beside it", () => {
  for (const m of MACHINES) {
    for (const f of m.files) {
      assert.ok(!f.url.startsWith('/') && !f.url.includes('..'), f.url);
      assert.ok(existsSync(join(mame, f.url)), `${m.id}: ${f.url} is not in public/mame/`);
      assert.ok(existsSync(join(mame, dirname(f.url), 'README.md')), `${m.id}: no README.md beside ${f.url}`);
      assert.match(f.path, /^\/(roms|software|cfg)\//, f.path);
    }
  }
});

test('MAME is served with its licence, the texts it names, what Emscripten adds, and where its source is', () => {
  for (const f of ['arcade.js', 'arcade.wasm', 'COPYING.txt', 'legal/GPL-2.0.txt', 'legal/emscripten.txt']) {
    assert.ok(existsSync(join(mame, f)), `public/mame/${f}`);
  }
  const root = join(mame, '..', '..');
  const tag = readFileSync(join(root, 'tools', 'build-mame.sh'), 'utf8').match(/^TAG=(\S+)$/m)?.[1];
  assert.ok(tag, "build-mame.sh's TAG");
  const source = `https://github.com/mamedev/mame/tree/${tag}`;
  assert.ok(readFileSync(join(root, 'README.md'), 'utf8').includes(source), `the README links ${source}`);
  assert.ok(readFileSync(join(mame, 'test.html'), 'utf8').includes(source), `the test page links ${source}`);
});

test("MAME's command line: the machine, its screen one pixel to one, drawn by SDL in software, and Web Audio at the context's rate", () => {
  for (const m of MACHINES) {
    const args = mameArgs(m, { sampleRate: 44100 });
    assert.equal(args[0], m.driver);
    const value = (/** @type {string} */ o) => args[args.indexOf(o) + 1];
    assert.equal(value('-resolution'), `${m.screen.width}x${m.screen.height}`);
    assert.equal(value('-video'), 'accel');
    assert.equal(value('-renderdriver'), 'software');
    assert.equal(value('-sound'), 'js');
    assert.equal(value('-samplerate'), '44100');
    assert.equal(value('-rompath'), '/roms');
    assert.equal(value('-cfg_directory'), '/cfg');
    for (const o of ['-window', '-nokeepaspect', '-skip_gameinfo', '-noreadconfig', '-nothrottle']) assert.ok(args.includes(o), o);
    assert.deepEqual(args.slice(args.length - m.args.length), m.args);
  }
});

test("only the machine's own keys reach MAME, never one of MAME's own controls (Escape ends it, Tab opens its menu)", () => {
  const ui = new Set(['Escape', 'Tab', 'ScrollLock', 'Pause', 'Backquote', 'Insert', 'Delete', 'PageUp', 'PageDown', 'Home', 'End', ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`)]);
  for (const m of MACHINES) {
    for (const [from, to] of Object.entries(m.keys)) {
      assert.ok(codesOf(to).length > 0, `${m.id}: ${from} presses nothing`);
      for (const code of codesOf(to)) assert.ok(!ui.has(code), `${m.id}: ${from} would press ${code}`);
      assert.ok(!ui.has(from), `${m.id}: ${from} is the page's`);
    }
    for (const code of machineCodes(m)) assert.ok(!ui.has(code), `${m.id} takes ${code}`);
  }
});

test("a computer's keys are its keyboard's, and its card has Reset and Stop; a console's, its Start and its Select (where it has one) too (on a TV, its A, B and C, where it has them, and A and B are two)", () => {
  for (const m of MACHINES) {
    const codes = machineCodes(m);
    assert.equal(new Set(codes).size, codes.length);
    for (const to of Object.values(m.keys)) for (const code of codesOf(to)) assert.ok(codes.includes(code), code);
    if (m.keyboard) {
      for (const k of m.keyboard.rows.flat()) assert.ok(codes.includes(k.code), k.code);
      assert.ok(!m.pad, `${m.id}: a pad and a keyboard`);
      assert.deepEqual(machineButtons(m), ['reset', 'stop']);
      assert.deepEqual(machineButtons(m, true), ['reset', 'stop']);
    }
    const p = m.pad;
    if (p) {
      const own = ['select', 'start'].filter((id) => Object.hasOwn(p, id));
      const face = ['a', 'b', 'c'].filter((id) => Object.hasOwn(p, id));
      assert.deepEqual(machineButtons(m).slice(-2), ['reset', 'stop']);
      assert.deepEqual(machineButtons(m).slice(0, -2).sort(), own);
      assert.deepEqual(machineButtons(m, true).slice(-2), ['reset', 'stop']);
      assert.deepEqual(machineButtons(m, true).slice(0, -2).sort(), oneButton(m) ? own : [...face, ...own].sort());
    }
  }
  // Backspace and the arrows are the Spectrum's own: CAPS SHIFT with 0, and with 5 to 8.
  const spectrum = /** @type {import('../public/js/machines.js').Machine} */ (machineById('spectrum'));
  assert.deepEqual(codesOf(spectrum.keys.Backspace), ['ShiftLeft', 'Digit0']);
  assert.deepEqual(['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'].map((k) => codesOf(spectrum.keys[k])[1]), ['Digit5', 'Digit6', 'Digit7', 'Digit8']);
});

test("a console's pad presses MAME's keys for its controls (its four ways, A, B and Start, and C and Select where it has them; A and B one, where it has one button), its own keys among them; MAME's reset only the Reset button's", () => {
  const ui = new Set(['Escape', 'Tab', 'ScrollLock', 'Pause', 'Backquote', ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`)]);
  const consoles = MACHINES.filter((m) => m.pad);
  assert.ok(consoles.length > 0);
  for (const m of consoles) {
    const pad = /** @type {import('../public/js/machines.js').Pad} */ (m.pad);
    const names = Object.keys(pad);
    for (const control of ['up', 'down', 'left', 'right', 'a', 'b', 'start']) assert.ok(names.includes(control), `${m.id}: no ${control}`);
    for (const control of names) assert.ok(['up', 'down', 'left', 'right', 'a', 'b', 'c', 'select', 'start'].includes(control), `${m.id}: ${control}`);
    const controls = Object.entries(pad).filter(([control]) => !(control === 'b' && oneButton(m)));
    assert.equal(new Set(controls.map(([, code]) => code)).size, controls.length, `${m.id}: two controls press one key`);
    const own = new Set(Object.values(m.keys).flatMap(codesOf));
    for (const [control, code] of Object.entries(pad)) {
      assert.ok(!ui.has(code), `${m.id}: ${control} would press ${code}`);
      assert.ok(own.has(code), `${m.id}: ${control} presses ${code}, which none of its keys does`);
    }
  }
  assert.equal(RESET, 'F3');
  for (const m of MACHINES) assert.ok(!machineCodes(m).includes(RESET), `${m.id}: a key resets it`);
});

test("a console's buttons go by its own names: a Nintendo's A, B, Select and Start, the Vectrex's 1 to 4, in that order in the card", () => {
  const nes = /** @type {import('../public/js/machines.js').Machine} */ (machineById('nes'));
  assert.deepEqual(machineButtons(nes, true).map((id) => buttonName(nes, id)), ['Start', 'Select', 'A', 'B', 'Reset', 'Stop']);
  assert.deepEqual(machineButtons(nes).map((id) => buttonName(nes, id)), ['Start', 'Select', 'Reset', 'Stop']);
  assert.equal(buttonName(nes, 'play'), 'Play');
  const vectrex = /** @type {import('../public/js/machines.js').Machine} */ (machineById('vectrex'));
  assert.deepEqual(machineButtons(vectrex, true).map((id) => buttonName(vectrex, id)), ['1', '2', '3', '4', 'Reset', 'Stop']);
  assert.deepEqual(machineButtons(vectrex).map((id) => buttonName(vectrex, id)), ['1', '2', 'Reset', 'Stop']);
  // Each the button MAME numbers so, by its keys for them (MAME's defaults for buttons 1 to 4), and
  // the visitor's 1 to 4 the same; its stick the arrows.
  const BUTTONS = { 1: 'ControlLeft', 2: 'AltLeft', 3: 'Space', 4: 'ShiftLeft' };
  const pad = /** @type {import('../public/js/machines.js').Pad} */ (vectrex.pad);
  for (const [id, name] of Object.entries(vectrex.names ?? {})) assert.equal(pad[/** @type {keyof typeof pad} */ (id)], BUTTONS[/** @type {keyof typeof BUTTONS} */ (name)], `${id} (${name})`);
  for (const [n, code] of Object.entries(BUTTONS)) assert.equal(vectrex.keys[`Digit${n}`], code);
  assert.deepEqual([pad.up, pad.down, pad.left, pad.right], ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  // Its light pen's crosshair, which the arrows move too, never shown: its settings for MAME say so.
  const cfg = vectrex.files.find((f) => f.path === '/cfg/vectrex.cfg');
  assert.ok(cfg, "the Vectrex's settings for MAME");
  assert.match(readFileSync(join(mame, cfg.url), 'utf8'), /<system name="vectrex">\s*<crosshairs>\s*<crosshair player="0" mode="0" \/>/);
});

test("the Atari 2600's one fire button is a pad's A and B alike, its own switches its Select and Start, and the arrows move both its joysticks", () => {
  const atari = /** @type {import('../public/js/machines.js').Machine} */ (machineById('a2600'));
  assert.ok(oneButton(atari));
  for (const id of ['nes', 'thwaite', 'vectrex']) assert.ok(!oneButton(/** @type {import('../public/js/machines.js').Machine} */ (machineById(id))), id);
  // Its switches in the card as on the console, left to right; no A or B on a TV, where OK fires.
  assert.deepEqual(machineButtons(atari).map((id) => buttonName(atari, id)), ['Game Select', 'Game Reset', 'Reset', 'Stop']);
  assert.deepEqual(machineButtons(atari, true), machineButtons(atari));
  assert.equal(buttonName(atari, 'a'), 'Fire');
  // MAME's keys for them (a2600.cpp: GAME SELECT 1, GAME RESET 2; the joystick's button, player 1's
  // first, Left Ctrl), and the visitor's Enter and Shift as a Nintendo's Start and Select.
  const pad = /** @type {import('../public/js/machines.js').Pad} */ (atari.pad);
  assert.deepEqual([pad.a, pad.b, pad.select, pad.start], ['ControlLeft', 'ControlLeft', 'Digit1', 'Digit2']);
  assert.deepEqual([atari.keys.Enter, atari.keys.ShiftLeft, atari.keys.Space], ['Digit2', 'Digit1', 'ControlLeft']);
  // Its settings for MAME: the right-hand joystick, player 2's, on the arrows too.
  const cfg = atari.files.find((f) => f.path === '/cfg/a2600.cfg');
  assert.ok(cfg, "the Atari 2600's settings for MAME");
  const xml = readFileSync(join(mame, cfg.url), 'utf8');
  assert.match(xml, /<system name="a2600">/);
  for (const [i, dir] of ['UP', 'DOWN', 'LEFT', 'RIGHT'].entries()) {
    const mask = 1 << i;
    assert.match(xml, new RegExp(`<port tag=":joyport2:joy:JOY" type="P2_JOYSTICK_${dir}" mask="${mask}" defvalue="${mask}">\\s*<newseq type="standard">KEYCODE_${dir}</newseq>`), dir);
  }
});

test("the Mega Drive's pad has A, B and C and Start, and no Select: MAME's keys for them, and the visitor's Z, X, C and Enter", () => {
  const md = /** @type {import('../public/js/machines.js').Machine} */ (machineById('megadrive'));
  const pad = /** @type {import('../public/js/machines.js').Pad} */ (md.pad);
  // MAME's (megadriv.cpp's pad: A, B and C its buttons 1 to 3, Left Ctrl, Left Alt and Space; Start
  // its 1), and the visitor's keys for them, left to right as on the pad.
  assert.deepEqual([pad.a, pad.b, pad.c, pad.start, pad.select], ['ControlLeft', 'AltLeft', 'Space', 'Digit1', undefined]);
  assert.deepEqual([md.keys.KeyZ, md.keys.KeyX, md.keys.KeyC, md.keys.Enter], [pad.a, pad.b, pad.c, pad.start]);
  assert.ok(!oneButton(md));
  // In the card: Start, Reset and Stop; on a TV, whose OK is its A, its B and C too.
  assert.deepEqual(machineButtons(md).map((id) => buttonName(md, id)), ['Start', 'Reset', 'Stop']);
  assert.deepEqual(machineButtons(md, true).map((id) => buttonName(md, id)), ['Start', 'A', 'B', 'C', 'Reset', 'Stop']);
  // Japan's model, NTSC: 60 pictures a second, as the room paces its machines (Europe's is PAL, 50).
  assert.equal(md.driver, 'megadrij');
  assert.deepEqual(md.args, ['-cart', md.files[0].path]);
});

test("a key event's key for its code, as a US keyboard gives it", () => {
  assert.equal(keyOf('KeyA'), 'a');
  assert.equal(keyOf('Digit5'), '5');
  assert.equal(keyOf('Space'), ' ');
  assert.equal(keyOf('Enter'), 'Enter');
  assert.equal(keyOf('ArrowLeft'), 'ArrowLeft');
  assert.equal(keyOf('ControlLeft'), 'Control');
  assert.equal(keyOf('AltLeft'), 'Alt');
  assert.equal(keyOf('ShiftRight'), 'Shift');
});

test('MAME is stepped 60 times a second whatever the display, one step a frame at 60 Hz however its frames jitter', () => {
  /** Steps run over `seconds` of frames `ms` apart (each shifted by jitter(i)). */
  const run = (/** @type {number} */ ms, seconds = 10, jitter = (/** @type {number} */ _i) => 0) => {
    let owed = 0, steps = 0;
    const counts = [];
    for (let i = 0; i < (seconds * 1000) / ms; i++) {
      const p = pace(owed, ms + jitter(i) - jitter(i - 1));
      owed = p.owed;
      steps += p.run;
      counts.push(p.run);
    }
    return { steps, counts };
  };
  const at60 = run(1000 / 60, 10, (i) => (i % 3 === 0 ? 2 : i % 3 === 1 ? -2 : 0.5)); // ±2 ms
  assert.ok(at60.counts.every((n) => n === 1), 'one step each frame');
  for (const hz of [72, 90, 120, 30]) {
    const { steps, counts } = run(1000 / hz);
    assert.ok(Math.abs(steps - 600) <= 1, `${hz} Hz: ${steps} steps in 10 s`);
    assert.ok(Math.max(...counts) <= Math.ceil(60 / hz) + 1, `${hz} Hz: at most ${Math.max(...counts)} a frame`);
  }
  // Back after a while away: at most three steps, not the whole time owed.
  assert.equal(pace(0, 5000).run, 3);
});

test('the machine\'s frame and the test page load what they load by relative URLs (GitHub Pages: /arcade/mame/)', () => {
  for (const page of ['machine.html', 'test.html']) {
    const html = readFileSync(join(mame, page), 'utf8');
    const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|data:)/.test(u));
    const map = html.match(/<script type="importmap">(.*?)<\/script>/s);
    if (map) urls.push(.../** @type {string[]} */ (Object.values(JSON.parse(map[1]).imports)));
    for (const u of urls) assert.ok(!u.startsWith('/'), `${page}: ${u}`);
  }
});

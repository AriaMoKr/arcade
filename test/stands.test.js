// Where the machines stand (stands.js): each fits the room as config.js makes it, a ray meets it
// and its panel, one walks round it and not through it, the place to play it faces its screen, and
// its panel's buttons are a console's or a computer's keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM } from '../public/js/config.js';
import { MARGIN, castRay, clampWalk, layoutRoom } from '../public/js/room.js';
import { MACHINES, machineById } from '../public/js/machines.js';
import { STANDS, castStands, clampStands, layoutStands, panelLayout, standButtonAt, standProblems } from '../public/js/stands.js';

const L = layoutRoom(ROOM);
const S = layoutStands(L);
const hit = () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: false, piece: -1, stand: -1 });

test('the stands fit the room: on their walls, clear of the window, the doorway and each other', () => {
  assert.deepEqual(standProblems(L, MACHINES.map((m) => m.id)), []);
  // And it would say so if one didn't.
  const ids = MACHINES.map((m) => m.id);
  const inWindow = { ...STANDS[0], at: 0 };
  assert.match(standProblems(L, ids, [inWindow]).join('\n'), /in front of the window/);
  assert.match(standProblems(L, ['nothing'], STANDS).join('\n'), /no such machine/);
  const spectrum = /** @type {import('../public/js/stands.js').Stand} */ (STANDS.find((s) => s.machine === 'spectrum'));
  assert.match(standProblems(L, ids, [{ ...spectrum, panel: { ...spectrum.panel, y: [0.9, 1.2] } }]).join('\n'), /not the shape/);
  assert.match(standProblems(L, ids, [{ ...spectrum, keys: { a: [-0.64, -0.407], y: 0.9, d: [0.52, 0.664] } }]).join('\n'), /its keys are not/);
  assert.match(standProblems(L, ids, [{ ...spectrum, front: { a: 0, d: 0.3 } }]).join('\n'), /not somewhere to stand/);
});

test('each stand is for a machine with a pad or a keyboard to play it by, once', () => {
  assert.equal(new Set(STANDS.map((s) => s.machine)).size, STANDS.length);
  for (const s of STANDS) {
    const m = MACHINES.find((m) => m.id === s.machine);
    assert.ok(m?.pad || m?.keyboard, s.machine);
    // A computer's keys are drawn on it.
    assert.equal(!!s.keys, !!m?.keyboard, s.machine);
  }
});

test('a ray meets the stand nearer than the wall behind it, and its panel, with where on it', () => {
  for (const [i, s] of S.entries()) {
    const f = s.front;
    // From where one plays it, at the screen: the stand, before the wall.
    const out = hit();
    const dx = s.screen.x - f.x, dy = s.screen.y - 1.6, dz = s.screen.z - f.z;
    const wall = castRay(L, f.x, 1.6, f.z, dx, dy, dz, hit());
    assert.ok(wall);
    const got = castStands(S, f.x, 1.6, f.z, dx, dy, dz, out, wall.t);
    assert.ok(got, `${s.machine}: nothing met`);
    assert.equal(got.kind, 'machine');
    assert.equal(got.stand, i);
    assert.ok(got.t < wall.t);
    // Its normal faces back at the viewer.
    assert.ok(got.nx * dx + got.ny * dy + got.nz * dz < 0);
    // The panel: its middle is at (0.5, 0.5).
    const pa = (s.panel.a[0] + s.panel.a[1]) / 2, py = (s.panel.y[0] + s.panel.y[1]) / 2;
    const [px, , pz] = s.at(pa, py, s.panel.d);
    const p = castStands(S, f.x, 1.6, f.z, px - f.x, py - 1.6, pz - f.z, hit(), Infinity);
    assert.equal(p?.kind, 'stand-panel');
    assert.ok(Math.abs(p.u - 0.5) < 1e-9 && Math.abs(p.v - 0.5) < 1e-9, `${p.u}, ${p.v}`);
    // Away from it, nothing; and a nearer wall comes first.
    assert.equal(castStands(S, f.x, 1.6, f.z, -dx, dy, -dz, hit()), null);
    assert.equal(castStands(S, f.x, 1.6, f.z, dx, dy, dz, hit(), 0.1), null);
  }
});

test('one walks round a stand, not through it, and stands where it says to play it, facing the wall, its screen and its panel before one', () => {
  for (const [i, s] of S.entries()) {
    const f = s.foot, mid = { x: (f.x0 + f.x1) / 2, z: (f.z0 + f.z1) / 2 };
    const c = clampStands(S, mid.x, mid.z);
    assert.ok(c.x <= f.x0 - MARGIN + 1e-9 || c.x >= f.x1 + MARGIN - 1e-9 || c.z <= f.z0 - MARGIN + 1e-9 || c.z >= f.z1 + MARGIN - 1e-9, `${s.machine}: still in it`);
    // Out into the room, not into the wall.
    const r = clampWalk(L, c.x, c.z, c.x, c.z);
    assert.ok(Math.hypot(r.x - c.x, r.z - c.z) < 1e-9);
    // Where one plays: clear, where the stand says, facing the wall.
    const p = s.front;
    assert.deepEqual(clampStands(S, p.x, p.z), { x: p.x, z: p.z });
    const [fx, , fz] = s.at(STANDS[i].front.a, 0, STANDS[i].front.d);
    assert.ok(Math.hypot(p.x - fx, p.z - fz) < 1e-9, s.machine);
    const facing = [-Math.sin(p.yaw), -Math.cos(p.yaw)];
    assert.ok(Math.abs(facing[0] + s.nx) < 1e-9 && Math.abs(facing[1] + s.nz) < 1e-9, `${s.machine}: not facing the wall`);
    // The screen and the panel within 35° of straight ahead.
    const pa = (s.panel.a[0] + s.panel.a[1]) / 2;
    const [px, , pz] = s.at(pa, 0, s.panel.d);
    for (const [x, z] of [[s.screen.x, s.screen.z], [px, pz]]) {
      const to = [x - p.x, z - p.z];
      assert.ok(facing[0] * to[0] + facing[1] * to[1] > Math.cos((35 * Math.PI) / 180) * Math.hypot(...to), `${s.machine}: ${x}, ${z} is off to the side`);
    }
  }
});

test("a panel's buttons: Play while stopped; while it runs a console's Select, Start, Reset and Stop, a computer's Reset, Stop and keys; none overlapping, all on it", () => {
  for (const s of S) {
    const m = machineById(s.machine);
    const layout = s.buttons;
    assert.deepEqual(layout, panelLayout(m));
    for (const state of /** @type {const} */ (['stopped', 'running'])) {
      const buttons = layout[state];
      for (const [id, x0, y0, x1, y1] of buttons) {
        assert.ok(x0 >= 0 && y0 >= 0 && x1 <= layout.width && y1 <= layout.height, id);
        // Its middle finds it.
        const u = (x0 + x1) / 2 / layout.width, v = 1 - (y0 + y1) / 2 / layout.height;
        assert.equal(standButtonAt(layout, u, v, state === 'running'), id);
        for (const [other, a0, b0, a1, b1] of buttons) if (other !== id) assert.ok(x1 <= a0 || a1 <= x0 || y1 <= b0 || b1 <= y0, `${id} and ${other}`);
      }
    }
    assert.deepEqual(layout.stopped.map((b) => b[0]), ['play']);
    const running = layout.running.map((b) => b[0]);
    if (m?.keyboard) assert.deepEqual(running, ['reset', 'stop', ...m.keyboard.rows.flat().map((k) => `key:${k.code}`)]);
    else assert.deepEqual(running.sort(), ['reset', 'select', 'start', 'stop']);
    assert.equal(standButtonAt(layout, 0.005, 0.995, false), null);
  }
});

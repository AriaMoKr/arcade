// Where the machines stand (stands.js): each fits the room as config.js makes it, a ray meets it
// and its panel, one walks round it and not through it, and the place to play it faces its screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM } from '../public/js/config.js';
import { MARGIN, castRay, clampWalk, layoutRoom } from '../public/js/room.js';
import { MACHINES } from '../public/js/machines.js';
import { STANDS, STAND_BUTTONS, STAND_PANEL_PX, castStands, clampStands, layoutStands, standButtonAt, standProblems } from '../public/js/stands.js';

const L = layoutRoom(ROOM);
const S = layoutStands(L);
const hit = () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: false, piece: -1, stand: -1 });

test('the stands fit the room: on their walls, clear of the window, the doorway and each other', () => {
  assert.deepEqual(standProblems(L, MACHINES.map((m) => m.id)), []);
  // And it would say so if one didn't.
  const inWindow = { ...STANDS[0], at: 0 };
  assert.match(standProblems(L, MACHINES.map((m) => m.id), [inWindow]).join('\n'), /in front of the window/);
  assert.match(standProblems(L, ['spectrum'], STANDS).join('\n'), /no such machine/);
});

test('each stand is for a machine with a pad to play it by, once', () => {
  assert.equal(new Set(STANDS.map((s) => s.machine)).size, STANDS.length);
  for (const s of STANDS) assert.ok(MACHINES.find((m) => m.id === s.machine)?.pad, s.machine);
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

test("one walks round a stand, not through it, and stands in front of its screen to play it, facing it", () => {
  for (const s of S) {
    const f = s.foot, mid = { x: (f.x0 + f.x1) / 2, z: (f.z0 + f.z1) / 2 };
    const c = clampStands(S, mid.x, mid.z);
    assert.ok(c.x <= f.x0 - MARGIN + 1e-9 || c.x >= f.x1 + MARGIN - 1e-9 || c.z <= f.z0 - MARGIN + 1e-9 || c.z >= f.z1 + MARGIN - 1e-9, `${s.machine}: still in it`);
    // Out into the room, not into the wall.
    const r = clampWalk(L, c.x, c.z, c.x, c.z);
    assert.ok(Math.hypot(r.x - c.x, r.z - c.z) < 1e-9);
    // Where one plays: clear, a stand's distance from the screen, facing it.
    const p = s.front;
    assert.deepEqual(clampStands(S, p.x, p.z), { x: p.x, z: p.z });
    assert.ok(Math.abs(Math.hypot(p.x - s.screen.x, p.z - s.screen.z) - STANDS[S.indexOf(s)].distance) < 1e-9);
    const facing = [-Math.sin(p.yaw), -Math.cos(p.yaw)];
    const to = [s.screen.x - p.x, s.screen.z - p.z];
    assert.ok(facing[0] * to[0] + facing[1] * to[1] > 0.99 * Math.hypot(...to));
  }
});

test("the panel's buttons: Play while stopped; Select, Start, Reset and Stop while it runs, none overlapping, all on it", () => {
  for (const state of /** @type {const} */ (['stopped', 'running'])) {
    const buttons = STAND_BUTTONS[state];
    for (const [id, x0, y0, x1, y1] of buttons) {
      assert.ok(x0 >= 0 && y0 >= 0 && x1 <= STAND_PANEL_PX.width && y1 <= STAND_PANEL_PX.height, id);
      // Its middle finds it.
      const u = (x0 + x1) / 2 / STAND_PANEL_PX.width, v = 1 - (y0 + y1) / 2 / STAND_PANEL_PX.height;
      assert.equal(standButtonAt(u, v, state === 'running'), id);
      for (const [other, a0, b0, a1, b1] of buttons) if (other !== id) assert.ok(x1 <= a0 || a1 <= x0 || y1 <= b0 || b1 <= y0, `${id} and ${other}`);
    }
  }
  assert.deepEqual(STAND_BUTTONS.stopped.map((b) => b[0]), ['play']);
  assert.deepEqual(STAND_BUTTONS.running.map((b) => b[0]).sort(), ['reset', 'select', 'start', 'stop']);
  assert.equal(standButtonAt(0.01, 0.99, false), null);
});

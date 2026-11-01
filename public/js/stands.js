// Where the room's machines stand (README, "The machines"): each on the floor against a wall, its
// parts boxes a ray meets and a visitor walks round, its screen, a panel of its buttons on the wall
// beside it, and where to stand to play it. Pure, as room.js is, so the tests run it in Node; the
// page builds the stands from it (stands-scene.js) and asks it what a ray meets (controls.js).
//
// A stand is laid out in its wall's own terms: `a` along the wall, to the right facing it, from the
// stand's middle; `y` up from the floor; `d` out from the wall into the room. Metres.
import { MARGIN } from './room.js';

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
 *   on the wall
 * @property {number} distance how far in front of the screen one stands to play
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
    distance: 1.0,
    about: 'Concentration Room, a memory game',
  },
];

/**
 * The panel's canvas, and its buttons on it as [id, x0, y0, x1, y1] in canvas pixels (y down): Play
 * while the machine is stopped; while it runs, its own Select and Start, Reset, and Stop.
 */
export const STAND_PANEL_PX = { width: 480, height: 416 };
/** @type {{ stopped: [id: string, x0: number, y0: number, x1: number, y1: number][], running: [id: string, x0: number, y0: number, x1: number, y1: number][] }} */
export const STAND_BUTTONS = {
  stopped: [['play', 32, 118, 448, 196]],
  running: [
    ['select', 32, 118, 232, 184],
    ['start', 248, 118, 448, 184],
    ['reset', 32, 200, 232, 266],
    ['stop', 248, 200, 448, 266],
  ],
};

/**
 * The panel's button at (u, v) (0…1 from its bottom left, as castStands reports), or null.
 * @param {number} u
 * @param {number} v
 * @param {boolean} running
 */
export function standButtonAt(u, v, running) {
  const x = u * STAND_PANEL_PX.width, y = (1 - v) * STAND_PANEL_PX.height;
  for (const b of STAND_BUTTONS[running ? 'running' : 'stopped']) {
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
 * (facing the screen) and its panel.
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
    const m = MARGIN + 0.05;
    const fx = clamp(sc[0] + w.nx * s.distance, L.x0 + m, L.x1 - m), fz = clamp(sc[2] + w.nz * s.distance, L.z1 + m, -m);
    return {
      machine: s.machine, wall: s.wall, about: s.about, ...w, at, boxes, foot,
      screen: { x: sc[0], y: sc[1], z: sc[2], width: s.screen.width, height: s.screen.height },
      panel: s.panel,
      front: { x: fx, z: fz, yaw: Math.atan2(w.nx, w.nz) },
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
 * and of the others, with its screen on a face of its parts, its panel on the wall clear of them,
 * and the place to play it somewhere to stand.
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
    const c = clampStands(S, s.front.x, s.front.z);
    if (Math.hypot(c.x - s.front.x, c.z - s.front.z) > 1e-9 || s.front.x < L.x0 + MARGIN || s.front.x > L.x1 - MARGIN || s.front.z < L.z1 + MARGIN || s.front.z > -MARGIN) say('where one plays it is not somewhere to stand');
  });
  return problems;
}

// Moving about the room: common's Controls (common/controls.js), the walking the hallway, outside
// and the rooms share, on every device (its README's table): a drag to look, the keys, a click or a
// tap, a gamepad, a TV's remote (main.js gives it useMiddle, and sets aimMiddle), and in VR the hands
// and the sticks, with less motion, seated mode and the vignette's speeds. Here is the room's own:
//   its walls and what a ray meets: room.js's clampWalk and castRay on its layout, the hit with
//     where on the panel or a picture (u, v) and which piece (the `hit` option)
//   the control panel: a button pressed is onPanel(id), and the one pointed at hoverPanel
//   the pieces on the walls: one chosen is onPiece(i, how), the one pointed at hoverPiece, and a
//     hand's reticle on one is 1.3 times its size
//   the walks through the doorway (walkInto) and up to a piece (walkUpTo; in VR a teleport)
//   the machines' stands (stands.js): one walked round, not through; its machine chosen is
//     onMachine(i, how) and a button of its panel onStandButton(i, id), the stand pointed at
//     hoverStand and its button hoverStandButton; the walk up to it (walkUpToStand); a move away
//     from it (stand) is onStand, which stops the machine; and while one runs in VR, the hands'
//     sticks and buttons are its first (onHand)
// What a click, a tap, A, OK or a trigger is on comes to use(hit, how): the panel, the pieces and the
// stands here, and common's the doorway (onDoor) and the floor (a walk there, in VR a teleport).
import { Controls as Walking } from 'common/controls.js';
import { EYE, castRay, clampWalk, panelButtonAt, pieceFront } from './room.js';
import { castStands, clampStands, standButtonAt } from './stands.js';

/** @typedef {import('./stands.js').ArcadeHit} ArcadeHit */
/** @typedef {import('common/controls.js').How} How */
/** @typedef {import('common/controls.js').Hand<ArcadeHit>} Hand */

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Walking about the room, with its control panel, the pictures on its walls and the machines' stands.
 * @extends {Walking<ArcadeHit>}
 */
export class Controls extends Walking {
  /**
   * @param {Omit<import('common/controls.js').ControlsOptions<ArcadeHit>, 'eye' | 'hit'> & { layout: import('./room.js').Layout, stands: import('./stands.js').Stands }} options
   *   common's, the room's layout (room.js layoutRoom) and its stands (stands.js layoutStands)
   */
  constructor({ layout, stands, ...options }) {
    super({ ...options, eye: EYE, hit: () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: false, piece: -1, stand: -1 }) });
    this.layout = layout; // after super(): common's constructor calls none of the methods below
    this.stands = stands;
    /** The control panel's button pointed at, or null. @type {string | null} */
    this.hoverPanel = null;
    /** What hangs on the walls pointed at: its index in layout.pieces, else -1. */
    this.hoverPiece = -1;
    /** The stand pointed at (its machine or its panel), else -1; its panel's button, or null. */
    this.hoverStand = -1;
    /** @type {string | null} */
    this.hoverStandButton = null;
    /** (button id) when a button of the control panel is pressed. @type {(id: string) => void} */
    this.onPanel = () => {};
    /** (i, how) when piece i on a wall (layout.pieces) is chosen. @type {(i: number, how: How) => void} */
    this.onPiece = () => {};
    /** (i, how) when stand i's machine is chosen. @type {(i: number, how: How) => void} */
    this.onMachine = () => {};
    /** (i, id) when a button of stand i's panel is pressed. @type {(i: number, id: string) => void} */
    this.onStandButton = () => {};
    /** Whether stand i's machine runs, which its panel's buttons are. @type {(i: number) => boolean} */
    this.running = () => false;
    /** Before a move away: the machine running stops. */
    this.onStand = () => {};
    /** A hand's controller in VR, each frame: whether the machine running took it (its stick too). @type {(hand: Hand, pad: Gamepad, ax: number, ay: number) => boolean} */
    this.onHand = () => false;
  }

  /**
   * What a ray meets first in the room (room.js castRay), with u, v and piece, or a stand there
   * (stands.js castStands) when nearer.
   * @param {number} ox
   * @param {number} oy
   * @param {number} oz
   * @param {number} dx
   * @param {number} dy
   * @param {number} dz
   * @param {ArcadeHit} out
   */
  castRay(ox, oy, oz, dx, dy, dz, out) {
    out.stand = -1;
    const hit = castRay(this.layout, ox, oy, oz, dx, dy, dz, out) ? out : null;
    return castStands(this.stands, ox, oy, oz, dx, dy, dz, out, hit ? hit.t : Infinity) ?? hit;
  }

  /**
   * The room's walls (room.js clampWalk), the doorway between its jambs, and round the stands.
   * @param {number} fx
   * @param {number} fz
   * @param {number} x
   * @param {number} z
   * @param {{ x: number, z: number }} out
   */
  clampWalk(fx, fz, x, z, out) {
    const c = clampWalk(this.layout, fx, fz, x, z, out);
    return clampStands(this.stands, c.x, c.z, out);
  }

  /**
   * What could be used where a hit is: a panel button's id, 'piece', 'machine', a stand's panel's
   * button, or common's ('door').
   * @param {ArcadeHit | null} hit
   */
  usable(hit) {
    if (hit?.kind === 'panel') return panelButtonAt(hit.u, hit.v);
    if (hit?.kind === 'piece' || hit?.kind === 'machine') return hit.kind;
    if (hit?.kind === 'stand-panel') return standButtonAt(hit.u, hit.v, this.running(hit.stand));
    return super.usable(hit);
  }

  /**
   * Uses what a hit is on: a panel button, a piece on a wall, a stand's machine or its panel's
   * button, or common's (the doorway, the floor).
   * @param {ArcadeHit | null} hit
   * @param {How} how
   */
  use(hit, how) {
    if (hit?.kind === 'panel') this._press(panelButtonAt(hit.u, hit.v));
    else if (hit?.kind === 'piece') this.onPiece(hit.piece, how);
    else if (hit?.kind === 'machine') this.onMachine(hit.stand, how);
    else if (hit?.kind === 'stand-panel') {
      const id = standButtonAt(hit.u, hit.v, this.running(hit.stand));
      if (id) this.onStandButton(hit.stand, id);
    } else super.use(hit, how);
  }

  /**
   * @protected
   * @param {string | null} usable
   * @param {ArcadeHit | null} hit
   */
  _setHover(usable, hit) {
    super._setHover(usable, hit);
    this.hoverPanel = hit?.kind === 'panel' ? usable : null;
    this.hoverPiece = hit?.kind === 'piece' ? hit.piece : -1;
    this.hoverStand = hit?.kind === 'machine' || hit?.kind === 'stand-panel' ? hit.stand : -1;
    this.hoverStandButton = hit?.kind === 'stand-panel' ? usable : null;
  }

  /**
   * A hand's reticle on a piece or a machine; the rest as common's.
   * @param {string | null} use
   * @param {ArcadeHit} hit
   */
  reticleScale(use, hit) {
    return use === 'piece' || use === 'machine' ? 1.3 : super.reticleScale(use, hit);
  }

  /**
   * Walks up to the doorway and through it, facing it from the first step: the view goes on to the
   * Hallway (main.js) before the walk ends.
   */
  walkInto() {
    const p = this.rig.position;
    const jamb = this.layout.door.width / 2 - 0.25;
    /** @type {[number, number]} */
    const front = [clamp(p.x, -jamb, jamb), -1.0];
    /** @type {[number, number][]} */
    const points = p.z > -1.2 && Math.abs(p.x) < jamb ? [] : [front];
    points.push([front[0], this.layout.door.reveal]);
    this._startWalk(points, Math.PI, null, false);
  }

  /**
   * Walks up to piece i on a wall, to stand in front of it facing it, then done() (unless the walk
   * is taken over on the way); with less motion, there at once. In VR, a teleport there.
   * @param {number} i
   * @param {(() => void) | null} [done]
   */
  walkUpTo(i, done = null) {
    const f = pieceFront(this.layout, i);
    if (this.renderer.xr.isPresenting) {
      this._teleport(f.x, f.z);
      done?.();
      return;
    }
    this._startWalk([[f.x, f.z]], f.yaw, done);
  }

  /**
   * Walks up to stand i, to stand where one plays its machine, facing its screen and looking down at
   * it, then done() (unless the walk is taken over on the way); with less motion, there at once. In
   * VR, a teleport there, and done() once there.
   * @param {number} i
   * @param {(() => void) | null} [done]
   */
  walkUpToStand(i, done = null) {
    const f = this.stands[i].front;
    if (this.renderer.xr.isPresenting) {
      // done() after the teleport's move, which first gets up (stand) from whatever ran before.
      const site = this.onTeleport;
      this.onTeleport = (move) => {
        this.onTeleport = site;
        site(() => {
          move();
          done?.();
        });
      };
      this._teleport(f.x, f.z);
      return;
    }
    const rest = this.restPitch;
    this.restPitch = PLAY_PITCH;
    this._startWalk([[f.x, f.z]], f.yaw, () => {
      this.restPitch = rest;
      done?.();
    });
    if (!this.auto) this.restPitch = rest; // there already
  }

  /** Gets up before a move: the machine running stops (onStand); nothing to sit on here. */
  stand() {
    this.onStand();
    return super.stand();
  }

  /**
   * A hand's controller in VR: the machine running's first (onHand), else common's.
   * @param {Hand} hand
   * @param {Gamepad} pad
   * @param {number} ax
   * @param {number} ay
   * @param {number} dt
   */
  takeHand(hand, pad, ax, ay, dt) {
    return this.onHand(hand, pad, ax, ay) || super.takeHand(hand, pad, ax, ay, dt);
  }

  /**
   * Walking again after a machine has had the keys and the gamepad: no key held, and a gamepad's A
   * or B still held from playing isn't a press.
   */
  resume() {
    this.keys.clear();
    this._padUse = this._padBack = true;
  }

  /** @param {string | null} id a panel button's, or null where there is none */
  _press(id) {
    if (id) this.onPanel(id);
  }
}

/** How far down one looks at a machine's screen, walked up to it: at it. */
const PLAY_PITCH = -0.45;

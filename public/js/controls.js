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
// What a click, a tap, A, OK or a trigger is on comes to use(hit, how): the panel and the pieces
// here, and common's the doorway (onDoor) and the floor (a walk there, in VR a teleport).
import { Controls as Walking } from 'common/controls.js';
import { EYE, castRay, clampWalk, panelButtonAt, pieceFront } from './room.js';

/** @typedef {import('./room.js').RoomHit} RoomHit */
/** @typedef {import('common/controls.js').How} How */

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Walking about the room, with its control panel and the pictures on its walls.
 * @extends {Walking<RoomHit>}
 */
export class Controls extends Walking {
  /**
   * @param {Omit<import('common/controls.js').ControlsOptions<RoomHit>, 'eye' | 'hit'> & { layout: import('./room.js').Layout }} options
   *   common's, and the room's layout (room.js layoutRoom)
   */
  constructor({ layout, ...options }) {
    super({ ...options, eye: EYE, hit: () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: false, piece: -1 }) });
    this.layout = layout; // after super(): common's constructor calls none of the methods below
    /** The control panel's button pointed at, or null. @type {string | null} */
    this.hoverPanel = null;
    /** What hangs on the walls pointed at: its index in layout.pieces, else -1. */
    this.hoverPiece = -1;
    /** (button id) when a button of the control panel is pressed. @type {(id: string) => void} */
    this.onPanel = () => {};
    /** (i, how) when piece i on a wall (layout.pieces) is chosen. @type {(i: number, how: How) => void} */
    this.onPiece = () => {};
  }

  /**
   * What a ray meets first in the room (room.js castRay), with u, v and piece.
   * @param {number} ox
   * @param {number} oy
   * @param {number} oz
   * @param {number} dx
   * @param {number} dy
   * @param {number} dz
   * @param {RoomHit} out
   */
  castRay(ox, oy, oz, dx, dy, dz, out) {
    return castRay(this.layout, ox, oy, oz, dx, dy, dz, out);
  }

  /**
   * The room's walls (room.js clampWalk), and the doorway between its jambs.
   * @param {number} fx
   * @param {number} fz
   * @param {number} x
   * @param {number} z
   * @param {{ x: number, z: number }} out
   */
  clampWalk(fx, fz, x, z, out) {
    return clampWalk(this.layout, fx, fz, x, z, out);
  }

  /**
   * What could be used where a hit is: a panel button's id, 'piece', or common's ('door').
   * @param {RoomHit | null} hit
   */
  usable(hit) {
    if (hit?.kind === 'panel') return panelButtonAt(hit.u, hit.v);
    return hit?.kind === 'piece' ? 'piece' : super.usable(hit);
  }

  /**
   * Uses what a hit is on: a panel button, a piece on a wall, or common's (the doorway, the floor).
   * @param {RoomHit | null} hit
   * @param {How} how
   */
  use(hit, how) {
    if (hit?.kind === 'panel') this._press(panelButtonAt(hit.u, hit.v));
    else if (hit?.kind === 'piece') this.onPiece(hit.piece, how);
    else super.use(hit, how);
  }

  /**
   * @protected
   * @param {string | null} usable
   * @param {RoomHit | null} hit
   */
  _setHover(usable, hit) {
    super._setHover(usable, hit);
    this.hoverPanel = hit?.kind === 'panel' ? usable : null;
    this.hoverPiece = hit?.kind === 'piece' ? hit.piece : -1;
  }

  /**
   * A hand's reticle on a piece; the rest as common's.
   * @param {string | null} use
   * @param {RoomHit} hit
   */
  reticleScale(use, hit) {
    return use === 'piece' ? 1.3 : super.reticleScale(use, hit);
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

  /** @param {string | null} id a panel button's, or null where there is none */
  _press(id) {
    if (id) this.onPanel(id);
  }
}

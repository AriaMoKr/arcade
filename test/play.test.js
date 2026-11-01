// Playing a machine (play.js): the D-pad on a touch screen, which holds the way a finger points
// (two ways on a diagonal), and the picture placed as large as it goes at its aspect.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DPAD, dpadDirections, fitIn } from '../public/js/play.js';

test('a finger on the D-pad holds the way it points: one along an arrow, two on a diagonal, none in the middle', () => {
  const r = 60;
  assert.equal(dpadDirections(0, -40, r), DPAD.up);
  assert.equal(dpadDirections(0, 40, r), DPAD.down);
  assert.equal(dpadDirections(-40, 0, r), DPAD.left);
  assert.equal(dpadDirections(40, 0, r), DPAD.right);
  // Within 22.5° of an arrow, that arrow alone.
  assert.equal(dpadDirections(40, -15, r), DPAD.right);
  assert.equal(dpadDirections(-15, -40, r), DPAD.up);
  assert.equal(dpadDirections(30, -30, r), DPAD.up | DPAD.right);
  assert.equal(dpadDirections(-30, 30, r), DPAD.down | DPAD.left);
  assert.equal(dpadDirections(-30, -30, r), DPAD.up | DPAD.left);
  assert.equal(dpadDirections(30, 30, r), DPAD.down | DPAD.right);
  assert.equal(dpadDirections(3, -4, r), 0);
  // Off the pad, still the way it points (the finger slides off it, held).
  assert.equal(dpadDirections(0, -200, r), DPAD.up);
});

test('the picture is as large as it goes at its aspect, in the middle of its space, and nothing where there is none', () => {
  assert.deepEqual(fitIn(0, 0, 400, 300, 4 / 3), { x: 0, y: 0, width: 400, height: 300 });
  // Wide: as high as the space, in its middle across.
  assert.deepEqual(fitIn(100, 0, 900, 300, 4 / 3), { x: 300, y: 0, width: 400, height: 300 });
  // Tall: as wide, in its middle down.
  assert.deepEqual(fitIn(0, 100, 400, 700, 4 / 3), { x: 0, y: 250, width: 400, height: 300 });
  const none = fitIn(500, 0, 400, 300, 4 / 3);
  assert.equal(none.width, 0);
  assert.equal(none.height, 0);
  assert.equal(fitIn(0, 300, 400, 200, 4 / 3).width, 0);
});

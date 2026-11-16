/**
 * lib/character-framing.ts: one scale for every character, a bigger frame for
 * what they hold.
 *
 * The viewer used to back the camera off until the whole model fit, so a
 * player holding a scythe was drawn at about 60% of the size of the same
 * player unarmed (reported 2026-11-16). These pin the replacement: the camera
 * does not move for a weapon or a pet, the frame grows instead and still holds
 * every corner, and only something absurd makes the camera step back.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BASE_FOV,
  MAX_GROWTH,
  REFERENCE_HEIGHT,
  frameCharacter,
  type Bounds,
} from "../lib/character-framing";

const ASPECT = 400 / 600;
const TURN = Math.PI * 0.18;
const UNIT = 1 / 128;

/** Bounds in game units, as measured off real uploads. */
function units(min: [number, number, number], max: [number, number, number]): Bounds {
  return {
    min: { x: min[0] * UNIT, y: min[1] * UNIT, z: min[2] * UNIT },
    max: { x: max[0] * UNIT, y: max[1] * UNIT, z: max[2] * UNIT },
  };
}

const UNARMED = units([-44, -8, -39], [38, 194, 31]);
const SCYTHE = units([-66, -13, -38], [38, 242, 127]);

/** Whether every corner of the box is inside the grown frame, at every turn asked for. */
function holds(bounds: Bounds, turns: number[]): boolean {
  const f = frameCharacter(bounds, ASPECT, TURN, turns.length > 1);
  const tanV = Math.tan((f.fov * Math.PI) / 360);
  const tanH = Math.tan((BASE_FOV * Math.PI) / 360) * ASPECT * f.growX;
  for (const turn of turns) {
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const depth = f.distance - (-x * Math.sin(turn) + z * Math.cos(turn));
          const across = Math.abs(x * Math.cos(turn) + z * Math.sin(turn)) / depth;
          const up = Math.abs(y - f.lookAtY) / depth;
          if (across > tanH || up > tanV) return false;
        }
      }
    }
  }
  return true;
}

const EVERY_TURN = Array.from({ length: 360 }, (_, i) => (i * Math.PI) / 180);

test("a lone character gets the base frame", () => {
  for (const spin of [false, true]) {
    const f = frameCharacter(UNARMED, ASPECT, TURN, spin);
    assert.equal(f.growX, 1);
    assert.equal(f.growY, 1);
    assert.equal(f.fov, BASE_FOV);
    assert.equal(f.lookAtY, REFERENCE_HEIGHT / 2);
  }
});

test("a scythe does not move the camera: the frame grows instead", () => {
  const unarmed = frameCharacter(UNARMED, ASPECT, TURN, true);
  const scythe = frameCharacter(SCYTHE, ASPECT, TURN, true);
  assert.equal(scythe.distance, unarmed.distance);
  assert.equal(scythe.lookAtY, unarmed.lookAtY);
  assert.ok(scythe.growX > 1.1 && scythe.growX < 1.4, `growX ${scythe.growX}`);
  // Its blade swings near the camera as it turns, which costs a little height too.
  assert.ok(scythe.growY >= 1 && scythe.growY < 1.1, `growY ${scythe.growY}`);
});

test("the grown frame holds the whole model at every turn", () => {
  assert.ok(holds(SCYTHE, EVERY_TURN));
  assert.ok(holds(UNARMED, EVERY_TURN));
});

test("a still only has to hold the pose it is drawn at", () => {
  const still = frameCharacter(SCYTHE, ASPECT, TURN, false);
  const spinning = frameCharacter(SCYTHE, ASPECT, TURN, true);
  assert.ok(still.growX < spinning.growX);
  assert.ok(holds(SCYTHE, [TURN]));
});

test("something held far overhead makes the frame taller", () => {
  const banner = units([-40, -8, -40], [40, 420, 40]);
  const f = frameCharacter(banner, ASPECT, TURN, false);
  assert.ok(f.growY > 1 && f.fov > BASE_FOV);
  assert.equal(f.growX, 1);
  assert.ok(holds(banner, [TURN]));
});

test("a player and a pet side by side widen the frame without shrinking the player", () => {
  const pair = units([-150, -8, -45], [150, 200, 45]);
  const f = frameCharacter(pair, ASPECT, TURN, true);
  assert.equal(f.distance, frameCharacter(UNARMED, ASPECT, TURN, true).distance);
  assert.ok(f.growX > 1);
  assert.ok(holds(pair, EVERY_TURN));
});

test("past the limit the camera backs off and still holds everything", () => {
  const huge = units([-900, -8, -900], [900, 1500, 900]);
  for (const spin of [false, true]) {
    const f = frameCharacter(huge, ASPECT, TURN, spin);
    assert.ok(f.distance > frameCharacter(UNARMED, ASPECT, TURN, spin).distance);
    assert.ok(f.growX <= MAX_GROWTH && f.growY <= MAX_GROWTH);
    assert.ok(holds(huge, spin ? EVERY_TURN : [TURN]));
  }
});

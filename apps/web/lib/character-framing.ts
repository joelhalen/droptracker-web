/**
 * How the character viewer frames a model.
 *
 * Every character is drawn at one scale: the camera sits where a player of
 * {@link REFERENCE_HEIGHT} fills the base frame the way a lone character
 * always has, and it does not move for what they are holding. A scythe, a
 * banner or a pet that would not fit is given a bigger frame instead (a wider
 * or taller canvas at the same pixels per tile), so nothing is cut off and the
 * character is not shrunk to make room.
 *
 * The camera used to back off until the whole bounding box fit, which drew a
 * player holding a scythe at about 60% of the size of the same player
 * unarmed.
 *
 * Pure geometry, no three.js, so it can be tested without a canvas.
 */

/** A standing player, in tiles (models are exported at 1/128: about 200 game units). */
export const REFERENCE_HEIGHT = 200 / 128;

/** Vertical field of view of the base frame, in degrees. */
export const BASE_FOV = 35;

/** The base frame is this many reference heights tall, leaving room above and below. */
const FILL = 1.9;

/** Breathing room around whatever makes the frame grow. */
const PADDING = 1.05;

/** A frame never grows past this; beyond it the camera finally backs off. */
export const MAX_GROWTH = 2;

export type Bounds = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

export type Framing = {
  /** Camera distance from the turning axis, in tiles. */
  distance: number;
  /** Height above the ground the camera looks at: the middle of a standing player. */
  lookAtY: number;
  /** Vertical field of view for the grown frame, in degrees. */
  fov: number;
  /** How much wider and taller than the base frame the canvas must be (1 = base). */
  growX: number;
  growY: number;
};

/**
 * @param bounds the model's box with the ground at y = 0 and the turning axis
 *   at x = z = 0, which is how a player is exported.
 * @param aspect width / height of the base frame.
 * @param rotationY the turn the model is drawn at, in radians.
 * @param spin whether it keeps turning: the frame then has to hold the whole
 *   circle the model sweeps, not just its pose at `rotationY`.
 */
export function frameCharacter(
  bounds: Bounds,
  aspect: number,
  rotationY: number,
  spin: boolean,
): Framing {
  const tanHalf = Math.tan((BASE_FOV * Math.PI) / 360);
  const lookAtY = REFERENCE_HEIGHT / 2;
  let distance = ((REFERENCE_HEIGHT / 2) / tanHalf) * FILL;

  const { min, max } = bounds;
  const up = Math.max(Math.abs(max.y - lookAtY), Math.abs(min.y - lookAtY));

  // The tangents of the half angles the model needs, seen from `d`.
  const needs = (d: number): [number, number] => {
    if (spin) {
      // Turning sweeps the farthest corner round the axis. Seen from the
      // camera the circle is widest along its tangent, and tallest where it
      // comes nearest.
      const reach = Math.hypot(
        Math.max(Math.abs(min.x), Math.abs(max.x)),
        Math.max(Math.abs(min.z), Math.abs(max.z)),
      );
      if (reach >= d) return [Infinity, Infinity];
      return [reach / Math.sqrt(d * d - reach * reach), up / (d - reach)];
    }
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    let across = 0;
    let nearest = 0;
    for (const x of [min.x, max.x]) {
      for (const z of [min.z, max.z]) {
        const depth = d - (-x * sin + z * cos);
        if (depth <= 0) return [Infinity, Infinity];
        across = Math.max(across, Math.abs(x * cos + z * sin) / depth);
        nearest = Math.max(nearest, up / depth);
      }
    }
    return [across, nearest];
  };

  const grow = (d: number): [number, number] => {
    const [across, tall] = needs(d);
    return [(across * PADDING) / (tanHalf * aspect), (tall * PADDING) / tanHalf];
  };

  let [growX, growY] = grow(distance);
  // Something enormous: stop growing the frame and step back after all.
  // Perspective makes the need fall faster than the distance grows, so a few
  // rounds settle it from above.
  for (let i = 0; i < 8 && Math.max(growX, growY) > MAX_GROWTH; i++) {
    const over = Math.max(growX, growY) / MAX_GROWTH;
    distance = Number.isFinite(over) ? distance * over : distance * 2;
    [growX, growY] = grow(distance);
  }
  growX = Math.min(MAX_GROWTH, Math.max(1, growX));
  growY = Math.min(MAX_GROWTH, Math.max(1, growY));

  return {
    distance,
    lookAtY,
    fov: (Math.atan(tanHalf * growY) * 360) / Math.PI,
    growX,
    growY,
  };
}

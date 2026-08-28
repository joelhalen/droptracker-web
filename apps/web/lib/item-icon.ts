/**
 * Detecting the "we could not produce this icon" response.
 *
 * The image server answers a missing item icon with a 1x1 transparent PNG at
 * HTTP 404 (see `web/front.py::_missing_item_icon`). An `<img>` cannot read a
 * status code or a response header, and a browser that successfully decodes the
 * body fires `load`, not `error` — so neither the status nor the
 * `X-DT-Placeholder` header is reachable from the DOM. The body itself has to
 * carry the signal, and its intrinsic size is the part of the body the DOM
 * exposes.
 *
 * 1x1 is unambiguous: every real OSRS item sprite is 36x32.
 */

/** Intrinsic width/height of the placeholder the image server returns. */
export const PLACEHOLDER_INTRINSIC_SIZE = 1;

type IntrinsicSize = { naturalWidth?: number; naturalHeight?: number };

/**
 * Whether a loaded image is the server's placeholder rather than a real icon.
 *
 * Returns false while the image is still loading (both dimensions are 0), so a
 * caller can run this from `onLoad` without special-casing that.
 */
export function isPlaceholderIcon(image: IntrinsicSize | null | undefined): boolean {
  if (!image) return false;
  const { naturalWidth, naturalHeight } = image;
  return (
    naturalWidth === PLACEHOLDER_INTRINSIC_SIZE &&
    naturalHeight === PLACEHOLDER_INTRINSIC_SIZE
  );
}

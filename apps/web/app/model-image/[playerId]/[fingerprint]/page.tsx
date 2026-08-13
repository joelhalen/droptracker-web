import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { CharacterModel } from "@/components/character-model";

/**
 * Chrome-less render of a player's character model, sized for the screenshot
 * that services/gear_image.py points a Discord embed at.
 *
 * Mounts the SAME `CharacterModel` the profile viewer uses, so the posted image
 * cannot drift from the page it links to — the guarantee /recap-image and
 * /board-image already give for their artifacts.
 *
 * Gated by `?k=<token>` matching BOARD_IMAGE_TOKEN, for the same reason as the
 * recap route: nothing here is secret, the token just keeps an un-styled
 * internal page from being crawled or hotlinked.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Keep in sync with MODEL_IMAGE_WIDTH / HEIGHT in services/gear_image.py.
const WIDTH = 400;
const HEIGHT = 600;

/**
 * Models are served through our own origin rather than fetched from the image
 * host directly. `fetch` is subject to CORS, and the page drawing a model is
 * not always same-origin with the images — headless chromium points at the Next
 * server, the Activity runs in an iframe, and group sites live on their own
 * subdomains. Going through the app makes all of those cases identical.
 */
const MODEL_BASE = "/api/models";

/** Hex, as written by the plugin — and never interpolated into a path unchecked. */
const FINGERPRINT_RE = /^[0-9a-f]{1,32}$/;

type Params = Promise<{ playerId: string; fingerprint: string }>;
type Search = Promise<{ k?: string; pet?: string }>;

export default async function ModelImagePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { playerId, fingerprint } = await params;
  const { k, pet } = await searchParams;

  const token = env.boardImageToken;
  const id = Number(playerId);

  if (!token || !k || k !== token) notFound();
  if (!Number.isFinite(id) || id <= 0) notFound();
  if (!FINGERPRINT_RE.test(fingerprint)) notFound();

  const src = `${MODEL_BASE}/${id}/${fingerprint}`;
  const petSrc = pet === "1" ? `${MODEL_BASE}/${id}/${fingerprint}-pet` : null;

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        // Transparent so the capture composites cleanly; the screenshot service
        // fills nothing behind it.
        background: "transparent",
        margin: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CharacterModel
        src={src}
        petSrc={petSrc}
        width={WIDTH}
        height={HEIGHT}
        spin={false}
        signalReady
      />
    </div>
  );
}

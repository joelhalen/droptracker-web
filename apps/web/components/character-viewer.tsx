"use client";

/**
 * The interactive character on a player profile.
 *
 * Wraps the same renderer the Discord still uses, so the two can never show
 * different things. Client-only and lazily mounted: three.js is a large
 * dependency and a profile with no uploaded model should not pay for it.
 *
 * Deliberately renders no card of its own — it sits inside the profile's
 * Account window, which supplies the framing. It draws responsively, capped by
 * `maxWidth`: the model used to be a fixed 260x390 box, which overflowed its
 * container on a phone and made the character look off-centre.
 */
import dynamic from "next/dynamic";

/** Portrait, matching the old fixed 260x390 box. */
export const CHARACTER_ASPECT = 260 / 390;

const CharacterModel = dynamic(
  () => import("@/components/character-model").then((m) => m.CharacterModel),
  {
    ssr: false,
    // Same box the canvas will occupy, so nothing below it jumps on load.
    loading: () => <div style={{ width: "100%", aspectRatio: String(CHARACTER_ASPECT) }} />,
  },
);

export function CharacterViewer({
  playerId,
  fingerprint,
  hasPet = false,
  maxWidth = 200,
}: {
  playerId: number;
  fingerprint: string;
  hasPet?: boolean;
  /** Upper bound in px. Keeps the model from dominating a wide phone screen. */
  maxWidth?: number;
}) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth }}>
      <CharacterModel
        src={`/api/models/${playerId}/${fingerprint}`}
        petSrc={hasPet ? `/api/models/${playerId}/${fingerprint}-pet` : null}
        responsive
        aspect={CHARACTER_ASPECT}
        spin
      />
    </div>
  );
}

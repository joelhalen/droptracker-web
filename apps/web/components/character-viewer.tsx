"use client";

/**
 * The interactive character on a player profile.
 *
 * Wraps the same renderer the Discord still uses, so the two can never show
 * different things. Client-only and lazily mounted: three.js is a large
 * dependency and a profile with no uploaded model should not pay for it.
 */
import dynamic from "next/dynamic";
import { Card } from "@/components/ui";

const CharacterModel = dynamic(
  () => import("@/components/character-model").then((m) => m.CharacterModel),
  {
    ssr: false,
    loading: () => <div style={{ width: 260, height: 390 }} />,
  },
);

export function CharacterViewer({
  playerId,
  fingerprint,
  hasPet = false,
}: {
  playerId: number;
  fingerprint: string;
  hasPet?: boolean;
}) {
  return (
    <Card padding="p-4">
      <h3 className="text-osrs-parchment-dark/60 mb-2 text-xs tracking-wide uppercase">
        Character
      </h3>
      <CharacterModel
        src={`/api/models/${playerId}/${fingerprint}`}
        petSrc={hasPet ? `/api/models/${playerId}/${fingerprint}-pet` : null}
        width={260}
        height={390}
        spin
      />
    </Card>
  );
}

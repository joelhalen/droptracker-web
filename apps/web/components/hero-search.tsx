"use client";

/**
 * Homepage hero search: the shared live-search combobox (entity-search.tsx)
 * in its large hero styling. Kept as its own export so the homepage and
 * test-hero read as "the hero search" rather than a bag of props.
 */
import { EntitySearch } from "@/components/entity-search";

export function HeroSearch() {
  return (
    <EntitySearch
      size="lg"
      withButton
      className="max-w-xl"
      placeholder="Find a player, clan, boss or item…"
    />
  );
}

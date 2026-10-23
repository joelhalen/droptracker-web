"use client";

import { useState, useTransition } from "react";
import type { RepostBoard } from "@droptracker/api-types";
import { Button } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import { repostGroupBoard } from "@/app/(site)/(admin)/groups/[id]/settings/actions";

/**
 * Re-post board. Stands in for the board's message id, which the bot manages
 * itself and the editor no longer shows (ConfigField.managed): the bot forgets
 * the old message, removes it if it posted it, and posts a fresh board in the
 * board's channel on its next pass. Rendered at the bottom of the board's
 * settings section, styled like one of its fields.
 */
export function BoardRepostPanel({
  groupId,
  board,
  name,
}: {
  groupId: number;
  board: RepostBoard;
  /** "lootboard", "PvP lootboard", "Clan Log" */
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onRepost() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      try {
        await repostGroupBoard(groupId, board);
        setDone(true);
      } catch (err) {
        setError(getErrorMessage(err, `Couldn't re-post the ${name}. Please try again.`));
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Re-post the {name}</span>
          <span className="text-osrs-parchment-dark/60 block text-xs">
            Missing, or not updating? The bot posts a fresh one in its channel within a minute or
            two, and removes its old one.
          </span>
        </div>
        <Button variant="secondary" size="sm" type="button" disabled={pending} onClick={onRepost}>
          {pending ? "Working…" : "Re-post"}
        </Button>
      </div>
      {done && (
        <p className="text-osrs-green mt-3 text-sm">Done. The new {name} will appear shortly.</p>
      )}
      {error && <p className="text-osrs-red mt-3 text-sm">{error}</p>}
    </div>
  );
}

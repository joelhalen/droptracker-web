/**
 * What a participant sees in place of the board and task list on an event
 * whose organisers keep the tasks to themselves (web112a, `tasks_hidden`).
 *
 * Pure markup, server- and client-safe, so the site page, the Activity and
 * the team page can all mount it. Deliberately not an `EmptyState`: "No tasks
 * yet" would be a lie — the tasks exist, this viewer just isn't shown them —
 * and the draft banner's amber notice is the site's idiom for "this content
 * is in an unusual state, here's why".
 */
export function HiddenBoardNotice({
  /** Trim the copy for the Activity's narrow column. */
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className="border-osrs-gold/30 bg-osrs-gold/10 text-osrs-parchment-dark/90 rounded border px-3 py-2 text-sm"
      role="note"
    >
      <span className="text-osrs-gold-bright font-medium">The board is hidden.</span>{" "}
      The organisers are keeping this event&apos;s tasks to themselves
      {compact
        ? " — you'll be told what you've completed as it happens."
        : ". Play as you normally would: your team's completions still count, you'll be notified as they land, and the standings above are live. Event admins and managers can see the full board."}
    </div>
  );
}

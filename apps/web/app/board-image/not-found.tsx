/*
 * Chrome-less 404 for the board-image export route. `[id]/page.tsx` calls
 * notFound() on a bad render token, a missing event, or an event with no board
 * — and without this boundary those bubble to the root `app/not-found.tsx`,
 * which wraps itself in SiteChrome. That would drop a live ticker, header and
 * footer into a page whose only consumer is the Discord bot's 1100px
 * screenshot. Keep this bare so a failed export screenshots as a plain card.
 */
export default function BoardImageNotFound() {
  return (
    <div className="p-10 text-center">
      <p className="text-osrs-parchment-dark/80">Board unavailable.</p>
    </div>
  );
}

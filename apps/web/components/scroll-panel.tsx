/**
 * OSRS news-style parchment scroll container (see .scroll-backdrop in
 * globals.css). Content inside sits on light parchment art, so use the
 * ink-* helper classes (and `Markdown tone="ink"`) for text — the site's
 * dark-theme text utilities are unreadable here.
 */
export function ScrollPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`scroll-backdrop ${className}`}>{children}</div>;
}

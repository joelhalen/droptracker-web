/**
 * A personal-best time as text. A time set with precise timing off is only
 * whole seconds, so the server counts it as the slowest game tick it could
 * be and flags it `approximate`; it shows with a leading "~".
 */
export function PbTime({
  display,
  approximate,
}: {
  display: string;
  approximate?: boolean;
}) {
  if (!approximate) return <>{display}</>;
  return (
    <span title="Set with precise timing off, so this is rounded. Turn on precise timing in game for exact times.">
      ~{display}
    </span>
  );
}

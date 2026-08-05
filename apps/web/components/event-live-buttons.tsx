import Link from "next/link";
import type { EventSummary } from "@droptracker/api-types";

/** Glowing quick links back into the viewer's clan events, shown above the
 * Active section on /events. Input is already picked/ordered/capped by
 * `pickYourEventButtons` — this component is purely presentational. */
export function EventLiveButtons({ events }: { events: EventSummary[] }) {
  if (!events.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {events.map((e) => {
        const live = e.status === "active";
        return (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className={
              live
                ? "border-osrs-gold text-osrs-gold-bright rounded-md border bg-gradient-to-b from-[#3a2f1a] to-[#241f16] px-5 py-2.5 font-semibold shadow-[0_0_14px_3px_color-mix(in_srgb,var(--dt-gold)_45%,transparent)] transition-transform hover:scale-[1.02] motion-safe:animate-[event-glow-pulse_2.2s_ease-in-out_infinite]"
                : "border-osrs-gold/60 text-osrs-gold rounded-md border bg-gradient-to-b from-[#2d2718] to-[#241f16] px-5 py-2.5 font-semibold shadow-[0_0_9px_1px_color-mix(in_srgb,var(--dt-gold)_30%,transparent)] transition-transform hover:scale-[1.02]"
            }
          >
            {live ? <>⚡ Live: {e.name}</> : <>Upcoming: {e.name}</>} →
          </Link>
        );
      })}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { entityPath } from "@/lib/slug";
import { getUser } from "@/lib/auth";
import { orNotFound } from "@/lib/fetch";
import { EventWindow, LocalTime } from "@/components/local-time";
import { teamColorMap } from "@/lib/events";
import { BingoBoard } from "@/components/bingo-board";
import { EventJoinPanel } from "@/components/event-join-panel";
import { EventTaskBoard } from "@/components/event-task-progress";
import { EmptyState } from "@/components/ui";

export const revalidate = 30;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  try {
    const event = await api.event(Number(id));
    return { title: event.name, description: event.description };
  } catch {
    return { title: "Event" };
  }
}

const STATUS_STYLES: Record<string, string> = {
  draft: "text-osrs-parchment-dark/60",
  active: "text-osrs-green",
  past: "text-osrs-parchment-dark/60",
};

export default async function EventDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) notFound();
  const user = await getUser().catch(() => null);
  // Signed-in viewers read with their session: the backend then serves draft
  // events to members of participating clans (the pre-publication landing
  // page) and includes the viewer block. Anonymous reads stay ISR-cached.
  const event = await orNotFound(user ? api.eventForAdmin(eventId) : api.event(eventId));

  const teams = [...event.teams].sort((a, b) => b.score - a.score);
  // Accent colors resolve against the unsorted roster so palette fallbacks
  // stay stable as standings change.
  const teamColor = teamColorMap(event.teams);
  const players = user ? user.players.map((p) => ({ id: p.id, name: p.name })) : null;

  return (
    <div className="space-y-8">
      <header>
        {event.group_id && (
          <Link
            href={`/groups/${event.group_id}`}
            className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
          >
            ← Group
          </Link>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-osrs-gold text-3xl font-bold">{event.name}</h1>
          <span className={`text-sm capitalize ${STATUS_STYLES[event.status] ?? ""}`}>
            ● {event.status === "draft" ? "upcoming" : event.status}
          </span>
        </div>
        <p className="text-osrs-parchment-dark/60 mt-1 text-sm">
          <EventWindow startsAt={event.starts_at} endsAt={event.ends_at} status={event.status} />
        </p>
        {event.description && (
          <p className="text-osrs-parchment-dark/80 mt-3 max-w-2xl">{event.description}</p>
        )}
        {event.status === "draft" && (
          <p className="border-osrs-gold/30 bg-osrs-gold/10 text-osrs-parchment-dark/90 mt-3 max-w-2xl rounded border px-3 py-2 text-sm">
            This event hasn&apos;t started yet — you can preview it because you&apos;re part of a
            participating clan. Sign up now and you&apos;ll be ready when it goes live.
          </p>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-8">
          {event.bingo && (
            <div>
              <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
                Bingo board
              </h2>
              <BingoBoard
                board={event.bingo}
                teams={event.teams.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
                tasks={event.tasks}
                eventId={event.id}
                live={event.status === "active"}
                progress={event.progress}
                viewerTeamId={event.viewer?.team_id}
              />
            </div>
          )}

          <div>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Tasks</h2>
            {event.tasks.length ? (
              <EventTaskBoard
                tasks={event.tasks}
                // Original (unsorted) team order — keeps per-team colors in
                // sync with the bingo board's index-based palette.
                teams={event.teams.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
                progress={event.progress}
                eventId={event.id}
                live={event.status === "active"}
                viewerTeamId={event.viewer?.team_id}
              />
            ) : (
              <EmptyState title="No tasks yet" />
            )}
          </div>
        </section>

        <aside className="space-y-8">
          <div>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
              Participate
            </h2>
            <EventJoinPanel
              event={event}
              players={players}
              viewerGroupIds={user?.groups.map((g) => g.id) ?? []}
            />
          </div>

          <div>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Teams</h2>
            {teams.length ? (
              <ol className="space-y-2">
                {teams.map((team, i) => (
                  <li
                    key={team.id}
                    className="border-osrs-bronze/20 hover:border-osrs-bronze/50 rounded border px-3 py-2 text-sm transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        <span className="text-osrs-parchment-dark/50 mr-2 tabular-nums">
                          {i + 1}
                        </span>
                        <span
                          className="mr-1.5 inline-block size-2 rounded-full align-baseline"
                          style={{ backgroundColor: teamColor.get(team.id) }}
                          aria-hidden
                        />
                        <Link
                          href={`/events/${event.id}/teams/${team.id}`}
                          className="hover:text-osrs-gold-bright font-medium"
                        >
                          {team.name}
                        </Link>
                        <span className="text-osrs-parchment-dark/50 ml-2 text-xs">
                          {team.member_count} players
                          {(() => {
                            const done = (event.progress ?? []).filter(
                              (p) => p.team_id === team.id && p.completed,
                            ).length;
                            return done > 0 ? ` · ${done}/${event.tasks.length} tasks` : "";
                          })()}
                        </span>
                      </span>
                      <span className="text-osrs-gold-bright tabular-nums">{team.score}</span>
                    </div>
                    {(team.members?.length ?? 0) > 0 && (
                      <ul className="text-osrs-parchment-dark/70 mt-2 space-y-0.5 text-xs">
                        {team.members!.map((m) => (
                          <li key={m.player_id} className="flex items-center justify-between">
                            <Link
                              href={entityPath("players", m.player_id, m.player_name)}
                              className="hover:text-osrs-gold-bright"
                            >
                              {m.player_name}
                            </Link>
                            {m.joined_at && (
                              <span className="text-osrs-parchment-dark/40">
                                joined <LocalTime unix={m.joined_at} mode="date" />
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No teams yet" />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { orNotFound } from "@/lib/fetch";
import { EventWindow } from "@/components/local-time";
import { BingoBoard } from "@/components/bingo-board";
import { EventBoardView } from "@/components/event-board-view";
import { EventJoinPanel } from "@/components/event-join-panel";
import { LootSweepMatrix } from "@/components/loot-sweep-matrix";
import { EventTaskBoard } from "@/components/event-task-progress";
import { EventCompletionHistory } from "@/components/event-completion-history";
import { EventTeamsPanel } from "@/components/event-teams-panel";
import { PrizePotPanel } from "@/components/prize-pot-panel";
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

  // Board-game events (web44a): the dice board replaces the bingo grid.
  const board =
    event.kind === "board_game" ? await api.eventBoard(eventId).catch(() => null) : null;

  // Loot Sweep events: the icon-grid collection race replaces the task list.
  const lootSweep =
    event.kind === "loot_sweep" ? await api.eventLootSweep(eventId).catch(() => null) : null;

  // Prize pot (web52a): the "Who's bought in" panel — only when the event runs
  // a pot. Read-only on the public page (no actions).
  const pot = event.prize_pot?.enabled
    ? await api.eventPot(eventId).catch(() => null)
    : null;

  const players = user ? user.players.map((p) => ({ id: p.id, name: p.name })) : null;

  const participatePanel = (
    <div>
      <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Participate</h2>
      <EventJoinPanel
        event={event}
        players={players}
        viewerGroupIds={user?.groups.map((g) => g.id) ?? []}
      />
    </div>
  );
  const teamsPanel = (
    <div>
      <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Teams</h2>
      {event.teams.length ? (
        <EventTeamsPanel
          eventId={event.id}
          teams={event.teams}
          progress={event.progress}
          taskCount={event.tasks.length}
          viewerTeamId={event.viewer?.team_id}
          viewerTeamRole={event.viewer?.team_role ?? null}
          canManage={event.can_manage}
          prizePot={event.prize_pot}
        />
      ) : (
        <EmptyState title="No teams yet" />
      )}
    </div>
  );
  const potPanel =
    pot && pot.enabled ? (
      <div>
        <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
          Who&apos;s bought in
        </h2>
        <PrizePotPanel pot={pot} actions={null} />
      </div>
    ) : null;
  const lootSweepBoard = lootSweep ? (
    <div>
      <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Loot Sweep</h2>
      <LootSweepMatrix
        eventId={event.id}
        initial={lootSweep}
        live={event.status === "active"}
        viewerTeamId={event.viewer?.team_id ?? null}
      />
    </div>
  ) : null;

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

      {lootSweep ? (
        // Loot Sweep: the board is data-dense, so it takes the FULL page width;
        // the roster/participate panels move up top instead of a right rail.
        <div className="space-y-8">
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {participatePanel}
            {teamsPanel}
            {potPanel}
          </div>
          {lootSweepBoard}
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-8">
          {board && (
            <div>
              <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
                Game board
              </h2>
              <EventBoardView
                event={event}
                initialBoard={board}
                viewerTeamId={event.viewer?.team_id ?? null}
                leadership={event.leadership}
                viewerRole={event.viewer?.team_role ?? null}
              />
            </div>
          )}

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

          {/* Loot Sweep sets are shown by the board above, not as flat tasks. */}
          {event.kind !== "loot_sweep" && (
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
          )}
        </section>

        <aside className="space-y-8">
          {participatePanel}
          {teamsPanel}
          {potPanel}
        </aside>
        </div>
      )}

      {/* Centralized completion history — every task completion / point award
          in one auditable, filterable timeline (web57a). */}
      {event.status !== "draft" && (event.teams.length > 0 || event.tasks.length > 0) && (
        <section>
          <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
            Completion history
          </h2>
          <p className="text-osrs-parchment-dark/60 mb-4 max-w-2xl text-sm">
            Every recorded task completion and the points it earned — who pulled it, for which team,
            and when.
          </p>
          <EventCompletionHistory
            eventId={event.id}
            teams={event.teams.map((t) => ({ id: t.id, name: t.name }))}
          />
        </section>
      )}
    </div>
  );
}

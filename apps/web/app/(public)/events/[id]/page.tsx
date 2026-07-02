import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { formatDate } from "@/lib/format";
import { TASK_TYPE_LABELS, taskGoal } from "@/lib/events";
import { BingoBoard } from "@/components/bingo-board";
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
  const event = await orNotFound(api.event(eventId));

  const teams = [...event.teams].sort((a, b) => b.score - a.score);

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
            ● {event.status}
          </span>
        </div>
        <p className="text-osrs-parchment-dark/60 mt-1 text-sm">
          {formatDate(event.starts_at)} – {formatDate(event.ends_at)}
        </p>
        {event.description && (
          <p className="text-osrs-parchment-dark/80 mt-3 max-w-2xl">{event.description}</p>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-8">
          {event.bingo && (
            <div>
              <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
                Bingo board
              </h2>
              <BingoBoard board={event.bingo} />
            </div>
          )}

          <div>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Tasks</h2>
            {event.tasks.length ? (
              <ul className="divide-osrs-bronze/20 divide-y">
                {event.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span>
                      <span className="text-osrs-parchment-dark/50 mr-2 text-xs uppercase">
                        {TASK_TYPE_LABELS[t.type]}
                      </span>
                      {t.label}
                      {taskGoal(t) && (
                        <span className="text-osrs-parchment-dark/60"> — {taskGoal(t)}</span>
                      )}
                    </span>
                    {t.points > 0 && (
                      <span className="text-osrs-gold-bright tabular-nums">{t.points} pts</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No tasks yet" />
            )}
          </div>
        </section>

        <aside>
          <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Teams</h2>
          {teams.length ? (
            <ol className="space-y-2">
              {teams.map((team, i) => (
                <li
                  key={team.id}
                  className="border-osrs-bronze/20 flex items-center justify-between rounded border px-3 py-2 text-sm"
                >
                  <span>
                    <span className="text-osrs-parchment-dark/50 mr-2 tabular-nums">{i + 1}</span>
                    {team.name}
                    <span className="text-osrs-parchment-dark/50 ml-2 text-xs">
                      {team.member_count} players
                    </span>
                  </span>
                  <span className="text-osrs-gold-bright tabular-nums">{team.score}</span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No teams yet" />
          )}
        </aside>
      </div>
    </div>
  );
}

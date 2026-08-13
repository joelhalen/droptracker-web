import type { ClanLog } from "@droptracker/api-types";
import { ItemDbIcon } from "@/components/item-db-icon";
import {
  boardSummary,
  categoryLabel,
  formatClanLogPeriod,
  formatObtainedAt,
  missingItems,
} from "@/lib/clan-log";

/**
 * The Clan Log summary poster — what Discord gets.
 *
 * Deliberately NOT the whole board. A 350-slot grid screenshots to something
 * past the renderer's 8000px ceiling and reads as a wall in a Discord embed, so
 * the card answers the three things a clan actually wants in-channel — how far
 * along are we, what did we just get, what's left — and links to the page for
 * the grid itself.
 *
 * Fixed composition at a fixed width so the capture is one screenshot with no
 * lazy content below the fold. `--u` scales every dimension from the render
 * width, the same trick `recap-card.tsx` uses: passing a width alone would
 * leave the type sized for a 1100px poster.
 */
export function ClanLogCard({ board, width = 1100 }: { board: ClanLog; width?: number }) {
  const summary = boardSummary(board);
  const u = width / 68.75;
  const categories = Object.entries(board.summary.per_category)
    .map(([key, value]) => ({
      key,
      label: categoryLabel(key),
      ...value,
      pct: value.total ? Math.round((100 * value.obtained) / value.total) : 0,
    }))
    .sort((a, b) => b.pct - a.pct || b.total - a.total);

  const recent = (board.recent ?? []).slice(0, 5);
  // Count and sample from the same pool. `summary.missing` includes pets, which
  // this panel deliberately never lists, so using it here would headline a
  // number larger than anything the clan could act on.
  const huntable = missingItems(board.sections);
  const missing = huntable.slice(0, 10);

  // Ring geometry for the completion dial.
  const radius = 5.2 * u;
  const circumference = 2 * Math.PI * radius;
  const filled = (summary.pct / 100) * circumference;

  return (
    <div
      style={{
        width,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ["--u" as any]: `${u}px`,
        background: "linear-gradient(160deg,#131a15 0%,#0d120f 55%,#10160f 100%)",
        border: "calc(var(--u)*0.14) solid #6b5a2f",
        borderRadius: "calc(var(--u)*0.9)",
        padding: "calc(var(--u)*1.6)",
        fontFamily: "Inter,system-ui,sans-serif",
        color: "#e8e2d0",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "calc(var(--u)*1.1)" }}>
        <div
          style={{
            fontSize: "calc(var(--u)*0.62)",
            letterSpacing: "calc(var(--u)*0.22)",
            color: "#c9a227",
            textTransform: "uppercase",
          }}
        >
          Clan Log · {formatClanLogPeriod(board.period)}
        </div>
        <div
          style={{
            fontSize: "calc(var(--u)*2.1)",
            fontWeight: 700,
            color: "#f2d675",
            lineHeight: 1.15,
            marginTop: "calc(var(--u)*0.2)",
          }}
        >
          {board.group_name ?? "Clan"}
        </div>
      </div>

      <div style={{ display: "flex", gap: "calc(var(--u)*1.4)", alignItems: "center" }}>
        {/* Completion dial */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg width={13 * u} height={13 * u}>
            <circle
              cx={6.5 * u}
              cy={6.5 * u}
              r={radius}
              fill="none"
              stroke="#3a3323"
              strokeWidth={1.1 * u}
            />
            <circle
              cx={6.5 * u}
              cy={6.5 * u}
              r={radius}
              fill="none"
              stroke="#f2d675"
              strokeWidth={1.1 * u}
              strokeDasharray={`${filled} ${circumference}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${6.5 * u} ${6.5 * u})`}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: "calc(var(--u)*1.8)", fontWeight: 700, color: "#f2d675" }}>
              {summary.pct}%
            </div>
            <div style={{ fontSize: "calc(var(--u)*0.55)", color: "#9a9382" }}>
              {summary.obtained}/{summary.total}
            </div>
          </div>
        </div>

        {/* Per-category bars */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {categories.map((category) => (
            <div key={category.key} style={{ marginBottom: "calc(var(--u)*0.42)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "calc(var(--u)*0.6)",
                  marginBottom: "calc(var(--u)*0.12)",
                }}
              >
                <span style={{ color: "#cfc8b4" }}>{category.label}</span>
                <span style={{ color: "#9a9382" }}>
                  {category.obtained}/{category.total}
                </span>
              </div>
              <div
                style={{
                  height: "calc(var(--u)*0.38)",
                  background: "#2a2519",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${category.pct}%`,
                    height: "100%",
                    background: "linear-gradient(90deg,#a8871f,#f2d675)",
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {recent.length > 0 && (
        <Panel title="Latest unlocks">
          {recent.map((entry) => (
            <div
              key={`${entry.item_id}-${entry.at}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "calc(var(--u)*0.5)",
                padding: "calc(var(--u)*0.18) 0",
                fontSize: "calc(var(--u)*0.62)",
              }}
            >
              <ItemDbIcon itemId={entry.item_id} size={Math.round(1.3 * u)} />
              <span style={{ color: "#e8e2d0", flex: 1, minWidth: 0 }}>{entry.name}</span>
              <span style={{ color: "#c9a227" }}>{entry.by ?? "—"}</span>
              <span style={{ color: "#7d7768", fontSize: "calc(var(--u)*0.55)" }}>
                {formatObtainedAt(entry.at)}
              </span>
            </div>
          ))}
        </Panel>
      )}

      {missing.length > 0 && (
        <Panel title={`Still hunting (${huntable.length})`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "calc(var(--u)*0.32)" }}>
            {missing.map(({ item }) => (
              <div
                key={item.item_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "calc(var(--u)*0.3)",
                  border: "1px solid #3a3323",
                  borderRadius: "calc(var(--u)*0.35)",
                  padding: "calc(var(--u)*0.18) calc(var(--u)*0.42)",
                  fontSize: "calc(var(--u)*0.58)",
                  color: "#9a9382",
                }}
              >
                <ItemDbIcon itemId={item.item_id} size={Math.round(1.1 * u)} gray />
                {item.name}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "calc(var(--u)*1)",
          fontSize: "calc(var(--u)*0.55)",
          color: "#7d7768",
        }}
      >
        <span style={{ color: "#c9a227", fontWeight: 600 }}>DROPTRACKER.IO</span>
        <span>droptracker.io/groups/{board.group_id}/log</span>
      </div>
    </div>
  );
}

/** Section frame. Sizing comes from the `--u` custom property the card sets,
 * so this needs no width of its own. */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: "calc(var(--u)*0.9)",
        border: "1px solid #3a3323",
        borderRadius: "calc(var(--u)*0.5)",
        padding: "calc(var(--u)*0.7)",
      }}
    >
      <div
        style={{
          fontSize: "calc(var(--u)*0.55)",
          letterSpacing: "calc(var(--u)*0.14)",
          textTransform: "uppercase",
          color: "#c9a227",
          marginBottom: "calc(var(--u)*0.4)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

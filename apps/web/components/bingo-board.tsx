import type { BingoBoard as BingoBoardData } from "@droptracker/api-types";

/** Read-only bingo board grid (FRONTEND_PLAN.md §14.1 bingo). */
export function BingoBoard({ board }: { board: BingoBoardData }) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))` }}
    >
      {board.cells.map((cell) => {
        const done = cell.completed_by.length > 0;
        return (
          <div
            key={cell.index}
            title={done ? `Completed by ${cell.completed_by.join(", ")}` : cell.label}
            className={`flex aspect-square flex-col items-center justify-center rounded border p-1 text-center text-[11px] leading-tight ${
              done
                ? "border-osrs-green/60 bg-osrs-green/15 text-osrs-parchment"
                : "border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment-dark/80"
            }`}
          >
            <span className="line-clamp-3">{cell.label}</span>
            {done && <span className="text-osrs-green mt-0.5 text-[10px]">✓</span>}
          </div>
        );
      })}
    </div>
  );
}

import type { Metadata } from "next";
import { requireSuperadmin } from "@/lib/auth";
import { Card } from "@/components/ui";
import { TOOL_CATEGORIES, TOOLS, type ToolEntry } from "@/lib/tools-directory";

export const metadata: Metadata = {
  title: "Tools & communities",
  description: "Tools and communities The DropTracker uses or recommends for Old School RuneScape players and clans.",
  // Staff-only preview for now; drop this with the guard when it goes public.
  robots: { index: false, follow: false },
};

function Monogram({ tool }: { tool: ToolEntry }) {
  const accent = tool.accent ?? "var(--color-osrs-bronze)";
  return (
    <span
      aria-hidden
      className="font-display flex size-12 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white shadow-sm"
      style={{
        background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, black))`,
        border: `1px solid color-mix(in srgb, ${accent} 70%, white 10%)`,
      }}
    >
      {tool.name.trim()[0]?.toUpperCase()}
    </span>
  );
}

function ToolCard({ tool }: { tool: ToolEntry }) {
  const [primary, ...rest] = tool.links;
  return (
    <Card className="flex min-w-0 flex-col gap-4">
      <div className="flex items-start gap-4">
        <Monogram tool={tool} />
        <div className="min-w-0">
          <h3 className="text-osrs-gold-bright text-lg font-semibold leading-tight">
            <a href={primary.href} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {tool.name}
            </a>
          </h3>
          <div className="text-osrs-parchment-dark/60 truncate text-xs">{primary.label}</div>
        </div>
      </div>

      <p className="text-osrs-parchment-dark/85 text-sm">{tool.description}</p>

      {tool.usedFor && (
        <p className="border-osrs-gold/40 bg-osrs-bronze/10 text-osrs-parchment-dark/85 rounded-r border-l-2 px-3 py-2 text-sm">
          <span className="text-osrs-gold font-semibold">How we use it: </span>
          {tool.usedFor}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-1.5">
          {tool.tags.map((tag) => (
            <li
              key={tag}
              className="border-osrs-bronze/35 text-osrs-parchment-dark/70 rounded-full border px-2 py-0.5 text-[11px]"
            >
              {tag}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3 text-sm">
          {[primary, ...rest].map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-osrs-gold-bright hover:underline"
            >
              {link === primary ? "Visit" : link.label} <span aria-hidden>↗</span>
            </a>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default async function ToolsPage() {
  // Admin-only while the list is being filled in. Moving this route out of
  // preview = delete this line and the `robots` entry above.
  await requireSuperadmin("/tools");

  return (
    <div className="space-y-10">
      <header>
        <span className="bg-osrs-red/20 text-osrs-red rounded px-2 py-0.5 text-xs font-medium">
          Staff preview
        </span>
        <h1 className="text-osrs-gold mt-2 text-3xl font-bold">Tools & communities</h1>
        <p className="text-osrs-parchment-dark/80 mt-2 max-w-2xl">
          The projects we build on and the places we point players to. None of these are run by
          The DropTracker. We just use them and think you should too.
        </p>
      </header>

      {TOOL_CATEGORIES.map((cat) => {
        const entries = TOOLS.filter((t) => t.category === cat.id);
        if (entries.length === 0) return null;
        return (
          <section key={cat.id} aria-labelledby={`tools-${cat.id}`} className="space-y-4">
            <div>
              <h2 id={`tools-${cat.id}`} className="text-osrs-gold text-xl font-bold">
                {cat.title}
              </h2>
              <p className="text-osrs-parchment-dark/70 text-sm">{cat.blurb}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {entries.map((tool) => (
                <ToolCard key={tool.name} tool={tool} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { TOOL_SECTIONS, type ToolListing, type ToolSection } from "@/lib/tools-directory";
import { ListingEditor } from "./listing-editor";
import { ToolCard } from "./tool-card";

type Editing = { id: number } | { newIn: ToolSection } | null;

const byOrder = (a: ToolListing, b: ToolListing) => a.sort_order - b.sort_order || a.id - b.id;

export function ToolsDirectory({
  initialListings,
  canAdmin,
}: {
  initialListings: ToolListing[];
  canAdmin: boolean;
}) {
  const [listings, setListings] = useState(initialListings);
  const [editing, setEditing] = useState<Editing>(null);

  const saved = (listing: ToolListing) => {
    setListings((prev) =>
      prev.some((l) => l.id === listing.id)
        ? prev.map((l) => (l.id === listing.id ? listing : l))
        : [...prev, listing],
    );
    // Adding or removing a maintainer saves too, but keeps the editor open.
    setEditing((cur) => (cur && "id" in cur && cur.id === listing.id ? cur : null));
  };
  const closeEditor = () => setEditing(null);

  return (
    <div className="space-y-10">
      {TOOL_SECTIONS.map((section) => {
        const entries = listings.filter((l) => l.section === section.id).sort(byOrder);
        const addingHere = editing != null && "newIn" in editing && editing.newIn === section.id;
        if (entries.length === 0 && !canAdmin) return null;
        return (
          <section key={section.id} aria-labelledby={`tools-${section.id}`} className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id={`tools-${section.id}`} className="text-osrs-gold text-xl font-bold">
                  {section.title}
                </h2>
                <p className="text-osrs-parchment-dark/70 text-sm">{section.blurb}</p>
              </div>
              {canAdmin && !addingHere && (
                <Button variant="ghost" size="xs" onClick={() => setEditing({ newIn: section.id })}>
                  Add listing
                </Button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {entries.map((tool) =>
                editing && "id" in editing && editing.id === tool.id ? (
                  <ListingEditor
                    key={tool.id}
                    listing={tool}
                    canAdmin={canAdmin}
                    onSaved={saved}
                    onDeleted={(id) => {
                      setListings((prev) => prev.filter((l) => l.id !== id));
                      closeEditor();
                    }}
                    onCancel={closeEditor}
                  />
                ) : (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onEdit={tool.can_edit ? () => setEditing({ id: tool.id }) : undefined}
                  />
                ),
              )}
              {addingHere && (
                <ListingEditor
                  canAdmin={canAdmin}
                  defaultSection={section.id}
                  onSaved={saved}
                  onDeleted={closeEditor}
                  onCancel={closeEditor}
                />
              )}
              {entries.length === 0 && !addingHere && (
                <p className="text-osrs-parchment-dark/50 text-sm">Nothing here yet.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

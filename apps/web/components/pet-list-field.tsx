"use client";

/**
 * Config-editor input for a `petlist` field (today `notify_pet_duplicate_pets`):
 * the shared pet picker over a stored JSON array of pet names.
 */

import { useEffect, useMemo, useState } from "react";
import { formatPetList, parsePetList, type EventPetCategory } from "@droptracker/api-types";
import { fetchGroupPetCatalog } from "@/app/(site)/(admin)/groups/[id]/settings/actions";
import { groupPetCatalog, PetPicker } from "@/components/pet-picker";

export function PetListField({
  groupId,
  value,
  onChange,
  disabled = false,
}: {
  groupId: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [catalog, setCatalog] = useState<EventPetCategory[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchGroupPetCatalog(groupId)
      .then((rows) => !cancelled && setCatalog(rows))
      .catch(() => !cancelled && setCatalog([]));
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const saved = useMemo(() => parsePetList(value) ?? [], [value]);
  const chosen = useMemo(() => new Set(saved.map((n) => n.toLowerCase())), [saved]);
  const displayName = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const g of groupPetCatalog(catalog ?? [])) {
      for (const p of g.pets) byKey.set(p.name.toLowerCase(), p.name);
    }
    // A saved name the catalog doesn't list (it failed to load) keeps its spelling.
    for (const n of saved) if (!byKey.has(n.toLowerCase())) byKey.set(n.toLowerCase(), n);
    return byKey;
  }, [catalog, saved]);

  return (
    <PetPicker
      catalog={catalog}
      chosen={chosen}
      onChange={(next) =>
        onChange(formatPetList([...next].map((k) => displayName.get(k)).filter((n): n is string => Boolean(n))))
      }
      disabled={disabled}
      summary={(picked, total) =>
        `${picked} of ${total ?? "…"} pets announced on duplicates`
      }
    />
  );
}

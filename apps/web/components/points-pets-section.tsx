"use client";

/**
 * Points page: how pets pay.
 *
 * A member earns a pet's "New pets" points once per group. This section
 * decides what later copies (duplicates) pay: nothing (the default), every
 * pet, or only the pets the admin picks, at the new-pet rate or a flat
 * amount. It also holds the "pets owned before DropTracker" option, which
 * pays out the moment it is turned on, so it previews the payout and asks
 * for a confirm instead of saving with the rest.
 *
 * Backend: data/submissions/pet_points.py (disc).
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  EventPetCategory,
  PetDuplicateMode,
  PointsBehavior,
  PriorOwnedPetsResult,
} from "@droptracker/api-types";
import {
  fetchPointsPetCatalog,
  previewPriorOwnedPets,
  savePointsSettings,
  setPriorOwnedPets,
} from "@/app/(site)/(admin)/groups/[id]/points/manage/actions";
import { getErrorMessage } from "@/lib/errors";
import { PET_CATEGORY_LABELS } from "@/lib/events";
import { Alert, Card } from "@/components/ui";
import { ItemDbIcon } from "@/components/item-db-icon";
import { QuantityInput } from "@/components/quantity-input";

const field =
  "bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-osrs-gold/60";

/** Picker order. A pet shows once, under the first group it belongs to, so
 * the raids pets sit under Raids rather than repeating under Bosses. */
const CATEGORY_ORDER = ["raids", "boss", "skilling", "minigame", "clue", "misc"];

const MODE_OPTIONS: { value: PetDuplicateMode; label: string; help: string }[] = [
  { value: "none", label: "Never", help: "Only the first copy of each pet pays." },
  { value: "all", label: "Every pet", help: "Every duplicate pays." },
  {
    value: "selected",
    label: "Only pets I choose",
    help: "Good for paying out on rare pets but not easy ones.",
  },
];

type PetEntry = { name: string; id: number | null };

/** Pet keys shared by the Behavior section, which must not save them. */
export const PET_BEHAVIOR_KEYS = [
  "pet_duplicates",
  "pet_duplicate_pets",
  "pet_duplicate_award",
  "pet_prior_owned",
] as const;

function groupCatalog(catalog: EventPetCategory[]): { key: string; pets: PetEntry[] }[] {
  const byKey = new Map(catalog.map((c) => [c.key, c.pets]));
  const keys = [...CATEGORY_ORDER, ...catalog.map((c) => c.key).filter((k) => !CATEGORY_ORDER.includes(k))];
  const seen = new Set<string>();
  const out: { key: string; pets: PetEntry[] }[] = [];
  for (const key of keys) {
    const pets = (byKey.get(key) ?? []).filter((p) => {
      const k = p.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (pets.length) out.push({ key, pets });
  }
  return out;
}

export function PetsSection({
  groupId,
  initial,
  newPetAward,
  disabled,
}: {
  groupId: number;
  initial: PointsBehavior;
  /** The "New pets" rule's award, for the "same as a new pet" hint. */
  newPetAward: number;
  disabled: boolean;
}) {
  const [mode, setMode] = useState<PetDuplicateMode>(initial.pet_duplicates);
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(initial.pet_duplicate_pets.map((n) => n.toLowerCase())),
  );
  const [customAward, setCustomAward] = useState(initial.pet_duplicate_award !== null);
  const [award, setAward] = useState(initial.pet_duplicate_award ?? newPetAward);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const [catalog, setCatalog] = useState<EventPetCategory[] | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (mode !== "selected" || catalog !== null) return;
    let cancelled = false;
    fetchPointsPetCatalog(groupId)
      .then((rows) => !cancelled && setCatalog(rows))
      .catch(() => !cancelled && setCatalog([]));
    return () => {
      cancelled = true;
    };
  }, [mode, catalog, groupId]);

  const groups = useMemo(() => groupCatalog(catalog ?? []), [catalog]);
  const allPets = useMemo(() => groups.flatMap((g) => g.pets), [groups]);
  const needle = query.trim().toLowerCase();

  const togglePet = (name: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      const k = name.toLowerCase();
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const setMany = (pets: PetEntry[], on: boolean) =>
    setChosen((prev) => {
      const next = new Set(prev);
      for (const p of pets) {
        if (on) next.add(p.name.toLowerCase());
        else next.delete(p.name.toLowerCase());
      }
      return next;
    });

  const save = () =>
    startTransition(async () => {
      setError(null);
      setSaved(false);
      // Send display spellings. Names already saved but missing from the
      // catalog (it failed to load) are kept as they were.
      const byKey = new Map(allPets.map((p) => [p.name.toLowerCase(), p.name]));
      const keptRaw = initial.pet_duplicate_pets.filter((n) => chosen.has(n.toLowerCase()));
      const names = [
        ...new Set([
          ...[...chosen].map((k) => byKey.get(k)).filter((n): n is string => Boolean(n)),
          ...keptRaw,
        ]),
      ];
      try {
        const result = await savePointsSettings(groupId, {
          behavior: {
            pet_duplicates: mode,
            pet_duplicate_pets: names,
            pet_duplicate_award: customAward ? award : null,
          },
        });
        setMode(result.behavior.pet_duplicates);
        setChosen(new Set(result.behavior.pet_duplicate_pets.map((n) => n.toLowerCase())));
        setSaved(true);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-osrs-gold text-lg font-semibold">Pets</h2>
        <p className="text-osrs-parchment-dark/70 mt-0.5 text-sm">
          Each member earns the New pets award once per pet. Choose what duplicates pay.
        </p>
      </div>

      <Card padding="p-4" className="space-y-5 text-sm">
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="text-osrs-parchment mb-1 font-medium">Duplicate pets</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODE_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`cursor-pointer rounded border p-3 ${
                  mode === o.value
                    ? "border-osrs-gold/70 bg-osrs-gold/10"
                    : "border-osrs-bronze/30 hover:border-osrs-bronze/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pet-duplicates"
                    value={o.value}
                    checked={mode === o.value}
                    onChange={() => setMode(o.value)}
                  />
                  <span className="text-osrs-parchment font-medium">{o.label}</span>
                </span>
                <span className="text-osrs-parchment-dark/60 mt-1 block text-xs">{o.help}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {mode === "selected" && (
          <div className="border-osrs-bronze/25 space-y-3 rounded border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pets…"
                aria-label="Search pets"
                className={`${field} w-full sm:w-64`}
              />
              <span className="text-osrs-parchment-dark/70 text-xs">
                {chosen.size} of {allPets.length || "…"} pets pay on duplicates
              </span>
            </div>
            {catalog === null ? (
              <p className="text-osrs-parchment-dark/60 text-xs">Loading pets…</p>
            ) : groups.length === 0 ? (
              <Alert variant="error">Couldn&apos;t load the pet list. Please refresh.</Alert>
            ) : (
              groups.map((g) => {
                const shown = needle
                  ? g.pets.filter((p) => p.name.toLowerCase().includes(needle))
                  : g.pets;
                if (!shown.length) return null;
                const picked = g.pets.filter((p) => chosen.has(p.name.toLowerCase())).length;
                return (
                  <div key={g.key} className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-osrs-gold/90 text-xs font-semibold uppercase">
                        {PET_CATEGORY_LABELS[g.key] ?? g.key}
                      </span>
                      <span className="text-osrs-parchment-dark/50 text-xs">
                        {picked}/{g.pets.length}
                      </span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setMany(g.pets, true)}
                        className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-xs underline-offset-2 hover:underline"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setMany(g.pets, false)}
                        className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-xs underline-offset-2 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {shown.map((p) => {
                        const on = chosen.has(p.name.toLowerCase());
                        return (
                          <button
                            key={p.name}
                            type="button"
                            disabled={disabled}
                            onClick={() => togglePet(p.name)}
                            aria-pressed={on}
                            className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                              on
                                ? "border-osrs-gold/70 bg-osrs-gold/15 text-osrs-parchment"
                                : "border-osrs-bronze/25 text-osrs-parchment-dark/70 hover:border-osrs-bronze/60"
                            } disabled:opacity-50`}
                          >
                            <ItemDbIcon itemId={p.id} size={18} gray={!on} />
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {mode !== "none" && (
          <fieldset className="space-y-2" disabled={disabled}>
            <legend className="text-osrs-parchment mb-1 font-medium">Points per duplicate</legend>
            <label className="flex items-center gap-2">
              <input type="radio" checked={!customAward} onChange={() => setCustomAward(false)} />
              <span>
                Same as a new pet{" "}
                <span className="text-osrs-parchment-dark/60 text-xs">
                  ({newPetAward} pts, or that pet&apos;s override)
                </span>
              </span>
            </label>
            <label className="flex flex-wrap items-center gap-2">
              <input type="radio" checked={customAward} onChange={() => setCustomAward(true)} />
              <span>A set amount</span>
              <QuantityInput
                min={0}
                value={award}
                disabled={disabled || !customAward}
                onChange={setAward}
                className={`${field} w-28`}
              />
              <span className="text-osrs-parchment-dark/60 text-xs">pts</span>
            </label>
          </fieldset>
        )}

        {error && <Alert variant="error">{error}</Alert>}
        {saved && <Alert variant="success">Pet settings saved.</Alert>}
        <button
          type="button"
          onClick={save}
          disabled={disabled || pending}
          className="bg-osrs-gold/90 text-osrs-brown-dark rounded px-4 py-2 text-sm font-semibold hover:bg-osrs-gold disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save pet settings"}
        </button>

        <PriorOwnedPets groupId={groupId} initial={initial.pet_prior_owned} disabled={disabled} />
      </Card>
    </section>
  );
}

/* --- Pets owned before DropTracker ---------------------------------------- */

function PriorOwnedPets({
  groupId,
  initial,
  disabled,
}: {
  groupId: number;
  initial: boolean;
  disabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [preview, setPreview] = useState<PriorOwnedPetsResult | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      setError(null);
      setDone(null);
      try {
        await fn();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  const check = () => run(async () => setPreview(await previewPriorOwnedPets(groupId)));

  const turnOn = () =>
    run(async () => {
      const result = await setPriorOwnedPets(groupId, true);
      setEnabled(true);
      setPreview(null);
      setDone(
        result.awards
          ? `Paid ${result.points.toLocaleString()} points to ${result.members} member${
              result.members === 1 ? "" : "s"
            } for ${result.awards} pet${result.awards === 1 ? "" : "s"}.`
          : "Turned on. Nothing to pay right now.",
      );
    });

  const turnOff = () =>
    run(async () => {
      await setPriorOwnedPets(groupId, false);
      setEnabled(false);
      setDone("Turned off. Points already paid stay.");
    });

  const btn =
    "rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50";

  return (
    <div className="border-osrs-bronze/25 space-y-3 border-t pt-4">
      <div>
        <div className="text-osrs-parchment font-medium">Pets owned before DropTracker</div>
        <p className="text-osrs-parchment-dark/60 mt-0.5 text-xs">
          {enabled
            ? "On. Pets in members' collection logs are paid once, and checked again every hour. The next copy of one of those pets counts as a duplicate."
            : "Off. A pet a member already had pays as new the first time DropTracker sees it. Turn this on to pay from their collection log instead."}
        </p>
      </div>

      {enabled ? (
        <button
          type="button"
          onClick={turnOff}
          disabled={disabled || pending}
          className={`${btn} border-osrs-bronze/40 hover:border-osrs-bronze/70 border`}
        >
          {pending ? "Working…" : "Turn off"}
        </button>
      ) : preview ? (
        <div className="bg-osrs-brown-dark/40 border-osrs-gold/40 space-y-3 rounded border p-3">
          {preview.awards ? (
            <>
              <p>
                Turning this on pays{" "}
                <strong className="text-osrs-gold-bright">
                  {preview.points.toLocaleString()} points
                </strong>{" "}
                to {preview.members} member{preview.members === 1 ? "" : "s"} for{" "}
                {preview.awards} pet{preview.awards === 1 ? "" : "s"} they already own.
              </p>
              <ul className="text-osrs-parchment-dark/80 grid gap-1 text-xs sm:grid-cols-2">
                {preview.by_pet.slice(0, 8).map((p) => (
                  <li key={p.pet} className="flex items-center gap-1.5">
                    <ItemDbIcon itemId={p.item_id} size={18} />
                    {p.pet}: {p.members} × {p.points_each} pts
                  </li>
                ))}
                {preview.by_pet.length > 8 && (
                  <li>and {preview.by_pet.length - 8} more pets</li>
                )}
              </ul>
            </>
          ) : (
            <p>No member has an unpaid pet in their collection log right now.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={turnOn}
              disabled={disabled || pending}
              className={`${btn} bg-osrs-gold/90 text-osrs-brown-dark hover:bg-osrs-gold`}
            >
              {pending
                ? "Working…"
                : preview.awards
                  ? `Turn on and pay ${preview.points.toLocaleString()} points`
                  : "Turn on"}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              disabled={pending}
              className={`${btn} border-osrs-bronze/40 hover:border-osrs-bronze/70 border`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={check}
          disabled={disabled || pending}
          className={`${btn} border-osrs-gold/50 text-osrs-gold-bright hover:border-osrs-gold border`}
        >
          {pending ? "Checking…" : "Check what this would pay"}
        </button>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {done && <Alert variant="success">{done}</Alert>}
    </div>
  );
}

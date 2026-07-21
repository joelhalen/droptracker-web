"use client";

/**
 * Per-event shop configuration (web50a): the leader/admin surface for tuning
 * the power-up shop of a board-game event. Two things live here:
 *
 *  - Refresh cadence (global): how often the shop restocks — never, every N
 *    turns, or every N hours. Persisted through the board-settings patch
 *    (`settings.shop.refresh_mode` / `refresh_interval`).
 *  - Per-item overrides: for every active catalog item, toggle it on/off and
 *    override its price, per-refresh stock and per-team purchase cap. Blank =
 *    the catalog default / unlimited / uncapped. Persisted through the
 *    dedicated shop-config PUT.
 *
 * Deliberately verbose-but-approachable: sane defaults, one-line hints, and the
 * stock/cap columns tucked behind an "advanced limits" toggle so a casual
 * organiser only sees enable + price. One explicit Save writes both payloads.
 */

import { useEffect, useState } from "react";
import type { BoardShopConfig } from "@droptracker/api-types";
import {
  fetchBoardShopConfig,
  saveBoardShopConfig,
  saveEventBoardSettings,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import { ItemDbIcon } from "@/components/item-db-icon";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-2 py-1 text-sm outline-none";

type ItemRow = {
  shop_item_id: number;
  name: string;
  description: string | null;
  icon_item_id: number | null;
  item_type: string;
  effect: string;
  default_cost_coins: number;
  enabled: boolean;
  /** All three kept as strings; "" means "use the default" (null on the wire). */
  price_override: string;
  stock_per_refresh: string;
  per_team_cap: string;
};

const numStr = (v: number | null | undefined): string => (v == null ? "" : String(v));

/** "" -> null; otherwise a non-negative integer (invalid strings become null,
 * caught earlier by validation). */
const strNum = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) ? n : null;
};

function rowsFromConfig(config: BoardShopConfig): ItemRow[] {
  return config.items.map((i) => ({
    shop_item_id: i.shop_item_id,
    name: i.name,
    description: i.description ?? null,
    icon_item_id: i.icon_item_id ?? null,
    item_type: i.item_type,
    effect: i.effect,
    default_cost_coins: i.default_cost_coins,
    enabled: i.enabled,
    price_override: numStr(i.price_override),
    stock_per_refresh: numStr(i.stock_per_refresh),
    per_team_cap: numStr(i.per_team_cap),
  }));
}

/** Validate a blank-or-non-negative-integer field. Returns an error string or
 * null. */
function badNonNeg(s: string): boolean {
  const t = s.trim();
  if (t === "") return false;
  const n = Number(t);
  return !Number.isInteger(n) || n < 0;
}

export function EventBoardShopConfig({
  groupId,
  eventId,
}: {
  groupId: number | null;
  eventId: number;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [refreshMode, setRefreshMode] = useState<"none" | "turns" | "hours" | "days">("none");
  const [refreshInterval, setRefreshInterval] = useState<string>("0");
  const [refreshRandom, setRefreshRandom] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchBoardShopConfig(groupId, eventId)
      .then((config) => {
        if (!live) return;
        setRows(rowsFromConfig(config));
        setRefreshMode(config.refresh_mode);
        setRefreshInterval(String(config.refresh_interval));
        setRefreshRandom(Boolean(config.refresh_random));
        setError(null);
      })
      .catch((err) => {
        if (live) setError(getErrorMessage(err, "Couldn't load the shop configuration."));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [groupId, eventId]);

  const updateRow = (id: number, patch: Partial<ItemRow>) => {
    setSaved(false);
    setRows((prev) => prev.map((r) => (r.shop_item_id === id ? { ...r, ...patch } : r)));
  };

  const onSave = async () => {
    // Validate the numeric fields before touching the network.
    for (const r of rows) {
      if (badNonNeg(r.price_override))
        return setError(`${r.name}: price must be a non-negative number.`);
      if (badNonNeg(r.stock_per_refresh))
        return setError(`${r.name}: stock per refresh must be a non-negative number.`);
      if (badNonNeg(r.per_team_cap))
        return setError(`${r.name}: per-team cap must be a non-negative number.`);
    }
    const interval = refreshMode === "none" ? 0 : Math.max(1, Number(refreshInterval) || 1);

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      // 1) refresh cadence rides on the board-settings patch.
      await saveEventBoardSettings(groupId, eventId, {
        shop: {
          refresh_mode: refreshMode,
          refresh_interval: interval,
          refresh_random: refreshRandom,
        },
      });
      // 2) per-item overrides through the dedicated config PUT.
      const config = await saveBoardShopConfig(groupId, eventId, {
        items: rows.map((r) => ({
          shop_item_id: r.shop_item_id,
          enabled: r.enabled,
          price_override: strNum(r.price_override),
          stock_per_refresh: strNum(r.stock_per_refresh),
          per_team_cap: strNum(r.per_team_cap),
        })),
      });
      // Re-sync from the server's canonical view.
      setRows(rowsFromConfig(config));
      setRefreshMode(config.refresh_mode);
      setRefreshInterval(String(config.refresh_interval));
      setRefreshRandom(Boolean(config.refresh_random));
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the shop configuration."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <fieldset className="border-osrs-bronze/20 rounded border p-3">
        <legend className="text-osrs-gold px-1 text-sm font-semibold">Shop configuration</legend>
        <p className="text-osrs-parchment-dark/60 text-sm">Loading…</p>
      </fieldset>
    );
  }

  return (
    <fieldset className="border-osrs-bronze/20 space-y-3 rounded border p-3">
      <legend className="text-osrs-gold px-1 text-sm font-semibold">Shop configuration</legend>
      <p className="text-osrs-parchment-dark/60 text-xs">
        Choose which power-ups appear in this event&apos;s shop and tune their price and limits.
        Blank price uses the catalog default; blank stock is unlimited; blank cap is uncapped.
        Turn the shop itself on or off in Board settings.
      </p>
      {error && <Alert variant="error">{error}</Alert>}

      {/* Refresh cadence (global). */}
      <div className="border-osrs-bronze/20 space-y-2 rounded border p-3">
        <h4 className="text-osrs-gold text-xs font-semibold">Restock cadence</h4>
        <p className="text-osrs-parchment-dark/60 text-[11px]">
          How often limited stock replenishes. Leave on “Never” for a fixed, one-time stock.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Refresh</span>
            <select
              value={refreshMode}
              onChange={(e) => {
                setSaved(false);
                setRefreshMode(e.target.value as "none" | "turns" | "hours" | "days");
              }}
              className={`${field} w-40`}
            >
              <option value="none">Never</option>
              <option value="turns">Every N turns</option>
              <option value="hours">Every N hours</option>
              <option value="days">Every N days</option>
            </select>
          </label>
          {refreshMode !== "none" && (
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                Interval ({refreshMode})
              </span>
              <input
                type="number"
                min={1}
                value={refreshInterval}
                onChange={(e) => {
                  setSaved(false);
                  setRefreshInterval(e.target.value);
                }}
                className={`${field} w-24`}
              />
            </label>
          )}
          {(refreshMode === "hours" || refreshMode === "days") && (
            <label className="text-osrs-parchment-dark/80 flex cursor-pointer items-center gap-1.5 pb-1.5 text-xs">
              <input
                type="checkbox"
                checked={refreshRandom}
                onChange={(e) => {
                  setSaved(false);
                  setRefreshRandom(e.target.checked);
                }}
              />
              Restock at a random time (harder to game)
            </label>
          )}
        </div>
      </div>

      {/* Per-item overrides. */}
      <div className="flex items-center justify-between">
        <h4 className="text-osrs-gold text-xs font-semibold">Items</h4>
        <label className="text-osrs-parchment-dark/70 flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={showAdvanced}
            onChange={(e) => setShowAdvanced(e.target.checked)}
            className="size-3.5"
          />
          Show advanced limits
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="text-osrs-parchment-dark/60 text-sm">No catalog items are available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="text-osrs-parchment-dark/60 text-left text-xs">
                <th className="py-1.5 pr-3 font-normal">Item</th>
                <th className="px-2 py-1.5 text-center font-normal">On</th>
                <th className="px-2 py-1.5 text-right font-normal">Price</th>
                {showAdvanced && (
                  <>
                    <th className="px-2 py-1.5 text-right font-normal">Stock / refresh</th>
                    <th className="px-2 py-1.5 text-right font-normal">Per-team cap</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-osrs-bronze/15 divide-y">
              {rows.map((r) => (
                <tr key={r.shop_item_id} className={r.enabled ? "" : "opacity-50"}>
                  <td className="py-1.5 pr-3">
                    <span className="flex items-center gap-1.5">
                      <ItemDbIcon itemId={r.icon_item_id} size={18} />
                      <span className="text-osrs-parchment" title={r.description ?? undefined}>
                        {r.name}
                      </span>
                      <span className="text-osrs-parchment-dark/40 text-[10px] uppercase">
                        {r.item_type}
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => updateRow(r.shop_item_id, { enabled: e.target.checked })}
                      className="size-4"
                      aria-label={`Enable ${r.name}`}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <input
                      type="number"
                      min={0}
                      placeholder={String(r.default_cost_coins)}
                      value={r.price_override}
                      onChange={(e) =>
                        updateRow(r.shop_item_id, { price_override: e.target.value })
                      }
                      className={`${field} w-24 text-right`}
                      aria-label={`${r.name} price override`}
                    />
                  </td>
                  {showAdvanced && (
                    <>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number"
                          min={0}
                          placeholder="∞"
                          value={r.stock_per_refresh}
                          onChange={(e) =>
                            updateRow(r.shop_item_id, { stock_per_refresh: e.target.value })
                          }
                          className={`${field} w-20 text-right`}
                          aria-label={`${r.name} stock per refresh`}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <span className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min={0}
                            placeholder="∞"
                            value={r.per_team_cap}
                            onChange={(e) =>
                              updateRow(r.shop_item_id, { per_team_cap: e.target.value })
                            }
                            className={`${field} w-16 text-right`}
                            aria-label={`${r.name} per-team cap`}
                          />
                          <button
                            type="button"
                            onClick={() => updateRow(r.shop_item_id, { per_team_cap: "1" })}
                            title="Limit to one purchase per team for the whole event"
                            className="border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-1.5 py-0.5 text-[10px]"
                          >
                            1×
                          </button>
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save shop config"}
        </button>
        {saved && <span className="text-osrs-gold text-xs">Saved.</span>}
      </div>
    </fieldset>
  );
}

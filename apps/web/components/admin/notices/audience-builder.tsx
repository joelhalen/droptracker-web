"use client";

/**
 * Who a pop-up goes to (web118a). Each row is one rule and a visitor who
 * matches ANY row sees the notice. Under the rows, a live count asks the
 * backend how many accounts the current rules reach, with a few example
 * names, so a typo'd audience is obvious before anything is sent.
 */
import { useEffect, useState } from "react";
import type {
  NoticeAudiencePreview,
  NoticeLabels,
  NoticeLookupHit,
  NoticeOptions,
  NoticeRule,
  NoticeRuleType,
} from "@droptracker/api-types";
import { previewNoticeAudience } from "@/app/(site)/(admin)/admin/notices/actions";
import { ToggleChip, cn } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import { RULE_LABELS, RULE_ORDER, audienceProblem, blankRule } from "@/lib/site-notices";
import { EntityPicker } from "./entity-picker";

const COUNT_DEBOUNCE_MS = 500;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function AudienceBuilder({
  rules,
  onChange,
  options,
  labels,
  onLabels,
  onCount,
}: {
  rules: NoticeRule[];
  onChange: (rules: NoticeRule[]) => void;
  options: NoticeOptions;
  labels: NoticeLabels;
  onLabels: (labels: NoticeLabels) => void;
  /** The latest count for the current rules, or null while unknown. */
  onCount?: (count: number | null) => void;
}) {
  const update = (i: number, rule: NoticeRule) => onChange(rules.map((r, j) => (j === i ? rule : r)));
  const remove = (i: number) => onChange(rules.filter((_, j) => j !== i));
  const add = (type: NoticeRuleType) => onChange([...rules, blankRule(type)]);

  const remember = (kind: "users" | "groups", hit?: NoticeLookupHit) => {
    if (!hit) return;
    onLabels({ ...labels, [kind]: { ...labels[kind], [String(hit.id)]: hit.name } });
  };

  const hasEveryone = rules.some((r) => r.type === "everyone");
  const groupTiers = options.tiers.filter((t) => t.scope === "group" && t.paid);
  const userTiers = options.tiers.filter((t) => t.scope === "user" && t.paid);

  return (
    <div className="space-y-3">
      {rules.length === 0 && (
        <p className="text-osrs-parchment-dark/60 text-sm">Nobody yet. Add who should see this below.</p>
      )}

      {rules.map((rule, i) => (
        <div key={i}>
          {i > 0 && (
            <p className="text-osrs-parchment-dark/50 mb-2 text-center text-[11px] font-semibold tracking-wide uppercase">
              or
            </p>
          )}
          <div className="border-osrs-bronze/30 bg-osrs-surface-1 rounded-xl border p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-osrs-gold text-sm font-semibold">{RULE_LABELS[rule.type].label}</p>
                <p className="text-osrs-parchment-dark/60 text-xs">{RULE_LABELS[rule.type].hint}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-osrs-parchment-dark/50 hover:text-osrs-red text-xs"
                aria-label={`Remove ${RULE_LABELS[rule.type].label}`}
              >
                Remove
              </button>
            </div>

            {rule.type === "users" && (
              <EntityPicker
                kind="user"
                selected={rule.user_ids}
                names={labels.users}
                placeholder="Search name, Discord id, user id or RSN"
                onChange={(ids, hit) => {
                  remember("users", hit);
                  update(i, { ...rule, user_ids: ids });
                }}
              />
            )}

            {rule.type === "group_leaders" && (
              <div className="space-y-3">
                <ChipRow label="Role">
                  <ToggleChip
                    active={rule.roles.includes("owner")}
                    onClick={() => update(i, { ...rule, roles: toggle(rule.roles, "owner") })}
                  >
                    Owners
                  </ToggleChip>
                  <ToggleChip
                    active={rule.roles.includes("admin")}
                    onClick={() => update(i, { ...rule, roles: toggle(rule.roles, "admin") })}
                  >
                    Admins
                  </ToggleChip>
                </ChipRow>
                <GroupFilters
                  groupIds={rule.group_ids}
                  groupTiers={rule.group_tiers}
                  tiers={groupTiers}
                  freeTier={options.free_tier}
                  names={labels.groups}
                  onGroups={(ids, hit) => {
                    remember("groups", hit);
                    update(i, { ...rule, group_ids: ids });
                  }}
                  onTiers={(t) => update(i, { ...rule, group_tiers: t })}
                />
              </div>
            )}

            {rule.type === "group_members" && (
              <GroupFilters
                groupIds={rule.group_ids}
                groupTiers={rule.group_tiers}
                tiers={groupTiers}
                freeTier={options.free_tier}
                names={labels.groups}
                onGroups={(ids, hit) => {
                  remember("groups", hit);
                  update(i, { ...rule, group_ids: ids });
                }}
                onTiers={(t) => update(i, { ...rule, group_tiers: t })}
              />
            )}

            {rule.type === "supporters" && (
              <div className="space-y-2">
                {userTiers.length > 0 && (
                  <ChipRow label="Personal">
                    {userTiers.map((t) => (
                      <ToggleChip
                        key={t.key}
                        active={rule.tier_keys.includes(t.key)}
                        onClick={() => update(i, { ...rule, tier_keys: toggle(rule.tier_keys, t.key) })}
                      >
                        {t.name}
                      </ToggleChip>
                    ))}
                  </ChipRow>
                )}
                {groupTiers.length > 0 && (
                  <ChipRow label="Paying for a group on">
                    {groupTiers.map((t) => (
                      <ToggleChip
                        key={t.key}
                        active={rule.tier_keys.includes(t.key)}
                        onClick={() => update(i, { ...rule, tier_keys: toggle(rule.tier_keys, t.key) })}
                      >
                        {t.name}
                      </ToggleChip>
                    ))}
                  </ChipRow>
                )}
                <p className="text-osrs-parchment-dark/50 text-xs">
                  {rule.tier_keys.length === 0 ? "No tier picked: every paying supporter." : "Anyone on a picked tier."}{" "}
                  Comped plans and Nitro boosts don&apos;t count.
                </p>
              </div>
            )}

            {rule.type === "everyone" && (
              <p className="text-osrs-ember text-xs">Every account that signs in to the site will see this.</p>
            )}
          </div>
        </div>
      ))}

      {!hasEveryone && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-osrs-parchment-dark/60 mr-1 text-xs">{rules.length ? "Or add:" : "Add:"}</span>
          {RULE_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => add(type)}
              title={RULE_LABELS[type].hint}
              className="border-osrs-bronze/40 text-osrs-parchment hover:border-osrs-gold/60 hover:text-osrs-gold-bright rounded-full border border-dashed px-2.5 py-1 text-xs transition-colors"
            >
              + {RULE_LABELS[type].label}
            </button>
          ))}
        </div>
      )}

      <AudienceCount rules={rules} onCount={onCount} />
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-osrs-parchment-dark/60 w-full text-[11px] font-semibold tracking-wide uppercase sm:w-auto sm:pr-1">
        {label}
      </span>
      {children}
    </div>
  );
}

function GroupFilters({
  groupIds,
  groupTiers,
  tiers,
  freeTier,
  names,
  onGroups,
  onTiers,
}: {
  groupIds: number[];
  groupTiers: string[];
  tiers: NoticeOptions["tiers"];
  freeTier: string;
  names: Record<string, string>;
  onGroups: (ids: number[], hit?: NoticeLookupHit) => void;
  onTiers: (tiers: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-osrs-parchment-dark/60 mb-1 text-[11px] font-semibold tracking-wide uppercase">Groups</p>
        <EntityPicker
          kind="group"
          selected={groupIds}
          names={names}
          placeholder="Search groups by name or id"
          emptyLabel="Any group."
          onChange={onGroups}
        />
      </div>
      <ChipRow label="Group plan">
        <ToggleChip active={groupTiers.includes(freeTier)} onClick={() => onTiers(toggle(groupTiers, freeTier))}>
          Free
        </ToggleChip>
        {tiers.map((t) => (
          <ToggleChip key={t.key} active={groupTiers.includes(t.key)} onClick={() => onTiers(toggle(groupTiers, t.key))}>
            {t.name}
          </ToggleChip>
        ))}
        {groupTiers.length === 0 && <span className="text-osrs-parchment-dark/50 text-xs">Any plan.</span>}
      </ChipRow>
    </div>
  );
}

/** Live "how many does this reach" read-out. */
function AudienceCount({
  rules,
  onCount,
}: {
  rules: NoticeRule[];
  onCount?: (count: number | null) => void;
}) {
  const problem = audienceProblem(rules);
  const key = JSON.stringify(rules);
  const [result, setResult] = useState<{ key: string; data?: NoticeAudiencePreview; error?: string } | null>(null);

  useEffect(() => {
    if (problem) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      previewNoticeAudience(JSON.parse(key) as NoticeRule[])
        .then((data) => !cancelled && setResult({ key, data }))
        .catch((err) => !cancelled && setResult({ key, error: getErrorMessage(err, "Couldn't count this audience.") }));
    }, COUNT_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, problem]);

  const fresh = result?.key === key ? result : null;
  const count = problem ? null : (fresh?.data?.count ?? null);
  useEffect(() => {
    onCount?.(count);
  }, [count, onCount]);

  return (
    <div
      aria-live="polite"
      className={cn(
        "rounded-xl border px-3 py-2.5 text-sm",
        problem || fresh?.error
          ? "border-osrs-bronze/30 text-osrs-parchment-dark/70"
          : "border-osrs-gold/30 bg-osrs-gold/5",
      )}
    >
      {problem ? (
        problem
      ) : fresh?.error ? (
        <span className="text-osrs-red">{fresh.error}</span>
      ) : !fresh?.data ? (
        <span className="text-osrs-parchment-dark/60">Counting…</span>
      ) : (
        <div className="space-y-1">
          <p>
            <span className="text-osrs-gold-bright font-semibold tabular-nums">
              {fresh.data.count.toLocaleString()}
            </span>{" "}
            {fresh.data.everyone
              ? "accounts (everyone). "
              : `${fresh.data.count === 1 ? "account matches" : "accounts match"} right now. `}
            <span className="text-osrs-parchment-dark/60">They see it the next time they open the site.</span>
          </p>
          {fresh.data.sample.length > 0 && (
            <p className="text-osrs-parchment-dark/60 text-xs">
              Including {fresh.data.sample.join(", ")}
              {fresh.data.count > fresh.data.sample.length ? ", …" : ""}
            </p>
          )}
          {fresh.data.notes.map((n) => (
            <p key={n} className="text-osrs-parchment-dark/60 text-xs">
              {n}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * Notification footer settings (custom_footer entitlement, every paid plan).
 * One choice for every notification, plus an optional override per type. The
 * bot resolves them the same way as `resolveFooter`: the type's own choice,
 * then its fallback type's, then the choice for every notification.
 */
import { useState, useTransition } from "react";
import {
  FOOTER_TEXT_MAX,
  FOOTER_TYPE_LABELS,
  type FooterChoice,
  type FooterMode,
  type FooterType,
  type NotificationFooters,
} from "@droptracker/api-types";
import {
  resetNotificationFootersAction,
  saveNotificationFootersAction,
} from "@/app/(site)/(admin)/groups/[id]/embeds/footer-actions";
import { resolveFooter } from "@/lib/notification-footers";
import { Alert, Button, Card, Input, Select } from "@/components/ui";

type Choice = { mode: FooterMode; text: string };
/** "inherit" = no row for the type: it follows the choice above it. */
type TypeChoice = { mode: FooterMode | "inherit"; text: string };

const MODE_LABELS: Record<FooterMode, string> = {
  default: "DropTracker footer",
  none: "No footer",
  custom: "Your own text",
};

function toChoice(c: FooterChoice | null | undefined): Choice {
  return { mode: c?.mode ?? "default", text: c?.text ?? "" };
}

function ChoiceEditor({
  value,
  onChange,
  inheritLabel,
  label,
}: {
  value: TypeChoice;
  onChange: (next: TypeChoice) => void;
  inheritLabel?: string;
  label: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        value={value.mode}
        aria-label={`${label} footer`}
        onChange={(e) => onChange({ ...value, mode: e.target.value as TypeChoice["mode"] })}
        className="sm:w-48 sm:shrink-0"
      >
        {inheritLabel && <option value="inherit">{inheritLabel}</option>}
        {(Object.keys(MODE_LABELS) as FooterMode[]).map((m) => (
          <option key={m} value={m}>
            {MODE_LABELS[m]}
          </option>
        ))}
      </Select>
      {value.mode === "custom" && (
        <Input
          type="text"
          value={value.text}
          maxLength={FOOTER_TEXT_MAX}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          className="w-full min-w-0"
          placeholder="Your clan name | your-site.com"
          aria-label={`${label} footer text`}
        />
      )}
    </div>
  );
}

export function FooterEditor({
  groupId,
  initial,
}: {
  groupId: number;
  initial: NotificationFooters;
}) {
  const [saved, setSaved] = useState(initial);
  const [all, setAll] = useState<Choice>(() => toChoice(initial.all));
  const [types, setTypes] = useState<Partial<Record<FooterType, TypeChoice>>>(
    () =>
      Object.fromEntries(
        Object.entries(initial.types).map(([t, c]) => [t, toChoice(c)]),
      ) as Partial<Record<FooterType, TypeChoice>>,
  );
  const [perType, setPerType] = useState(() => Object.keys(initial.types).length > 0);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const ours = saved.default_footer ?? "";
  const typeChoice = (t: FooterType): TypeChoice => types[t] ?? { mode: "inherit", text: "" };

  const load = (data: NotificationFooters) => {
    setSaved(data);
    setAll(toChoice(data.all));
    setTypes(
      Object.fromEntries(Object.entries(data.types).map(([t, c]) => [t, toChoice(c)])) as Partial<
        Record<FooterType, TypeChoice>
      >,
    );
    setDirty(false);
  };

  // What the bot would send with the unsaved settings, for the per-type list.
  const draftFooters: NotificationFooters = {
    ...saved,
    entitled: true,
    all: all.mode === "default" ? null : { mode: all.mode, text: all.text },
    types: Object.fromEntries(
      Object.entries(types)
        .filter(([, c]) => perType && c && c.mode !== "inherit")
        .map(([t, c]) => [t, { mode: c!.mode as FooterMode, text: c!.text }]),
    ),
  };

  const save = () => {
    const blank = [
      ...(all.mode === "custom" && !all.text.trim() ? ["every notification"] : []),
      ...(perType
        ? Object.entries(types)
            .filter(([, c]) => c?.mode === "custom" && !c.text.trim())
            .map(([t]) => FOOTER_TYPE_LABELS[t as FooterType])
        : []),
    ];
    if (blank.length) {
      setMessage({
        tone: "error",
        text: `Enter footer text for ${blank.join(", ")}, or choose No footer.`,
      });
      return;
    }
    startTransition(async () => {
      const res = await saveNotificationFootersAction(groupId, {
        all: draftFooters.all,
        types: draftFooters.types,
      });
      if (!res.ok) {
        setMessage({ tone: "error", text: res.error });
        return;
      }
      load(res.data);
      setMessage({ tone: "success", text: "Saved. New notifications use it within a minute." });
    });
  };

  const reset = () => {
    if (!window.confirm("Go back to the DropTracker footer on every notification?")) return;
    startTransition(async () => {
      const res = await resetNotificationFootersAction(groupId);
      if (!res.ok) {
        setMessage({ tone: "error", text: res.error });
        return;
      }
      load(res.data);
      setPerType(false);
      setMessage({ tone: "success", text: "Back to the DropTracker footer." });
    });
  };

  const hasSaved = saved.all !== null || Object.keys(saved.types).length > 0;

  return (
    <div className="space-y-4">
      {message && <Alert variant={message.tone}>{message.text}</Alert>}

      <Card padding="p-5" className="space-y-3">
        <div>
          <h3 className="text-osrs-gold text-sm font-semibold">Every notification</h3>
          <p className="text-osrs-parchment-dark/60 mt-1 text-xs">
            The small line under each embed the bot posts. By default it reads &quot;{ours}&quot;.
            You can remove it or use your own text.
          </p>
        </div>
        <ChoiceEditor
          value={all}
          label="Every notification"
          onChange={(next) => {
            setAll({ mode: next.mode === "inherit" ? "default" : next.mode, text: next.text });
            setDirty(true);
          }}
        />
        <p className="text-osrs-parchment-dark/50 text-xs">
          Placeholders work too.{" "}
          <code className="text-osrs-gold-bright">{"{player_name_plain}"}</code> works everywhere;
          others, like <code className="text-osrs-gold-bright">{"{npc_name}"}</code>, fill in only
          on the notifications that have them and are left blank on the rest.
        </p>
      </Card>

      <Card padding="p-5" className="space-y-3">
        <label className="text-osrs-parchment flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={perType}
            onChange={(e) => {
              setPerType(e.target.checked);
              setDirty(true);
            }}
            className="accent-osrs-gold"
          />
          Set a different footer for some notification types
        </label>
        {perType && (
          <div className="divide-osrs-bronze/20 divide-y">
            {saved.footer_types.map((t) => {
              const fallback = saved.fallback_types[t] as FooterType | undefined;
              const sent = resolveFooter(draftFooters, t);
              return (
                <div key={t} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[12rem_1fr]">
                  <div>
                    <div className="text-osrs-parchment text-sm">{FOOTER_TYPE_LABELS[t]}</div>
                    <div className="text-osrs-parchment-dark/50 truncate text-xs">
                      {sent === null ? "No footer" : sent}
                    </div>
                  </div>
                  <ChoiceEditor
                    value={typeChoice(t)}
                    label={FOOTER_TYPE_LABELS[t]}
                    inheritLabel={
                      fallback
                        ? `Same as ${FOOTER_TYPE_LABELS[fallback]}`
                        : "Same as every notification"
                    }
                    onChange={(next) => {
                      setTypes((m) => ({ ...m, [t]: next }));
                      setDirty(true);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" type="button" onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save footer"}
        </Button>
        {hasSaved && (
          <Button variant="ghost" type="button" onClick={reset} disabled={pending}>
            Use the DropTracker footer everywhere
          </Button>
        )}
        {dirty && <span className="text-osrs-parchment-dark/60 text-xs">Unsaved changes</span>}
      </div>
    </div>
  );
}

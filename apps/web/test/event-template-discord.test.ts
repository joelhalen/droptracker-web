/** Event templates: optional Discord settings (suggestion #197). */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EventTemplateDetailSchema,
  EventTemplateInstantiateResultSchema,
  EventTemplateSaveInputSchema,
} from "@droptracker/api-types";

const detailBase = {
  id: 1,
  name: "Weekly BotW",
  preview: { tasks: [], teams: [] },
};

test("template detail without saved Discord settings still parses", () => {
  const d = EventTemplateDetailSchema.parse(detailBase);
  assert.equal(d.preview.discord ?? null, null);
});

test("template detail carries Discord counts", () => {
  const d = EventTemplateDetailSchema.parse({
    ...detailBase,
    preview: { ...detailBase.preview, discord: { channels: 2, pings: 1, team_channels: true } },
  });
  assert.deepEqual(d.preview.discord, { channels: 2, pings: 1, team_channels: true });
});

test("instantiate result: discord report optional, dropped defaults to 0", () => {
  const bare = EventTemplateInstantiateResultSchema.parse({ id: 5, skipped_tasks: [] });
  assert.equal(bare.discord ?? null, null);
  const r = EventTemplateInstantiateResultSchema.parse({
    id: 5,
    skipped_tasks: [],
    discord: { applied: false, reason: "Not your server" },
  });
  assert.deepEqual(r.discord, { applied: false, reason: "Not your server", dropped: 0 });
});

test("save input keeps include_discord and leaves it unset by default", () => {
  assert.equal(EventTemplateSaveInputSchema.parse({ name: "T" }).include_discord, undefined);
  assert.equal(
    EventTemplateSaveInputSchema.parse({ name: "T", include_discord: true }).include_discord,
    true,
  );
});

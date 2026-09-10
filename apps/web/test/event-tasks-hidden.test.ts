import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EventDetailSchema,
  EventInputSchema,
  EventPlayerDetailSchema,
  EventSummarySchema,
  EventTeamDetailSchema,
} from "@droptracker/api-types";
import { mockEvent, mockEventTeam } from "../lib/mock-data";

/** Board/task visibility (web112a): the setting on the summary, the
 * `tasks_hidden` signal on every task-bearing detail, and the PATCH input. */

test("a payload from before the column reads as public and shown", () => {
  const legacy = EventSummarySchema.parse({
    id: 1,
    group_id: 2,
    name: "Bingo",
    status: "active",
    starts_at: null,
    ends_at: null,
  });
  assert.equal(legacy.tasks_visibility, "public");
  const detail = EventDetailSchema.parse({ ...mockEvent(1) });
  assert.equal(detail.tasks_hidden, false);
});

test("a hidden detail carries the signal with no tasks, board or progress", () => {
  const hidden = EventDetailSchema.parse({
    ...mockEvent(1),
    tasks_visibility: "admins",
    tasks: [],
    bingo: null,
    progress: undefined,
    tasks_hidden: true,
  });
  assert.equal(hidden.tasks_hidden, true);
  assert.deepEqual(hidden.tasks, []);
  assert.equal(hidden.bingo, null);
  assert.equal(hidden.progress, undefined);
});

test("team and player details default the signal off", () => {
  assert.equal(EventTeamDetailSchema.parse(mockEventTeam(1, 21)).tasks_hidden, false);
  const team = EventTeamDetailSchema.parse({ ...mockEventTeam(1, 21), tasks: [], tasks_hidden: true });
  assert.equal(team.tasks_hidden, true);
  const player = EventPlayerDetailSchema.parse({
    event: mockEvent(1),
    player: { player_id: 5, player_name: "Ra ine" },
    tasks_hidden: true,
    activity: [{ id: 1, task_id: 91, task_label: null, created_at: null }],
  });
  assert.equal(player.tasks_hidden, true);
  assert.equal(player.activity[0]?.task_label, null);
});

test("the manager's PATCH accepts the setting and refuses other values", () => {
  const patch = EventInputSchema.omit({ group_id: true }).partial();
  assert.equal(patch.parse({ tasks_visibility: "admins" }).tasks_visibility, "admins");
  assert.equal(patch.parse({ tasks_visibility: "public" }).tasks_visibility, "public");
  assert.throws(() => patch.parse({ tasks_visibility: "private" }));
});

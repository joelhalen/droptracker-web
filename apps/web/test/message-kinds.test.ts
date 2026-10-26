import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GROUP_CONFIG_FIELDS,
  GroupMemberDeathMessagesSchema,
  MEMBER_MESSAGE_TOKENS,
  MEMBER_MESSAGE_TOKEN_ALIASES,
  MEMBER_MESSAGE_TYPES,
  MyDeathMessagesSchema,
  PLAIN_TEXT_TYPE_OPTIONS,
  memberDeathMessageIssue,
  memberDeathMessagesIssue,
} from "@droptracker/api-types";
import { previewDeathMessage } from "../lib/member-death-messages";
import { MESSAGE_KINDS, messageKindForKey } from "../lib/message-kinds";
import { mockGroupMemberDeathMessages, mockMyDeathMessages } from "../lib/mock-data";

/**
 * Collection log, drop and personal best messages alongside deaths. The
 * per-type placeholder lists mirror the backend's MessageKind tokens
 * (tests/unit/test_member_message_types.py there).
 */

test("every message type has its three group settings", () => {
  const keys = new Set(GROUP_CONFIG_FIELDS.map((f) => f.key));
  for (const t of MEMBER_MESSAGE_TYPES) {
    assert.ok(keys.has(`${t}_message_variants`), t);
    assert.ok(keys.has(`${t}_message_as_embed_description`), t);
    assert.ok(keys.has(`allow_member_${t}_messages`), t);
  }
});

test("a list key resolves to its kind", () => {
  assert.equal(messageKindForKey("drop_message_variants"), "drop");
  assert.equal(messageKindForKey("pb_message_variants"), "pb");
  assert.equal(messageKindForKey("death_message_variants"), "death");
  assert.equal(messageKindForKey("something_else"), "death");
});

test("placeholders are checked per type", () => {
  assert.match(
    memberDeathMessageIssue("{player_name} died to {killer}", "pb") ?? "",
    /Unknown placeholder/,
  );
  assert.equal(memberDeathMessageIssue("{player_name} got {boss} to {time}", "pb"), null);
  assert.equal(memberDeathMessageIssue("{player_name} {npc_name} {kc_received}", "clog"), null);
  assert.equal(memberDeathMessageIssue("{player_name} died to {killer}"), null);
});

test("aliases point at documented tokens", () => {
  for (const t of MEMBER_MESSAGE_TYPES) {
    for (const canonical of Object.values(MEMBER_MESSAGE_TOKEN_ALIASES[t])) {
      assert.ok(MEMBER_MESSAGE_TOKENS[t].includes(canonical), `${t} ${canonical}`);
    }
  }
});

test("the suggested lines are ones a member may save", () => {
  for (const t of MEMBER_MESSAGE_TYPES) {
    if (t === "death") continue; // death's suggestions predate the member editor
    assert.equal(memberDeathMessagesIssue(MESSAGE_KINDS[t].suggested.slice(0, 5), t), null, t);
  }
});

test("previews read aliases for the type", () => {
  const tokens = mockMyDeathMessages("pb").tokens;
  assert.equal(
    previewDeathMessage("{player_name}: {npc_name} in {personal_best}", tokens, "Ron", "pb"),
    "Ron: Vorkath in 1:02.40",
  );
});

test("mocks parse for every type", () => {
  for (const t of MEMBER_MESSAGE_TYPES) {
    assert.equal(MyDeathMessagesSchema.parse(mockMyDeathMessages(t)).type, t);
    assert.equal(GroupMemberDeathMessagesSchema.parse(mockGroupMemberDeathMessages(t)).type, t);
  }
});

test("a payload from before message types still parses", () => {
  const { type: _type, ...legacy } = mockMyDeathMessages("death");
  assert.equal(MyDeathMessagesSchema.parse(legacy).type, undefined);
});

test("plain-text options name every type once", () => {
  const values = PLAIN_TEXT_TYPE_OPTIONS.map((o) => o.value);
  assert.equal(new Set(values).size, values.length);
  for (const t of ["drop", "clog", "pb", "death"]) assert.ok(values.includes(t));
});

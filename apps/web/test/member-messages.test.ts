import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GroupMemberDeathMessagesSchema,
  MEMBER_MESSAGE_MAX_LENGTH,
  MEMBER_MESSAGE_MAX_MESSAGES,
  MyDeathMessagesSchema,
  memberDeathMessageIssue,
  memberDeathMessagesIssue,
  normalizeMemberDeathMessages,
} from "@droptracker/api-types";
import {
  deathMessagesChanged,
  groupPostingState,
  previewDeathMessage,
} from "../lib/member-death-messages";
import { mockGroupMemberDeathMessages, mockMyDeathMessages } from "../lib/mock-data";

/**
 * Members' own death messages. The validator mirrors the backend's
 * (disc db/member_messages.py) so the editor can explain a refusal before the
 * save; these cases are the same ones tests/unit/test_member_messages.py pins
 * there, with the same wording, so a rule changed on one side fails here.
 */

const MENTIONS = "Messages can't mention people, roles or channels, or use custom emoji.";
const LINKS = "Messages can't contain links.";
const HEADINGS = "Messages can't start with a heading or a quote.";
const ONE_LINE = "Each message has to be a single line of text.";

test("limits match the backend", () => {
  assert.equal(MEMBER_MESSAGE_MAX_MESSAGES, 5);
  assert.equal(MEMBER_MESSAGE_MAX_LENGTH, 150);
});

test("normalizing trims, drops blank rows and duplicates, lowercases placeholders", () => {
  assert.deepEqual(
    normalizeMemberDeathMessages(["  {player_name} forgot to pray  ", "", "   ", "{player_name} forgot to pray"]),
    ["{player_name} forgot to pray"],
  );
  assert.deepEqual(normalizeMemberDeathMessages(["{Player_Name} vs {KILLER}"]), ["{player_name} vs {killer}"]);
});

test("at most five messages, blank rows not counted", () => {
  assert.match(memberDeathMessagesIssue(["a", "b", "c", "d", "e", "f"]) ?? "", /at most 5 messages/);
  assert.equal(memberDeathMessagesIssue(["a", "b", "c", "d", "e", "", " "]), null);
});

test("length is counted in characters, not UTF-16 units", () => {
  assert.equal(memberDeathMessageIssue("x".repeat(151)), "Each message can be at most 150 characters.");
  assert.equal(memberDeathMessageIssue("x".repeat(150)), null);
  // 150 emoji are 300 UTF-16 units but 150 characters to the backend.
  assert.equal(memberDeathMessageIssue("💀".repeat(150)), null);
});

for (const text of [
  "@everyone rip", "@here rip", "<@123> rip", "<@!123> rip", "<@&456> rip",
  "<#789> rip", "<:skull:123456> rip", "<a:dance:123456> rip",
  "</settings:123456> rip", "<t:1700000000:R> rip",
]) {
  test(`no mentions or Discord entities: ${text}`, () => {
    assert.equal(memberDeathMessageIssue(text), MENTIONS);
  });
}

for (const text of [
  "see https://example.com", "http://x.y", "www.example.org rip",
  "join discord.gg/abcdef", "discord.com/invite/abc", "free gp at scam.xyz",
  "[click me](https://example.com)",
]) {
  test(`no links: ${text}`, () => {
    assert.equal(memberDeathMessageIssue(text), LINKS);
  });
}

for (const text of ["# {player_name} died", "## big", "-# small", "> quoted", ">>> quoted"]) {
  test(`no headings or quotes: ${text}`, () => {
    assert.equal(memberDeathMessageIssue(text), HEADINGS);
  });
}

for (const text of ["line one\nline two", "tab\tseparated", "sep\u2028arated"]) {
  test(`single line: ${JSON.stringify(text)}`, () => {
    assert.equal(memberDeathMessageIssue(text), ONE_LINE);
  });
}

test("unknown placeholders are named, with what is allowed", () => {
  const issue = memberDeathMessageIssue("{player_name} {video_url} {image_url}") ?? "";
  assert.ok(issue.startsWith("Unknown placeholders {image_url}, {video_url}."), issue);
  assert.ok(issue.includes("{killer}"));
});

for (const text of [
  "{player_name} lost {value_lost} (kept {value_kept}) to a level {killer_combat_level} {killer}",
  "{player_name} died at {location}",
  "{player_name} vs {source} in {region_name}",
  "Mr. Mordaut got {player_name} again — 4.2M gone, e.g. everything",
  "{player_name} **really** thought that was ||safe||",
]) {
  test(`ordinary messages pass: ${text}`, () => {
    assert.equal(memberDeathMessageIssue(text), null);
  });
}

test("the preview fills samples, the account name and aliases, and drops what it may not use", () => {
  const { tokens } = mockMyDeathMessages();
  assert.equal(
    previewDeathMessage("{player_name} fed {killer} at {region_name} {video_url}", tokens, "Iron Ron"),
    "Iron Ron fed Vorkath at Ungael",
  );
  assert.equal(previewDeathMessage("{Source} again", tokens, "Ron"), "Vorkath again");
});

test("a group posts, is off, or has blocked the member", () => {
  assert.equal(groupPostingState({ id: 1, name: "A", allowed: true, blocked: false }), "posting");
  assert.equal(groupPostingState({ id: 1, name: "A", allowed: false, blocked: false }), "off");
  // Blocked wins, whether or not the group has the feature on.
  assert.equal(groupPostingState({ id: 1, name: "A", allowed: true, blocked: true }), "blocked");
  assert.equal(groupPostingState({ id: 1, name: "A", allowed: false, blocked: true }), "blocked");
});

test("unsaved changes are judged on what would actually be saved", () => {
  const saved = ["{player_name} planked"];
  assert.equal(deathMessagesChanged(["  {player_name} planked ", ""], saved), false);
  assert.equal(deathMessagesChanged(["{Player_Name} planked"], saved), false);
  assert.equal(deathMessagesChanged(["{player_name} planked again"], saved), true);
  assert.equal(deathMessagesChanged([], saved), true);
});

test("the mock payloads parse, so mock mode matches the contract", () => {
  assert.doesNotThrow(() => MyDeathMessagesSchema.parse(mockMyDeathMessages()));
  assert.doesNotThrow(() => GroupMemberDeathMessagesSchema.parse(mockGroupMemberDeathMessages()));
});

test("a real backend payload parses", () => {
  const body = {
    max_length: 150,
    max_messages: 5,
    tokens: [{ help: "Your name", sample: "Zezima", token: "{player_name}" }],
    players: [
      {
        id: 9,
        name: "Alice",
        messages: ["{player_name} planked"],
        updated_at: "2026-09-14T12:00:00",
        groups: [{ allowed: false, blocked: false, id: 2, name: "DropTracker.io" }],
      },
    ],
  };
  const parsed = MyDeathMessagesSchema.parse(body);
  assert.equal(parsed.players[0]!.groups[0]!.name, "DropTracker.io");
  assert.throws(() =>
    GroupMemberDeathMessagesSchema.parse({ enabled: "yes", members: [] }),
  );
});

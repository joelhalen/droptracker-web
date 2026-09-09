import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONFIG_CATEGORIES,
  GROUP_CONFIG_FIELDS,
  type ConfigField,
} from "@droptracker/api-types";
import {
  SETTINGS_INSERTS,
  SETTINGS_SECTIONS,
  blockLayout,
  fieldBlocks,
  fieldMatches,
  fieldsForCategory,
  navGroups,
  seasonalFieldsGrouped,
  sectionForKey,
  visibleSections,
} from "@/lib/group-settings-sections";

/**
 * The settings page renders whatever this model says, so the model has to
 * cover the registry completely: a category left out of SETTINGS_SECTIONS is a
 * set of settings nobody can reach from the website.
 */

test("every registry category is exactly one page section, and the page has nothing else registry-shaped", () => {
  const categoryIds = SETTINGS_SECTIONS.filter((s) => s.kind === "category").map((s) => s.id);
  assert.deepEqual([...categoryIds].sort(), CONFIG_CATEGORIES.map((c) => c.id).sort());
  assert.equal(new Set(categoryIds).size, categoryIds.length);
  // Every field lands in a section that exists.
  for (const f of GROUP_CONFIG_FIELDS) {
    assert.ok(categoryIds.includes(f.category), `${f.key} category ${f.category} has no section`);
  }
  // The two list editors and the Seasonal section are the only non-registry sections.
  assert.deepEqual(
    SETTINGS_SECTIONS.filter((s) => s.kind !== "category").map((s) => s.id),
    ["blacklist", "always", "seasonal"],
  );
});

test("section labels come from the shared registry, so the Discord panel says the same thing", () => {
  for (const s of SETTINGS_SECTIONS) {
    if (s.kind !== "category") continue;
    assert.equal(s.label, CONFIG_CATEGORIES.find((c) => c.id === s.id)?.label);
    assert.ok(s.blurb.trim(), `${s.id} has no blurb`);
  }
});

test("sidebar groups are contiguous runs — a heading never appears twice", () => {
  const groups = navGroups(visibleSections(""));
  const navs = groups.map((g) => g.nav);
  assert.equal(new Set(navs).size, navs.length, `nav headings repeat: ${navs.join(", ")}`);
  // Page order: the group's own profile first, seasonal mirrors last.
  assert.equal(navs[0], "Group");
  assert.equal(navs[navs.length - 1], "Seasonal worlds");
  assert.equal(SETTINGS_SECTIONS[0]?.id, "profile");
});

test("inserts point at registry sections and read as part of them", () => {
  const categoryIds = new Set(CONFIG_CATEGORIES.map((c) => c.id));
  for (const insert of SETTINGS_INSERTS) {
    assert.ok(categoryIds.has(insert.section), `${insert.id} targets unknown section ${insert.section}`);
    assert.ok(insert.keywords.length > 0, `${insert.id} needs filter keywords`);
  }
  assert.equal(SETTINGS_INSERTS.find((i) => i.id === "groupIcon")?.section, "profile");
  assert.equal(SETTINGS_INSERTS.find((i) => i.id === "timeframeBoard")?.section, "board");
});

// The reorganisation the page was rebuilt around: name/description at the top,
// the clan chat bridge and the voice counters out of the old catch-all
// "Integration & info" section, each feature owning its channel.
test("the moved settings live where the page now says they do", () => {
  const cat = (key: string) => GROUP_CONFIG_FIELDS.find((f) => f.key === key)?.category;
  assert.equal(cat("group_name"), "profile");
  assert.equal(cat("group_description"), "profile");
  assert.equal(cat("discord_url"), "profile");
  for (const key of [
    "clan_chat_name",
    "clan_broadcast_tracking",
    "clan_broadcast_min_value",
    "clan_broadcast_notify_without_images",
    "clan_chat_bridge_enabled",
    "channel_id_clan_chat_bridge",
  ]) {
    assert.equal(cat(key), "clan_chat", key);
  }
  for (const key of GROUP_CONFIG_FIELDS.filter((f) => f.key.startsWith("vc_to_display_")).map((f) => f.key)) {
    assert.equal(cat(key), "voice", key);
  }
  assert.equal(cat("lootboard_channel_id"), "board");
  assert.equal(cat("channel_id_to_post_manual_review"), "drops");
  assert.equal(cat("min_ca_tier_to_notify"), "achievements");
  // What is left of the old section is WiseOldMan and API keys only.
  assert.deepEqual(
    fieldsForCategory("integration")
      .map((f) => f.key)
      .sort(),
    ["auto_provision_members", "event_wom_reconciliation", "export_api_key", "wom_verification_code"],
  );
});

test("ungrouped fields open their section: the registry never declares one after a grouped field", () => {
  for (const c of CONFIG_CATEGORIES) {
    let seenGroup = false;
    for (const f of fieldsForCategory(c.id)) {
      if (f.group) seenGroup = true;
      else assert.ok(!seenGroup, `${f.key} is ungrouped but follows a grouped field in ${c.id}`);
    }
  }
});

test("fieldBlocks keeps registry order and puts ungrouped fields first", () => {
  const f = (key: string, group?: string): ConfigField => ({
    key,
    label: key,
    category: "drops",
    type: "boolean",
    help: "",
    default: false,
    group,
  });
  const blocks = fieldBlocks([f("a", "B"), f("b"), f("c", "A"), f("d", "B")]);
  assert.deepEqual(
    blocks.map((b) => [b.group, b.fields.map((x) => x.key)]),
    [
      [null, ["b"]],
      ["B", ["a", "d"]],
      ["A", ["c"]],
    ],
  );
});

test("a block leads with its toggles only when a toggle is declared first", () => {
  const deaths = fieldBlocks(fieldsForCategory("deaths"));
  const main = blockLayout(deaths[0]!.fields);
  assert.equal(main.leadWithToggles, true, "Notify deaths is the first thing in Deaths");
  assert.deepEqual(
    main.toggles.map((f) => f.key),
    ["notify_deaths", "notify_deaths_safe"],
  );
  assert.deepEqual(main.compact.map((f) => f.key), ["channel_id_to_post_deaths"]);

  const messages = deaths.find((b) => b.group === "Death messages")!;
  const layout = blockLayout(messages.fields);
  assert.equal(layout.leadWithToggles, false, "the message editor comes before its placement toggle");
  assert.deepEqual(layout.wide.map((f) => f.key), ["death_message_variants"]);

  const drops = blockLayout(fieldBlocks(fieldsForCategory("drops"))[0]!.fields);
  assert.equal(drops.leadWithToggles, false, "minimum value opens Drop notifications");
  assert.equal(drops.compact[0]?.key, "minimum_value_to_notify");
});

test("filter matches what an admin can see, including keys with the underscores spaced out", () => {
  const review = GROUP_CONFIG_FIELDS.find((f) => f.key === "channel_id_to_post_manual_review")!;
  assert.ok(fieldMatches(review, "manual review"));
  assert.ok(fieldMatches(review, "approval")); // from its help text
  assert.ok(fieldMatches(review, "manual submissions")); // its group heading
  assert.ok(!fieldMatches(review, "death"));
  assert.ok(fieldMatches(review, ""), "an empty query matches everything");
});

test("visibleSections narrows to matching fields, keeps a whole section when its title matches, and drops the rest", () => {
  const all = visibleSections("");
  assert.equal(all.length, SETTINGS_SECTIONS.length);
  for (const v of all) {
    if (v.section.kind === "category") {
      assert.equal(v.fields.length, fieldsForCategory(v.section.id as never).length);
    }
  }

  // A word from one field's help text: only that field, in only that section
  // (plus any section whose own copy mentions it).
  const bridge = visibleSections("relayed into the game");
  assert.deepEqual(bridge.map((v) => v.section.id), ["clan_chat"]);
  assert.deepEqual(bridge[0]!.fields.map((f) => f.key), ["channel_id_clan_chat_bridge"]);
  assert.deepEqual(bridge[0]!.inserts, []);

  // A section title: every field of it, inserts included.
  const board = visibleSections("Lootboard").find((v) => v.section.id === "board")!;
  assert.equal(board.fields.length, fieldsForCategory("board").length);
  assert.deepEqual(board.inserts.map((i) => i.id), ["timeframeBoard"]);

  // An insert's own keyword shows its section with just the insert.
  const icon = visibleSections("avatar");
  assert.deepEqual(icon.map((v) => v.section.id), ["profile"]);
  assert.deepEqual(icon[0]!.fields, []);
  assert.deepEqual(icon[0]!.inserts.map((i) => i.id), ["groupIcon"]);

  // Panel sections match on their keywords.
  assert.ok(visibleSections("mute").some((v) => v.section.id === "blacklist"));
  assert.ok(!visibleSections("mute").some((v) => v.section.id === "always"));

  // Seasonal mirrors are searchable through their base field.
  const seasonal = visibleSections("Notify pets").find((v) => v.section.id === "seasonal");
  assert.ok(seasonal && seasonal.fields.some((f) => f.key === "notify_pets"));

  assert.deepEqual(visibleSections("zzzz-no-such-setting"), []);
});

test("seasonal mirrors are grouped under their base category's label", () => {
  const grouped = seasonalFieldsGrouped();
  assert.ok(grouped.length > 0);
  for (const f of grouped) {
    assert.equal(f.group, CONFIG_CATEGORIES.find((c) => c.id === f.category)?.label);
  }
  // Grouping never rewrites the key: the Seasonal section prefixes it itself.
  assert.ok(grouped.every((f) => !f.key.startsWith("seasonal_") || f.key === "seasonal_boards"));
});

test("sectionForKey sends a seasonal mirror to the Seasonal section and a base key to its category", () => {
  const pets = GROUP_CONFIG_FIELDS.find((f) => f.key === "notify_pets")!;
  assert.equal(sectionForKey("seasonal_notify_pets", pets), "seasonal");
  assert.equal(sectionForKey("notify_pets", pets), "achievements");
});

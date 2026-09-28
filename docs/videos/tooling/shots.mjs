// How each clip in episodes.mjs is filmed. One function per clip id.
//
//   node shots.mjs [clipId ...]        record the named clips (default: all)
//
// Every shot gets a page that is already loaded and settled; it calls
// `rec()` to start the camera, does its choreography, and returns. Page
// loads mid-shot go through `cut()` so the loading flash never hits the tape.
//
// Shots whose line has been voiced (tooling/vo, see voice.py) are cut to the
// read: `at("phrase")` is when the narrator says that phrase, measured from
// the start of the clip, and `until(t)` waits for that moment, so the cursor
// lands on "Bingo" as he says "Bingo". The runner keeps rolling until the
// beat's full length is on tape. Unvoiced, `at()` is null, `until(null)`
// returns at once, and a shot plays at its own pace.
import fs from "node:fs";
import path from "node:path";
import {
  BASE,
  openHD,
  go,
  glide,
  scroll,
  scrollTo,
  typeSlow,
  cast,
  setCursor,
  zoom,
  renamePlayers,
} from "./lib.mjs";
import { episodes } from "../episodes.mjs";
import { wordClock } from "./timing.mjs";

const OUT = process.env.CLIPS || path.resolve("clips");
const VO = process.env.VO || path.resolve("vo");
// Must match build.mjs: breath before the line, air after it, dissolve.
const LEAD = 0.35,
  TAIL = 0.45,
  XF = 0.3;

// The voiced timing for a clip: its take's sentences, placed on the clip's
// own clock, and how long the clip must run to cover the beat.
function cueSheet(clipId) {
  for (const ep of episodes)
    for (const [i, b] of ep.beats.entries()) {
      if (b.clip !== clipId) continue;
      const f = path.join(VO, ep.id, `${String(i + 1).padStart(2, "0")}.json`);
      if (!fs.existsSync(f)) return null;
      const take = JSON.parse(fs.readFileSync(f, "utf8"));
      if (take.text !== b.vo) return null;
      return {
        line: b.vo,
        sentences: take.sentences,
        clock: wordClock(b.vo, take.words),
        length: LEAD + take.duration + TAIL + (b.hold || 0) + XF,
      };
    }
  return null;
}

// When `phrase` is spoken: from the take's word clock when it has one;
// otherwise the start of its sentence plus its share of the sentence by
// position (a fair guess for one steady read).
function cueAt(sheet, phrase) {
  if (!sheet) return null;
  if (sheet.clock) {
    const k = sheet.line.toLowerCase().indexOf(phrase.toLowerCase());
    if (k < 0) throw new Error(`no cue "${phrase}" in the take`);
    return LEAD + sheet.clock.at(k);
  }
  for (const s of sheet.sentences) {
    const k = s.text.toLowerCase().indexOf(phrase.toLowerCase());
    if (k < 0) continue;
    return LEAD + s.start + ((s.end - s.start) * k) / s.text.length;
  }
  throw new Error(`no cue "${phrase}" in the take`);
}
const G = "/groups/101/events";
const EV = "/events/1";
const MGR = `${G}/1`;
const WIZ = (step) => `${G}/new?event=5&step=${step}`;
// Slides are served over http from localhost (see serveRepo in the runner):
// a file:// page runs in another renderer process, and the screencast loses
// the tab when a shot cuts from the site to a slide.
let SLIDES = "";
// Move the open slide scene to its nth state.
const step = (page, n) => page.evaluate((n) => window.step(n), n);

// Scroll so `sel` sits `top` px below the viewport top, instantly (pre-roll).
async function frame(page, sel, top = 110) {
  const y = await page
    .locator(sel)
    .first()
    .evaluate((el, top) => el.getBoundingClientRect().top + window.scrollY - top, top);
  await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, y));
  await page.waitForTimeout(400);
}
async function glideTo(page, sel, top = 110, ms = 1200) {
  const y = await page
    .locator(sel)
    .first()
    .evaluate((el, top) => el.getBoundingClientRect().top + window.scrollY - top, top);
  await scrollTo(page, Math.max(0, y), ms);
}
const tab = (page, name) =>
  page
    .locator("button, [role=tab], a")
    .filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) })
    .first();
async function soft(label, fn) {
  try {
    await fn();
  } catch (e) {
    console.warn(`  ! ${label}: ${e.message.split("\n")[0]}`);
  }
}

export const shots = {
  // ---------------------------------------------------------------- EP1
  // Cut to the voiced read: each `on()` is the phrase the picture answers.
  async e1_cold_open({ page, rec, on }) {
    await go(page, EV);
    await frame(page, "h1", 90);
    await rec();
    await glide(page, { x: 900, y: 420 }, { steps: 40, pause: 300 });
    await on("we should do a bingo", 0.8);
    await scroll(page, 330, 3000);
    await glide(page, { x: 470, y: 520 }, { steps: 50, pause: 300 });
    await on("And then one person", 0.3);
    await scroll(page, 160, 3000);
    await on("squinting at screenshots", 0.6);
    await glide(page, { x: 820, y: 560 }, { steps: 60, pause: 200 });
    await scroll(page, 140, 2400);
  },
  async e1_cold_open_2({ page, rec }) {
    await go(page, EV);
    await frame(page, "text=Tasks >> nth=-1", 100);
    await rec();
    await glide(page, { x: 700, y: 330 }, { steps: 40 });
    await scroll(page, 260, 3200);
  },
  async e1_events_tab({ page, rec, on }) {
    await go(page, G);
    await rec();
    await on("then Events", 0.7);
    await glide(page, "text=Events >> nth=1", { pause: 400 });
    await on("mission control", 0.6);
    await glide(page, "text=active 5 / 3", { pause: 300 });
    await on("Live events", 0.6);
    await glide(page, "text=Zulrah Blitz >> nth=0", { pause: 100, ms: 500 });
    // "Live events, drafts, things that already ended" is a quick list; the
    // drafts and past rows sit a scroll below the live ones.
    await on("drafts", 1.1);
    await glideTo(page, "text=Starts automatically", 330, 650);
    await glide(page, "text=Continue setup", { pause: 100, ms: 420 });
    await on("already ended", 0.5);
    await glide(page, "text=Spring Boss Race", { pause: 200, ms: 420 });
    await on("a button that says", 0.9);
    await scrollTo(page, 0, 1000);
    await glide(page, "text=Create event →", { pause: 300 });
    await on("Bravely", 0.2);
    await glide(page, "text=Create event →", { click: true, pause: 300 });
  },
  async e1_basics({ page, rec, on }) {
    await go(page, `${G}/new`);
    await zoom(page, 1.3);
    await frame(page, "text=Guided setup", 120);
    await rec();
    await glide(page, 'input[placeholder*="Winter Bingo"]', { click: true, pause: 200 });
    await on("like", 0.1);
    await typeSlow(page, "Autumn Ladder", 65);
    await on("Nobody has ever", 0.5);
    await glide(page, "textarea", { click: true, pause: 100, ms: 450 });
    await typeSlow(page, "Two weeks. Five bosses. Zero spreadsheets.", 26);
    await on("Then a format");
    await glide(page, "text=Format >> nth=0", { pause: 200 });
    await on("Standard is");
    await glide(page, 'button:has-text("Standard")', { pause: 200 });
    await on("Bingo is a grid");
    await glide(page, 'button:has-text("Bingo")', { pause: 200 });
    await on("The fancier formats", 0.4);
    await glide(page, 'button:has-text("Board game")', { pause: 200 });
    await on("emotional support", 0.2);
    await glide(page, 'button:has-text("Standard")', { click: true, pause: 300 });
  },
  async e1_schedule({ page, rec, on }) {
    await go(page, WIZ(1));
    await zoom(page, 1.3);
    await frame(page, "text=Save & exit", 140);
    await rec();
    await glide(page, "text=When it runs >> nth=0", { pause: 200 });
    await on("A start");
    await glide(page, 'input[type="datetime-local"] >> nth=0', { pause: 200 });
    await on("an end");
    await glide(page, 'input[type="datetime-local"] >> nth=1', { pause: 200 });
    await on("Or make it repeat", 0.7);
    await glide(page, "text=Repeats on a schedule", { click: true, pause: 300 });
    await on("every weekend", 0.6);
    await glide(page, "text=Weekends >> nth=0", { click: true, pause: 200 });
    await on("between windows", 0.9);
    await glideTo(page, "text=scoring windows", 330, 1300);
    await glide(page, "text=scoring windows", { pause: 200 });
    await on("All times are UTC", 1.2);
    await glideTo(page, "text=Times are entered", 260, 1100);
    await glide(page, "text=UTC (GMT)", { pause: 200 });
  },
  async e1_joining({ page, rec, on }) {
    await go(page, WIZ(2));
    await zoom(page, 1.3);
    await frame(page, "text=Save & exit", 140);
    await rec();
    await glide(page, "text=How do players get onto teams", { pause: 200 });
    for (const [phrase, option] of [
      ["pick their own", "players pick their team"],
      ["auto-balanced", "auto-assigned to a team"],
      ["sign-up pool", "admins sort teams later"],
      ["assign everyone by hand", "no self sign-up"],
    ]) {
      await on(phrase);
      await glide(page, `text=${option}`, { pause: 200 });
    }
    await on("Down here", 0.9);
    await glideTo(page, "text=Which submissions count", 260, 1200);
    const policy = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "Plugin submissions only" }) })
      .first();
    await glide(page, policy, { pause: 200 });
    await policy.focus();
    await on("plugin only", 0.2);
    await page.keyboard.press("ArrowDown");
    await on("anything typed in", 0.2);
    await page.keyboard.press("ArrowDown");
    await on("Trust is a spectrum", -0.8);
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
  },
  async e1_tasks({ page, rec, on }) {
    await go(page, WIZ(3));
    await zoom(page, 1.3);
    await frame(page, "text=Save & exit", 140);
    await rec();
    await glide(page, "text=Vorkath 50 KC", { pause: 200 });
    await on("one at a time");
    await glide(page, 'button:has-text("New task")', { pause: 200 });
    await on("from the library");
    await glide(page, 'button:has-text("From library")', { pause: 200 });
    await on("hit Fill for me");
    await glide(page, 'button:has-text("Fill for me")', { click: true, pause: 300 });
    await on("drafts a balanced list", 0.3);
    await glideTo(page, "text=How active", 300, 1200);
    const active = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "Very active" }) })
      .first();
    await glide(page, active, { pause: 200 });
    await active.focus();
    await on("casual", 0.2);
    await page.keyboard.press("ArrowUp");
    await on("regular", 0.2);
    await page.keyboard.press("ArrowDown");
    await on("very active", 0.2);
    await page.keyboard.press("ArrowDown");
    await on("Be honest", -0.5);
    await page.keyboard.press("ArrowUp");
    await on("Episode two", 0.3);
    await glide(page, { x: 900, y: 600 }, { steps: 40, pause: 200 });
  },
  async e1_teams({ page, rec, on }) {
    await go(page, WIZ(4));
    await zoom(page, 1.3);
    await frame(page, "text=Save & exit", 140);
    await rec();
    // "Type a name, add it, paste in a list" is one breath: be in the box
    // before it starts.
    await glide(page, 'input[placeholder="Team name"]', { click: true, pause: 150 });
    await on("Type a name", 0.1);
    await typeSlow(page, "Team Orange", 38);
    await on("add it", 0.45);
    await glide(page, 'button:has-text("Add team")', { click: true, pause: 120, ms: 380 });
    await on("paste in a list", 0.3);
    await glide(page, page.locator('input[placeholder^="Add players"]').last(), {
      click: true,
      pause: 120,
    });
    await typeSlow(page, "Zezima, Woox, B0aty", 55);
    await on("Or skip it", 0.6);
    await glide(page, "text=Skip for now", { pause: 200 });
  },
  async e1_discord({ page, rec, on }) {
    await go(page, WIZ(5));
    await zoom(page, 1.3);
    await frame(page, "text=Save & exit", 140);
    await rec();
    await glide(page, "select >> nth=0", { pause: 200 });
    await on("where announcements go");
    // Exact labels: the header has "Leaderboards", the clan tabs "Announcements".
    await glide(page, page.getByText("Announcements", { exact: true }).last(), { pause: 200 });
    await on("where completions go");
    await glide(page, page.getByText("Completions", { exact: true }), { pause: 200 });
    await on("live leaderboard");
    await glide(page, page.getByText("Leaderboard", { exact: true }), { pause: 200 });
    await on("It can even create", 1.0);
    await glideTo(page, "text=Team channels & roles", 200, 1100);
    await glide(page, "text=Team channels & roles", { click: true, pause: 300 });
    await on("a role for every team", 0.6);
    await glide(page, "text=Create team roles", { pause: 200 });
    await on("tidy them up", 1.2);
    await glideTo(page, "text=After the event ends", 300, 1300);
    await glide(
      page,
      page
        .locator("select")
        .filter({ has: page.locator("option", { hasText: "Delete after 48 hours" }) }),
      { pause: 200 },
    );
    await on("A butler who pings", 1.2);
    await glideTo(page, "text=Announcements & pings", 380, 1000);
    await glide(page, "text=Announcements & pings", { pause: 200 });
  },
  async e1_launch({ page, rec, on }) {
    await go(page, WIZ(6));
    await zoom(page, 1.3);
    await frame(page, "text=Save & exit", 140);
    await rec();
    for (const t of [
      "Autumn Ladder",
      "Standard — single clan",
      "Self sign-up",
      "All submissions count",
    ])
      await soft(t, () =>
        glide(page, page.getByText(t, { exact: false }).last(), { pause: 120, ms: 520 }),
      );
    await on("all green", 0.6);
    await soft("ready", () =>
      glide(page, page.getByText("Ready to launch").first(), { pause: 200 }),
    );
    await on("launch it now", 0.5);
    await glide(page, 'button:has-text("Launch event now")', { pause: 200 });
    await on("keep it as a draft", 0.5);
    await glide(page, "text=Keep as draft", { pause: 200 });
    await on("never ask", 0.8);
    await glide(page, { x: 1000, y: 470 }, { steps: 70, pause: 200 });
  },
  async e1_player_view({ page, rec, on }) {
    await go(page, EV, 5500);
    await rec();
    await glide(page, "h1", { pause: 200 });
    await on("The board");
    await glide(page, "text=Bingo board", { pause: 200 });
    await on("the standings");
    await glide(page, "text=Team Red >> nth=0", { pause: 200 });
    await on("their team");
    await glide(page, "text=is on Team Red", { pause: 200 });
    await on("sign up button");
    await glide(page, 'button:has-text("Sign up")', { pause: 200 });
    await on("they just play the game", 0.9);
    await scroll(page, 240, 1500);
    await glide(page, { x: 420, y: 470 }, { steps: 40, pause: 200 });
    await on("RuneLite plugin", 0.3);
    await glide(page, { x: 640, y: 520 }, { steps: 70, pause: 200 });
    await on("the board fills itself in", 0.4);
    await scroll(page, 200, 2200);
  },
  async e1_player_view_2({ page, rec, on }) {
    await go(page, EV);
    await frame(page, "text=KILL COUNT", 150);
    await rec();
    await glide(page, { x: 500, y: 250 }, { steps: 30, pause: 100 });
    await scroll(page, 200, 1200);
    await on("Nobody checks them", 0.2);
    await scroll(page, 180, 1200);
    await on("spreadsheet person is free", 0.2);
    await scroll(page, 120, 2600);
  },
  async e1_outro({ page, rec, on }) {
    await go(page, "/events", 3500);
    await rec();
    await glide(page, "text=Summer Bingo 2026 >> nth=0", { pause: 300 });
    await on("What counts", 0.4);
    await glide(page, "text=Autumn Ladder >> nth=0", { pause: 300 });
    await on("Turael", 0.3);
    await scroll(page, 400, 3000);
  },

  // ------------------------------------------------------------- TRAILER
  // Slide beats open slides/trailer.html#<scene> and advance it with
  // window.step(n) on the narrator's cue; site beats film the real pages.
  // The runner swaps real players' names for fictional ones for these.
  async p1_quiet({ page, rec, on }) {
    await go(page, `${SLIDES}#quiet`, 800);
    await rec();
    await on("Somewhere", 0);
    await step(page, 1);
    await on("They're looking", 0.1);
    await step(page, 2);
    await on("Or never", 0.1);
    await step(page, 3);
  },
  async p1_arrives({ page, rec, on }) {
    await go(page, `${SLIDES}#arrives`, 800);
    await rec();
    await on("Or it could", 0.2);
    await step(page, 1);
    await on("in seconds", 0.6);
    await step(page, 2);
  },
  async p1_plugin({ page, rec, on }) {
    await go(page, `${SLIDES}#plugin`, 800);
    await rec();
    for (const [n, phrase] of [
      [1, "the loot"],
      [2, "personal bests"],
      [3, "collection log"],
      [4, "the pets"],
      [5, "takes the screenshot"],
      [6, "sends it in"],
    ]) {
      await on(phrase, 0.1);
      await step(page, n);
    }
  },
  async p1_message({ page, rec, on }) {
    await go(page, `${SLIDES}#message`, 800);
    await rec();
    for (const [n, phrase] of [
      [1, "A moment later"],
      [2, "The item"],
      [3, "what it's worth"],
      [4, "the kill count"],
      [5, "the screenshot"],
      [6, "where they now rank"],
    ]) {
      await on(phrase, 0.1);
      await step(page, n);
    }
  },
  async p1_design({ page, rec, on }) {
    await go(page, "/groups/101/embeds", 3000);
    await frame(page, "text=Embed templates", 150);
    await rec();
    await on("You decide", 0.6);
    await glide(page, 'input[value*="item_name"]', { click: true, pause: 150 });
    await page.keyboard.press("Control+A");
    await on("Every part of the design", 0.3);
    await typeSlow(page, "{item_name} — what a drop!", 45);
    await on("and it's free", 0.8);
    await glide(page, "text=Live preview", { pause: 200 });
  },
  async p1_settings({ page, rec, on }) {
    await go(page, `${SLIDES}#settings`, 800);
    await rec();
    for (const [n, phrase] of [
      [1, "two and a half million"],
      [2, "rune scimitars"],
      [3, "Personal bests"],
      [4, "pets"],
      [5, "collection logs"],
      [6, "Deaths"],
    ]) {
      await on(phrase, 0.1);
      await step(page, n);
    }
  },
  async p1_pages({ page, rec, cut, on }) {
    await go(page, "/groups/101/lootboard", 3500);
    await frame(page, "text=Total loot", 120);
    await rec();
    await glide(page, "text=Iron Ingrid >> nth=1", { steps: 40, pause: 200 });
    await on("redrawn on its own", 0.5);
    await glide(page, { x: 820, y: 560 }, { steps: 50, pause: 200 });
    await on("its own pages", 0.9);
    await cut("/groups/101");
    await glide(page, "text=Clan records", { pause: 200 });
    await on("settling arguments", 0.9);
    await cut("/groups/101/personal-bests");
    await glide(page, "text=Solo >> nth=0", { steps: 30, pause: 200 });
    await on("Or starting them", 0.4);
    await glide(page, "text=2 players >> nth=0", { steps: 30, pause: 200 });
  },
  async p1_members({ page, rec, on }) {
    await go(page, `${SLIDES}#members`, 800);
    await rec();
    await on("syncs every hour", 0.2);
    await step(page, 1);
    await on("New recruits", 0.1);
    await step(page, 2);
    await on("People who left", 0.1);
    await step(page, 3);
  },
  async p1_verify({ page, rec, on }) {
    await go(page, `${SLIDES}#verify`, 800);
    await rec();
    await on("checked against", 0.1);
    await step(page, 1);
    await on("from a goblin", 0.1);
    await step(page, 2);
    await on("doesn't get recorded", 0.3);
    await step(page, 3);
  },
  async p1_more({ page, rec, cut, on }) {
    await go(page, EV, 3500);
    await frame(page, "text=Bingo board", 110);
    await rec();
    await glide(page, { x: 420, y: 470 }, { steps: 50, pause: 200 });
    await on("keep a clan points", 0.3);
    await cut(`${SLIDES}#points`);
    await on("post a Hall of Fame", 0.3);
    await cut(`${SLIDES}#hof`);
  },
  async p1_setup({ page, rec, on, offTape }) {
    await go(page, "/groups/new", 3000);
    await zoom(page, 1.3);
    await frame(page, "text=Create a group", 110);
    await rec();
    const btn = (re) => page.getByRole("button", { name: re }).first();
    await on("Pick your Discord server", 0.6);
    await glide(page, "text=Iron Wolves HQ", { click: true, pause: 150 });
    await on("invite the bot", 0.5);
    await glide(page, "text=bot is in this server", { pause: 150 });
    await glide(page, btn(/^continue/i), { click: true, pause: 150, ms: 450 });
    await on("paste in your Wise Old Man", 0.6);
    await glide(page, page.locator("main input").first(), { click: true, pause: 100, ms: 450 });
    await typeSlow(page, "4521", 60);
    await glide(page, btn(/look up/i), { click: true, pause: 150, ms: 420 });
    await on("choose a channel", 0.9);
    // Jump cut past naming the group: the line moves faster than the form.
    await offTape(async () => {
      await btn(/^continue/i).click();
      await page.waitForTimeout(700);
      await page.locator("main input").first().fill("Iron Wolves");
      await btn(/create group/i).click();
      await page.getByText("Drop notifications channel").waitFor();
      await page.waitForTimeout(500);
    });
    await soft("channel", async () => {
      // The drop-notifications picker: a searchable list of the server's channels.
      await glide(page, page.locator('main input[placeholder^="Search channels"]').last(), {
        click: true,
        pause: 250,
        ms: 450,
      });
      await glide(page, page.getByText("#drops", { exact: true }).last(), {
        click: true,
        pause: 150,
        ms: 400,
      });
    });
    await glide(page, btn(/save & continue/i), { click: true, pause: 150, ms: 420 });
    await on("install the DropTracker plugin", 0.8);
    await glide(page, "text=install the DropTracker RuneLite plugin", { pause: 200 });
  },
  async p1_calm({ page, rec, on }) {
    await go(page, `${SLIDES}#calm`, 800);
    await rec();
    await step(page, 1);
    await on("were never", 0.2);
    await step(page, 2);
    await on("the fun part", 0.3);
    await step(page, 3);
  },

  // ---------------------------------------------------------------- EP2
  async e2_cold_open({ page, rec }) {
    await go(page, EV);
    await frame(page, "text=KILL COUNT", 150);
    await rec();
    await glide(page, { x: 480, y: 300 }, { steps: 40 });
    await scroll(page, 200, 3500);
  },
  async e2_new_task({ page, rec }) {
    await go(page, MGR);
    await frame(page, "text=EVENT SETTINGS", 140);
    await rec();
    await glide(page, tab(page, "Tasks"), { pause: 700 });
    await glide(page, 'button:has-text("New task")', { click: true, pause: 1200 });
    await glideTo(page, "text=Task type", 140, 1400);
    await glide(page, { x: 640, y: 420 }, { steps: 40, pause: 400 });
    await scroll(page, 360, 2400);
    await scroll(page, -360, 1600);
  },
  async e2_task_types({ page, rec }) {
    await go(page, MGR);
    await page.locator('button:has-text("New task")').first().click();
    await page.waitForTimeout(1200);
    await frame(page, "text=Task type", 140);
    await rec();
    const sel = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "Kill count" }) })
      .first();
    await glide(page, sel, { click: true, pause: 300 });
    await page.keyboard.press("Escape");
    await sel.focus();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(1250);
    }
    await sel.selectOption("item_collection");
    await page.waitForTimeout(1200);
  },
  async e2_item_modes({ page, rec }) {
    await go(page, MGR);
    await page.locator('button:has-text("New task")').first().click();
    await page.waitForTimeout(1200);
    await frame(page, "text=Task type", 140);
    await rec();
    const sel = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "Either-or" }) })
      .first();
    await glide(page, sel, { pause: 600 });
    await sel.focus();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(2600);
    }
    await page.waitForTimeout(1500);
  },
  async e2_pick_item({ page, rec }) {
    await go(page, MGR);
    await page.locator('button:has-text("New task")').first().click();
    await page.waitForTimeout(1200);
    await frame(page, "text=Collection mode", 120);
    await rec();
    await glide(page, 'input[placeholder^="Search items"]', { click: true });
    await typeSlow(page, "Twisted bow", 90);
    await soft("pick item", async () => {
      const panel = page
        .locator('input[placeholder^="Search items"]')
        .first()
        .locator("xpath=ancestor::div[2]");
      const hit = panel.getByText("Twisted bow", { exact: true }).first();
      await hit.waitFor({ timeout: 10000 });
      await page.waitForTimeout(700);
      await glide(page, hit, { click: true, pause: 1200 });
    });
    await soft("points", async () => {
      await glide(page, page.locator('label:has(span:text-is("Points")) input').first(), {
        click: true,
        pause: 200,
      });
      await page.keyboard.press("Control+A");
      await typeSlow(page, "50", 160);
    });
    await glide(page, 'button:has-text("Add task")', { pause: 2600 });
  },
  async e2_what_counts({ page, rec }) {
    await go(page, MGR);
    await frame(page, "text=KILL COUNT", 200);
    await rec();
    await glide(page, 'summary:has-text("What counts") >> nth=0', { click: true, pause: 2200 });
    await scroll(page, 300, 1600);
    await glide(page, 'summary:has-text("What counts") >> nth=4', { click: true, pause: 1200 });
    await scroll(page, 180, 1200);
    await glide(page, "text=Zamorak hilt", { pause: 1500 }).catch(() => {});
    await page.waitForTimeout(2500);
  },
  async e2_anticheese({ page, rec }) {
    await go(page, MGR);
    await page.locator('button:has-text("New task")').first().click();
    await page.waitForTimeout(1200);
    await frame(page, "text=Task type", 140);
    const sel = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "Kill count" }) })
      .first();
    await rec();
    await glide(page, sel, { pause: 500 });
    await sel.selectOption("kc_target");
    await page.waitForTimeout(700);
    await soft("kc help", () =>
      glide(
        page,
        page
          .getByText(/kill count/i)
          .locator("visible=true")
          .nth(1),
        { pause: 3200 },
      ),
    );
    await glide(page, sel, { pause: 300 });
    await sel.selectOption("slayer_target");
    await page.waitForTimeout(900);
    await soft("turael", () =>
      glide(
        page,
        page
          .getByText(/Turael/)
          .locator("visible=true")
          .first(),
        { pause: 4200 },
      ),
    );
    await glide(page, sel, { pause: 300 });
    await sel.selectOption("pet_collection");
    await page.waitForTimeout(900);
    await soft("dupes", () =>
      glide(page, page.getByText("Duplicate pets count").first(), { pause: 3600 }),
    );
    await glide(page, sel, { pause: 300 });
    await sel.selectOption("item_collection");
    await page.waitForTimeout(3000);
  },
  async e2_review({ page, rec }) {
    await go(page, MGR);
    await frame(page, "text=EVENT SETTINGS", 140);
    await rec();
    await glide(page, 'label:has-text("review") >> nth=0', { click: true, pause: 1200 });
    await glide(page, tab(page, "Review"), { click: true, pause: 1500 });
    await glide(page, "text=Obtain a Twisted bow >> visible=true", { pause: 900 });
    await glide(page, 'button:has-text("Confirm") >> visible=true', { pause: 1400 });
    await glide(page, 'button:has-text("Reject") >> visible=true', { pause: 900 });
    await glide(page, "select >> nth=-3", { pause: 1400 }).catch(() => {});
    await page.waitForTimeout(2500);
  },
  async e2_library({ page, rec }) {
    await go(page, MGR);
    await frame(page, "text=EVENT SETTINGS", 140);
    await rec();
    await glide(page, 'button:has-text("From library")', { click: true, pause: 1600 });
    await scroll(page, 420, 3500);
    await glide(page, { x: 640, y: 420 }, { steps: 40, pause: 800 });
    await scroll(page, 380, 3500);
    await page.waitForTimeout(3000);
  },
  async e2_outro({ page, rec }) {
    await go(page, EV);
    await frame(page, "text=ITEM COLLECTION", 150);
    await rec();
    await glide(page, { x: 700, y: 330 }, { steps: 40 });
    await scroll(page, 200, 4000);
    await page.waitForTimeout(2500);
  },

  // ---------------------------------------------------------------- EP3
  async e3_cold_open({ page, rec }) {
    await go(page, EV);
    await frame(page, "h1", 90);
    await rec();
    for (const t of ["#1", "#2", "#3"]) await glide(page, `text=${t} >> nth=0`, { pause: 900 });
    await page.waitForTimeout(1200);
  },
  async e3_task_points({ page, rec }) {
    await go(page, EV);
    await frame(page, "text=KILL COUNT", 150);
    await rec();
    await glide(page, "text=10 pts", { pause: 1400 });
    await glide(page, "text=35 / 50", { pause: 1200 });
    await glide(page, "text=50 pts", { pause: 1200 });
    await glide(page, "text=✓ complete >> nth=0", { pause: 2000 });
  },
  async e3_split({ page, rec }) {
    await go(page, `${EV}/players`, 3500);
    await rec();
    await glide(page, { x: 640, y: 330 }, { steps: 40, pause: 900 });
    await scroll(page, 300, 3000);
    await glide(page, { x: 900, y: 420 }, { steps: 40, pause: 1200 });
    await page.waitForTimeout(4000);
  },
  async e3_bingo({ page, rec }) {
    await go(page, EV);
    await frame(page, "text=Bingo board", 90);
    await rec();
    await glide(page, "text=FREE >> nth=0", { pause: 1400 });
    // trace the first row, then the first column
    const cells = page.locator("text=COLLECT");
    await glide(page, cells.nth(0), { pause: 400 }).catch(() => {});
    for (const t of [
      "FREE >> nth=0",
      "SKILL LEVEL >> nth=0",
      "KC TARGET >> nth=0",
      "ANY 2 >> nth=0",
    ])
      await glide(page, `text=${t}`, { pause: 350, steps: 16 }).catch(() => {});
    for (let i = 1; i < 5; i++)
      await glide(page, `text=ANY 2 >> nth=${i}`, { pause: 350, steps: 16 }).catch(() => {});
    await page.waitForTimeout(2500);
  },
  async e3_team_filter({ page, rec }) {
    await go(page, EV);
    await frame(page, "text=Bingo board", 90);
    await rec();
    for (const t of ["Team Red", "Team Blue", "Team Green", "All teams"])
      await glide(
        page,
        page
          .locator("button")
          .filter({ hasText: new RegExp(`^\\s*${t}\\s*$`) })
          .first(),
        { click: true, pause: 1700 },
      ).catch(() => {});
  },
  async e3_standings({ page, rec }) {
    await go(page, `${EV}/teams`, 3500);
    await rec();
    await glide(page, "text=Team Red >> nth=1", { pause: 1200 }).catch(() => {});
    await glide(page, "text=Team Blue >> nth=1", { pause: 1200 }).catch(() => {});
    await scroll(page, 300, 3000);
    await page.waitForTimeout(4000);
  },
  async e3_history({ page, rec }) {
    await go(page, EV);
    await frame(page, "text=Completion history", 90);
    await page.waitForTimeout(2000);
    await rec();
    await soft("team filter", async () => {
      const sel = page
        .locator("select")
        .filter({ has: page.locator("option", { hasText: "All teams" }) })
        .last();
      await glide(page, sel, { pause: 500 });
      await sel.selectOption({ label: "Team Red" });
      await page.waitForTimeout(1800);
    });
    await glide(page, "text=Show progress updates", { click: true, pause: 2000 });
    await scroll(page, 300, 2500);
    await page.waitForTimeout(3000);
  },
  async e3_effort({ page, rec }) {
    await go(page, `${MGR}/effort`, 3500);
    await rec();
    await glide(page, { x: 640, y: 360 }, { steps: 40, pause: 900 });
    await scroll(page, 380, 4000);
    await page.waitForTimeout(3500);
  },
  async e3_payouts({ page, rec }) {
    await go(page, MGR);
    await frame(page, "text=EVENT SETTINGS", 140);
    await rec();
    await glide(page, tab(page, "Prize Pot"), { click: true, pause: 1600 });
    await scroll(page, 260, 1800);
    await soft("pot total", () =>
      glide(page, page.getByText("45M").locator("visible=true").first(), { pause: 1600 }),
    );
    await scroll(page, 300, 2200);
    await page.waitForTimeout(800);
    await scrollTo(
      page,
      await page
        .locator("text=EVENT SETTINGS")
        .first()
        .evaluate((el) => el.getBoundingClientRect().top + scrollY - 140),
      1300,
    );
    await glide(page, tab(page, "Clan Points"), { click: true, pause: 1600 });
    await scroll(page, 380, 2600);
    await soft("afk", async () => {
      const afk = page.getByText("took no part").first();
      await afk.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await glide(page, afk, { pause: 3500 });
    });
  },
  async e3_outro({ page, rec }) {
    await go(page, "/events", 3500);
    await rec();
    for (const t of ["GWD Loot Sweep", "Zulrah Blitz", "Mining Mayhem"])
      await glide(page, `text=${t} >> nth=0`, { pause: 1100 });
    await scroll(page, 450, 3500);
    await page.waitForTimeout(3000);
  },
};

// A static server over the repo on a free localhost port, for the slides
// (they load the site's fonts and icon from apps/web by relative path).
async function serveRepo() {
  const http = await import("node:http");
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
  const types = {
    ".html": "text/html",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".png": "image/png",
    ".css": "text/css",
    ".js": "text/javascript",
  };
  const server = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory())
      return res.writeHead(404).end();
    res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  server.unref();
  return `http://localhost:${server.address().port}`;
}

// ------------------------------------------------------------------ runner
if (import.meta.url === `file://${process.argv[1]}`) {
  fs.mkdirSync(OUT, { recursive: true });
  const want = process.argv.slice(2);
  const ids = want.length ? want : Object.keys(shots);
  SLIDES = `${await serveRepo()}/docs/videos/slides/trailer.html`;
  const { browser, page } = await openHD();
  // The trailer never shows a real player's name.
  if (ids.some((id) => id.startsWith("p1_"))) await renamePlayers(page.context());
  // Warm the dev server so first-compile delays never land in a clip.
  for (const u of [
    "/events",
    EV,
    `${EV}/players`,
    `${EV}/teams`,
    G,
    `${G}/new`,
    WIZ(3),
    MGR,
    `${MGR}/effort`,
  ])
    await go(page, u, 300).catch(() => {});
  // ...and the client-side API routes the shots trigger (first compile is slow).
  for (const u of [
    "/api/events/1/tasks/11/requirements",
    "/api/events/1/completions/history?mode=completions",
  ])
    await page.request.get(BASE + u, { timeout: 120000 }).catch(() => {});
  for (const id of ids) {
    const fn = shots[id];
    if (!fn) {
      console.warn(`unknown clip ${id}`);
      continue;
    }
    let camera = null;
    let t0 = null;
    let paused = 0;
    const sheet = cueSheet(id);
    const elapsed = () => (t0 === null ? 0 : (Date.now() - t0) / 1000 - paused);
    const rec = async () => {
      camera = await cast(page, path.join(OUT, `${id}.mp4`));
      t0 = Date.now();
    };
    // Do something with the camera off: a jump cut inside one page.
    const offTape = async (fn) => {
      const p0 = Date.now();
      camera?.pause();
      await fn();
      await camera?.resume();
      paused += (Date.now() - p0) / 1000;
    };
    const cut = async (url) => {
      const p0 = Date.now();
      camera?.pause();
      await go(page, url);
      await camera?.resume();
      paused += (Date.now() - p0) / 1000;
    };
    const at = (phrase) => cueAt(sheet, phrase);
    // Start moving a little before the word, so the cursor arrives on it.
    const on = (phrase, lead = 0.5) => until(sheet ? at(phrase) - lead : null);
    const until = async (t) => {
      if (t == null) return;
      const late = elapsed() - t;
      if (late > 0.4)
        console.warn(`\n  ! ${id}: ${late.toFixed(1)}s behind the cue at ${t.toFixed(1)}s`);
      else if (late < 0) await page.waitForTimeout(-late * 1000);
    };
    process.stdout.write(`${id} … `);
    try {
      await page.mouse.move(640, 360);
      setCursor(640, 360);
      await fn({ page, rec, cut, offTape, at, until, on });
      if (sheet) await until(sheet.length - 0.2);
      const r = await camera.stop(0.2);
      console.log(
        `${r.seconds.toFixed(1)}s, ${r.frames} frames${sheet ? ` (beat ${sheet.length.toFixed(1)}s)` : ""}`,
      );
    } catch (e) {
      console.log(`FAILED: ${e.message.split("\n")[0]}`);
      if (camera) await camera.stop().catch(() => {});
    }
  }
  await browser.close();
}

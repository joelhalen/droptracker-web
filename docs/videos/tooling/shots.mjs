// How each clip in episodes.mjs is filmed. One function per clip id.
//
//   node shots.mjs [clipId ...]        record the named clips (default: all)
//
// Every shot gets a page that is already loaded and settled; it calls
// `rec()` to start the camera, does its choreography, and returns. Page
// loads mid-shot go through `cut()` so the loading flash never hits the tape.
import fs from "node:fs";
import path from "node:path";
import { BASE, openHD, go, glide, scroll, scrollTo, typeSlow, cast, setCursor } from "./lib.mjs";

const OUT = process.env.CLIPS || path.resolve("clips");
const G = "/groups/101/events";
const EV = "/events/1";
const MGR = `${G}/1`;
const WIZ = (step) => `${G}/new?event=5&step=${step}`;

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
  async e1_cold_open({ page, rec }) {
    await go(page, EV);
    await frame(page, "h1", 90);
    await rec();
    await glide(page, { x: 900, y: 420 }, { steps: 40, pause: 300 });
    await scroll(page, 330, 5200);
    await glide(page, { x: 470, y: 520 }, { steps: 60, pause: 1500 });
    await scroll(page, 200, 3500);
  },
  async e1_cold_open_2({ page, rec }) {
    await go(page, EV);
    await frame(page, "text=Tasks >> nth=-1", 100);
    await rec();
    await glide(page, { x: 700, y: 330 }, { steps: 40 });
    await scroll(page, 260, 3200);
  },
  async e1_events_tab({ page, rec }) {
    await go(page, G);
    await rec();
    await glide(page, "text=Events >> nth=1", { pause: 700 });
    await glideTo(page, "text=Create event", 160, 1600);
    await glide(page, "text=Create event →", { pause: 500 });
    await scroll(page, 380, 2200);
    await glide(page, { x: 640, y: 380 }, { pause: 900 });
    await scrollTo(page, 0, 1400);
    await glide(page, "text=Create event →", { click: true, pause: 600 });
    await page.waitForTimeout(2500);
  },
  async e1_basics({ page, rec }) {
    await go(page, `${G}/new`);
    await frame(page, "text=Guided setup", 120);
    await rec();
    await glide(page, 'input[placeholder*="Winter Bingo"]', { click: true });
    await typeSlow(page, "Autumn Ladder", 85);
    await glide(page, "textarea", { click: true, pause: 200 });
    await typeSlow(page, "Two weeks. Five bosses. Zero spreadsheets.", 40);
    await glide(page, 'button:has-text("Standard")', { pause: 900 });
    await glide(page, 'button:has-text("Bingo")', { pause: 1300 });
    await glide(page, 'button:has-text("Standard")', { click: true, pause: 900 });
    await glideTo(page, "text=Format", 160, 900);
    await page.waitForTimeout(1500);
  },
  async e1_schedule({ page, rec }) {
    await go(page, WIZ(1));
    await frame(page, "text=Save & exit", 140);
    await rec();
    await glide(page, 'input[type="datetime-local"] >> nth=0', { pause: 900 });
    await glide(page, 'input[type="datetime-local"] >> nth=1', { pause: 900 });
    await glide(page, "text=Runs continuously", { pause: 900 });
    await glide(page, "text=Repeats on a schedule", { click: true, pause: 1500 });
    await scroll(page, 240, 1600);
    await page.waitForTimeout(2200);
  },
  async e1_joining({ page, rec }) {
    await go(page, WIZ(2));
    await frame(page, "text=Save & exit", 140);
    await rec();
    for (const t of [
      "players pick their team",
      "auto-assigned to a team",
      "admins sort teams later",
      "no self sign-up",
    ])
      await glide(page, `text=${t}`, { pause: 1300 });
    await glideTo(page, "text=Which submissions count", 220, 1500);
    await glide(page, "select >> nth=0", { pause: 800 });
    await soft("policy cycle", async () => {
      const sel = page
        .locator("select")
        .filter({ has: page.locator("option", { hasText: "Plugin submissions only" }) })
        .first();
      await sel.focus();
      for (let i = 0; i < 2; i++) {
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(1500);
      }
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(1200);
    });
  },
  async e1_tasks({ page, rec }) {
    await go(page, WIZ(3));
    await frame(page, "text=Save & exit", 140);
    await rec();
    await glide(page, 'button:has-text("Fill for me")', { pause: 1400 });
    await glide(page, 'button:has-text("New task")', { pause: 1100 });
    await glide(page, 'button:has-text("From library")', { pause: 1100 });
    for (const t of [
      "Vorkath 50 KC",
      "Obtain a Twisted bow",
      "Reach 99 Slayer",
      "Gain 10M Ranged XP",
      "Collect any 2 godsword hilts",
    ])
      await glide(page, `text=${t}`, { pause: 700, steps: 18 });
    await page.waitForTimeout(3000);
  },
  async e1_teams({ page, rec }) {
    await go(page, WIZ(4));
    await frame(page, "text=Save & exit", 140);
    await rec();
    await glide(page, 'input[placeholder="Team name"]', { click: true });
    await typeSlow(page, "Team Orange", 80);
    await glide(page, 'button:has-text("Add team")', { click: true, pause: 1200 });
    await glide(page, "text=Team Red", { pause: 800 });
    await glide(page, page.locator('input[placeholder^="Add players"]').last(), { click: true });
    await typeSlow(page, "Zezima, Woox, B0aty", 70);
    await page.waitForTimeout(2500);
  },
  async e1_discord({ page, rec }) {
    await go(page, WIZ(5));
    await frame(page, "text=Save & exit", 140);
    await rec();
    await glide(page, "select >> nth=0", { pause: 1000 });
    await glide(page, "text=Announcements >> nth=0", { pause: 800 });
    await glide(page, "text=Completions >> nth=0", { pause: 800 });
    await glideTo(page, "text=Team channels & roles", 200, 1400);
    await glide(page, "text=Team channels & roles", { click: true, pause: 1200 });
    await scroll(page, 380, 2600);
    await page.waitForTimeout(2800);
  },
  async e1_launch({ page, rec }) {
    await go(page, WIZ(6));
    await frame(page, "text=Save & exit", 140);
    await rec();
    for (const t of [
      "Autumn Ladder",
      "Standard — single clan",
      "Self sign-up",
      "All submissions count",
      "3 (5 players)",
    ])
      await soft(t, () => glide(page, page.getByText(t, { exact: false }).last(), { pause: 650 }));
    await soft("ready", () =>
      glide(page, page.getByText("Ready to launch").first(), { pause: 900 }),
    );
    await glide(page, 'button:has-text("Launch event now")', { pause: 1700 });
    await glide(page, "text=Keep as draft", { pause: 2600 });
  },
  async e1_player_view({ page, rec }) {
    await go(page, EV, 5500);
    await rec();
    await glide(page, "text=Team Red >> nth=0", { pause: 900 });
    await glide(page, "text=Team Blue >> nth=0", { pause: 600 });
    await scroll(page, 240, 2000);
    await glide(page, { x: 380, y: 420 }, { pause: 900 });
    await glide(page, "text=Participate", { pause: 600 });
    await glide(page, 'button:has-text("Sign up")', { pause: 1400 });
    await soft("teams rail", () =>
      glide(page, page.getByText("View all", { exact: false }).first(), { pause: 1600 }),
    );
    await page.waitForTimeout(3500);
  },
  async e1_player_view_2({ page, rec }) {
    await go(page, EV);
    await frame(page, "text=KILL COUNT", 150);
    await rec();
    await glide(page, { x: 500, y: 250 }, { steps: 30 });
    await scroll(page, 380, 4200);
  },
  async e1_outro({ page, rec }) {
    await go(page, "/events", 3500);
    await rec();
    await glide(page, "text=Summer Bingo 2026 >> nth=0", { pause: 900 });
    await glide(page, "text=Autumn Ladder >> nth=0", { pause: 900 });
    await scroll(page, 400, 3000);
    await page.waitForTimeout(2500);
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

// ------------------------------------------------------------------ runner
if (import.meta.url === `file://${process.argv[1]}`) {
  fs.mkdirSync(OUT, { recursive: true });
  const want = process.argv.slice(2);
  const ids = want.length ? want : Object.keys(shots);
  const { browser, page } = await openHD();
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
    const rec = async () => {
      camera = await cast(page, path.join(OUT, `${id}.mp4`));
    };
    const cut = async (url) => {
      camera?.pause();
      await go(page, url);
      await camera?.resume();
    };
    process.stdout.write(`${id} … `);
    try {
      await page.mouse.move(640, 360);
      setCursor(640, 360);
      await fn({ page, rec, cut });
      const r = await camera.stop();
      console.log(`${r.seconds.toFixed(1)}s, ${r.frames} frames`);
    } catch (e) {
      console.log(`FAILED: ${e.message.split("\n")[0]}`);
      if (camera) await camera.stop().catch(() => {});
    }
  }
  await browser.close();
}

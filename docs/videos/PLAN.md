# Events, Explained — video series plan

A short series of explainer videos for DropTracker's event system. The tone is
deadpan and a bit too honest, like a narrator who has run one clan bingo too
many. Each episode is 2½–3½ minutes of real UI footage with a calm voice-over
and dry jokes that are still true.

**What exists now**

|                           |                                                                              |
| ------------------------- | ---------------------------------------------------------------------------- |
| Series plan (this file)   | 8 episodes. Episodes 1–3 are scripted and filmed, 4–8 are outlined below     |
| `episodes.mjs`            | The single source for every line of voice-over, every beat and every clip id |
| `scripts/ep{1,2,3}.md`    | Shooting scripts: timecode, clip, what's on screen, voice-over               |
| `scripts/ep{1,2,3}-vo.md` | Voice-over read sheets: numbered lines, each with a time target              |
| `captions/ep{1,2,3}.srt`  | The voice-over as captions, on the rough-cut timeline                        |
| `tooling/`                | Records the clips from the live web app and assembles captioned rough cuts   |

The rough cuts and clips are build output and are not committed (see "Producing
it" below). Rebuild them with two commands.

---

## Style guide

- **Narrator:** unbothered and dry. It sounds a little like a nature
  documentary narrator. It never sounds excited. The joke is always an aside
  and never the point of the sentence, so every line still teaches something
  true. If a line is only funny, cut it.
- **Humour sources, in order of preference:**
  1. Real clan-event pain: the spreadsheet person, screenshot policing, the AFK
     teammate.
  2. OSRS in-jokes that any player gets: Turael skipping, twisted bow luck,
     "one more kc", dry streaks.
  3. Things our own code already jokes about. The engine really does skip
     Turael/Spria slayer tasks, and it auto-accepts small loot-value drops so
     "nobody approves three hundred bones".
- **Pace:** about 150 wpm. Each beat is one paragraph over one clip. Where a line
  ends on a joke, hold the picture for about a second (`hold` in
  `episodes.mjs`).
- **Picture:** real UI and nothing mocked up by hand. Keep the cursor slow and
  deliberate: glide, pause, click, with a gold pulse on each click. No zoom
  effects in the recording; do punch-ins in the edit if wanted.
- **Cards:** Cinzel title in site gold on the site's dark brown, with Figtree
  subtitles. These are the site's own fonts and colours.
- **Music:** a lo-fi or "tavern" bed at -24 LUFS under the voice. Add a small
  sting on each title card.
- **Accuracy rule:** every claim in the voice-over was checked against the code
  on 2026-09-25. File references are in the "Fact sheet" section below. If a
  behaviour changes, change the line.

---

## Episodes

| #   | Title                    | Status                          | Runtime | Covers                                                                                     |
| --- | ------------------------ | ------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| 1   | Your First Event         | scripted + filmed + rough cut   | ~3:20   | Events tab → 7-step wizard → launch → what players see                                     |
| 2   | What Actually Counts     | scripted + filmed               | ~2:50   | Task types, item modes, anti-cheese rules, review queue, library / Fill for me             |
| 3   | How Scoring Works        | scripted + filmed               | ~2:20   | Task points, contribution split, bingo lines/blackout, standings, history, effort, payouts |
| 4   | Running It               | outline                         | ~3:00   | Review queue in anger, Discord surfaces, in-game HUD, ending an event, templates           |
| 5   | Loot Sweep               | outline                         | ~2:30   | Decay, groups and sets                                                                     |
| 6   | Skill / Boss of the Week | outline                         | ~2:00   | Races, bonus rules, WOM mirroring                                                          |
| 7   | The Board Game           | outline, **blocked on footage** | ~3:30   | Dice, tile tiers, shop, chutes/ladders, the mercy rule                                     |
| 8   | Conquest                 | outline, **blocked on footage** | ~3:30   | Troops, Risk dice, hold-time scoring, the Gielinor map                                     |

### Outlines for 4–8

**4 · Running It.** Cold open: "The event is live. You are now customer
support." Beats:

- The review queue with confirm, reject, manual award and revoke.
- The Discord channels: announcements, completions, leaderboard and admin.
  The live board is one message edited in place.
- Team channels and roles, which are created for you and cleaned up 48h after
  the end.
- The sign-up prompt, whose button disappears when sign-ups close. It does that
  because players "believed they were entered".
- In-game: the plugin's chat, pop-up and Enhanced HUD modes, the "focus task"
  and the team rank ("2nd of 4"), plus team badges in clan chat.
- The "starts in an hour" and "ends in an hour, top 3 so far" reminders.
- End event, then Save as template.

Joke to land: "Scheduled on UTC. No daylight savings surprises. The surprises
will come from your clan."

**5 · Loot Sweep.** Race to collect items, where points never stop accruing:

- The first copy pays full points, then each repeat pays 20 points less:
  100 → 80 → 60 → 40 → 20 → nothing ("fully farmed").
- Items are grouped by boss, with group bonuses and set bonuses. For example,
  all six Barrows brothers earn the set bonus.
- A stack of 3 counts as 3.
- Footage: `/events/3`, the matrix. It renders lazily, so scroll it into view
  before recording.
- Joke: "The sixth Dharok's helm is worth exactly as much as your opinion on
  Dharok's."

**6 · Skill / Boss of the Week.** "Of the week is tradition. It can be any
length."

- Can mirror or create a Wise Old Man competition.
- Bonus rules: pets, and kill-time tiers. A 0:48 kill pays both "sub-1:00" and
  "sub-0:50".
- XP milestones.
- One clan only.
- Footage: `/events/6` (Zulrah Blitz) and `/events/7` (Mining Mayhem).

**7 · The Board Game.** Chutes and ladders, but with bosses:

- Complete the tile's one task, earn coins, then roll 1d6.
- Tile tiers are air < water < earth < fire, each dealing a random task of
  that difficulty.
- Required tiles are checkpoints.
- Overshoot rules: land anyway, stay put, or bounce back.
- The shop, with PvP items that steal, freeze or knock rivals back. Pirate
  Pete's Parrot's whole description is "Squawk!". A roadblock also traps the
  team that placed it.
- The mercy rule: a task that stays stuck too long auto-completes for no coins
  and no score, and the deadline grows each time.
- Leaders roll and shop, and can be elected.

**8 · Conquest.** "Risk, but the dice are your drop rates." Covers:

- Regions of boss tiles, where each tile has rules that pay troops.
- Troops resolve on their own: claim, fortify (up to +5), capture, or attack.
- Attacks use Risk dice: 2d6 against up to 2d6, and ties go to the defender.
- A breach leaves a window to reinforce, and the capturing troop stays behind
  as 1 defense.
- Scoring is `hold_time` (points per hour held, pro-rated to the minute) or
  `final`.
- Start modes: `neutral` land grab, or `dealt`, "like the opening of a game of
  Risk".
- The Gielinor preset: 45 bosses in 10 regions, sized from EHB so "no team wins
  by camping the fastest boss".
- Revoked credit becomes **troop debt**, because dice can't be un-rolled.

This is the episode closest to the reference video. Script it last, after 1–3
have set the voice.

### Why 7 and 8 have no footage yet

The board game and Conquest have **no mock data**. Their API calls in
`apps/web/lib/api/event-conquest.ts` and the board-game helpers are not wrapped
in `withFallback`, and neither kind appears in the mock kinds list. So the mock
dev server this footage was shot on shows an empty map.

There are two ways to get it:

1. **Film on the dev instance (recommended).** Point the tooling at a dev web
   build with a real conquest or board-game event running, using
   `BASE=https://… node shots.mjs e8_…`. This is real data and needs no new
   code.
2. **Add mock fixtures.** Add conquest and board-game fixtures to
   `lib/mock-data.ts` and wrap those calls in `withFallback`. This also helps
   local development, but it is a web-repo change with its own review.

Both kinds are also staff-only or test-only in `web_event_types` right now
(Conquest was seeded off). Hold these two episodes until the kinds are on for
clans, so the video doesn't advertise something viewers can't click.

---

## Producing it

### Record the clips

The clips come from the web app in mock mode, which has a full bingo, a draft,
loot sweeps and competitions, and a mock superadmin.

```bash
# 1. the site, in mock mode
cd apps/web && USE_MOCK_API=true PORT=3001 pnpm dev

# 2. the recorder (Playwright + Chromium, and ffmpeg on PATH)
cd docs/videos/tooling && npm install
node shots.mjs                    # every clip → tooling/clips/*.mp4
node shots.mjs e1_basics e2_review   # or just some
```

How the recorder works:

- It uses Chrome's screencast (CDP), not Playwright's built-in video. That
  gives sharp 1920×1080 at about 45 fps (a 1280×720 viewport at 1.5× scale),
  encoded to 30 fps H.264 at CRF 18.
- Page loads mid-shot are cut out of the tape.
- A drawn cursor with click pulses is injected, because headless Chrome has no
  cursor.
- The Next.js dev badge and the chat bubble are hidden.

A few reads are empty in mock mode but needed on camera: item/NPC search,
completion history, prize pot and clan-point payouts. `tooling/meta-server.py`
is a stand-in Web API on `:31325` that serves just those, for event 1, and
answers 503 to everything else so the rest falls back to the normal mocks.
Start it before recording:

```bash
python3 meta-server.py meta.json   # meta.json: {"items": {name: id}, "npcs": {name: id}}
```

Build `meta.json` from the osrsbox package: the `name` and id of each
non-noted item in `items-complete.json`, and each monster in
`monsters-complete.json`.

Item icons in mock data point at `droptracker.io/img/itemdb/<id>.png`. On a box
without internet access, drop the icons into `tooling/icons/itemdb/`. For
example, `pip download osrsbox` ships every item icon as base64 in
`items-complete.json`. The recorder serves those in place of the network.
Skills and bosses have no icons there, so the recorder films in-game
stand-ins: the skillcape for a skill (`/img/metrics/slayer.png` → Slayer cape)
and the pet for a boss (`/img/npcdb/8060.png` → Vorki). This stand-in table is
in `lib.mjs`. With internet access, nothing is needed. To film real data
instead, set `BASE` to a dev instance.

### Assemble

```bash
node build.mjs                     # scripts/*.md, captions/*.srt from episodes.mjs
node build.mjs --video ep1 ep2 ep3 # + tooling/out/<ep>-roughcut.mp4
```

`build.mjs` needs `tooling/fonts/` to contain static TTFs of Cinzel and Figtree,
with family names `DT Cinzel` and `DT Figtree`. They are instanced from
`apps/web/app/fonts/*.woff2` with fontTools (`varLib.instancer`, weight 700 and
600).

The rough cut gives each beat the time its line needs at about 150 wpm:

- A clip that runs long is sped up by at most 1.25×, then trimmed.
- A clip that runs short holds its last frame.
- Captions are burned in, and every frame carries a "ROUGH CUT" tag.

### Voice-over and the final edit

1. Record one take per numbered line in `scripts/<ep>-vo.md`.
2. In the editor (Resolve, Premiere or CapCut), lay the clips down in beat
   order, then cut or slip each clip to its take.
3. Hold the picture wherever a beat has a `hold`.
4. Add a music bed and card stings.
5. Import `captions/<ep>.srt` as a starting point, then re-time it to the real
   voice.

For an AI voice, feed the read sheet line by line to ElevenLabs or a similar
tool. Use a calm, low-energy, dry British or mid-Atlantic voice. Pick
stability over expressiveness: deadpan is the joke.

---

## Fact sheet (what the voice-over claims, and where it's true)

Backend paths are in `droptracker-core`, web paths in this repo.

| Claim                                                                           | Source                                                                       |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Kinds: standard, bingo, board game, loot sweep, SOTW/BOTW, conquest             | `db/models/events.py` `EVENT_KINDS`                                          |
| 7-step wizard: basics, schedule, joining, tasks, teams, Discord, review         | `components/event-setup-wizard.tsx`                                          |
| Recurring windows, UTC, "no DST surprises"                                      | `services/event_schedule.py`                                                 |
| Four joining modes                                                              | `db/models/events.py` (self_join / auto_assign / signup_pool / admin_assign) |
| Submission policies: all / non-plugin needs review / plugin only                | `lib/events.ts` `SUBMISSION_POLICY_LABELS`; `event_engine.py`                |
| Fill for me: casual / regular / very active                                     | `components/event-task-generator.tsx` `ACTIVITY_LABELS`                      |
| Task library, a few hundred public presets                                      | `docs/TASK_GENERATOR_PLAN.md` (~258)                                         |
| Team channels and roles created and cleaned up                                  | `services/event_team_discord.py`                                             |
| Drafts are unlimited; the tier cap applies at activation                        | `db/entitlements.py`; `event_lifecycle.py`                                   |
| Task types and item modes                                                       | `lib/events.ts` `TASK_TYPE_LABELS`; `event-task-form.tsx` `ITEM_MODE_LABELS` |
| KC from the plugin and WOM merged by max, never summed                          | `services/event_wom_reconciler.py`                                           |
| Drop and its collection-log echo count once                                     | `event_engine.py` (10-minute window)                                         |
| Slayer tasks exclude Turael/Aya and Spria by default                            | `db/models/events.py`; `event_engine.py`                                     |
| Only submissions after joining count                                            | `event_engine.py` `joined_at` cutoff                                         |
| Loot-value tasks auto-accept drops under `min_value` ("bones and ashes")        | `event_engine.py` ~1502                                                      |
| Points split by contribution share (5 pts, 50/50 → 2.5 each)                    | `event_engine.py` `_award_contribution_points`                               |
| Line and blackout bonuses; empty cells are free spaces                          | `event_engine.py` `evaluate_bingo_bonuses`, `grant_free_cells`               |
| The Discord leaderboard is one message edited in place                          | `services/event_board.py`                                                    |
| The prize pot is advertised only; no real GP moves                              | `services/event_prizes.py`                                                   |
| Placement and participation clan points; the AFK winner gets nothing by default | `services/event_point_awards.py`                                             |

**Check before publishing:** the default submission policy for new events.
The model default and the engine comment say `confirm_non_api`, but the backend
CLAUDE.md says `all`. The script avoids naming a default, so it's safe either
way.

## Noticed while filming

- The Loot Sweep "Teams" rail shows raw floats: `588.4000000000001`,
  `566.5999999999999` (`/events/3`, mock data). The matrix header rounds them
  correctly. The rail probably needs the same formatter. This is worth a fix
  before the Loot Sweep episode is filmed.

# Events, Explained — video series plan

A short series of explainer videos for DropTracker's event system. The tone is
deadpan and a bit too honest, like a narrator who has run one clan bingo too
many. Each episode is 2½–3½ minutes of real UI footage with a calm voice-over
and dry jokes that are still true.

**What exists now**

|                           |                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------- |
| Series plan (this file)   | 8 episodes. 1 is finished; 2–3 are scripted and filmed; 4–8 are outlined below   |
| `episodes.mjs`            | The single source for every line of voice-over, every beat and every clip id     |
| `scripts/ep{1,2,3}.md`    | Shooting scripts: timecode, clip, what's on screen, voice-over                   |
| `scripts/ep{1,2,3}-vo.md` | Voice-over read sheets: numbered lines, with each take's length (or a target)    |
| `captions/ep{1,2,3}.srt`  | The voice-over as captions, timed to the recorded takes where they exist (ep1)   |
| `tooling/`                | Voices the lines, records the clips to the voice, and renders the finished video |

Clips, takes, music and videos are build output and are not committed (see
"Producing it" below). Everything is reproducible from this folder.

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
| 1   | Your First Event         | **finished** (voiced, scored)   | ~3:45   | Events tab → 7-step wizard → launch → what players see                                     |
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

One pass, in order. Each step is repeatable on its own; the finished episode is
`tooling/out/<ep>.mp4` (clean, for YouTube with `captions/<ep>.srt` uploaded as
subtitles) and `tooling/out/<ep>-captioned.mp4` (captions burned in, for
Discord and socials).

```bash
cd docs/videos/tooling
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
python3 -m venv .venv-voice && .venv-voice/bin/pip install -r requirements-chatterbox.txt
npm install                          # Playwright; ffmpeg must be on PATH

.venv-voice/bin/python voice.py ep1     # 1. the voice-over → vo/ep1/NN.wav (+ timings)
.venv/bin/python music.py               # 2. music/bed.wav + music/sting.wav
.venv/bin/python fonts.py               # 3. fonts/ for cards and captions

# 4. the site in mock mode, and the stand-in API beside it
(cd ../../../apps/web && USE_MOCK_API=true PORT=3001 pnpm dev) &
python3 meta-server.py &
node shots.mjs e1_cold_open e1_basics …  # 5. clips, cut to the voice (default: all)

node build.mjs --video ep1           # 6. scripts, captions and the finished video
```

### 1. Voice-over

Everything runs locally: no script text or audio leaves the machine.

`voice.py` reads each numbered line of the read sheet with **Chatterbox**
(Resemble AI, MIT licence, CPU; its models download from Hugging Face on first
run). Chosen in an A/B on the cold open (2026-09-28) over Kokoro, a drier
Chatterbox setting and Chatterbox Turbo, because it performs the lines: it
acts a quote ("we should do a _bingo_!") and takes a beat before a punchline.

- **The narrator** is `voices/narrator.flac`, 12 s of Kokoro `bm_fable`.
  Chatterbox copies its timbre, so the voice is ours to use and no real
  person is cloned. Swap the file to recast the series.
- **Settings:** exaggeration 0.65, cfg weight 0.3 (`EXAGGERATION=`,
  `CFG_WEIGHT=`). Each line is read whole, which is where the phrasing comes
  from.
- **Takes are reviewed automatically.** Chatterbox's reads vary, so each line
  is rendered until a take passes. Whisper transcribes it, and it must:
  - match the script (letter error rate ≤ 5%);
  - neither add nor drop a word (it once invented "Step 5." after "Be honest.");
  - have no pause over 1.4 s, or 2 s right after a short punchline sentence,
    where the beat is the joke;
  - read no faster than 170 wpm.

  Up to 4 takes (`MAX_TAKES=`). A line where none pass is listed at the end,
  and a take with the right words always beats one with the wrong words.
  Takes are seeded, so a rerun gives the same reads, and
  `voice.py ep1 --lines 8 --take 6` renders one particular read.

- **Names** it mispronounces are respelled for it in `SAY` ("Turael").
- **Timings:** the script is aligned to the take's transcript letter by
  letter, and every script word gets its time in `NN.json`. Captions and shot
  cues count words from there, so they land on the word, not near it.
- About 3.5× slower than real time on 4 CPU cores: ~15 minutes an episode.
- Chatterbox embeds Resemble's inaudible Perth watermark in its output.
- `ENGINE=kokoro` is the first voice: Kokoro-82M, one sentence at a time with
  measured gaps, IPA fixes in `PRONOUNCE`, and `--check` for the Whisper diff.
- A take is tied to its line's text. Change a line in `episodes.mjs` and the
  build warns until that line is re-voiced.
- A human read replaces any take: drop `NN.wav` in and run
  `voice.py <ep> --retime --lines NN` to time it.

### 2. Music

`music.py` synthesizes the bed and the card sting, so the episodes carry no
licence question: plucked-lute arpeggios (Karplus-Strong) over a soft pad in D
dorian, 80 bpm, a seamless 96-second loop. It is texture, not a tune. To use a
licensed track instead, drop it in as `music/bed.{wav,mp3,m4a}` (and
`music/sting.*`); the build loops it to length.

### 3. Recording the clips

The clips come from the web app in mock mode, which has a full bingo, a draft,
loot sweeps and competitions, and a mock superadmin.

- **Cut to the voice.** A shot calls `on("Bingo is a grid")` to wait for the
  moment the narrator says it (from the take's sentence timings), so the
  cursor lands on the thing as it's named. The runner keeps rolling until the
  beat is covered and warns when a shot falls behind its cue. Without takes,
  shots play at their own pace, as before.
- **Framing.** The wizard steps are filmed at a 1.3× page zoom (`zoom()` in
  `lib.mjs`, CSS zoom on `<main>` only, so the header stays desktop and text
  stays sharp). The form is only 768 px wide and otherwise fills half the frame.
- **Real images.** Item, NPC and skill images are fetched from droptracker.io
  on first use and cached in `icons/`. `OFFLINE=1` films the old way:
  the osrsbox extract from `icons/itemdb/`, with skillcape/pet stand-ins and
  blanks for anything else.
- It uses Chrome's screencast (CDP): a 1280×720 viewport at 1.5× scale,
  1920×1080 at about 45 fps, encoded to 30 fps H.264 at CRF 18. Page loads
  mid-shot are cut out of the tape. A drawn cursor with click pulses is
  injected (headless Chrome has no cursor); the Next.js dev badge and chat
  bubble are hidden.

`meta-server.py` is a stand-in Web API on `:31325` for the reads mock mode
leaves empty on camera: the "Fill for me" generator form, completion history,
prize pot, clan-point payouts and task requirements (event 1), and item/NPC
search. It answers 503 to everything else, so the rest falls back to the normal
mocks. Search needs `meta.json` (`{"items": {name: id}, "npcs": {name: id}}`,
built from the osrsbox package's `items-complete.json` and
`monsters-complete.json`); episode 1 doesn't use it. To film real data instead,
set `BASE` to a dev instance.

### 4. Assembly

`build.mjs` writes the scripts and captions for every episode, and with
`--video` renders:

- **Timing.** Each beat lasts its take plus a breath either side and its
  `hold`. A clip that runs long is sped up by at most 1.25×, then trimmed; one
  that runs short holds its last frame (and the build says so).
- **Picture.** 0.3 s dissolves between beats, placed so the picture stays in
  step with the voice. Title cards in Cinzel and Figtree with the logo, a fade
  in and out.
- **Sound.** The voice (high-passed at 70 Hz), the bed 12 dB down and ducked
  about 7 dB under the voice, a sting on each card. Two-pass linear loudnorm
  to −14 LUFS / −2 dBTP, YouTube's target.
- **Captions** follow each sentence where it is spoken, in chunks of about 13
  words split at the comma nearest the middle. They are within ±0.4 s of the
  spoken words on ep1.

Without takes, the render is a silent rough cut timed at about 150 wpm and
stamped "ROUGH CUT", as before.

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

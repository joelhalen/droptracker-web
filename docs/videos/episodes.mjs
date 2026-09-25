// Single source of truth for the "Events, Explained" video series.
//
// Each episode is a list of beats. A beat is one voice-over paragraph laid
// over one recorded clip (see tooling/shots.mjs for how each clip is filmed).
// `build.mjs` turns this file into the readable scripts (scripts/*.md),
// caption files (captions/*.srt) and a captioned rough cut per episode.
//
// Voice: deadpan, unbothered, a little too honest. The narrator has run a
// clan event before and has seen things. Jokes are dry asides, never the
// point of the sentence — every line still teaches something true.
//
// `card` beats are full-screen title cards (no clip). `hold` = extra seconds
// of picture after the line ends, for a joke to land or a UI change to read.

export const episodes = [
  {
    id: "ep1",
    title: "Your First Event",
    subtitle: "or: how the spreadsheet person finally retired",
    beats: [
      {
        clip: "e1_cold_open",
        screen: "Public page of a live bingo. Slow drift down the board, past the standings strip.",
        vo: 'Every clan event starts the same way. Someone says, "we should do a bingo." Everyone agrees. And then one person spends the next two weeks in a spreadsheet, squinting at screenshots of other people\'s Vorkath kills.',
      },
      {
        clip: "e1_cold_open_2",
        screen: "Continue the drift into the task progress bars.",
        vo: "Today, that person retires.",
        hold: 1.2,
      },
      { card: ["DropTracker Events", "Episode 1 · Your First Event"], vo: "", hold: 3 },
      {
        clip: "e1_events_tab",
        screen:
          "Manage Clan → Events. Hover the Live / Drafts buckets, then glide to “Create event →” and click.",
        vo: "Open your clan's Manage page, then Events. This is mission control. Live events, drafts, things that already ended, and a button that says Create event. We're going to press it. Bravely.",
      },
      {
        clip: "e1_basics",
        screen:
          "Wizard step 1. Type “Autumn Ladder”, a short description, hover Bingo, pick Standard.",
        vo: 'Step one: a name. Something inspiring, like "Autumn Ladder." Nobody has ever been this creative. Then a format. Standard is a plain list of tasks. Bingo is a grid, with bonus points for finishing lines. The fancier formats get their own episodes, because they need the emotional support.',
      },
      {
        clip: "e1_schedule",
        screen: "Step 2. Hover start/end fields, then the “Repeats on a schedule” option.",
        vo: "Step two: when it runs. A start, an end, done. Or make it repeat, say every weekend this month, and between windows it simply ignores everyone. All times are UTC. Game time. No daylight savings surprises.",
      },
      {
        clip: "e1_joining",
        screen: "Step 3. Glide down the four joining options, then to “Which submissions count?”.",
        vo: "Step three: how people get on teams. They pick their own, get auto-balanced, drop into a sign-up pool you sort out later, or you assign everyone by hand, like a benevolent dictator. Down here you choose which submissions count. Everything, plugin only, or anything typed in manually needs an admin's thumbs up. Trust is a spectrum.",
      },
      {
        clip: "e1_tasks",
        screen:
          "Step 4. Hover “Fill for me”, “New task”, “From library”, then glide over the task list.",
        vo: "Step four: tasks. Build them one at a time, grab presets from the library, or hit Fill for me, and DropTracker drafts a balanced list based on how long the event runs and how much your clan actually plays. The options are casual, regular, and very active. Be honest. Episode two covers tasks properly.",
      },
      {
        clip: "e1_teams",
        screen: "Step 5. Type “Team Orange”, click Add team. Type a player name into a roster box.",
        vo: "Step five: teams. Type a name, add it, paste in a list of players if you already know who's who. Or skip it and let people sign themselves up. Your clan, your call, your group chat drama.",
      },
      {
        clip: "e1_discord",
        screen: "Step 6. Server + channel pickers, then expand “Team channels & roles”.",
        vo: "Step six: Discord. Pick where announcements go, where completions go, and where the live leaderboard lives. It can even create a private channel and a role for every team, then tidy them up afterwards. Like a butler. A butler who pings.",
      },
      {
        clip: "e1_launch",
        screen: "Step 7. Glide down the summary table, land on “Launch event now” (don't click).",
        vo: "Last step: the pre-flight check. If it's all green, launch it now. Or keep it as a draft and walk away. Drafts don't expire, don't cost anything, and never ask how you're doing.",
      },
      {
        clip: "e1_player_view",
        screen:
          "Public event page. Standings strip, bingo board, then the Participate panel and Sign up button.",
        vo: "Here's what your players see. The board, the standings, their team, and a big sign up button. And from then on, they just play the game. The RuneLite plugin sends their drops, kills and personal bests to DropTracker, and the board fills itself in.",
      },
      {
        clip: "e1_player_view_2",
        screen: "Scroll to the task list with progress bars per team.",
        vo: "Nobody posts screenshots. Nobody checks them. The spreadsheet person is free.",
        hold: 1,
      },
      {
        clip: "e1_outro",
        screen: "The /events timeline, bars sliding past “Now”.",
        vo: "Next time: tasks. What counts, what doesn't, and why Turael skipping will not save you.",
        hold: 1.5,
      },
      { card: ["droptracker.io", "Events · Episode 2: What Actually Counts"], vo: "", hold: 3 },
    ],
  },

  {
    id: "ep2",
    title: "What Actually Counts",
    subtitle: "tasks, and the many ways people try to cheese them",
    beats: [
      {
        clip: "e2_cold_open",
        screen: "Public task list: progress bars for three teams.",
        vo: "A task is a promise. You promise points. The game promises drops. Only one of you is lying.",
        hold: 1,
      },
      { card: ["DropTracker Events", "Episode 2 · What Actually Counts"], vo: "", hold: 3 },
      {
        clip: "e2_new_task",
        screen: "Manager → Tasks → New task. The task form opens.",
        vo: "Tasks live in your event's manager, under Tasks. Click New task and you get this form. It looks like a lot. It is a lot. But it's the good kind of a lot.",
      },
      {
        clip: "e2_task_types",
        screen:
          "Focus the Task type select and arrow through the types; the help text under it changes each time.",
        vo: "First, the type. Items, kill count, XP, skill levels, personal bests, pets, combat achievements, slayer tasks, total loot value. Nearly all of them are scored automatically from the plugin. The ones that aren't, like custom tasks, wait for an admin.",
      },
      {
        clip: "e2_item_modes",
        screen:
          "Back on Item collection. Arrow through “Collection mode”: single, any, different, all, points, combined, either-or.",
        vo: "Item tasks have modes. One specific item. Any items from a list. Different items, so the fifth Bandos tasset in a row doesn't count five times. All of a list. Points per item. Combined requirements, like every godsword shard plus any hilt. Or either-or: a boss pet, or five thousand kills. Whichever comes first. It won't be the pet.",
      },
      {
        clip: "e2_pick_item",
        screen: "Type “Twisted” in the item search, pick Twisted bow, set Points to 50.",
        vo: "Search for the item, drop it in, set the points. Fifty points for a twisted bow feels fair. It is not fair. Nothing about a twisted bow is fair.",
      },
      {
        clip: "e2_what_counts",
        screen: "Task list: expand “What counts” under a kill count task and an item task.",
        vo: "Every task explains itself. Open What counts and it tells you exactly what gets credited. And it's been stress-tested by clan members, who are the most creative people alive when points are involved.",
      },
      {
        clip: "e2_anticheese",
        screen: "Slow pan across the task list while the anti-cheese rules are read.",
        vo: "Kill count from the plugin and from Wise Old Man is merged, never added, so no kill counts twice. A drop and its collection log entry count once. Slayer tasks skip Turael and Spria by default, so Turael skipping will not save you. And only things you do after joining count. Yes, we checked.",
      },
      {
        clip: "e2_review",
        screen:
          "Tick “review” on a task, then open the Review tab: a pending Twisted bow, hover Confirm.",
        vo: "Want a human in the loop? Tick review on a task, or on the whole event, and completions land here, in the review queue. Confirm, reject, or hand out points manually. Loot value tasks can auto-accept small drops, because nobody should have to approve three hundred bones.",
      },
      {
        clip: "e2_library",
        screen: "Click “From library”; the preset picker opens. Scroll it.",
        vo: "Every task you make is saved to a reusable library, and there are a few hundred public presets already. Or press Fill for me, answer a couple of questions, and get a balanced list you can lock, reroll, and pretend you wrote yourself.",
      },
      {
        clip: "e2_outro",
        screen: "Public task list, one bar completing.",
        vo: "That's tasks. Next episode: points. Who gets them, how bingo lines work, and why the person who went AFK on the winning team gets nothing.",
        hold: 1.5,
      },
      { card: ["droptracker.io", "Events · Episode 3: How Scoring Works"], vo: "", hold: 3 },
    ],
  },

  {
    id: "ep3",
    title: "How Scoring Works",
    subtitle: "points, lines, blackouts and consequences",
    beats: [
      {
        clip: "e3_cold_open",
        screen:
          "Standings strip on the public page: #1 Team Red 120, #2 Team Blue 95, #3 Team Green 60.",
        vo: "Points. The only thing clans love more than drops, and arguing about drops.",
        hold: 1,
      },
      { card: ["DropTracker Events", "Episode 3 · How Scoring Works"], vo: "", hold: 3 },
      {
        clip: "e3_task_points",
        screen: "Task list: hover a task's points value, then its per-team bars.",
        vo: "Every task is worth some points. When a team finishes it, the team gets those points. Simple. What's less simple is who on the team gets the credit.",
      },
      {
        clip: "e3_split",
        screen: "Players tab: per-player points and contributions.",
        vo: "Points are split by contribution. If two of you each got half of a five point task, you each get two and a half. So yes, the person who carried the team gets to prove it, with decimals.",
      },
      {
        clip: "e3_bingo",
        screen: "Bingo board: hover a free cell, trace a completed row, then a column.",
        vo: "Bingo adds bonuses. Finish a row, a column, or a diagonal and your team gets line points on top. Fill the whole board for the blackout bonus. Empty cells are free spaces, already done for everyone, as a treat.",
      },
      {
        clip: "e3_team_filter",
        screen: "Click the Team Red / Team Blue filters above the board; completed cells change.",
        vo: "Filter the board by team to see exactly who's close to a line, and who's one Vorkath kill away from a breakdown.",
      },
      {
        clip: "e3_standings",
        screen: "Teams page: ranked team cards with scores.",
        vo: "Standings update live, here and in Discord. The Discord leaderboard is one message, edited in place, so your channel doesn't turn into a wall of scoreboards.",
      },
      {
        clip: "e3_history",
        screen: "Completion history: filter by team, toggle “Show progress updates”.",
        vo: "Every point has a receipt. The completion history shows who pulled what, for which team, and when. It is very useful for settling arguments, and for starting new ones.",
      },
      {
        clip: "e3_effort",
        screen: "Effort report: per-player EHE numbers.",
        vo: "Then there's effort. Hours spent on things that actually move the board, not hours spent five-manning a boss that isn't on it. Busy isn't the same as helpful.",
      },
      {
        clip: "e3_payouts",
        screen: "Manager → Prize Pot tab, then Clan Points tab.",
        vo: "When it ends, you can pay out. The prize pot tracks buy-ins and donations, but it's advertised only. No real gold moves, you still trade it in game. Clan points go out for placement and participation. And by default, the person who signed up and went AFK on the winning team gets nothing. Justice. Finally.",
      },
      {
        clip: "e3_outro",
        screen: "Timeline on /events with the other event kinds visible.",
        vo: "That's the core of it. Next up, the fancier formats: loot sweeps, skill and boss of the week, the board game, and Conquest, where your clan fights over a map of Gielinor. Bring snacks.",
        hold: 1.5,
      },
      { card: ["droptracker.io", "Events, Explained"], vo: "", hold: 3 },
    ],
  },
];

// Planned follow-ups (outlined in PLAN.md; not yet filmed, see why there).
export const upcoming = [
  "ep4 — Running It: review queue, Discord surfaces, the in-game HUD, ending an event",
  "ep5 — Loot Sweep: decay, groups and sets",
  "ep6 — Skill / Boss of the Week",
  "ep7 — The Board Game: dice, tiles, the shop, and the mercy rule",
  "ep8 — Conquest: troops, dice battles and holding territory",
];

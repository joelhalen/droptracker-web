// Turns episodes.mjs into the written deliverables and a timed rough cut.
//
//   node build.mjs                 scripts + captions for every episode
//   node build.mjs --video ep1     ...and render ep1's rough cut (needs clips/)
//
// Writes (relative to docs/videos/):
//   scripts/<ep>.md         shooting script: timecode, VO, on-screen, clip
//   scripts/<ep>-vo.md      read sheet for the voice-over, with time targets
//   captions/<ep>.srt       the VO as captions, on the rough-cut timeline
//   tooling/out/<ep>-roughcut.mp4   clips cut to VO length, captions burned in
//
// Timing: the rough cut gives each beat the time the line needs at a relaxed
// ~150 wpm, plus the beat's `hold`. When the real VO lands, re-time by
// re-cutting to the audio; the beat order and clip ids stay the same.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { episodes, upcoming } from "../episodes.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CLIPS = process.env.CLIPS || path.join(ROOT, "tooling/clips");
const OUT = process.env.OUT || path.join(ROOT, "tooling/out");
const FONTS = process.env.FONTS || path.join(ROOT, "tooling/fonts");
const WPS = 2.5; // words per second for the relaxed deadpan read
const LEAD = 0.35; // breath before a line starts
const TAIL = 0.45; // air after it ends

const words = (s) => (s.match(/\S+/g) || []).length;
export function beatTimes(ep) {
  let t = 0;
  return ep.beats.map((b) => {
    const speak = b.vo ? words(b.vo) / WPS : 0;
    const dur = +(LEAD + speak + TAIL + (b.hold || 0)).toFixed(2);
    const r = { ...b, start: t, dur, speak };
    t += dur;
    return r;
  });
}
const tc = (s, ms = false) => {
  const m = Math.floor(s / 60),
    sec = s - m * 60;
  return ms
    ? `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:${sec.toFixed(3).padStart(6, "0").replace(".", ",")}`
    : `${m}:${String(Math.floor(sec)).padStart(2, "0")}`;
};

// Split a VO paragraph into caption chunks of ~10 words on sentence/comma
// boundaries, each timed by its share of the words.
function chunks(text) {
  const parts = text
    .match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (words(p) <= 13) {
      out.push(p);
      continue;
    }
    let cur = [];
    for (const w of p.split(/\s+/)) {
      cur.push(w);
      if (cur.length >= 8 && /[,;:]$/.test(w)) {
        out.push(cur.join(" "));
        cur = [];
      } else if (cur.length >= 13) {
        out.push(cur.join(" "));
        cur = [];
      }
    }
    if (cur.length) out.push(cur.join(" "));
  }
  return out;
}
function captionCues(ep) {
  const cues = [];
  for (const b of beatTimes(ep)) {
    if (!b.vo) continue;
    let t = b.start + LEAD;
    for (const c of chunks(b.vo)) {
      const d = words(c) / WPS;
      cues.push({ start: t, end: t + d, text: c });
      t += d;
    }
  }
  return cues;
}

function writeDocs(ep) {
  const beats = beatTimes(ep);
  const total = beats.at(-1).start + beats.at(-1).dur;
  const wc = beats.reduce((n, b) => n + words(b.vo || ""), 0);
  let md = `# Episode ${ep.id.slice(2)} — ${ep.title}\n\n_${ep.subtitle}_\n\n`;
  md += `**Runtime target:** ~${tc(total)} · **VO:** ${wc} words · **Clips:** \`tooling/clips/<clip>.mp4\`\n\n`;
  md += `Generated from \`docs/videos/episodes.mjs\` — edit that file, then \`node tooling/build.mjs\`.\n\n`;
  md += `| # | Time | Clip | On screen | Voice-over |\n|---|---|---|---|---|\n`;
  beats.forEach((b, i) => {
    const clip = b.card ? "_title card_" : `\`${b.clip}\``;
    const screen = b.card ? `**${b.card[0]}** / ${b.card[1]}` : b.screen;
    md += `| ${i + 1} | ${tc(b.start)} | ${clip} | ${screen} | ${b.vo ? b.vo.replace(/\|/g, "\\|") : "_(music sting)_"} |\n`;
  });
  fs.writeFileSync(path.join(ROOT, "scripts", `${ep.id}.md`), md);

  let vo = `# ${ep.title} — voice-over read sheet\n\n`;
  vo += `Deadpan, unhurried, faintly amused. Think "nature documentary narrator who has seen one clan bingo too many".\n`;
  vo += `Leave a beat of silence where a line ends in a joke; the edit holds on the picture there.\n`;
  vo += `Record each numbered line as its own take (file name = the number) so the edit can drop them onto the timeline.\n\n`;
  beats.forEach((b, i) => {
    if (!b.vo) return;
    vo += `**${String(i + 1).padStart(2, "0")}** · target ${b.speak.toFixed(1)}s${b.hold ? ` (+${b.hold}s hold after)` : ""}\n\n> ${b.vo}\n\n`;
  });
  fs.writeFileSync(path.join(ROOT, "scripts", `${ep.id}-vo.md`), vo);

  const srt = captionCues(ep)
    .map((c, i) => `${i + 1}\n${tc(c.start, true)} --> ${tc(c.end, true)}\n${c.text}\n`)
    .join("\n");
  fs.writeFileSync(path.join(ROOT, "captions", `${ep.id}.srt`), srt);
  return { total, wc };
}

// ---------------------------------------------------------------- video
const ff = (args) =>
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    stdio: "inherit",
  });
const probe = (f) =>
  parseFloat(
    execFileSync("ffmpeg", ["-i", f, "-hide_banner"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .toString()
      .match(/Duration: (\d+):(\d+):([\d.]+)/)
      ?.slice(1)
      .reduce((a, v, i) => a + v * [3600, 60, 1][i], 0) ?? 0,
  );
function durationOf(f) {
  try {
    return probe(f);
  } catch (e) {
    const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/);
    return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
  }
}
const assTime = (s) =>
  `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;
const ASS_HEAD = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,DT Figtree,46,&H00F2F2F2,&H000000FF,&H00000000,&HA0000000,0,0,0,0,100,100,0,0,3,14,0,2,260,260,64,1
Style: Title,DT Cinzel,118,&H0041B5F2,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,6,5,100,100,0,1
Style: Sub,DT Figtree,50,&H00C4DCE8,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,0,3,5,100,100,0,1
Style: Tag,DT Figtree,26,&H0075A0C8,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,3,0,1,0,0,3,30,30,18,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

function renderVideo(ep) {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = path.join(OUT, `${ep.id}_parts`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp);
  const beats = beatTimes(ep);
  const parts = [];
  beats.forEach((b, i) => {
    const out = path.join(tmp, `${String(i).padStart(2, "0")}.mp4`);
    const vf = [];
    if (b.card) {
      // Brand-dark card with a soft vignette; the text itself comes from the ASS pass.
      ff([
        "-f",
        "lavfi",
        "-i",
        `color=c=0x16110b:s=1920x1080:r=30:d=${b.dur}`,
        "-vf",
        "vignette=PI/4,format=yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        out,
      ]);
    } else {
      const src = path.join(CLIPS, `${b.clip}.mp4`);
      if (!fs.existsSync(src)) {
        console.warn(`  missing clip ${b.clip} — using a slate`);
        ff([
          "-f",
          "lavfi",
          "-i",
          `color=c=0x2a1f14:s=1920x1080:r=30:d=${b.dur}`,
          "-vf",
          "format=yuv420p",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          out,
        ]);
      } else {
        const have = durationOf(src);
        // Too long: speed up to 1.25x, then trim. Too short: hold the last frame.
        const speed = have > b.dur ? Math.min(1.25, have / b.dur) : 1;
        if (speed > 1) vf.push(`setpts=PTS/${speed.toFixed(3)}`);
        const eff = have / speed;
        if (eff < b.dur)
          vf.push(`tpad=stop_mode=clone:stop_duration=${(b.dur - eff + 0.1).toFixed(2)}`);
        vf.push("fps=30", "format=yuv420p");
        ff([
          "-i",
          src,
          "-vf",
          vf.join(","),
          "-t",
          String(b.dur),
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "18",
          out,
        ]);
      }
    }
    parts.push(out);
  });
  const list = path.join(tmp, "list.txt");
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  const joined = path.join(tmp, "joined.mp4");
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);

  // Overlay: title cards, placeholder captions, and a "scratch" tag so a
  // rough cut is never mistaken for the finished video.
  const total = beats.at(-1).start + beats.at(-1).dur;
  let ass = ASS_HEAD;
  for (const b of beats)
    if (b.card) {
      const s = assTime(b.start + 0.2),
        e = assTime(b.start + b.dur - 0.1);
      ass += `Dialogue: 1,${s},${e},Title,,0,0,0,,{\\fad(500,400)\\pos(960,500)}${b.card[0]}\n`;
      ass += `Dialogue: 1,${s},${e},Sub,,0,0,0,,{\\fad(700,400)\\pos(960,610)}${b.card[1]}\n`;
    }
  for (const c of captionCues(ep))
    ass += `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Cap,,0,0,0,,${c.text}\n`;
  ass += `Dialogue: 2,${assTime(0)},${assTime(total)},Tag,,0,0,0,,ROUGH CUT · captions = scratch VO\n`;
  const assFile = path.join(tmp, "overlay.ass");
  fs.writeFileSync(assFile, ass);
  const final = path.join(OUT, `${ep.id}-roughcut.mp4`);
  ff([
    "-i",
    joined,
    "-vf",
    `subtitles=${assFile}:fontsdir=${FONTS},fade=t=in:st=0:d=0.6,fade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8`,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-movflags",
    "+faststart",
    final,
  ]);
  fs.rmSync(tmp, { recursive: true, force: true });
  return final;
}

// ---------------------------------------------------------------- main
fs.mkdirSync(path.join(ROOT, "scripts"), { recursive: true });
fs.mkdirSync(path.join(ROOT, "captions"), { recursive: true });
const want = process.argv.includes("--video")
  ? process.argv.slice(process.argv.indexOf("--video") + 1)
  : [];
for (const ep of episodes) {
  const { total, wc } = writeDocs(ep);
  console.log(`${ep.id}: ${tc(total)} · ${wc} words · ${ep.beats.length} beats`);
  if (want.includes(ep.id) || want.includes("all")) console.log("  →", renderVideo(ep));
}
if (!want.length) console.log(`(upcoming: ${upcoming.length} episodes outlined in PLAN.md)`);

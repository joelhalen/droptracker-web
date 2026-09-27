// Turns episodes.mjs into the written deliverables and the finished video.
//
//   node build.mjs                 scripts + captions for every episode
//   node build.mjs --video ep1     ...and render ep1 (needs clips/)
//
// Writes (relative to docs/videos/):
//   scripts/<ep>.md         shooting script: timecode, VO, on-screen, clip
//   scripts/<ep>-vo.md      read sheet for the voice-over, with time targets
//   captions/<ep>.srt       the VO as captions, on the video's timeline
//   tooling/out/<ep>.mp4             the episode: picture, voice, music, cards
//   tooling/out/<ep>-captioned.mp4   the same with captions burned in (for
//                                    Discord and socials; YouTube gets the .srt)
//
// Timing: when an episode has takes in tooling/vo/<ep>/ (voice.py), every beat
// lasts exactly as long as its take plus a breath either side and its `hold`,
// and the captions follow the take's sentence timings. Without takes, beats
// are timed at a relaxed ~150 wpm and the render is a silent, captioned rough
// cut stamped "ROUGH CUT".
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { episodes, upcoming } from "../episodes.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TOOLING = path.join(ROOT, "tooling");
const CLIPS = process.env.CLIPS || path.join(TOOLING, "clips");
const OUT = process.env.OUT || path.join(TOOLING, "out");
const FONTS = process.env.FONTS || path.join(TOOLING, "fonts");
const VO = process.env.VO || path.join(TOOLING, "vo");
const MUSIC = process.env.MUSIC || path.join(TOOLING, "music");
const LOGO_SRC = path.join(ROOT, "../../apps/web/public/og-default.png");
const WPS = 2.5; // words per second for the relaxed deadpan read (no takes yet)
const LEAD = 0.35; // breath before a line starts
const TAIL = 0.45; // air after it ends
const XF = 0.3; // dissolve between beats
const LOUDNESS = "I=-14:TP=-2:LRA=11"; // YouTube's target, with AAC headroom

const words = (s) => (s.match(/\S+/g) || []).length;
const num = (i) => String(i + 1).padStart(2, "0");

// The take for beat i, if voice.py (or a human) has recorded one.
function take(ep, i) {
  const wav = path.join(VO, ep.id, `${num(i)}.wav`);
  if (!fs.existsSync(wav)) return null;
  const meta = path.join(VO, ep.id, `${num(i)}.json`);
  if (fs.existsSync(meta)) {
    const m = JSON.parse(fs.readFileSync(meta, "utf8"));
    // A take is only good for the line it read.
    if (m.text === ep.beats[i].vo) return { wav, duration: m.duration, sentences: m.sentences };
    console.warn(`  ${ep.id}/${num(i)}: the line changed since it was voiced — re-run voice.py`);
    return null;
  }
  return { wav, duration: durationOf(wav), sentences: null };
}
const hasVoice = (ep) => ep.beats.some((b, i) => b.vo && take(ep, i));

export function beatTimes(ep) {
  let t = 0;
  return ep.beats.map((b, i) => {
    const tk = b.vo ? take(ep, i) : null;
    const speak = tk ? tk.duration : b.vo ? words(b.vo) / WPS : 0;
    const dur = +(LEAD + speak + TAIL + (b.hold || 0)).toFixed(2);
    const r = { ...b, start: t, dur, speak, take: tk, n: i };
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

const sentencesOf = (text) =>
  text
    .match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g)
    .map((s) => s.trim())
    .filter(Boolean);

// Split a sentence into caption chunks of about 13 words: as few chunks as
// that allows, of about equal length, cut after the comma nearest the even
// split when one is close, and never leaving a stub of under 4 words.
function split(sentence) {
  let ws = sentence.split(/\s+/);
  const out = [];
  while (ws.length > 13) {
    const target = ws.length / Math.ceil(ws.length / 13);
    let cut = Math.round(target);
    let best = Infinity;
    ws.forEach((w, j) => {
      const len = j + 1;
      const ok =
        /[,;:]$/.test(w) && len >= Math.max(4, target - 4) && len <= Math.min(15, ws.length - 4);
      // On a tie take the later comma: it keeps lists ("drops, kills and pbs") whole.
      if (ok && Math.abs(len - target) <= best) [best, cut] = [Math.abs(len - target), len];
    });
    out.push(ws.slice(0, cut).join(" "));
    ws = ws.slice(cut);
  }
  out.push(ws.join(" "));
  return out;
}

// Caption cues on the episode timeline. With a take, each sentence is placed
// where it is actually spoken and its chunks share that span by length;
// otherwise chunks are timed at WPS.
function captionCues(ep) {
  const cues = [];
  for (const b of beatTimes(ep)) {
    if (!b.vo) continue;
    const at = b.start + LEAD;
    if (b.take?.sentences) {
      for (const s of b.take.sentences) {
        const parts = split(s.text);
        const total = parts.reduce((n, p) => n + p.length, 0);
        let t = at + s.start;
        for (const p of parts) {
          const d = ((s.end - s.start) * p.length) / total;
          cues.push({ start: t, end: t + d, text: p });
          t += d;
        }
      }
    } else {
      const parts = sentencesOf(b.vo).flatMap(split);
      const scale = b.take ? b.take.duration / (words(b.vo) / WPS) : 1;
      let t = at;
      for (const p of parts) {
        const d = (words(p) / WPS) * scale;
        cues.push({ start: t, end: t + d, text: p });
        t += d;
      }
    }
  }
  // Keep each cue up until the next one starts when the gap is only a breath,
  // so captions don't flicker off between sentences.
  for (let i = 0; i + 1 < cues.length; i++)
    if (cues[i + 1].start - cues[i].end < 0.6) cues[i].end = cues[i + 1].start;
  return cues;
}

function writeDocs(ep) {
  const beats = beatTimes(ep);
  const total = beats.at(-1).start + beats.at(-1).dur;
  const wc = beats.reduce((n, b) => n + words(b.vo || ""), 0);
  const voiced = hasVoice(ep);
  let md = `# Episode ${ep.id.slice(2)} — ${ep.title}\n\n_${ep.subtitle}_\n\n`;
  md += `**Runtime${voiced ? "" : " target"}:** ~${tc(total)} · **VO:** ${wc} words${voiced ? " (timed to the recorded takes)" : ""} · **Clips:** \`tooling/clips/<clip>.mp4\`\n\n`;
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
  vo += `Record each numbered line as its own take (file name = the number) so the edit can drop them onto the timeline.\n`;
  if (voiced)
    vo += `The times below are the current takes in \`tooling/vo/${ep.id}/\`; a human read can run a little either side.\n`;
  vo += `\n`;
  beats.forEach((b, i) => {
    if (!b.vo) return;
    vo += `**${num(i)}** · ${b.take ? "take" : "target"} ${b.speak.toFixed(1)}s${b.hold ? ` (+${b.hold}s hold after)` : ""}\n\n> ${b.vo}\n\n`;
  });
  fs.writeFileSync(path.join(ROOT, "scripts", `${ep.id}-vo.md`), vo);

  const srt = captionCues(ep)
    .map((c, i) => `${i + 1}\n${tc(c.start, true)} --> ${tc(c.end, true)}\n${c.text}\n`)
    .join("\n");
  fs.writeFileSync(path.join(ROOT, "captions", `${ep.id}.srt`), srt);
  return { total, wc, voiced };
}

// ---------------------------------------------------------------- video
const ff = (args) =>
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    stdio: "inherit",
  });
function durationOf(f) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
    { encoding: "utf8" },
  );
  return parseFloat(out) || 0;
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
Style: Title,DT Cinzel,104,&H0041B5F2,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,6,5,100,100,0,1
Style: Sub,DT Figtree,48,&H00C4DCE8,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,0,3,5,100,100,0,1
Style: Tag,DT Figtree,26,&H0075A0C8,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,3,0,1,0,0,3,30,30,18,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

const x264 = (crf = 18, preset = "veryfast") => [
  "-c:v",
  "libx264",
  "-preset",
  preset,
  "-crf",
  String(crf),
  "-pix_fmt",
  "yuv420p",
];

// One beat's picture, `len` seconds long (its time plus the dissolve into the
// next beat). Clips that run long are sped up to at most 1.25x, then trimmed;
// clips that run short hold their last frame.
function renderPart(b, len, out) {
  if (b.card) {
    ff([
      "-f",
      "lavfi",
      "-i",
      `color=c=0x16110b:s=1920x1080:r=30:d=${len}`,
      "-vf",
      "vignette=PI/4",
      ...x264(),
      out,
    ]);
    return;
  }
  const src = path.join(CLIPS, `${b.clip}.mp4`);
  if (!fs.existsSync(src)) {
    console.warn(`  missing clip ${b.clip} — using a slate`);
    ff(["-f", "lavfi", "-i", `color=c=0x2a1f14:s=1920x1080:r=30:d=${len}`, ...x264(), out]);
    return;
  }
  const have = durationOf(src);
  const vf = [];
  const speed = have > len ? Math.min(1.25, have / len) : 1;
  if (speed > 1) vf.push(`setpts=PTS/${speed.toFixed(3)}`);
  const eff = have / speed;
  if (eff < len) {
    const freeze = len - eff;
    if (freeze > 1.5) console.warn(`  ${b.clip}: holds its last frame for ${freeze.toFixed(1)}s`);
    vf.push(`tpad=stop_mode=clone:stop_duration=${(freeze + 0.1).toFixed(2)}`);
  }
  vf.push("fps=30", "settb=AVTB");
  ff(["-i", src, "-vf", vf.join(","), "-t", len.toFixed(3), "-an", ...x264(), out]);
}

// The card logo: the square DropTracker art from the site's OG image.
function logo(tmp) {
  const f = path.join(tmp, "logo.png");
  // Rounded corners (r=28) so it reads as an app icon, not a pasted square.
  const r = 28;
  const corner = `hypot(max(0,abs(X-150)-${150 - r}),max(0,abs(Y-150)-${150 - r}))`;
  ff([
    "-i",
    LOGO_SRC,
    "-vf",
    `crop=440:440:380:95,scale=300:300:flags=lanczos,format=rgba,` +
      `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*clip(${r}+0.5-${corner},0,1)'`,
    f,
  ]);
  return f;
}

// Voice, a ducked music bed, and a sting on each card, mixed to YouTube's
// loudness target (-14 LUFS integrated, -1.5 dBTP).
function renderAudio(beats, total, out) {
  const inputs = [];
  const input = (...args) => {
    inputs.push(...args);
    return inputs.filter((a) => a === "-i").length - 1;
  };
  const chains = [];
  const voIn = [];
  for (const b of beats) {
    if (!b.take) continue;
    const k = input("-i", b.take.wav);
    const ms = Math.round((b.start + LEAD) * 1000);
    chains.push(
      `[${k}]aformat=sample_rates=48000:channel_layouts=mono,highpass=f=70,adelay=${ms},apad=whole_dur=${total}[v${k}]`,
    );
    voIn.push(`[v${k}]`);
  }
  chains.push(
    `${voIn.join("")}amix=inputs=${voIn.length}:normalize=0:duration=longest,atrim=0:${total},asplit[vo][key]`,
  );
  const mix = ["[vo]"];
  const find = (name) =>
    ["wav", "mp3", "m4a"].map((e) => path.join(MUSIC, `${name}.${e}`)).find(fs.existsSync);
  const bed = find("bed");
  if (bed) {
    // The bed sits ~12 dB down and ducks a further ~7 dB while the narrator
    // talks: about 15 dB under the voice, and back up in the pauses and cards.
    const k = input("-stream_loop", "-1", "-i", bed);
    chains.push(
      `[${k}]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${total},volume=-12dB,` +
        `afade=t=in:d=1.5,afade=t=out:st=${(total - 3).toFixed(2)}:d=3[bedraw]`,
      `[key]aformat=channel_layouts=stereo[keyst]`,
      `[bedraw][keyst]sidechaincompress=threshold=0.03:ratio=3:attack=150:release=1200[bed]`,
    );
    mix.push("[bed]");
  } else {
    chains.push(`[key]anullsink`);
    console.warn("  no music/bed.* — run music.py or drop a track in; mixing voice only");
  }
  const sting = find("sting");
  if (sting)
    for (const b of beats.filter((b) => b.card)) {
      const k = input("-i", sting);
      chains.push(
        `[${k}]aformat=sample_rates=48000:channel_layouts=stereo,volume=-6dB,adelay=${Math.round(b.start * 1000)}:all=1[s${k}]`,
      );
      mix.push(`[s${k}]`);
    }
  chains.push(
    `${mix.join("")}amix=inputs=${mix.length}:normalize=0:duration=first,aformat=channel_layouts=stereo[a]`,
  );
  const premix = out.replace(/\.wav$/, "-premix.wav");
  ff([
    ...inputs,
    "-filter_complex",
    chains.join(";"),
    "-map",
    "[a]",
    "-t",
    String(total),
    "-c:a",
    "pcm_f32le",
    premix,
  ]);
  // Two-pass loudnorm: measure, then apply one linear gain, so the balance
  // between voice, bed and stings survives normalization.
  const { stderr } = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-i",
      premix,
      "-af",
      `loudnorm=${LOUDNESS}:print_format=json`,
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8" },
  );
  const m = JSON.parse(stderr.slice(stderr.lastIndexOf("{")));
  const measured =
    `measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:` +
    `measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  ff([
    "-i",
    premix,
    "-af",
    `loudnorm=${LOUDNESS}:${measured},aresample=48000`,
    "-c:a",
    "pcm_s16le",
    out,
  ]);
  fs.rmSync(premix);
}

function renderVideo(ep) {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = path.join(OUT, `${ep.id}_parts`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp);
  const beats = beatTimes(ep);
  const total = +(beats.at(-1).start + beats.at(-1).dur).toFixed(2);
  const voiced = hasVoice(ep);

  // 1. Every beat's picture, each overlapping the next by XF for the dissolve.
  const parts = beats.map((b, i) => {
    const out = path.join(tmp, `${String(i).padStart(2, "0")}.mp4`);
    renderPart(b, b.dur + (i + 1 < beats.length ? XF : 0), out);
    return out;
  });

  // 2. Dissolve them together. Beat k's dissolve starts exactly at its start
  //    time, so the picture stays in step with the voice.
  const joined = path.join(tmp, "joined.mp4");
  const xf = [];
  let last = "[0:v]";
  for (let k = 1; k < parts.length; k++) {
    const lbl = k + 1 < parts.length ? `[x${k}]` : "[vout]";
    xf.push(
      `${last}[${k}:v]xfade=transition=fade:duration=${XF}:offset=${beats[k].start.toFixed(3)}${lbl}`,
    );
    last = lbl;
  }
  ff([
    ...parts.flatMap((p) => ["-i", p]),
    "-filter_complex",
    xf.join(";"),
    "-map",
    "[vout]",
    ...x264(16),
    joined,
  ]);

  // 3. Overlays: card titles (+ logo), and the captions for the captioned cut.
  let cards = "";
  for (const b of beats)
    if (b.card) {
      const s = assTime(b.start + 0.25),
        e = assTime(b.start + b.dur - 0.1);
      cards += `Dialogue: 1,${s},${e},Title,,0,0,0,,{\\fad(500,400)\\pos(960,640)}${b.card[0]}\n`;
      cards += `Dialogue: 1,${s},${e},Sub,,0,0,0,,{\\fad(700,400)\\pos(960,740)}${b.card[1]}\n`;
    }
  let caps = "";
  for (const c of captionCues(ep))
    caps += `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Cap,,0,0,0,,${c.text}\n`;
  const tag = voiced
    ? ""
    : `Dialogue: 2,${assTime(0)},${assTime(total)},Tag,,0,0,0,,ROUGH CUT · captions = scratch VO\n`;

  // Logo on each card: its own input per card so each can fade in and out.
  const logoPng = logo(tmp);
  const cardBeats = beats.filter((b) => b.card);
  const logoIns = cardBeats.flatMap(() => ["-loop", "1", "-t", String(total), "-i", logoPng]);
  const overlay = (assFile) => {
    const g = [];
    let v = "[0:v]";
    cardBeats.forEach((b, i) => {
      const a = (b.start + 0.2).toFixed(2),
        z = (b.start + b.dur - 0.5).toFixed(2);
      g.push(
        `[${i + 1}:v]format=rgba,fade=t=in:st=${a}:d=0.6:alpha=1,fade=t=out:st=${z}:d=0.4:alpha=1[l${i}]`,
        `${v}[l${i}]overlay=x=(W-w)/2:y=190:enable='between(t,${a},${(b.start + b.dur).toFixed(2)})'[o${i}]`,
      );
      v = `[o${i}]`;
    });
    g.push(
      `${v}subtitles=${assFile}:fontsdir=${FONTS},fade=t=in:st=0:d=0.6,fade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8[v]`,
    );
    return g.join(";");
  };
  const writeAss = (name, body) => {
    const f = path.join(tmp, name);
    fs.writeFileSync(f, ASS_HEAD + body);
    return f;
  };

  const results = [];
  if (voiced) {
    const audio = path.join(tmp, "mix.wav");
    renderAudio(beats, total, audio);
    const outputs = [
      [`${ep.id}.mp4`, writeAss("clean.ass", cards)],
      [`${ep.id}-captioned.mp4`, writeAss("captioned.ass", cards + caps)],
    ];
    for (const [name, assFile] of outputs) {
      const final = path.join(OUT, name);
      ff([
        "-i",
        joined,
        ...logoIns,
        "-i",
        audio,
        "-filter_complex",
        overlay(assFile),
        "-map",
        "[v]",
        "-map",
        `${cardBeats.length + 1}:a`,
        ...x264(19, "medium"),
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-t",
        String(total),
        "-movflags",
        "+faststart",
        final,
      ]);
      results.push(final);
    }
  } else {
    const final = path.join(OUT, `${ep.id}-roughcut.mp4`);
    ff([
      "-i",
      joined,
      ...logoIns,
      "-filter_complex",
      overlay(writeAss("rough.ass", cards + caps + tag)),
      "-map",
      "[v]",
      ...x264(20, "medium"),
      "-movflags",
      "+faststart",
      final,
    ]);
    results.push(final);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return results;
}

// ---------------------------------------------------------------- main
fs.mkdirSync(path.join(ROOT, "scripts"), { recursive: true });
fs.mkdirSync(path.join(ROOT, "captions"), { recursive: true });
const want = process.argv.includes("--video")
  ? process.argv.slice(process.argv.indexOf("--video") + 1)
  : [];
for (const ep of episodes) {
  const { total, wc, voiced } = writeDocs(ep);
  console.log(
    `${ep.id}: ${tc(total)} · ${wc} words · ${ep.beats.length} beats${voiced ? " · voiced" : ""}`,
  );
  if (want.includes(ep.id) || want.includes("all"))
    for (const f of renderVideo(ep)) console.log("  →", f);
}
if (!want.length) console.log(`(upcoming: ${upcoming.length} episodes outlined in PLAN.md)`);

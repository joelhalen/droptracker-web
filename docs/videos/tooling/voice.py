"""Voice-over for the "Events, Explained" episodes, read by a local neural TTS.

    python3 voice.py ep1                 every line of ep1 -> vo/ep1/NN.wav
    python3 voice.py ep1 --lines 4 12    just those lines (numbers = read sheet)
    python3 voice.py ep1 --lines 8 --take 6   (chatterbox) that exact take, e.g.
                                         to prefer another read of a line
    python3 voice.py ep1 --check         (kokoro) transcribe each take and diff it
                                         against the script

Everything runs locally; no text or audio leaves the machine.

ENGINE=chatterbox (default) — Chatterbox (Resemble AI, MIT) reads each line
whole, in the narrator's voice (voices/narrator.flac, a 12 s Kokoro bm_fable
read, so the voice is ours to use), at exaggeration 0.65 / cfg 0.3: dry, but
it acts a quote or a punchline. Its reads vary take to take, so each line is
rendered until a take passes review: Whisper transcribes it, and it must match
the script (letter error rate <= 5%, no word added or dropped), with no stall
longer than MAX_PAUSE (PUNCHLINE_PAUSE after a short sentence) and no faster
than MAX_WPM.
Takes are seeded, so a rerun gives the same reads. ~3.5x real time on 4 CPU
cores: about 15 minutes an episode. Deps: requirements-chatterbox.txt.
Chatterbox marks its output with Resemble's inaudible Perth watermark.

ENGINE=kokoro — the first voice: Kokoro-82M (Apache-2.0), one sentence at a
time, joined with measured silence (a longer one before a short punchline).
VOICE=bm_fable and SPEED=0.9 by default. Deps: requirements.txt.

Each take's sentence timings go next to it (vo/<ep>/NN.json) so shots.mjs and
build.mjs cut the picture and time the captions to the real read. The numbers
match scripts/<ep>-vo.md, so a human read can replace any take: drop your own
NN.wav in and run `voice.py <ep> --retime --lines NN` to time it.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request
import zlib

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, "models")
ENGINE = os.environ.get("ENGINE", "chatterbox")
TARGET_RMS_DB = -20.0
LIMIT = 0.05  # letter error rate above which a take doesn't match the script

# ---------------------------------------------------------------- chatterbox
NARRATOR = os.path.join(HERE, "voices", "narrator.flac")
EXAGGERATION = float(os.environ.get("EXAGGERATION", "0.65"))
CFG_WEIGHT = float(os.environ.get("CFG_WEIGHT", "0.3"))
MAX_TAKES = int(os.environ.get("MAX_TAKES", "4"))
MAX_PAUSE = 1.4  # seconds of silence inside a line before it reads as a stall
PUNCHLINE_PAUSE = 2.0  # ...except after a short sentence ("Be honest."), where it's the joke
MAX_WPM = 170  # faster than this reads as rushed
MAX_RUN = 4  # letters in a row added or dropped: a whole word, not a spelling

# Chatterbox reads plain text, so names it gets wrong are respelled for it
# (the script, captions and review keep the real spelling).
SAY = {
    "Turael": "Tur-ay-el",  # otherwise "Toriel"
    "droptracker.io": "droptracker dot I O",
}

# ---------------------------------------------------------------- kokoro
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
FILES = ["kokoro-v1.0.onnx", "voices-v1.0.bin"]
VOICE = os.environ.get("VOICE", "bm_fable")
SPEED = float(os.environ.get("SPEED", "0.9"))
GAP = 0.25  # silence between sentences
BEAT_GAP = 0.50  # ...before a short punchline sentence
PUNCHLINE_WORDS = 4

# Words the phonemizer gets wrong, as the IPA Kokoro should say instead.
# Checked against how players say them, not how espeak guesses them.
PRONOUNCE = {
    "Turael": "tʊɹˈeɪəl",  # tur-AY-el, not "tyuh-RAIL"
}


def episodes():
    js = "import('./episodes.mjs').then(m => console.log(JSON.stringify(m.episodes)))"
    out = subprocess.check_output(["node", "--input-type=module", "-e", js], cwd=os.path.dirname(HERE))
    return {e["id"]: e for e in json.loads(out)}


def sentences(text):
    """Same split as build.mjs's captions: end punctuation plus a closing quote."""
    return [s.strip() for s in re.findall(r'[^.!?]+[.!?]+["”]?|[^.!?]+$', text) if s.strip()]


def trim(a, sr, floor_db=-45.0, pad=0.03):
    frame = int(sr * 0.01)
    n = len(a) // frame
    if n == 0:
        return a
    rms = np.sqrt(np.mean(a[: n * frame].reshape(n, frame) ** 2, axis=1) + 1e-12)
    loud = np.where(20 * np.log10(rms) > floor_db)[0]
    if not len(loud):
        return a
    s = max(0, loud[0] * frame - int(pad * sr))
    e = min(len(a), (loud[-1] + 1) * frame + int(pad * sr))
    return a[s:e]


def level(audio):
    audio = audio * (10 ** (TARGET_RMS_DB / 20) / max(np.sqrt(np.mean(audio**2)), 1e-6))
    peak = np.max(np.abs(audio))
    return audio * (0.97 / peak) if peak > 0.97 else audio


ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def spell(n):
    """1204 -> "one thousand two hundred four": Whisper writes numbers as
    digits ("40") that the script spells out ("forty")."""
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + "hundred" + ("" if n % 100 == 0 else spell(n % 100))
    if n < 1_000_000:
        return spell(n // 1000) + "thousand" + ("" if n % 1000 == 0 else spell(n % 1000))
    return str(n)


def letters(s):
    """Spelling-blind form for comparing a transcript to the script: "Step 4 –
    pre-flight" and "step four, preflight" both become "stepfourpreflight"."""
    s = re.sub(r"\d[\d,]*", lambda m: spell(int(m.group().replace(",", ""))), s.lower())
    return re.sub(r"[^a-z]", "", s)


def word_slips(ref, hyp):
    """Longest run of letters the take added or left out. A misheard word
    ("sought" for "sort") is a substitution and doesn't count; an invented
    phrase ("Step 5.") or a skipped one does."""
    r, h = letters(ref), letters(hyp)
    n, m = len(r), len(h)
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        d[i][0] = i
    for j in range(m + 1):
        d[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] != h[j - 1]))
    i, j, run, longest, kind = n, m, 0, 0, None
    while i or j:
        if i and j and d[i][j] == d[i - 1][j - 1] + (r[i - 1] != h[j - 1]):
            op = "sub"
            i, j = i - 1, j - 1
        elif j and d[i][j] == d[i][j - 1] + 1:
            op = "ins"
            j -= 1
        else:
            op = "del"
            i -= 1
        run = run + 1 if op != "sub" and op == kind else (1 if op != "sub" else 0)
        kind = op
        longest = max(longest, run)
    return longest


def tighten(audio, sr, words):
    """Shorten silences Chatterbox holds too long, down to the allowed pause
    (see overlong_pause), and move the word clock to match. The cut is taken
    from the middle of the gap with a short crossfade, so no breath or
    syllable is touched. Returns (audio, words, seconds removed)."""
    cuts, since = [], 0
    for a, b in zip(words, words[1:]):
        since += 1
        ends = a[2].endswith((".", "!", "?"))
        allowed = (PUNCHLINE_PAUSE if ends and since <= PUNCHLINE_WORDS else MAX_PAUSE) - 0.1
        gap = b[0] - a[1]
        if gap > allowed:
            mid = (a[1] + b[0]) / 2
            cuts.append((mid - (gap - allowed) / 2, mid + (gap - allowed) / 2))
        if ends:
            since = 0
    if not cuts:
        return audio, words, 0.0
    fade = int(0.01 * sr)
    out, pos = [], 0
    for c0, c1 in cuts:
        i0, i1 = int(c0 * sr), int(c1 * sr)
        seg = audio[pos:i0].copy()
        if out and len(seg) > fade:
            seg[:fade] *= np.linspace(0, 1, fade)
        if len(seg) > fade:
            seg[-fade:] *= np.linspace(1, 0, fade)
        out.append(seg)
        pos = i1
    tail = audio[pos:].copy()
    if len(tail) > fade:
        tail[:fade] *= np.linspace(0, 1, fade)
    out.append(tail)

    def shift(t):
        return t - sum(min(max(t - c0, 0.0), c1 - c0) for c0, c1 in cuts)

    moved = [(shift(a), shift(b), w) for a, b, w in words]
    return np.concatenate(out), moved, sum(c1 - c0 for c0, c1 in cuts)


def overlong_pause(words):
    """Seconds past the allowed pause at the worst gap between words. A beat
    after a short sentence ("Be honest." / "Bravely.") may run longer."""
    worst, since = 0.0, 0
    for a, b in zip(words, words[1:]):
        since += 1
        ends = a[2].endswith((".", "!", "?"))
        allowed = PUNCHLINE_PAUSE if ends and since <= PUNCHLINE_WORDS else MAX_PAUSE
        worst = max(worst, (b[0] - a[1]) - allowed)
        if ends:
            since = 0
    return worst


def cer(ref, hyp):
    r, h = letters(ref), letters(hyp)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev, d[j] = d[j], cur
    return d[len(h)] / max(1, len(r))


_whisper = None


def whisper():
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel

        _whisper = WhisperModel("small.en", device="cpu", compute_type="int8")
    return _whisper


def transcribe(path):
    """Words with start/end seconds. The take is heard with a second of
    silence either side: Whisper's word timestamps drift by a second or more
    when speech starts on the first sample, as a trimmed take does."""
    audio, sr = sf.read(path, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if sr != 16000:
        import librosa

        audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
    pad = np.zeros(16000, dtype=np.float32)
    segs, _ = whisper().transcribe(np.concatenate([pad, audio, pad]), beam_size=5, word_timestamps=True)
    dur = len(audio) / 16000
    return [(min(max(w.start - 1, 0.0), dur), min(max(w.end - 1, 0.0), dur), w.word.strip()) for s in segs for w in s.words]


def align_words(text, heard):
    """Time every word of the script from the transcript's words: align the
    two letter by letter (edit distance, so "saving" for "savings" or
    "sought" for "sort" costs a letter, not a word), then give each script
    word the start of the heard word under its first letter and the end of
    the one under its last. Returns [[start, end, word], ...], one per
    whitespace-separated word of `text`."""
    r = []  # script letters -> script word index
    for k, w in enumerate(text.split()):
        r += [k] * len(letters(w))
    h, hw = [], []  # heard letters -> heard word index
    for k, (_, _, w) in enumerate(heard):
        n = len(letters(w))
        h += list(letters(w))
        hw += [k] * n
    rl = letters(text)
    n, m = len(rl), len(h)
    d = np.zeros((n + 1, m + 1), dtype=np.int32)
    d[:, 0] = np.arange(n + 1)
    d[0, :] = np.arange(m + 1)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (rl[i - 1] != h[j - 1]))
    under = [None] * n  # script letter -> heard letter
    i, j = n, m
    while i and j:
        if d[i, j] == d[i - 1, j - 1] + (rl[i - 1] != h[j - 1]):
            under[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif d[i, j] == d[i - 1, j] + 1:
            i -= 1
        else:
            j -= 1
    words = text.split()
    out, last = [], [0.0, 0.0]
    for k, w in enumerate(words):
        idx = [under[x] for x in range(n) if r[x] == k and under[x] is not None]
        if idx:
            last = [heard[hw[idx[0]]][0], heard[hw[idx[-1]]][1]]
        out.append([round(last[0], 3), round(last[1], 3), w])
    return out


def sentence_times(text, script_words):
    out, k = [], 0
    for s in sentences(text):
        n = len(s.split())
        span = script_words[k : k + n]
        out.append({"text": s, "start": span[0][0], "end": span[-1][1]})
        k += n
    return out


# ---------------------------------------------------------------- engines
def load_chatterbox():
    import torch
    from chatterbox.tts import ChatterboxTTS

    torch.set_num_threads(os.cpu_count() or 4)
    m = ChatterboxTTS.from_pretrained(device="cpu")
    m.prepare_conditionals(NARRATOR, exaggeration=EXAGGERATION)
    return m


def chatterbox_line(m, text, key, tmp, only=None):
    """Render takes until one passes review; return the best one. `only`
    renders just that take (1-based), whatever the review says."""
    import time

    import torch

    best = None
    for take in [only - 1] if only else range(MAX_TAKES):
        seed = zlib.crc32(f"{key}:{take}".encode())
        torch.manual_seed(seed)
        t0 = time.time()
        said = text
        for word, respelled in SAY.items():
            said = said.replace(word, respelled)
        wav = m.generate(said, exaggeration=EXAGGERATION, cfg_weight=CFG_WEIGHT)
        spent = time.time() - t0
        audio = level(trim(wav.squeeze(0).numpy().astype(np.float32), m.sr))
        sf.write(tmp, audio, m.sr, subtype="PCM_16")
        words = transcribe(tmp)
        heard = " ".join(w for _, _, w in words)
        err = cer(text, heard)
        slip = word_slips(text, heard)
        # A read that's right but lingers too long between words is kept and
        # its silences shortened, instead of thrown away.
        stall = max((b[0] - a[1] for a, b in zip(words, words[1:])), default=0.0)
        audio, words, cut = tighten(audio, m.sr, words)
        if cut:
            sf.write(tmp, audio, m.sr, subtype="PCM_16")
        over = overlong_pause(words)
        wpm = len(text.split()) * 60 / (len(audio) / m.sr)
        ok = err <= LIMIT and slip < MAX_RUN and over <= 0 and wpm <= MAX_WPM
        # Wrong words always lose to right words read a little slowly or fast.
        words_ok = err <= LIMIT and slip < MAX_RUN
        score = (0 if words_ok else 100 + err) + max(0.0, over) + max(0.0, wpm - MAX_WPM) / 100
        print(
            f"      take {take + 1}: {len(audio) / m.sr:.1f}s in {spent:.0f}s · CER {err:4.1%} · "
            f"slip {slip} · pause {stall:.1f}s{f' (cut {cut:.1f}s)' if cut else ''} · {wpm:.0f} wpm"
            f"{'' if ok else '  ✗'}",
            flush=True,
        )
        if best is None or score < best["score"]:
            best = {"audio": audio, "words": words, "heard": heard, "cer": err, "stall": stall,
                    "seed": seed, "take": take + 1, "score": score, "ok": ok, "slip": slip}
        if only:
            best["ok"] = True  # chosen by hand
        if ok or only:
            break
    return best, m.sr


def load_kokoro():
    os.makedirs(MODELS, exist_ok=True)
    for f in FILES:
        dst = os.path.join(MODELS, f)
        if not os.path.exists(dst):
            print(f"  downloading {f} …", flush=True)
            urllib.request.urlretrieve(MODEL_URL + f, dst + ".part")
            os.replace(dst + ".part", dst)
    from kokoro_onnx import Kokoro

    return Kokoro(os.path.join(MODELS, FILES[0]), os.path.join(MODELS, FILES[1]))


def kokoro_line(k, text):
    lang = "en-gb" if VOICE.startswith("b") else "en-us"
    parts, timings, t = [], [], 0.0
    sr = 24000
    for i, s in enumerate(sentences(text)):
        ph = k.tokenizer.phonemize(s, lang)
        for word, ipa in PRONOUNCE.items():
            if word in s:
                ph = ph.replace(k.tokenizer.phonemize(word, lang).strip(), ipa)
        a, sr = k.create(ph, voice=VOICE, speed=SPEED, lang=lang, is_phonemes=True)
        a = trim(a, sr)
        if i:
            gap = BEAT_GAP if len(s.split()) <= PUNCHLINE_WORDS else GAP
            parts.append(np.zeros(int(gap * sr), dtype=np.float32))
            t += gap
        parts.append(a.astype(np.float32))
        timings.append({"text": s, "start": round(t, 3), "end": round(t + len(a) / sr, 3)})
        t += len(a) / sr
    return level(np.concatenate(parts)), sr, timings


def retime(eps, args):
    """Word clock and sentence timings for takes already on disk — a human
    read dropped in as NN.wav, or a take from before the clock was kept."""
    for ep_id in args.episodes:
        for i, beat in enumerate(eps[ep_id]["beats"]):
            num = f"{i + 1:02d}"
            wav = os.path.join(HERE, "vo", ep_id, f"{num}.wav")
            if not beat.get("vo") or not os.path.exists(wav) or (args.lines and i + 1 not in args.lines):
                continue
            path = os.path.join(HERE, "vo", ep_id, f"{num}.json")
            meta = json.load(open(path)) if os.path.exists(path) else {"engine": "recorded"}
            words = transcribe(wav)
            heard = " ".join(w for _, _, w in words)
            script_words = align_words(beat["vo"], words)
            meta.update({"text": beat["vo"], "duration": round(sf.info(wav).duration, 3), "heard": heard,
                         "sentences": sentence_times(beat["vo"], script_words), "words": script_words})
            with open(path, "w") as f:
                json.dump(meta, f, indent=1, ensure_ascii=False)
            print(f"  {ep_id}/{num}  CER {cer(beat['vo'], heard):4.1%}  {len(words)} words")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episodes", nargs="+")
    ap.add_argument("--lines", nargs="*", type=int)
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--take", type=int, help="(chatterbox) render exactly this take of the given --lines")
    ap.add_argument("--retime", action="store_true", help="re-derive timings for the takes already on disk")
    args = ap.parse_args()
    eps = episodes()
    if args.retime:
        return retime(eps, args)
    model = load_chatterbox() if ENGINE == "chatterbox" else load_kokoro()
    if ENGINE == "chatterbox":
        print(f"chatterbox · narrator {os.path.basename(NARRATOR)} · exaggeration {EXAGGERATION} · cfg {CFG_WEIGHT}")
    else:
        print(f"kokoro · voice {VOICE} · speed {SPEED}")
    flagged = []
    for ep_id in args.episodes:
        ep = eps[ep_id]
        out = os.path.join(HERE, "vo", ep_id)
        os.makedirs(out, exist_ok=True)
        for i, beat in enumerate(ep["beats"]):
            num = f"{i + 1:02d}"
            if not beat.get("vo") or (args.lines and i + 1 not in args.lines):
                continue
            text = beat["vo"]
            wav = os.path.join(out, f"{num}.wav")
            print(f"  {ep_id}/{num}", flush=True)
            if ENGINE == "chatterbox":
                best, sr = chatterbox_line(model, text, f"{ep_id}/{num}", wav, args.take)
                audio = best["audio"]
                script_words = align_words(text, best["words"])
                timings = sentence_times(text, script_words)
                meta = {"engine": "chatterbox", "narrator": os.path.basename(NARRATOR),
                        "exaggeration": EXAGGERATION, "cfg_weight": CFG_WEIGHT, "seed": best["seed"],
                        "take": best["take"], "cer": round(best["cer"], 4), "heard": best["heard"],
                        # Each script word's time in the take, for captions and shot cues.
                        "words": script_words}
                if not best["ok"]:
                    flagged.append(f"{ep_id}/{num} (CER {best['cer']:.0%}, pause {best['stall']:.1f}s): {best['heard']}")
            else:
                audio, sr, timings = kokoro_line(model, text)
                meta = {"engine": "kokoro", "voice": VOICE, "speed": SPEED}
            sf.write(wav, audio, sr, subtype="PCM_16")
            dur = len(audio) / sr
            meta.update({"text": text, "duration": round(dur, 3), "sentences": timings})
            with open(os.path.join(out, f"{num}.json"), "w") as f:
                json.dump(meta, f, indent=1, ensure_ascii=False)
            print(f"      → {dur:5.1f}s  {len(text.split()) * 60 / dur:4.0f} wpm", flush=True)
            if ENGINE == "kokoro" and args.check:
                heard = " ".join(w for _, _, w in transcribe(wav))
                e = cer(text, heard)
                print(f"      CER {e:4.1%}  heard: {heard}")
                if e > LIMIT:
                    flagged.append(f"{ep_id}/{num} (CER {e:.0%}): {heard}")
    if flagged:
        print("\nno take passed review — listen to these:\n  " + "\n  ".join(flagged))
        sys.exit(1)


if __name__ == "__main__":
    main()

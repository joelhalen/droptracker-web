"""Voice-over for the "Events, Explained" episodes, read by a local neural TTS.

    python3 voice.py ep1                 every line of ep1 -> vo/ep1/NN.wav
    python3 voice.py ep1 --lines 4 12    just those lines (numbers = read sheet)
    python3 voice.py ep1 --check         (kokoro) transcribe each take and diff it
                                         against the script

Everything runs locally; no text or audio leaves the machine.

ENGINE=chatterbox (default) — Chatterbox (Resemble AI, MIT) reads each line
whole, in the narrator's voice (voices/narrator.flac, a 12 s Kokoro bm_fable
read, so the voice is ours to use), at exaggeration 0.65 / cfg 0.3: dry, but
it acts a quote or a punchline. Its reads vary take to take, so each line is
rendered until a take passes review: Whisper transcribes it, and it must match
the script (letter error rate <= 5%, no word added or dropped), with no stall
longer than MAX_PAUSE and no faster than MAX_WPM.
Takes are seeded, so a rerun gives the same reads. ~3.5x real time on 4 CPU
cores: about 15 minutes an episode. Deps: requirements-chatterbox.txt.
Chatterbox marks its output with Resemble's inaudible Perth watermark.

ENGINE=kokoro — the first voice: Kokoro-82M (Apache-2.0), one sentence at a
time, joined with measured silence (a longer one before a short punchline).
VOICE=bm_fable and SPEED=0.9 by default. Deps: requirements.txt.

Each take's sentence timings go next to it (vo/<ep>/NN.json) so shots.mjs and
build.mjs cut the picture and time the captions to the real read. The numbers
match scripts/<ep>-vo.md, so a human read can replace any take: drop your own
NN.wav in and delete its NN.json (the build then times its captions by word
count within the take).
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
MAX_WPM = 170  # faster than this reads as rushed
MAX_RUN = 4  # letters in a row added or dropped: a whole word, not a spelling

# Chatterbox reads plain text, so names it gets wrong are respelled for it
# (the script, captions and review keep the real spelling).
SAY = {
    "Turael": "Tur-ay-el",  # otherwise "Toriel"
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


NUMBERS = dict(zip("1 2 3 4 5 6 7 8 9 10".split(), "one two three four five six seven eight nine ten".split()))


def letters(s):
    """Spelling-blind form for comparing a transcript to the script: "Step 4 –
    pre-flight" and "step four, preflight" both become "stepfourpreflight"."""
    s = re.sub(r"\d+", lambda m: NUMBERS.get(m.group(), m.group()), s.lower())
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
    segs, _ = whisper().transcribe(path, beam_size=5, word_timestamps=True)
    return [(w.start, w.end, w.word.strip()) for s in segs for w in s.words]


def sentence_times(text, words):
    """Place each script sentence on the take: walk the transcript's letters
    against the script's, so a sentence starts at the word holding its first
    letter and ends at the word holding its last."""
    spans, pos = [], 0
    for s in sentences(text):
        n = len(letters(s))
        spans.append((s, pos, pos + max(n, 1) - 1))
        pos += n
    total = max(pos, 1)
    heard = sum(len(letters(w)) for _, _, w in words) or 1
    scale = heard / total  # absorbs small misspellings in the transcript
    marks, acc = [], 0
    for start, end, w in words:
        n = len(letters(w))
        marks.append((acc, acc + max(n, 1) - 1, start, end))
        acc += n

    def at(i, edge):
        i = min(int(i * scale), acc - 1)
        for lo, hi, start, end in marks:
            if lo <= i <= hi or lo > i:
                return start if edge == "start" else end
        return marks[-1][3]

    return [{"text": s, "start": round(at(a, "start"), 3), "end": round(at(b, "end"), 3)} for s, a, b in spans]


# ---------------------------------------------------------------- engines
def load_chatterbox():
    import torch
    from chatterbox.tts import ChatterboxTTS

    torch.set_num_threads(os.cpu_count() or 4)
    m = ChatterboxTTS.from_pretrained(device="cpu")
    m.prepare_conditionals(NARRATOR, exaggeration=EXAGGERATION)
    return m


def chatterbox_line(m, text, key, tmp):
    """Render takes until one passes review; return the best one."""
    import time

    import torch

    best = None
    for take in range(MAX_TAKES):
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
        stall = max((b[0] - a[1] for a, b in zip(words, words[1:])), default=0.0)
        wpm = len(text.split()) * 60 / (len(audio) / m.sr)
        ok = err <= LIMIT and slip < MAX_RUN and stall <= MAX_PAUSE and wpm <= MAX_WPM
        score = err + 0.02 * max(0, slip - MAX_RUN + 1) + max(0.0, stall - MAX_PAUSE) + max(0.0, wpm - MAX_WPM) / 100
        print(
            f"      take {take + 1}: {len(audio) / m.sr:.1f}s in {spent:.0f}s · CER {err:4.1%} · "
            f"slip {slip} · pause {stall:.1f}s · {wpm:.0f} wpm{'' if ok else '  ✗'}",
            flush=True,
        )
        if best is None or score < best["score"]:
            best = {"audio": audio, "words": words, "heard": heard, "cer": err, "stall": stall,
                    "seed": seed, "take": take + 1, "score": score, "ok": ok, "slip": slip}
        if ok:
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episodes", nargs="+")
    ap.add_argument("--lines", nargs="*", type=int)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    eps = episodes()
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
                best, sr = chatterbox_line(model, text, f"{ep_id}/{num}", wav)
                audio = best["audio"]
                timings = sentence_times(text, best["words"])
                meta = {"engine": "chatterbox", "narrator": os.path.basename(NARRATOR),
                        "exaggeration": EXAGGERATION, "cfg_weight": CFG_WEIGHT, "seed": best["seed"],
                        "take": best["take"], "cer": round(best["cer"], 4), "heard": best["heard"]}
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

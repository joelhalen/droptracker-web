"""Voice-over for the "Events, Explained" episodes, read by a local neural TTS.

    python3 voice.py ep1                 every line of ep1 -> vo/ep1/NN.wav
    python3 voice.py ep1 --lines 4 12    just those lines (numbers = read sheet)
    python3 voice.py ep1 --check         ...then transcribe each take and diff it
                                         against the script (needs faster-whisper)

Voice: Kokoro-82M (Apache-2.0, runs on CPU, ~4x real time on 4 cores).
The model files download to models/ on first run. Pick another voice with
VOICE=bm_george (any Kokoro voice id), and another pace with SPEED=0.9.

A line is read one sentence at a time and the sentences are joined with
measured silence, because the deadpan lives in the gaps: a short sentence
after a long one ("Bravely." / "A butler who pings.") gets a longer pause in
front of it. Each take's sentence timings are written next to it
(vo/<ep>/NN.json) so build.mjs can cut the picture and time the captions to
the real read instead of a words-per-minute guess.

The numbers match scripts/<ep>-vo.md, so a human read can replace any take:
drop your own NN.wav in and delete its NN.json (the build then times its
captions by word count within the take).
"""
import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, "models")
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
FILES = ["kokoro-v1.0.onnx", "voices-v1.0.bin"]

VOICE = os.environ.get("VOICE", "bm_fable")
SPEED = float(os.environ.get("SPEED", "0.9"))
GAP = 0.25  # silence between sentences
BEAT_GAP = 0.50  # ...before a short punchline sentence
PUNCHLINE_WORDS = 4
TARGET_RMS_DB = -20.0
LIMIT = 0.05  # --check: letter error rate above which a take needs a listen

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


def load_model():
    os.makedirs(MODELS, exist_ok=True)
    for f in FILES:
        dst = os.path.join(MODELS, f)
        if not os.path.exists(dst):
            print(f"  downloading {f} …", flush=True)
            urllib.request.urlretrieve(MODEL_URL + f, dst + ".part")
            os.replace(dst + ".part", dst)
    from kokoro_onnx import Kokoro

    return Kokoro(os.path.join(MODELS, FILES[0]), os.path.join(MODELS, FILES[1]))


def lang_for(voice):
    return "en-gb" if voice.startswith("b") else "en-us"


def speak(k, text):
    """One sentence -> float32 mono, silence trimmed off both ends."""
    lang = lang_for(VOICE)
    ph = k.tokenizer.phonemize(text, lang)
    for word, ipa in PRONOUNCE.items():
        if word in text:
            ph = ph.replace(k.tokenizer.phonemize(word, lang).strip(), ipa)
    audio, sr = k.create(ph, voice=VOICE, speed=SPEED, lang=lang, is_phonemes=True)
    return trim(audio, sr), sr


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


def read_line(k, text):
    parts, timings, t = [], [], 0.0
    sr = 24000
    for i, s in enumerate(sentences(text)):
        a, sr = speak(k, s)
        if i:
            gap = BEAT_GAP if len(s.split()) <= PUNCHLINE_WORDS else GAP
            parts.append(np.zeros(int(gap * sr), dtype=np.float32))
            t += gap
        parts.append(a.astype(np.float32))
        timings.append({"text": s, "start": round(t, 3), "end": round(t + len(a) / sr, 3)})
        t += len(a) / sr
    audio = np.concatenate(parts)
    rms = np.sqrt(np.mean(audio**2))
    audio = audio * (10 ** (TARGET_RMS_DB / 20) / max(rms, 1e-6))
    peak = np.max(np.abs(audio))
    if peak > 0.97:
        audio *= 0.97 / peak
    return audio, sr, timings


NUMBERS = dict(zip("1 2 3 4 5 6 7 8 9 10".split(), "one two three four five six seven eight nine ten".split()))


def letters(s):
    """Spelling-blind form for comparing a transcript to the script: "Step 4 –
    pre-flight" and "step four, preflight" both become "stepfourpreflight"."""
    s = re.sub(r"\d+", lambda m: NUMBERS.get(m.group(), m.group()), s.lower())
    return re.sub(r"[^a-z]", "", s)


def cer(ref, hyp):
    r, h = letters(ref), letters(hyp)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev, d[j] = d[j], cur
    return d[len(h)] / max(1, len(r))


def check(files):
    from faster_whisper import WhisperModel

    m = WhisperModel("small.en", device="cpu", compute_type="int8")
    worst = 0.0
    for num, path, text in files:
        segs, _ = m.transcribe(path, beam_size=5)
        heard = " ".join(s.text.strip() for s in segs)
        e = cer(text, heard)
        worst = max(worst, e)
        flag = "  <-- listen" if e > LIMIT else ""
        print(f"  {num}  CER {e:5.1%}{flag}\n      heard: {heard}")
    return worst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episodes", nargs="+")
    ap.add_argument("--lines", nargs="*", type=int)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    eps = episodes()
    k = load_model()
    print(f"voice {VOICE} · speed {SPEED}")
    for ep_id in args.episodes:
        ep = eps[ep_id]
        out = os.path.join(HERE, "vo", ep_id)
        os.makedirs(out, exist_ok=True)
        done = []
        for i, beat in enumerate(ep["beats"]):
            num = f"{i + 1:02d}"
            if not beat.get("vo") or (args.lines and i + 1 not in args.lines):
                continue
            audio, sr, timings = read_line(k, beat["vo"])
            wav = os.path.join(out, f"{num}.wav")
            sf.write(wav, audio, sr, subtype="PCM_16")
            dur = len(audio) / sr
            words = len(beat["vo"].split())
            meta = {"voice": VOICE, "speed": SPEED, "text": beat["vo"], "duration": round(dur, 3), "sentences": timings}
            with open(os.path.join(out, f"{num}.json"), "w") as f:
                json.dump(meta, f, indent=1)
            print(f"  {ep_id}/{num}  {dur:5.1f}s  {words * 60 / dur:4.0f} wpm")
            done.append((num, wav, beat["vo"]))
        if args.check and done:
            worst = check(done)
            if worst > LIMIT:
                sys.exit(f"{ep_id}: a take drifted from the script (worst CER {worst:.0%}); listen to the flagged lines")


if __name__ == "__main__":
    main()

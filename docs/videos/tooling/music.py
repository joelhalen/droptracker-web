"""A small synthesized "tavern" bed and title-card sting, so the episodes ship
with music we own outright.

    python3 music.py            -> music/bed.wav (seamless 96s loop), music/sting.wav

Plucked-lute arpeggios (Karplus-Strong) over a soft pad and a round bass, in
D dorian at 80 bpm, through a short synthetic room. It sits under the voice at
about -24 LUFS and is ducked further while the narrator talks (build.mjs), so
it is texture, not a tune anyone hums.

To use a real track instead, drop it in as music/bed.wav (or .mp3 / .m4a) and
music/sting.wav; build.mjs loops the bed to the episode length either way.
Deterministic: the same seed always writes the same files.
"""
import os

import numpy as np
import soundfile as sf

SR = 44100
BPM = 80
BEAT = 60 / BPM
BAR = 4 * BEAT
RNG = np.random.default_rng(7)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "music")


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def pluck(freq, dur, bright=0.5, decay=0.996):
    """Karplus-Strong string: a burst of filtered noise in a tuned delay loop."""
    n = int(dur * SR)
    period = int(SR / freq)
    buf = RNG.uniform(-1, 1, period)
    # Soften the excitation: less bright = rounder, more lute than harpsichord.
    for _ in range(int((1 - bright) * 4) + 1):
        buf = 0.5 * (buf + np.roll(buf, 1))
    # The loop filter passes DC almost undamped, so any offset in the burst
    # would ring on as a sub-bass thump under every note.
    buf -= buf.mean()
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = decay * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    env = np.minimum(1, np.arange(n) / (0.004 * SR))
    return out * env


def pad(freqs, dur):
    t = np.arange(int(dur * SR)) / SR
    voices = [(f * detune, phase) for f in freqs for detune, phase in ((1.0, 0.0), (1.002, 0.9))]
    tone = sum(
        np.sin(2 * np.pi * v * t + ph) + 0.25 * np.sin(4 * np.pi * v * t) + 0.08 * np.sin(6 * np.pi * v * t)
        for v, ph in voices
    )
    a = int(0.9 * SR)
    env = np.ones_like(t)
    env[:a] = np.linspace(0, 1, a) ** 2
    env[-a:] = np.linspace(1, 0, a) ** 2
    return tone * env / len(voices)


def bass(freq, dur):
    t = np.arange(int(dur * SR)) / SR
    return (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t)) * np.exp(-t * 2.2)


def room(x, seconds=1.1, wet=0.22):
    """Convolve with decaying noise: a cheap, smooth small-hall tail."""
    n = int(seconds * SR)
    ir = RNG.standard_normal(n) * np.exp(-np.arange(n) / (0.25 * SR))
    ir = np.convolve(ir, np.ones(8) / 8, mode="same")  # darker tail
    ir /= np.sqrt(np.sum(ir**2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    tail = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x) + n]
    return tail, wet


def band(x, cutoff, low=80.0):
    """Second-order roll-offs in the frequency domain: no rumble under the
    voice, and the digital edge taken off the top."""
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    spec *= 1 / np.sqrt(1 + (f / cutoff) ** 4)
    spec *= 1 / np.sqrt(1 + (low / np.maximum(f, 1e-3)) ** 4)
    return np.fft.irfft(spec, len(x))


# D dorian: i – IV – i – VII, then i – VI – IV – V(sus) for a turnaround.
CHORDS = [
    (50, [62, 65, 69, 72]),  # Dm7
    (55, [62, 67, 71, 74]),  # G
    (50, [62, 65, 69, 74]),  # Dm
    (48, [60, 64, 67, 72]),  # C
    (50, [62, 65, 69, 72]),  # Dm7
    (46, [58, 62, 65, 70]),  # Bb
    (55, [59, 62, 67, 71]),  # G
    (45, [57, 62, 64, 69]),  # Asus
]
PATTERN = [0, 2, 1, 3, 2, 1, 3, 2]  # eighth-note arpeggio order through the chord


def bed(bars=32):
    total = int(bars * BAR * SR)
    tail = int(1.5 * SR)
    mix = np.zeros(total + tail)
    for b in range(bars):
        root, notes = CHORDS[b % len(CHORDS)]
        t0 = b * BAR
        s = int(t0 * SR)
        p = pad([hz(n - 12) for n in notes[:3]], BAR + 0.9)
        mix[s : s + len(p)] += 0.10 * p
        for beat in (0, 2):
            bs = int((t0 + beat * BEAT) * SR)
            bb = bass(hz(root), 1.6)
            mix[bs : bs + len(bb)] += 0.12 * bb
        # Rest on the last eighth of every other bar, so it breathes.
        for k, idx in enumerate(PATTERN):
            if b % 2 and k == 7:
                continue
            swing = 0.03 * BEAT if k % 2 else 0.0
            ts = t0 + k * BEAT / 2 + swing + RNG.normal(0, 0.004)
            vel = 0.55 + 0.15 * (k % 4 == 0) + RNG.normal(0, 0.05)
            note = notes[idx] + (12 if b % 8 == 7 and k == 6 else 0)
            pl = pluck(hz(note), 1.4, bright=0.35)
            ps = int(ts * SR)
            mix[ps : ps + len(pl)] += vel * 0.30 * pl
    wet_sig, wet = room(mix)
    mix = (1 - wet) * mix + wet * wet_sig[: len(mix)]
    # Seamless loop: fold the tail that rings past the end back onto the start.
    loop = mix[:total].copy()
    loop[:tail] += mix[total : total + tail]
    loop = band(loop, 5200)
    return normalize(loop, -18.0)


def sting():
    """A slow strum up a D minor add9 chord with a low D under it."""
    dur = 3.2
    out = np.zeros(int(dur * SR))
    for i, n in enumerate([50, 57, 62, 65, 69, 74, 76]):
        pl = pluck(hz(n), dur - i * 0.045, bright=0.55, decay=0.9975)
        s = int(i * 0.045 * SR)
        out[s : s + len(pl)] += (0.7 - i * 0.04) * pl
    b = bass(hz(50), dur) * np.exp(-np.arange(int(dur * SR)) / SR * 0.6)
    out += 0.5 * b
    wet_sig, wet = room(out, 1.6, 0.3)
    out = (1 - wet) * out + wet * wet_sig[: len(out)]
    fade = int(0.4 * SR)
    out[-fade:] *= np.linspace(1, 0, fade)
    return normalize(band(out, 6500), -16.0)


def normalize(x, rms_db):
    x = x - np.mean(x)
    x *= 10 ** (rms_db / 20) / np.sqrt(np.mean(x**2))
    peak = np.max(np.abs(x))
    return x * (0.9 / peak) if peak > 0.9 else x


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    b = bed()
    sf.write(os.path.join(OUT, "bed.wav"), np.stack([b, b], 1).astype(np.float32), SR, subtype="PCM_16")
    s = sting()
    sf.write(os.path.join(OUT, "sting.wav"), np.stack([s, s], 1).astype(np.float32), SR, subtype="PCM_16")
    print(f"music/bed.wav {len(b) / SR:.1f}s loop · music/sting.wav {len(s) / SR:.1f}s")

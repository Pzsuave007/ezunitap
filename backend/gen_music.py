"""One-off: synthesize 3 original royalty-free background tracks (~16s each)
for the Reel video generator. 100% generated here => no copyright claims.
Outputs WAV to backend/assets/music/, then encode to mp3 via ffmpeg.
"""
import os
import subprocess
import wave
import numpy as np

OUT = os.path.join(os.path.dirname(__file__), "assets", "music")
os.makedirs(OUT, exist_ok=True)

SR = 44100
DUR = 16.0
N = int(SR * DUR)
t = np.linspace(0, DUR, N, endpoint=False)


def note(freq, length, start, kind="pad", amp=0.3):
    """Return a buffer of N with a note placed at `start` seconds."""
    buf = np.zeros(N)
    s = int(start * SR)
    ln = int(length * SR)
    e = min(N, s + ln)
    if s >= N:
        return buf
    tt = np.linspace(0, (e - s) / SR, e - s, endpoint=False)
    if kind == "pad":
        wave_ = (np.sin(2 * np.pi * freq * tt)
                 + 0.5 * np.sin(2 * np.pi * freq * 2 * tt)
                 + 0.25 * np.sin(2 * np.pi * freq * 3 * tt))
        env = np.minimum(1, tt * 6) * np.exp(-tt * 0.8)
    elif kind == "pluck":
        wave_ = np.sin(2 * np.pi * freq * tt) + 0.3 * np.sin(2 * np.pi * freq * 2 * tt)
        env = np.exp(-tt * 7)
    else:  # bell
        wave_ = np.sin(2 * np.pi * freq * tt)
        env = np.exp(-tt * 3)
    buf[s:e] = wave_ * env * amp
    return buf


def kick(start, amp=0.7):
    buf = np.zeros(N)
    s = int(start * SR)
    ln = int(0.18 * SR)
    e = min(N, s + ln)
    if s >= N:
        return buf
    tt = np.linspace(0, (e - s) / SR, e - s, endpoint=False)
    f = 120 * np.exp(-tt * 25) + 45
    wave_ = np.sin(2 * np.pi * f * tt)
    env = np.exp(-tt * 9)
    buf[s:e] = wave_ * env * amp
    return buf


def hat(start, amp=0.18):
    buf = np.zeros(N)
    s = int(start * SR)
    ln = int(0.05 * SR)
    e = min(N, s + ln)
    if s >= N:
        return buf
    tt = np.linspace(0, (e - s) / SR, e - s, endpoint=False)
    noise = np.random.uniform(-1, 1, e - s)
    env = np.exp(-tt * 60)
    buf[s:e] = noise * env * amp
    return buf


NOTES = {  # frequencies
    "C3": 130.81, "D3": 146.83, "E3": 164.81, "F3": 174.61, "G3": 196.0, "A3": 220.0, "B3": 246.94,
    "C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23, "G4": 392.0, "A4": 440.0, "B4": 493.88,
    "C5": 523.25, "D5": 587.33, "E5": 659.25, "G5": 783.99, "A5": 880.0,
}


def build_track(style):
    mix = np.zeros(N)
    bpm = {"energetica": 120, "corporativa": 90, "lofi": 78, "epica": 80, "alegre": 124, "urbana": 96}[style]
    beat = 60.0 / bpm
    bar = beat * 4
    # chord progressions (root triads), 4 chords looping
    progs = {
        "energetica": [["C4", "E4", "G4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"], ["G3", "B3", "D4"]],
        "corporativa": [["C4", "E4", "G4"], ["G3", "B3", "D4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"]],
        "lofi": [["A3", "C4", "E4"], ["F3", "A3", "C4"], ["C4", "E4", "G4"], ["G3", "B3", "D4"]],
        "epica": [["C3", "G3", "C4"], ["A3", "E4", "A4"], ["F3", "C4", "F4"], ["G3", "D4", "G4"]],
        "alegre": [["D4", "F4", "A4"], ["G3", "B3", "D4"], ["A3", "D4", "F4"], ["C4", "E4", "G4"]],
        "urbana": [["E3", "G3", "B3"], ["C4", "E4", "G4"], ["A3", "C4", "E4"], ["D4", "F4", "A4"]],
    }[style]
    arp_top = {
        "energetica": ["C5", "E5", "G5", "E5"],
        "corporativa": ["C5", "G4", "E5", "G4"],
        "lofi": ["A4", "E5", "C5", "E5"],
        "epica": ["C5", "G4", "A4", "E5"],
        "alegre": ["A4", "D5", "F4", "A5"],
        "urbana": ["E4", "B4", "G4", "E5"],
    }[style]

    nbars = int(DUR / bar) + 1
    for b in range(nbars):
        start = b * bar
        chord = progs[b % len(progs)]
        for n in chord:
            mix += note(NOTES[n], bar * 1.05, start, "pad", amp=0.18)
        # arpeggio
        for i in range(8):
            ar = arp_top[i % len(arp_top)]
            mix += note(NOTES[ar], beat * 0.5, start + i * (beat / 2), "pluck", amp=0.16)
    # rhythm
    nbeats = int(DUR / beat) + 1
    for i in range(nbeats):
        bt = i * beat
        if style == "corporativa":
            if i % 2 == 0:
                mix += hat(bt, 0.10)
        elif style == "epica":
            mix += kick(bt, 0.6)
            if i % 4 == 3:
                mix += kick(bt + beat / 2, 0.3)
        else:
            mix += kick(bt, 0.55 if style in ("energetica", "alegre", "urbana") else 0.42)
            mix += hat(bt + beat / 2, 0.16)
            if style in ("energetica", "alegre"):
                mix += hat(bt + beat / 4, 0.08)
                mix += hat(bt + 3 * beat / 4, 0.08)
            if style == "urbana":
                mix += hat(bt + beat / 3, 0.07)
                mix += hat(bt + 2 * beat / 3, 0.07)

    # gentle fade in/out at edges
    fade = int(0.4 * SR)
    mix[:fade] *= np.linspace(0, 1, fade)
    mix[-int(SR):] *= np.linspace(1, 0, int(SR))
    # normalize
    peak = np.max(np.abs(mix)) or 1.0
    mix = (mix / peak) * 0.85
    return mix


def write_wav(path, mono):
    stereo = np.column_stack([mono, mono])
    data = (stereo * 32767).astype(np.int16)
    with wave.open(path, "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


for style in ["energetica", "corporativa", "lofi", "epica", "alegre", "urbana"]:
    np.random.seed(42)
    mono = build_track(style)
    wav = os.path.join(OUT, f"{style}.wav")
    mp3 = os.path.join(OUT, f"{style}.mp3")
    write_wav(wav, mono)
    subprocess.run(["ffmpeg", "-y", "-i", wav, "-b:a", "128k", mp3],
                   check=True, capture_output=True)
    os.remove(wav)
    print(f"wrote {mp3} ({os.path.getsize(mp3)} bytes)")

print("done")

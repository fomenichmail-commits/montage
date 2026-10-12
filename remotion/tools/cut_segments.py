"""Cut dialogue segments from a source video and build Remotion sample props.

Usage: python3 tools/cut_segments.py SOURCE.mp4 WORDS.json
WORDS.json is [[start, end, word], ...] (faster-whisper word timestamps).
Edit SEGS below to choose the kept phrases (source seconds).
Writes public/seg/s*.mp4 and segments.json (pass via --props together with style fields).
"""
import json
import subprocess
import sys

src, words_path = sys.argv[1], sys.argv[2]
w = json.load(open(words_path))
# Dialogue-first jump cuts around the David Beckham hit (first sample video).
SEGS = [(343.45, 347.15), (359.45, 364.35), (366.55, 368.75), (371.15, 373.75),
        (374.95, 382.05), (382.0, 384.55), (390.05, 394.6), (397.45, 403.25)]
# Fix speech-recognition spellings in captions.
FIX = {"уйфлак": "УФ-лак", "Уйфлак": "УФ-лак", "Мончестер": "Манчестер"}

segs = []
for i, (a, b) in enumerate(SEGS):
    out = f"public/seg/s{i}.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-ss", f"{a - 0.5:.3f}", "-i", src, "-ss", "0.5", "-t", f"{b - a:.3f}",
        "-vf", "scale=1920:1080,fps=30,format=yuv420p",
        "-af", f"highpass=f=80,afftdn=nf=-28,acompressor=threshold=-20dB:ratio=2.5:attack=10:release=150,"
               f"afade=t=in:d=0.03,afade=t=out:st={b - a - 0.05:.3f}:d=0.05,aresample=48000",
        "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-c:a", "aac", "-b:a", "192k", out,
    ], check=True)
    seg_words = []
    for s, e, t in w:
        if a - 0.05 <= s < b - 0.1:
            t = t.strip()
            if t.startswith("-") and seg_words:
                seg_words[-1]["text"] += t
                continue
            for k, v in FIX.items():
                t = t.replace(k, v)
            seg_words.append({"t": round(max(s - a, 0), 3), "text": t})
    segs.append({"file": f"seg/s{i}.mp4", "dur": round(b - a, 3), "words": seg_words})

json.dump({"segments": segs}, open("segments.json", "w"), ensure_ascii=False, indent=1)

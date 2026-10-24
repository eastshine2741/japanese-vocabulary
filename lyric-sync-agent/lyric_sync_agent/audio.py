import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import yt_dlp

VOICED_HOP = 0.02
# Vocal stems keep reverb and backing-vocal bleed, so a pause between phrases sits ~20 dB under the lead.
QUIET_DB = 20


def download(video_id: str, workdir: Path) -> Path:
    opts = {
        "format": "bestaudio",
        "outtmpl": str(workdir / "mv.%(ext)s"),
        "quiet": True,
        "noprogress": True,
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "wav"}],
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
    return workdir / "mv.wav"


def separate_vocals(wav: Path, workdir: Path, device: str) -> Path:
    """Whisper misses most lines on the full mix; it needs the vocal stem."""
    done = subprocess.run(
        [sys.executable, "-m", "demucs", "--two-stems", "vocals", "-n", "htdemucs", "-d", device,
         "-o", str(workdir / "sep"), str(wav)],
        capture_output=True,
        text=True,
    )
    if done.returncode != 0:
        raise RuntimeError(f"demucs exited {done.returncode}: {done.stderr[-500:]}")
    return workdir / "sep" / "htdemucs" / wav.stem / "vocals.wav"


def voiced_mask(path: Path) -> list[bool]:
    x, sr = sf.read(str(path), dtype="float32", always_2d=True)
    x = x.mean(axis=1)
    n = int(sr * VOICED_HOP)
    frames = x[: len(x) // n * n].reshape(-1, n)
    db = 20 * np.log10(np.sqrt((frames ** 2).mean(axis=1)) + 1e-9)
    return (db > np.percentile(db, 95) - QUIET_DB).tolist()

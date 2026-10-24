"""One claimed sync: MV audio -> vocal stem -> Whisper -> line anchors -> line start times."""
import tempfile
from dataclasses import dataclass
from pathlib import Path

from . import audio, timing
from .align import Anchor, kana, line_anchors
from .transcribe import SAMPLE_RATE, Transcriber

# Below this a stretch is too short for Whisper to place anything in.
MIN_WINDOW_SECONDS = 1.0
# Whisper's prompt is capped near 224 tokens; keep the lines closest to the stretch.
PROMPT_CHARS = 200
# Below these the verdict is LOW and the server keeps the result off the app.
OK_MIN_ANCHORS, OK_WITHIN_HALF_SECOND = 8, 0.7
OK_PLAIN_ANCHOR_RATIO = 0.7


class SyncError(Exception):
    """The song itself cannot be synced (its lines are not found in the MV). Retrying gives the same answer."""


@dataclass
class SyncResult:
    method: str
    lines: list[dict]
    confidence: dict


def run(job: dict, model_name: str, device: str) -> SyncResult:
    with tempfile.TemporaryDirectory(prefix="lyric-sync-") as tmp:
        workdir = Path(tmp)
        wav = audio.download(job["youtubeVideoId"], workdir)
        vocals = audio.separate_vocals(wav, workdir, device)
        # Loaded per job, not kept: the GPU is shared with the desktop and the agent mostly idles.
        transcriber = Transcriber(model_name, device)
        texts = [line["text"] for line in job["lines"]]
        anchors = line_anchors(texts, transcriber.full(vocals))
        fill_gaps(anchors, texts, transcriber, vocals)
        timing.drop_out_of_order(anchors)
        timing.snap_to_onsets(anchors, audio.voiced_mask(vocals), audio.VOICED_HOP)
    if job["lyricType"] == "SYNCED":
        return offset_result(job, anchors)
    return aligned_result(job, anchors)


def fill_gaps(anchors: list[Anchor | None], texts: list[str], transcriber: Transcriber, vocals: Path) -> None:
    """Re-listens to each stretch between two found lines, prompted with the lines missing there.

    The full pass skips whole verses and hallucinates over them; prompted, Whisper hears most of them.
    """
    clip = transcriber.load(vocals)
    total = len(clip) / SAMPLE_RATE
    n, i = len(anchors), 0
    while i < n:
        if anchors[i] is not None:
            i += 1
            continue
        j = i
        while j < n and anchors[j] is None:
            j += 1
        before = i - 1 if i > 0 else None
        start = anchors[before].start if before is not None else 0.0
        end = anchors[j].start if j < n else total
        if end - start >= MIN_WINDOW_SECONDS:
            # The found line before the stretch goes in too so the alignment has a known start.
            span = list(range(before if before is not None else i, j))
            prompt = " ".join(texts[k] for k in span)[-PROMPT_CHARS:]
            found = line_anchors([texts[k] for k in span], transcriber.window(clip, start, end, prompt))
            last = start
            for k, a in zip(span, found):
                if k < i or a is None or not (last <= a.start < end):
                    continue
                a.filled = True
                anchors[k] = a
                last = a.start
        i = j


def offset_result(job: dict, anchors: list[Anchor | None]) -> SyncResult:
    """SYNCED lyrics keep their hand-made lrclib times, shifted per stretch to where the MV sings them."""
    lines = job["lines"]
    pts = [(line["startTimeMs"] / 1000, a.start) for line, a in zip(lines, anchors)
           if a is not None and line["startTimeMs"] is not None]
    if len(pts) < timing.MIN_SYNCED_ANCHORS:
        raise SyncError(f"only {len(pts)} lines found in the MV audio")
    segments = timing.fit_offsets(pts)
    residuals = [abs(y - x - timing.offset_at(segments, x)) for x, y in pts]
    within = sum(r <= 0.5 for r in residuals) / len(residuals)
    # Where the MV cuts a verse the offset drops, and lines just before the cut would land after the next one.
    shifted = timing.non_decreasing(
        [None if line["startTimeMs"] is None else line["startTimeMs"] / 1000 + timing.offset_at(segments, line["startTimeMs"] / 1000)
         for line in lines])
    out = [{"index": line["index"], "startTimeMs": None if t is None else max(0, int(round(t * 1000)))}
           for line, t in zip(lines, shifted)]
    confidence = {
        **counts(anchors),
        "within500ms": round(float(within), 3),
        "segments": [{"fromLrcSec": round(float(s.from_lrc), 2), "offsetSec": round(float(s.offset), 2)} for s in segments],
        "verdict": "OK" if len(pts) >= OK_MIN_ANCHORS and within >= OK_WITHIN_HALF_SECOND else "LOW",
    }
    return SyncResult("OFFSET", out, confidence)


def aligned_result(job: dict, anchors: list[Anchor | None]) -> SyncResult:
    lines = job["lines"]
    if all(a is None for a in anchors):
        raise SyncError("no line found in the MV audio")
    times = timing.non_decreasing(timing.interpolate(anchors, [len(kana(line["text"])) for line in lines]))
    out = [{"index": line["index"], "startTimeMs": None if t is None else max(0, int(round(t * 1000)))}
           for line, t in zip(lines, times)]
    c = counts(anchors)
    c["verdict"] = "OK" if c["anchored"] / c["lines"] >= OK_PLAIN_ANCHOR_RATIO else "LOW"
    return SyncResult("ALIGNED", out, c)


def counts(anchors: list[Anchor | None]) -> dict:
    found = [a for a in anchors if a is not None]
    return {
        "lines": len(anchors),
        "anchored": len(found),
        "filled": int(sum(a.filled for a in found)),
        "snapped": int(sum(a.snapped > 0 for a in found)),
    }

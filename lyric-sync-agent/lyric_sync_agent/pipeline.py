"""One claimed sync: MV audio -> vocal stem -> Whisper -> line anchors -> line start times."""
import re
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
# SYNCED is judged mostly by how many lines were found: lrclib's own per-line error keeps within500ms near 0.6-0.7
# even on a clean fit, so a strict cut there hid MV shifts that were right (マリーゴールド +2.95s).
OK_MIN_ANCHORS, OK_SYNCED_ANCHOR_RATIO, OK_WITHIN_HALF_SECOND = 8, 0.6, 0.5
OK_PLAIN_ANCHOR_RATIO = 0.7
# Below this share of lines heard on the stem, the full mix is heard too: Demucs can strip a synthetic voice
# almost entirely (ループザルーム: 64% of lines heard on the mix, 17% on the stem).
MIX_RETRY_RATIO = 0.7
# A SYNCED song whose lines were nearly all found but disagree with every offset fit has lrclib times for another
# cut or sloppy times (グランドエスケープ Movie edit vs full MV: 15/16 found, 33% within 0.5s); the found times win.
DIRECT_ANCHOR_RATIO = 0.8
# Lines without kana or kanji (English lines of K-pop Japanese versions) cannot match a Japanese transcript.
JAPANESE_RE = re.compile(r"[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f々]")


class SyncError(Exception):
    """The song itself cannot be synced (its lines are not in the MV, or the MV cannot be fetched). Retrying gives the same answer."""


@dataclass
class SyncResult:
    method: str
    lines: list[dict]
    confidence: dict


def run(job: dict, model_name: str, device: str) -> SyncResult:
    with tempfile.TemporaryDirectory(prefix="lyric-sync-") as tmp:
        workdir = Path(tmp)
        try:
            wav = audio.download(job["youtubeVideoId"], workdir)
        except audio.VideoUnavailable as e:
            raise SyncError(f"MV not downloadable: {e}") from e
        vocals = audio.separate_vocals(wav, workdir, device)
        # Loaded per job, not kept: the GPU is shared with the desktop and the agent mostly idles.
        transcriber = Transcriber(model_name, device)
        texts = [line["text"] for line in job["lines"]]
        heard = vocals
        anchors = line_anchors(texts, transcriber.full(vocals))
        if heard_ratio(texts, anchors) < MIX_RETRY_RATIO:
            on_mix = line_anchors(texts, transcriber.full(wav, vad=False))
            if heard_ratio(texts, on_mix) > heard_ratio(texts, anchors):
                heard, anchors = wav, on_mix
        fill_gaps(anchors, texts, transcriber, heard)
        timing.drop_out_of_order(anchors)
        timing.snap_to_onsets(anchors, audio.voiced_mask(heard), audio.VOICED_HOP)
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
    texts = [line["text"] for line in lines]
    if within < OK_WITHIN_HALF_SECOND and heard_ratio(texts, anchors) >= DIRECT_ANCHOR_RATIO:
        result = aligned_result(job, anchors)
        result.confidence["offsetWithin500ms"] = round(float(within), 3)
        return result
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
        "verdict": "OK" if synced_ok(*heard_counts(texts, anchors), within) else "LOW",
    }
    return SyncResult("OFFSET", out, confidence)


def synced_ok(anchored: int, lines: int, within: float) -> bool:
    return lines > 0 and anchored >= OK_MIN_ANCHORS and anchored / lines >= OK_SYNCED_ANCHOR_RATIO and within >= OK_WITHIN_HALF_SECOND


def aligned_result(job: dict, anchors: list[Anchor | None]) -> SyncResult:
    lines = job["lines"]
    if all(a is None for a in anchors):
        raise SyncError("no line found in the MV audio")
    times = timing.non_decreasing(timing.interpolate(anchors, [len(kana(line["text"])) for line in lines]))
    out = [{"index": line["index"], "startTimeMs": None if t is None else max(0, int(round(t * 1000)))}
           for line, t in zip(lines, times)]
    c = counts(anchors)
    c["verdict"] = "OK" if heard_ratio([line["text"] for line in lines], anchors) >= OK_PLAIN_ANCHOR_RATIO else "LOW"
    return SyncResult("ALIGNED", out, c)


def heard_counts(texts: list[str], anchors: list[Anchor | None]) -> tuple[int, int]:
    """(found, total) over the lines a Japanese transcript can match; the other lines are still timed by interpolation."""
    sung = [a for t, a in zip(texts, anchors) if JAPANESE_RE.search(t)]
    return sum(a is not None for a in sung), len(sung)


def heard_ratio(texts: list[str], anchors: list[Anchor | None]) -> float:
    found, total = heard_counts(texts, anchors)
    return found / total if total else 0.0


def counts(anchors: list[Anchor | None]) -> dict:
    found = [a for a in anchors if a is not None]
    return {
        "lines": len(anchors),
        "anchored": len(found),
        "filled": int(sum(a.filled for a in found)),
        "snapped": int(sum(a.snapped > 0 for a in found)),
    }

"""Turns line anchors into final line start times. Pure functions so they can be tested without audio."""
import statistics
from dataclasses import dataclass

from .align import Anchor

# A jump this long inside a line's first chars means Whisper put the first word on the previous phrase.
HEAD_JUMP_SECONDS = 1.0
# Quiet this long before an onset counts as the pause between phrases.
MIN_SILENCE_SECONDS = 0.3
# No sung line is shorter than this; a line starting closer to the one before was matched onto the same sound.
MIN_LINE_SECONDS = 0.3

# Offset fitting: a new segment costs PENALTY, each anchor costs its residual capped at CAP seconds.
PENALTY, MIN_SEGMENT, CAP = 4.0, 3, 2.0
MIN_SYNCED_ANCHORS = 3


def snap_to_onsets(anchors: list[Anchor | None], voiced: list[bool], hop: float) -> None:
    """Moves a line start to the vocal onset after a silence its first chars jump across.
    A sustained note keeps the stem voiced through the jump, so it stays; never moves past the next line."""
    starts = [a.start if a else None for a in anchors]
    for i, a in enumerate(anchors):
        if a is None:
            continue
        next_start = next((t for t in starts[i + 1:] if t is not None), float("inf"))
        for p in range(1, len(a.heads)):
            if a.heads[p] - a.heads[p - 1] > HEAD_JUMP_SECONDS:
                onset = onset_after_silence(voiced, hop, a.heads[p - 1], a.heads[p])
                if onset is not None and a.start < onset < next_start:
                    a.snapped = round(onset - a.start, 2)
                    a.start = onset
                break


def onset_after_silence(voiced: list[bool], hop: float, t0: float, t1: float) -> float | None:
    """Last vocal onset in (t0, t1] that follows at least MIN_SILENCE_SECONDS of quiet."""
    first, last = int(t0 / hop), min(int(t1 / hop) + 5, len(voiced) - 1)
    quiet, best = 0, None
    for k in range(first, last + 1):
        if not voiced[k]:
            quiet += 1
            continue
        if quiet * hop >= MIN_SILENCE_SECONDS and k > first:
            best = float(k * hop)
        quiet = 0
    return best


def drop_out_of_order(anchors: list[Anchor | None]) -> None:
    """Lines are sung in order. An anchor not clearly after the one before it is a mismatch; drop it
    so it is interpolated. Kept, it would share the start and the app would skip the line before."""
    last = float("-inf")
    for i, a in enumerate(anchors):
        if a is None:
            continue
        if a.start < last + MIN_LINE_SECONDS:
            anchors[i] = None
        else:
            last = a.start


@dataclass
class OffsetSegment:
    from_lrc: float
    offset: float


def fit_offsets(pts: list[tuple[float, float]]) -> list[OffsetSegment]:
    """Piecewise constant offsets from (lrclib time, MV time) anchors, ordered by lrclib time.
    No tempo slope: ASR bias on rapid repeated lines reads as fake drift that grows toward the song's end."""
    n = len(pts)

    def cost(i: int, j: int) -> tuple[float, float]:
        off = statistics.median(y - x for x, y in pts[i:j])
        return sum(min(abs(y - x - off), CAP) for x, y in pts[i:j]), off

    best = [0.0] + [float("inf")] * n
    prev = [0] * (n + 1)
    for j in range(MIN_SEGMENT, n + 1):
        for i in range(0, j - MIN_SEGMENT + 1):
            if best[i] == float("inf"):
                continue
            c = best[i] + cost(i, j)[0] + PENALTY
            if c < best[j]:
                best[j], prev[j] = c, i
    cuts, j = [], n
    while j > 0:
        cuts.append((prev[j], j))
        j = prev[j]
    return [OffsetSegment(from_lrc=pts[i][0], offset=cost(i, j)[1]) for i, j in reversed(cuts)]


def offset_at(segments: list[OffsetSegment], lrc: float) -> float:
    k = sum(lrc >= s.from_lrc for s in segments[1:])
    return segments[k].offset


def interpolate(anchors: list[Anchor | None], weights: list[int]) -> list[float | None]:
    """Fills lines between two anchors by their share of characters. Lines outside the anchors stay None."""
    times = [a.start if a else None for a in anchors]
    found = [i for i, t in enumerate(times) if t is not None]
    for a, b in zip(found, found[1:]):
        span = sum(max(1, w) for w in weights[a:b])
        acc = 0
        for i in range(a + 1, b):
            acc += max(1, weights[i - 1])
            times[i] = times[a] + (times[b] - times[a]) * acc / span
    return times


def non_decreasing(times: list[float | None]) -> list[float | None]:
    """The app finds the current line as the last one already started, so a later line must not start earlier."""
    out, last = [], float("-inf")
    for t in times:
        if t is None:
            out.append(None)
            continue
        last = max(last, t)
        out.append(last)
    return out

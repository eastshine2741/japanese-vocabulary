"""Places known lyric lines on Whisper word timings: Whisper mishears sung words but times them well.
One kana DP over the whole song, not line-to-segment matching, which drifts when lrclib lines are finer than segments."""
import unicodedata
from dataclasses import dataclass, field

import pykakasi

_KAKASI = pykakasi.kakasi()
_SMALL = str.maketrans("ぁぃぅぇぉっゃゅょゎゕゖ", "あいうえおつやゆよわかけ")
MATCH, MISMATCH, GAP_LYRIC, GAP_ASR = 2.0, -1.0, -1.0, -0.4
# A line counts as found when half its chars matched and the match starts within its first few chars.
MIN_MATCH_RATIO, MAX_FIRST_POS = 0.5, 2
# Seconds per char used to step back from the first matched char to the line start.
CHAR_SECONDS = 0.2
HEAD_CHARS = 6


@dataclass
class Word:
    start: float
    end: float
    text: str


@dataclass
class Anchor:
    start: float
    # Times of the line's first matched chars; a jump between them shows Whisper glued the first word
    # onto the previous phrase (see timing.snap_to_onsets).
    heads: list[float] = field(default_factory=list)
    filled: bool = False
    snapped: float = 0.0


def kana(text: str) -> list[str]:
    out = []
    for part in _KAKASI.convert(unicodedata.normalize("NFKC", text)):
        for ch in part["hira"].lower():
            ch = ch.translate(_SMALL)
            if ch.isalnum() and ch != "ー":
                out.append(ch)
    return out


def char_stream(words: list[Word]) -> tuple[list[str], list[float]]:
    chars, times = [], []
    for w in words:
        ks = kana(w.text)
        if not ks:
            continue
        step = (w.end - w.start) / len(ks)
        for i, ch in enumerate(ks):
            chars.append(ch)
            times.append(w.start + i * step)
    return chars, times


def align(a: list[str], b: list[str]) -> dict[int, int]:
    """Monotonic alignment of lyric chars a onto ASR chars b. Returns matched pairs a-index -> b-index.

    Skipping ASR chars is cheap so MV dialogue and hallucinated text cost little; ASR leading/trailing
    chars are free.
    """
    n, m = len(a), len(b)
    prev = [0.0] * (m + 1)
    back = []
    for i in range(1, n + 1):
        cur = [prev[0] + GAP_LYRIC] + [0.0] * m
        bp = bytearray(m + 1)
        bp[0] = 1
        ai = a[i - 1]
        for j in range(1, m + 1):
            d = prev[j - 1] + (MATCH if ai == b[j - 1] else MISMATCH)
            u = prev[j] + GAP_LYRIC
            left = cur[j - 1] + GAP_ASR
            if d >= u and d >= left:
                cur[j] = d
                bp[j] = 0
            elif u >= left:
                cur[j] = u
                bp[j] = 1
            else:
                cur[j] = left
                bp[j] = 2
        back.append(bp)
        prev = cur
    j = max(range(m + 1), key=lambda k: prev[k])
    i, pairs = n, {}
    while i > 0:
        move = back[i - 1][j] if j > 0 else 1
        if move == 0:
            if a[i - 1] == b[j - 1]:
                pairs[i - 1] = j - 1
            i -= 1
            j -= 1
        elif move == 1:
            i -= 1
        else:
            j -= 1
    return pairs


def line_anchors(texts: list[str], words: list[Word]) -> list[Anchor | None]:
    chars, times = char_stream(words)
    seq, owner, pos = [], [], []
    per_line = []
    for li, text in enumerate(texts):
        ks = kana(text)
        per_line.append(len(ks))
        for p, ch in enumerate(ks):
            seq.append(ch)
            owner.append(li)
            pos.append(p)
    hits: dict[int, list[tuple[int, float]]] = {}
    for ai, bj in align(seq, chars).items():
        hits.setdefault(owner[ai], []).append((pos[ai], times[bj]))
    anchors: list[Anchor | None] = []
    for li in range(len(texts)):
        h = sorted(hits.get(li, []))
        if not h or per_line[li] == 0 or len(h) / per_line[li] < MIN_MATCH_RATIO or h[0][0] > MAX_FIRST_POS:
            anchors.append(None)
            continue
        anchors.append(Anchor(start=max(0.0, h[0][1] - h[0][0] * CHAR_SECONDS), heads=[t for p, t in h if p < HEAD_CHARS]))
    return anchors

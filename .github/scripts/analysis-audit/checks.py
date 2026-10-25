"""Rule checks over one finished song analysis, and the compact text the audit model reads.

usage: python3 -I checks.py <work.json> <lyric.json> <mv.json>
  work.json   GET /admin/api/song-analysis-works/{id}
  lyric.json  GET /admin/api/lyrics/{lyricId}
  mv.json     {"status": <YouTube oEmbed HTTP status, 0 when unreachable>, "title", "author_name"}
prints {"findings": [...], "promptText": "..."}
"""
import json
import re
import sys

JAPANESE = re.compile(r"[\u3040-\u30fa\u30fc-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\u3005\u3006]")
HANGUL = re.compile(r"[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]")
# 緞帳(どんちょう): providers print a reading after a word, and segmentation leaves it out on purpose.
INLINE_READING = re.compile(r"[（(][\u3040-\u30ff]+[)）]")
# Parts of speech a learner taps for a meaning. Particles and auxiliaries carry grammar labels instead.
CONTENT_POS = {
    "NOUN", "VERB", "ADJECTIVE", "NA_ADJECTIVE", "ADVERB", "PRONOUN", "ADNOMINAL",
    "CONJUNCTION", "INTERJECTION", "EXPRESSION",
}

# Share of lines with any Japanese. Japanese-version K-pop puts English in most lines but Japanese in
# nearly all of them, so a letter count would flag it; a Korean or English lyric has almost no such line.
MIN_JAPANESE_LINE_RATIO = 0.5
# A Japanese version keeps a few Korean ad-libs; more than this is the Korean version's lyric.
MAX_HANGUL_LINE_RATIO = 0.2
MIN_LYRIC_LINES = 4
# Synced lyrics end before the track does; a last line far past the end is another recording's timing.
MAX_TAIL_OVERRUN_MS = 20_000
# A few uncovered kana (a dropped ー or っ) are the segmenter's normal rounding.
MAX_UNCOVERED_CHARS = 2


def finding(category, problem, line_index=None, target=None, evidence=None):
    return {
        "source": "rule",
        "category": category,
        "lineIndex": line_index,
        "target": target,
        "problem": problem,
        "evidence": evidence,
        "suggestion": None,
    }


def check_lyrics(work, lyric):
    found = []
    raw = [l for l in (lyric.get("rawContent") or []) if (l.get("text") or "").strip()]
    if len(raw) < MIN_LYRIC_LINES:
        found.append(finding("LYRICS_BROKEN", f"가사가 {len(raw)}줄뿐이다"))
        return found

    japanese = [l for l in raw if JAPANESE.search(l["text"])]
    hangul = [l for l in raw if HANGUL.search(l["text"])]
    if len(japanese) / len(raw) < MIN_JAPANESE_LINE_RATIO:
        sample = next((l for l in raw if not JAPANESE.search(l["text"])), raw[0])
        found.append(finding(
            "LYRICS_NOT_JAPANESE", f"일본어가 있는 줄이 {len(raw)}줄 중 {len(japanese)}줄뿐이다",
            line_index=sample["index"], evidence=sample["text"],
        ))
    if len(hangul) / len(raw) > MAX_HANGUL_LINE_RATIO:
        found.append(finding(
            "LYRICS_NOT_JAPANESE", f"한글이 있는 줄이 {len(raw)}줄 중 {len(hangul)}줄이다",
            line_index=hangul[0]["index"], evidence=hangul[0]["text"],
        ))

    if lyric.get("lyricType") == "SYNCED":
        times = [l.get("startTimeMs") for l in raw]
        backwards = [raw[i]["index"] for i in range(1, len(times))
                     if times[i] is not None and times[i - 1] is not None and times[i] < times[i - 1]]
        if backwards:
            found.append(finding("LYRICS_BROKEN", f"줄 시각이 거꾸로 가는 곳이 {len(backwards)}군데 있다",
                                 line_index=backwards[0]))
        duration = work.get("durationSeconds")
        last = max((t for t in times if t is not None), default=None)
        if duration and last is not None and last > duration * 1000 + MAX_TAIL_OVERRUN_MS:
            found.append(finding(
                "LYRICS_WRONG_SONG",
                f"마지막 줄이 {last // 1000}초에 시작하는데 곡 길이는 {duration}초다",
                line_index=raw[-1]["index"],
            ))
    return found


def check_analysis(lyric):
    found = []
    raw = {l["index"]: l["text"] for l in (lyric.get("rawContent") or []) if (l.get("text") or "").strip()}
    analyzed = lyric.get("analyzedContent")
    if not analyzed:
        return [finding("ANALYSIS_BROKEN", "분석 결과가 비어 있다")]

    by_index = {l["index"]: l for l in analyzed}
    missing = [i for i, t in raw.items() if i not in by_index and JAPANESE.search(t)]
    if missing:
        found.append(finding("ANALYSIS_BROKEN", f"분석 결과에 없는 가사 줄이 {len(missing)}개 있다",
                             line_index=missing[0], evidence=raw[missing[0]]))

    for line in analyzed:
        index = line["index"]
        text = raw.get(index, "")
        if JAPANESE.search(text) and not (line.get("koreanLyrics") or "").strip():
            found.append(finding("TRANSLATION", "줄 번역이 비어 있다", index, evidence=text))

        # Offsets are Kotlin string indices (UTF-16 units); an emoji or 𠮟 takes two.
        units = text.encode("utf-16-le")
        u16_starts, pos = [], 0
        for c in text:
            u16_starts.append(pos)
            pos += 2 if ord(c) > 0xFFFF else 1
        covered = [False] * (len(units) // 2)
        for m in INLINE_READING.finditer(text):
            for i in range(u16_starts[m.start()], u16_starts[m.end() - 1] + 1):
                covered[i] = True
        for token in line.get("tokens") or []:
            start, end, surface = token.get("charStart"), token.get("charEnd"), token.get("surface") or ""
            sliced = units[2 * start:2 * end].decode("utf-16-le", "replace") if start is not None and end is not None else ""
            if sliced != surface:
                found.append(finding(
                    "SEGMENTATION", "토큰 위치가 가사 글자와 어긋난다", index, surface,
                    evidence=f"{text} [{start}:{end}] = 「{sliced}」",
                ))
                continue
            for i in range(start, min(end, len(covered))):
                covered[i] = True
            if token.get("partOfSpeech") in CONTENT_POS and not (token.get("koreanText") or "").strip():
                found.append(finding("MEANING", "뜻이 비어 있다", index, surface,
                                     evidence=f"{text} (원형 {token.get('baseForm')})"))
        uncovered = "".join(c for c, u in zip(text, u16_starts) if not covered[u] and JAPANESE.match(c))
        if len(uncovered) > MAX_UNCOVERED_CHARS:
            found.append(finding("SEGMENTATION", "토큰이 덮지 않은 글자가 있다", index, uncovered, evidence=text))
    return found


def check_mv(work, mv):
    if not work.get("youtubeUrl"):
        return [finding("MV_MISSING", "MV 없이 분석됐다")]
    # The app plays the MV in an embed, so a video that refuses embedding is as good as gone.
    problem = {
        401: "MV 가 퍼가기를 막았거나 비공개라 앱에서 재생되지 않는다",
        403: "MV 가 퍼가기를 막아 앱에서 재생되지 않는다",
        404: "MV 가 삭제됐거나 비공개다",
        400: "MV 가 삭제됐거나 비공개다",
    }.get(mv.get("status"))
    return [finding("MV_MISMATCH", problem, evidence=work["youtubeUrl"])] if problem else []


def token_text(token):
    meaning = (token.get("koreanText") or "").strip() or "∅"
    base = token.get("baseForm") or ""
    head = token["surface"] if base in ("", token["surface"]) else f"{token['surface']}({base})"
    return f"{head}[{token.get('partOfSpeech')}]={meaning}"


def prompt_text(work, lyric, mv):
    out = [
        f"곡: 「{work.get('rawTitle')}」 / {work.get('rawArtist')}",
        f"곡 길이: {work.get('durationSeconds')}초, 가사 종류: {lyric.get('lyricType')}",
    ]
    if work.get("youtubeUrl"):
        out.append(f"MV: {work['youtubeUrl']} — 제목 「{mv.get('title')}」, 채널 「{mv.get('author_name')}」")
    else:
        out.append("MV: 없음")
    out.append("")
    out.append("줄번호 | 시각 | 원문 | 줄 번역 | 토큰 표면(원형)[품사]=뜻")
    analyzed = {l["index"]: l for l in (lyric.get("analyzedContent") or [])}
    for line in lyric.get("rawContent") or []:
        text = (line.get("text") or "").strip()
        if not text:
            continue
        a = analyzed.get(line["index"], {})
        ms = line.get("startTimeMs")
        stamp = f"{ms // 60000}:{ms // 1000 % 60:02d}" if ms is not None else "-"
        tokens = " ".join(token_text(t) for t in a.get("tokens") or [])
        out.append(f"{line['index']} | {stamp} | {text} | {a.get('koreanLyrics') or '∅'} | {tokens}")
    return "\n".join(out)


def collapse(findings):
    """One finding per (category, problem): a broken stage repeats the same one on every token."""
    groups = {}
    for f in findings:
        groups.setdefault((f["category"], f["problem"]), []).append(f)
    out = []
    for same in groups.values():
        first = dict(same[0])
        if len(same) > 1:
            targets = ", ".join(dict.fromkeys(f["target"] for f in same if f["target"]))
            first["problem"] = f"{first['problem']} ({len(same)}곳" + (f": {targets[:200]})" if targets else ")")
        out.append(first)
    return out


def main():
    work, lyric, mv = (json.load(open(p, encoding="utf-8")) for p in sys.argv[1:4])
    findings = collapse(check_lyrics(work, lyric) + check_analysis(lyric) + check_mv(work, mv))
    json.dump({"findings": findings, "promptText": prompt_text(work, lyric, mv)}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()

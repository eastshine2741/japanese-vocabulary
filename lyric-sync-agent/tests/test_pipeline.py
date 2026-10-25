from unittest.mock import MagicMock

import pytest
import yt_dlp

from lyric_sync_agent import audio
from lyric_sync_agent.align import Anchor
from lyric_sync_agent.pipeline import aligned_result, heard_counts, offset_result, synced_ok


def _job(lyric_type, texts, starts):
    return {"lyricType": lyric_type,
            "lines": [{"index": i, "text": t, "startTimeMs": s} for i, (t, s) in enumerate(zip(texts, starts))]}


def test_english_only_lines_do_not_count_against_the_verdict():
    texts = ["Wherever you go", "鳴り止まない愛が", "君の声", "Baby baby", "夜を越えて"]
    anchors = [None, Anchor(10.0), Anchor(14.0), None, Anchor(20.0)]
    assert heard_counts(texts, anchors) == (3, 3)
    assert aligned_result(_job("PLAIN", texts, [None] * 5), anchors).confidence["verdict"] == "OK"


def test_synced_lines_found_but_off_every_offset_fit_keep_the_found_times():
    # Found times scatter up to ±1.6s around any constant shift of the lrclib times: lrclib is timed for another cut.
    n = 16
    texts = [f"歌詞{i}の行" for i in range(n)]
    lrc = [10_000 + i * 8_000 for i in range(n)]
    found = [10.0 + i * 8.0 + ((i * 7) % 5 - 2) * 0.8 for i in range(n)]
    result = offset_result(_job("SYNCED", texts, lrc), [Anchor(t) for t in found])
    assert result.method == "ALIGNED"
    assert [line["startTimeMs"] for line in result.lines] == [int(round(t * 1000)) for t in found]
    assert result.confidence["offsetWithin500ms"] < 0.5


def test_synced_lines_that_fit_one_offset_stay_offset():
    n = 16
    texts = [f"歌詞{i}の行" for i in range(n)]
    lrc = [10_000 + i * 8_000 for i in range(n)]
    result = offset_result(_job("SYNCED", texts, lrc), [Anchor(x / 1000 + 2.95) for x in lrc])
    assert result.method == "OFFSET"
    assert result.confidence["verdict"] == "OK"


@pytest.mark.parametrize("anchored, lines, within, ok", [
    (49, 51, 0.653, True),   # マリーゴールド: MV runs at a slightly different speed, lrclib error keeps within500ms low
    (39, 42, 0.615, True),
    (11, 42, 0.909, False),  # オーバー!: few lines heard
    (6, 126, 0.667, False),  # 熱異常
    (15, 20, 0.4, False),    # 恋人よ: lines found but they disagree
])
def test_synced_verdict_trusts_found_lines_over_lrclib_scatter(anchored, lines, within, ok):
    assert synced_ok(anchored, lines, within) is ok


def test_age_restricted_mv_is_unavailable_not_a_pc_failure(monkeypatch, tmp_path):
    ydl = MagicMock()
    ydl.__enter__.return_value.download.side_effect = yt_dlp.utils.DownloadError(
        "ERROR: [youtube] x8VYWazR5mE: Sign in to confirm your age. This video may be inappropriate for some users.")
    monkeypatch.setattr(yt_dlp, "YoutubeDL", MagicMock(return_value=ydl))
    with pytest.raises(audio.VideoUnavailable):
        audio.download("x8VYWazR5mE", tmp_path)


def test_other_download_errors_stay_retryable(monkeypatch, tmp_path):
    ydl = MagicMock()
    ydl.__enter__.return_value.download.side_effect = yt_dlp.utils.DownloadError("ERROR: HTTP Error 403: Forbidden")
    monkeypatch.setattr(yt_dlp, "YoutubeDL", MagicMock(return_value=ydl))
    with pytest.raises(yt_dlp.utils.DownloadError):
        audio.download("x8VYWazR5mE", tmp_path)

from unittest.mock import MagicMock

import pytest
import yt_dlp

from lyric_sync_agent import audio
from lyric_sync_agent.pipeline import synced_ok


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
    with pytest.raises(audio.VideoUnavailable) as raised:
        audio.download("x8VYWazR5mE", tmp_path)
    assert raised.value.reason == audio.AGE_RESTRICTED


def test_removed_mv_is_unavailable(monkeypatch, tmp_path):
    ydl = MagicMock()
    ydl.__enter__.return_value.download.side_effect = yt_dlp.utils.DownloadError(
        "ERROR: [youtube] Yt3p3kxWlwo: Video unavailable. This video has been removed by the uploader")
    monkeypatch.setattr(yt_dlp, "YoutubeDL", MagicMock(return_value=ydl))
    with pytest.raises(audio.VideoUnavailable) as raised:
        audio.download("Yt3p3kxWlwo", tmp_path)
    assert raised.value.reason == audio.UNAVAILABLE


def test_other_download_errors_stay_retryable(monkeypatch, tmp_path):
    ydl = MagicMock()
    ydl.__enter__.return_value.download.side_effect = yt_dlp.utils.DownloadError("ERROR: HTTP Error 403: Forbidden")
    monkeypatch.setattr(yt_dlp, "YoutubeDL", MagicMock(return_value=ydl))
    with pytest.raises(yt_dlp.utils.DownloadError):
        audio.download("x8VYWazR5mE", tmp_path)

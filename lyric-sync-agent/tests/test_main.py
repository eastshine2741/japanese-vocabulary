from unittest.mock import MagicMock

import lyric_sync_agent.__main__ as agent
from lyric_sync_agent import pipeline
from lyric_sync_agent.client import Rejected

JOB = {"id": 7, "attempt": 2, "songId": 1, "title": "t", "artist": "a", "youtubeVideoId": "x" * 11}


def test_song_level_failure_is_final_and_does_not_count_against_the_pc(monkeypatch):
    api = MagicMock()
    monkeypatch.setattr(pipeline, "run", MagicMock(side_effect=pipeline.SyncError("no line found")))
    assert agent.process(api, JOB, "m", "cpu") is True
    api.fail.assert_called_once_with(7, 2, "SyncError: no line found", retryable=False, mv_unavailable=None)


def test_pc_failure_is_retryable_and_counts_against_the_pc(monkeypatch):
    api = MagicMock()
    monkeypatch.setattr(pipeline, "run", MagicMock(side_effect=RuntimeError("CUDA error")))
    assert agent.process(api, JOB, "m", "cpu") is False
    api.fail.assert_called_once_with(7, 2, "RuntimeError: CUDA error", retryable=True)


def test_rejected_result_is_recorded_as_final_failure(monkeypatch):
    api = MagicMock()
    api.complete.side_effect = Rejected("400 bad timings")
    monkeypatch.setattr(pipeline, "run", MagicMock(return_value=pipeline.SyncResult("ALIGNED", [], {})))
    assert agent.process(api, JOB, "m", "cpu") is True
    api.fail.assert_called_once_with(7, 2, "rejected: 400 bad timings", retryable=False)


def test_a_failing_report_never_escapes(monkeypatch):
    api = MagicMock()
    api.fail.side_effect = Rejected("404")
    monkeypatch.setattr(pipeline, "run", MagicMock(side_effect=RuntimeError("boom")))
    assert agent.process(api, JOB, "m", "cpu") is False


def test_unavailable_mv_reports_why_with_the_final_failure(monkeypatch):
    api = MagicMock()
    monkeypatch.setattr(pipeline, "run", MagicMock(side_effect=pipeline.SyncError("MV not downloadable: age", "AGE_RESTRICTED")))
    assert agent.process(api, JOB, "m", "cpu") is True
    api.fail.assert_called_once_with(7, 2, "SyncError: MV not downloadable: age", retryable=False, mv_unavailable="AGE_RESTRICTED")

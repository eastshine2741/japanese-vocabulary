from lyric_sync_agent.align import Anchor
from lyric_sync_agent.timing import (
    drop_out_of_order, fit_offsets, interpolate, offset_at, snap_to_onsets,
)

HOP = 0.1


def voiced(spans, total=30.0):
    mask = [False] * int(total / HOP)
    for a, b in spans:
        for k in range(int(a / HOP), int(b / HOP)):
            mask[k] = True
    return mask


def test_first_word_glued_onto_the_previous_phrase_moves_to_the_onset_after_the_silence():
    # Whisper placed あの at 7.3s right after the previous phrase; the line is really sung from 11.9s.
    a = Anchor(start=7.3, heads=[7.3, 7.7, 11.9, 12.2])
    snap_to_onsets([a], voiced([(0, 8.0), (11.9, 20)]), HOP)
    assert abs(a.start - 11.9) < HOP
    assert a.snapped > 4


def test_a_sustained_note_across_the_jump_is_left_alone():
    a = Anchor(start=7.3, heads=[7.3, 9.5])
    snap_to_onsets([a], voiced([(0, 20)]), HOP)
    assert a.start == 7.3


def test_snap_never_moves_a_line_past_the_next_one():
    a = Anchor(start=7.3, heads=[7.3, 11.9])
    nxt = Anchor(start=10.0)
    snap_to_onsets([a, nxt], voiced([(0, 8.0), (11.9, 20)]), HOP)
    assert a.start == 7.3


def test_out_of_order_anchor_is_dropped():
    anchors = [Anchor(5.0), Anchor(3.0), Anchor(6.0)]
    drop_out_of_order(anchors)
    assert anchors[1] is None and anchors[2].start == 6.0


def test_anchor_on_the_same_sound_as_the_line_before_is_dropped():
    # あだぽしゃ: the prompted re-listen put 分かっていたでしょう and お互い幸せに… both at 44.91s.
    anchors = [Anchor(43.31), Anchor(44.91), Anchor(44.91), Anchor(51.42)]
    drop_out_of_order(anchors)
    assert anchors[2] is None
    assert interpolate(anchors, [8, 10, 13, 9])[2] > 44.91 + 1


def test_offsets_split_where_the_mv_inserts_a_scene():
    # 強風オールバック: the MV inserts ~14s after the 86s mark.
    pts = [(x, x - 0.1) for x in (0, 10, 30, 50, 60)] + [(x, x + 14.1) for x in (86, 92, 100, 110)]
    segments = fit_offsets(pts)
    assert len(segments) == 2
    assert abs(offset_at(segments, 20) + 0.1) < 1e-9
    assert abs(offset_at(segments, 95) - 14.1) < 1e-9


def test_scattered_asr_noise_does_not_create_segments():
    noise = [0.3, -0.4, 0.2, 0.9, -0.2, 0.1, -0.6, 0.4]
    pts = [(10.0 * i, 10.0 * i + 7.3 + e) for i, e in enumerate(noise)]
    segments = fit_offsets(pts)
    assert len(segments) == 1
    assert abs(segments[0].offset - 7.3) < 0.3


def test_interpolation_splits_the_gap_by_characters_and_leaves_the_edges_empty():
    anchors = [None, Anchor(10.0), None, Anchor(14.0), None]
    times = interpolate(anchors, [3, 2, 2, 4, 1])
    assert times[0] is None and times[4] is None
    assert times[2] == 12.0


def test_times_never_go_backwards_where_the_mv_cuts_a_verse():
    from lyric_sync_agent.timing import non_decreasing
    assert non_decreasing([68.0, None, 55.0, 70.0]) == [68.0, None, 68.0, 70.0]

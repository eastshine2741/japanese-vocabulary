from lyric_sync_agent.align import Word, align, kana, line_anchors


def test_kana_reads_kanji_and_folds_small_kana():
    assert kana("名前を呼んだ") == kana("なまえをよんだ")
    assert kana("ちょっと") == list("ちよつと")


def test_align_keeps_order_and_skips_extra_asr_chars():
    pairs = align(list("あいう"), list("あXいYう"))
    assert pairs == {0: 0, 1: 2, 2: 4}


def test_lines_finer_than_whisper_segments_each_get_their_own_start():
    # lrclib splits 思い出すのは / 君の歌 while Whisper hears them as one phrase.
    words = [Word(8.0, 9.0, "思い出すのは"), Word(10.0, 11.0, "君の歌")]
    anchors = line_anchors(["思い出すのは", "君の歌"], words)
    assert anchors[0].start == 8.0
    assert anchors[1].start == 10.0


def test_a_line_whisper_never_heard_has_no_anchor():
    anchors = line_anchors(["夢ならば", "未だにあなたのことを"], [Word(1.0, 2.0, "夢ならば")])
    assert anchors[0] is not None
    assert anchors[1] is None

package com.japanese.vocabulary.karaoke.service

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class KaraokeTitleCleanerTest {

    @Test
    fun `strips tie-up and feat parentheses from vendor titles and artists`() {
        assertThat(KaraokeTitleCleaner.cleanTitle("風のゆくえ(映画 'ONE PIECE FILM RED' OST)")).isEqualTo("風のゆくえ")
        assertThat(KaraokeTitleCleaner.cleanTitle("なんもねえ (\"ヤニねこ\"OP)")).isEqualTo("なんもねえ")
        assertThat(KaraokeTitleCleaner.cleanTitle("オールドファッション(ドラマ '大恋愛～僕を忘れる君と' OST)")).isEqualTo("オールドファッション")
        assertThat(KaraokeTitleCleaner.cleanArtist("ピノキオピー(Feat.初音ミク)")).isEqualTo("ピノキオピー")
        assertThat(KaraokeTitleCleaner.cleanArtist("椎名もた feat.鏡音リン")).isEqualTo("椎名もた")
        assertThat(KaraokeTitleCleaner.cleanArtist("椎名もた feat. 鏡音リン")).isEqualTo("椎名もた")
    }

    @Test
    fun `keeps titles that only look like punctuation`() {
        assertThat(KaraokeTitleCleaner.cleanTitle("-ERROR")).isEqualTo("-ERROR")
        assertThat(KaraokeTitleCleaner.cleanTitle("言って。")).isEqualTo("言って。")
    }

    @Test
    fun `drops a latin subtitle after a japanese title`() {
        assertThat(KaraokeTitleCleaner.cleanTitle("夜に駆ける - Yoru ni Kakeru")).isEqualTo("夜に駆ける")
        assertThat(KaraokeTitleCleaner.cleanTitle("Love - Song")).isEqualTo("Love - Song")
    }

    @Test
    fun `cuts a truncated parenthesis and the truncation marker`() {
        assertThat(KaraokeTitleCleaner.cleanTitle("処方箋(TVアニメ 'とても長いタイトルの..")).isEqualTo("処方箋")
        assertThat(KaraokeTitleCleaner.isTruncated("連続する長い名前のアーティスト..")).isTrue()
    }

    @Test
    fun `matches catalog results only on both title and artist`() {
        assertThat(KaraokeTitleCleaner.sameSong("風のゆくえ(映画 'ONE PIECE FILM RED' OST)", "Ado", "風のゆくえ", "Ado")).isTrue()
        assertThat(KaraokeTitleCleaner.sameSong("歌姫失格", "ピノキオピー(Feat.初音ミク)", "歌姫失格", "ピノキオピー feat. 初音ミク")).isTrue()
        assertThat(KaraokeTitleCleaner.sameSong("光", "RADWIMPS", "光", "宇多田ヒカル")).isFalse()
        assertThat(KaraokeTitleCleaner.sameSong("とても長いタイトル..", "Ado", "とても長いタイトルの歌", "Ado")).isTrue()
        assertThat(KaraokeTitleCleaner.sameSong("唱", "Ado", "唱 (Remix)", "Ado")).isTrue()
    }

    @Test
    fun `matches on the main artist however guests are credited`() {
        assertThat(KaraokeTitleCleaner.sameSong("少女A", "椎名もた feat.鏡音リン", "少女A", "椎名もた & 鏡音リン")).isTrue()
        assertThat(KaraokeTitleCleaner.sameSong("少女A", "椎名もた feat.鏡音リン", "少女A", "椎名もた")).isTrue()
        assertThat(KaraokeTitleCleaner.sameSong("少女A", "椎名もた feat.鏡音リン", "少女A", "中森明菜")).isFalse()
        assertThat(KaraokeTitleCleaner.sameSong("曲", "長い名前のアーティ..", "曲", "長い名前のアーティスト & ゲスト")).isTrue()
    }
}

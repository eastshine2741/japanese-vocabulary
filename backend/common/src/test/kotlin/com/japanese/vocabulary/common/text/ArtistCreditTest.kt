package com.japanese.vocabulary.common.text

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ArtistCreditTest {

    @Test
    fun `drops featured guests with or without a space after the dot`() {
        assertThat(ArtistCredit.withoutFeaturing("椎名もた feat.鏡音リン")).isEqualTo("椎名もた")
        assertThat(ArtistCredit.withoutFeaturing("椎名もた feat. 鏡音リン")).isEqualTo("椎名もた")
        assertThat(ArtistCredit.withoutFeaturing("ピノキオピー Ft 初音ミク")).isEqualTo("ピノキオピー")
        assertThat(ArtistCredit.withoutFeaturing("niki & リリィ")).isEqualTo("niki & リリィ")
    }

    @Test
    fun `keeps names that only contain feat or ft`() {
        assertThat(ArtistCredit.withoutFeaturing("Kis-My-Ft2")).isEqualTo("Kis-My-Ft2")
        assertThat(ArtistCredit.names("Kis-My-Ft2")).containsExactly("Kis-My-Ft2")
        assertThat(ArtistCredit.names("Defeat")).containsExactly("Defeat")
    }

    @Test
    fun `lists every credited name in order`() {
        assertThat(ArtistCredit.names("椎名もた feat.鏡音リン")).containsExactly("椎名もた", "鏡音リン")
        assertThat(ArtistCredit.names("椎名もた & 鏡音リン")).containsExactly("椎名もた", "鏡音リン")
        assertThat(ArtistCredit.names("A featuring B, C")).containsExactly("A", "B", "C")
    }
}

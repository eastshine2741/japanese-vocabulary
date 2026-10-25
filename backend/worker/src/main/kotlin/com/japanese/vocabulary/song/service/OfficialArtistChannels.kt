package com.japanese.vocabulary.song.service

/**
 * Official channels whose name and upload titles never say the artist, so no rule can tell them from a
 * fan upload (ラブライブ!スーパースター!! for Liella!, OFFICIAL HIGE DANDISM). Keyed by channel id: names change.
 * Artist names match the song's credit exactly, after the feat. guest is dropped.
 */
object OfficialArtistChannels {
    private val ARTISTS_BY_CHANNEL: Map<String, Set<String>> = mapOf(
        "UCGzO-WBL6ggp2TIoW0fhPjA" to setOf("Liella!"), // ラブライブ!スーパースター!!
        "UCZooi-eLVkSl9HpYwKc86yA" to setOf("Aqours"), // ラブライブ!サンシャイン!!
        "UCgFMZfZa0ek3zNpkvlt_nSw" to setOf("うちのボカロは様子がおかしい"), // Something's off with my Vocaloid
        "UC9M4B-fqveLyWPGNdSkam7g" to setOf("Official髭男dism"), // OFFICIAL HIGE DANDISM
        "UC3vg17IZ1IV73xx069jG44w" to setOf("Official髭男dism"),
        "UC84Rm0a3gimYXPtqp5O_JRw" to setOf("Official髭男dism"),
        "UC3Bjw_Ek1FTbhEKZsh9uo1w" to setOf("バルーン"), // SudaKeina Balloon
        "UCtmi2O7lp0C_i53hFIExAaA" to setOf("サツキ"), // 32ki
        "UCOvn_LNao_hjdY-A5d7RUKg" to setOf("ネクライトーキー"), // Necry Talkie
        "UCG09qajPDZdPtLsTkW7mJQA" to setOf("40mP"), // 40meterP
        "UCHG5yLvj57pnMNm6perFrZA" to setOf("一二三"), // Hifumi
        "UC_P7NBqY_sWRjWcGeUWMVWA" to setOf("椎乃味醂"), // Sheeno Mirin
        "UCT77P4HLpV7B2sbmuxa_djQ" to setOf("松原みき"), // Miki Matsubara Official "stay with me"
        "UC2OgzdgLQ7vxlANVxF3kgvg" to setOf("ユリイ・カノン"), // Tsukuyomi / YurryCanon
    )

    fun isArtistChannel(channelId: String?, artistNames: List<String>): Boolean {
        val artists = channelId?.let { ARTISTS_BY_CHANNEL[it] } ?: return false
        return artistNames.any { it in artists }
    }
}

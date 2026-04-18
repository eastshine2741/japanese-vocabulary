package com.japanese.vocabulary.song.dto

enum class PartOfSpeech(val japaneseName: String, val koreanName: String) {
    NOUN("名詞", "명사"),
    VERB("動詞", "동사"),
    ADJECTIVE("形容詞", "형용사"),
    NA_ADJECTIVE("形状詞", "형용동사"),
    ADVERB("副詞", "부사"),
    PRONOUN("代名詞", "대명사"),
    ADNOMINAL("連体詞", "연체사"),
    CONJUNCTION("接続詞", "접속사"),
    AUXILIARY_VERB("助動詞", "조동사"),
    PARTICLE("助詞", "조사"),
    INTERJECTION("感動詞", "감동사"),
    PREFIX("接頭辞", "접두사"),
    SUFFIX("接尾辞", "접미사"),
    FILLER("フィラー", "필러"),
    OTHER("その他", "기타"),
    SYMBOL("記号", "기호"),
    SUPPLEMENTARY_SYMBOL("補助記号", "보조기호"),
    WHITESPACE("空白", "공백");

    companion object {
        private val JAPANESE_POS_MAP = values().associateBy { it.japaneseName } + mapOf(
            "形容動詞" to NA_ADJECTIVE, // IPADic variant
            "接頭詞" to PREFIX,          // IPADic uses 詞, UniDic uses 辞
        )
        fun fromJapaneseOrNull(jaPos: String): PartOfSpeech? = JAPANESE_POS_MAP[jaPos]
    }
}

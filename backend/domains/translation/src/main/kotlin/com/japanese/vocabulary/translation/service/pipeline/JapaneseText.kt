package com.japanese.vocabulary.translation.service.pipeline

object JapaneseText {
    private val regex = Regex("[぀-ゟ゠-ヿ一-鿿㐀-䶿ｦ-ﾟ]")

    fun containsJapanese(text: String): Boolean = regex.containsMatchIn(text)
}

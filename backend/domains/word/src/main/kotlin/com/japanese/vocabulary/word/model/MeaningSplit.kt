package com.japanese.vocabulary.word.model

/**
 * 곡 분석이 내려주는 뜻은 "사랑, 애정" 처럼 쉼표로 이어붙인 문자열 하나다. 단어는 뜻 단위이므로
 * 담을 때 그 조각 하나하나를 별개의 sense 로 쪼갠다 — 담긴 뜻인지 판정도 조각 단위 문자열 일치다.
 *
 * 괄호 안 쉼표는 자르지 않는다. "(사람, 물건이) 있다" 같은 뜻풀이가 반토막 나면 안 된다.
 */
fun splitMeaningText(meaning: String): List<String> {
    val parts = mutableListOf<String>()
    val buffer = StringBuilder()
    var depth = 0
    for (ch in meaning) {
        when {
            ch in OPEN_BRACKETS -> { depth++; buffer.append(ch) }
            ch in CLOSE_BRACKETS -> { if (depth > 0) depth-- ; buffer.append(ch) }
            ch in SEPARATORS && depth == 0 -> { parts += buffer.toString(); buffer.clear() }
            else -> buffer.append(ch)
        }
    }
    parts += buffer.toString()
    return parts.map { it.trim() }.filter { it.isNotEmpty() }.distinct()
}

/** 쪼갠 뜻 각각이 원래 sense 의 품사·JLPT·예문을 그대로 물려받는다. */
fun WordSense.splitMeanings(): List<WordSense> =
    splitMeaningText(meaning).map { copy(meaning = it) }

fun List<WordSense>.splitMeanings(): List<WordSense> = flatMap { it.splitMeanings() }

private val OPEN_BRACKETS = setOf('(', '（', '[', '［')
private val CLOSE_BRACKETS = setOf(')', '）', ']', '］')
private val SEPARATORS = setOf(',', '，', '、')

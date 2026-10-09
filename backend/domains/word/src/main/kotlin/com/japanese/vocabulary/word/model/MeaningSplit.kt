package com.japanese.vocabulary.word.model

/**
 * 곡 분석의 뜻 "사랑, 애정" 을 쉼표 단위로 쪼개 각각 별개의 sense 로 담는다.
 * 괄호 안 쉼표는 자르지 않는다: "(사람, 물건이) 있다".
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

/**
 * 쪼갠 뜻 각각이 원래 sense 의 품사·JLPT 를 물려받는다. **예문은 첫 조각만** 갖는다.
 *
 * 가사 줄이 어느 조각의 뜻으로 쓰였는지 모르므로 복제하지 않는다. 복제하면 같은 줄이 반복되고 sense 당
 * 예문 상한을 잡아먹는다.
 */
fun WordSense.splitMeanings(): List<WordSense> =
    splitMeaningText(meaning).mapIndexed { index, part ->
        copy(meaning = part, examples = if (index == 0) examples else emptyList())
    }

fun List<WordSense>.splitMeanings(): List<WordSense> = flatMap { it.splitMeanings() }

private val OPEN_BRACKETS = setOf('(', '（', '[', '［')
private val CLOSE_BRACKETS = setOf(')', '）', ']', '］')
private val SEPARATORS = setOf(',', '，', '、')

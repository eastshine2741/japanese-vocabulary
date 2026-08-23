package com.japanese.vocabulary.word.model

/**
 * [WordSense] 에 딸린 예문. [songId] 와 [lineIndex] 가 모두 있으면 앱이 해당 곡의 해당 가사로 이동한다.
 * 유저가 직접 추가한 예문은 둘 다 null 이다. 곡 참조는 논리 참조이며 FK 를 만들지 않는다.
 */
data class SenseExample(
    val text: String,
    val translation: String? = null,
    val songId: Long? = null,
    val lineIndex: Int? = null,
)

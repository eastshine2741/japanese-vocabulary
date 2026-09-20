package com.japanese.vocabulary.song.model

/**
 * 어떤 노래에도 나오는 뼈대 단어. 두 곳이 같은 목록을 본다:
 * - [com.japanese.vocabulary.song.service.WordCandidateGenerator] 는 중요도 점수를 깎아 핵심 단어에서 밀어낸다.
 * - 곡 단어 4단계 분류는 이 단어들을 "입문" 단계로 묶는다.
 *
 * prod 가사 77곡의 등장 곡 비율과 상위 5개 진입 횟수를 보고 고른 목록 (2026-09). 내용어(忘れる·笑う·夢)는 흔해도 남긴다.
 */
object CommonWords {
    private val WORDS: Set<Pair<String, PartOfSpeech>> = buildSet {
        listOf("ない", "無い", "いい", "良い", "よい")
            .forEach { add(it to PartOfSpeech.ADJECTIVE) }
        listOf(
            "する", "いる", "居る", "ある", "有る", "なる", "言う", "見る", "思う", "知る", "行く", "いく", "来る", "くる",
            "できる", "出来る", "わかる", "分かる", "しまう", "くれる", "あげる", "もらう",
        ).forEach { add(it to PartOfSpeech.VERB) }
        listOf("こと", "もの", "よう", "の", "ため", "とき", "時", "今", "中", "前", "日", "まま", "方")
            .forEach { add(it to PartOfSpeech.NOUN) }
        add("よう" to PartOfSpeech.NA_ADJECTIVE)
        listOf("もう", "そう", "こう", "どう", "また", "まだ", "ずっと", "ただ")
            .forEach { add(it to PartOfSpeech.ADVERB) }
    }

    fun contains(japanese: String, partOfSpeech: PartOfSpeech): Boolean = (japanese to partOfSpeech) in WORDS

    /** 저장된 후보의 품사는 [PartOfSpeech.name] 문자열이다. */
    fun contains(japanese: String, partOfSpeech: String): Boolean =
        PartOfSpeech.entries.firstOrNull { it.name == partOfSpeech }?.let { contains(japanese, it) } ?: false
}

package com.japanese.vocabulary.word.model

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.word.dto.songword.WordInSongItemDto
import com.japanese.vocabulary.word.dto.songword.WordsInSongDto

/** 곡 하나의 단계별 tier 단어와 그 유저의 flashcard(없으면 null). */
class SongTierCards(
    val words: WordsInSongDto,
    /** [SongWordTierKey.current] 순서. */
    val tiers: Map<SongWordTierKey, List<Pair<WordInSongItemDto, FlashcardEntity?>>>,
)

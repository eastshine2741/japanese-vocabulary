package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.song.dto.songdetail.SongLyricLineDto
import java.time.Instant

data class SongCardResponse(
    val songId: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val artistId: Long?,
    val grade: SongCardGrade,
    /** null 이면 아직 서명 전. grade 와 다르면 등급 오름 연출이 남았다. */
    val seenGrade: SongCardGrade?,
    val acquiredSeq: Int,
    /** 주인이 고른 줄. 비어 있으면 기본 줄을 [lyric] 에 싣는다. */
    val lyricLineIndexes: List<Int>,
    /** 카드에 싣는 가사 줄, 곡 순서대로. `GET /api/songs/{id}/lyrics` 의 줄과 같은 모양이다. */
    val lyric: List<SongLyricLineDto>,
    /** 뒷면 단어. 곡에서 중요한 단어부터 5개. */
    val words: List<RewardCardWordResponse>,
    /** 끝낸 단계 단어들의 평균 FSRS 기억 확률. 낡음은 이 값에서 나온다. */
    val recall: Double,
    val nextGoal: RewardCardGoalResponse?,
    val signature: List<String>,
    val masteredAt: Instant?,
    val createdAt: Instant,
)

package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.song.dto.songdetail.SongLyricLineDto
import java.time.Instant

/** 등급마다 한 장. 같은 곡의 카드들은 [id]·[grade]·[acquiredSeq]·가사·서명·[reviewedCount]·[dueCount] 만 다르다. */
data class SongCardResponse(
    val id: Long,
    val songId: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val artistId: Long?,
    val grade: SongCardGrade,
    val acquiredSeq: Int,
    /** 주인이 고른 줄. 비어 있으면 기본 줄을 [lyric] 에 싣는다. */
    val lyricLineIndexes: List<Int>,
    /** 카드에 싣는 가사 줄, 곡 순서대로. `GET /api/songs/{id}/lyrics` 의 줄과 같은 모양이다. */
    val lyric: List<SongLyricLineDto>,
    /** 뒷면 단어. 곡에서 중요한 단어부터 5개. */
    val words: List<RewardCardWordResponse>,
    /** 이 카드를 받은 뒤 리뷰한 tier 단어 수. */
    val reviewedCount: Int,
    /** [reviewedCount] 중 지금 복습할 차례인 단어 수. 낡음은 이 비율에서 나온다. */
    val dueCount: Int,
    /** 곡의 받은 등급 위 등급마다의 진행, 등급 순서대로. 같은 곡의 카드는 모두 같은 값이다. */
    val goals: List<RewardCardGoalResponse>,
    val signature: List<String>,
    /** false 면 아직 서명 전. */
    val issued: Boolean,
    val createdAt: Instant,
)

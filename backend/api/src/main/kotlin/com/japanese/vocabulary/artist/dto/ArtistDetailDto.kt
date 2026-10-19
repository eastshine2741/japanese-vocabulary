package com.japanese.vocabulary.artist.dto

import com.japanese.vocabulary.songsearch.dto.SongSearchItemDto

data class ArtistDetailDto(
    val id: Long,
    val name: String,
    val artworkUrl: String?,
    val appleMusicUrl: String?,
    /** 이 유저가 곡 단어장을 가진 곡. 이해도 높은 순. */
    val studyingSongs: List<ArtistStudyingSongDto>,
    /**
     * Apple Music 인기곡 중 [studyingSongs] 에 없는 곡. 검색 결과와 같은 모양이라 앱은 검색 결과를
     * 누를 때와 같은 흐름(곡 조회 → 없으면 분석 요청)을 탄다. Apple Music 이 실패하면 빈 목록이다.
     */
    val popularSongs: List<SongSearchItemDto>,
)

/** 이해도는 곡 상세와 같은 계산이다 (`GET /api/songs/{id}/coverage`). */
data class ArtistStudyingSongDto(
    val songId: Long,
    val title: String,
    val artworkUrl: String?,
    val totalLines: Int,
    val knownLines: Int,
)

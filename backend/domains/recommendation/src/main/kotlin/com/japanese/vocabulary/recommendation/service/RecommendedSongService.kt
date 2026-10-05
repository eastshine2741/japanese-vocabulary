package com.japanese.vocabulary.recommendation.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.recommendation.dto.RecommendedSongDto
import com.japanese.vocabulary.recommendation.entity.RecommendedSongEntity
import com.japanese.vocabulary.recommendation.repository.RecommendedSongRepository
import com.japanese.vocabulary.song.repository.SongRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class RecommendedSongService(
    private val recommendedSongRepository: RecommendedSongRepository,
    private val songRepository: SongRepository,
) {
    @Transactional(readOnly = true)
    fun list(): List<RecommendedSongDto> = recommendedSongRepository.findAllWithSong()

    @Transactional
    fun add(songId: Long): RecommendedSongDto {
        val song = songRepository.findById(songId).orElseThrow { NoSuchElementException("Song not found: $songId") }
        if (recommendedSongRepository.existsBySongId(songId)) {
            throw BusinessException(ErrorCode.SONG_ALREADY_RECOMMENDED)
        }
        val orderIndex = recommendedSongRepository.findMaxOrderIndex()?.plus(1) ?: 0
        // 동시 추가는 exists 검사를 함께 통과하므로 UNIQUE(song_id) 위반으로 판정한다.
        val saved = try {
            recommendedSongRepository.saveAndFlush(RecommendedSongEntity(songId = songId, orderIndex = orderIndex))
        } catch (e: DataIntegrityViolationException) {
            throw BusinessException(ErrorCode.SONG_ALREADY_RECOMMENDED)
        }
        return RecommendedSongDto(
            id = requireNotNull(saved.id),
            songId = songId,
            title = song.title,
            artist = song.artist,
            artworkUrl = song.artworkUrl,
            orderIndex = saved.orderIndex,
            createdAt = saved.createdAt,
        )
    }

    @Transactional
    fun remove(id: Long) {
        val recommendation = recommendedSongRepository.findById(id)
            .orElseThrow { NoSuchElementException("Recommended song not found: $id") }
        recommendedSongRepository.delete(recommendation)
    }

    @Transactional
    fun reorder(ids: List<Long>): List<RecommendedSongDto> {
        val current = recommendedSongRepository.findAll().associateBy { requireNotNull(it.id) }
        require(ids.size == ids.toSet().size && ids.toSet() == current.keys) {
            "ids must list every recommended song exactly once."
        }
        ids.forEachIndexed { index, id -> current.getValue(id).orderIndex = index }
        recommendedSongRepository.flush()
        return recommendedSongRepository.findAllWithSong()
    }
}

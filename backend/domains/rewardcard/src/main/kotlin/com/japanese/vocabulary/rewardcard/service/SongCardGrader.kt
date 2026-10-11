package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.rewardcard.dto.SongAchievementDto
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.service.songword.SongTierCardService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 곡 카드 등급을 잰다. 곡 수와 상관없이 곡·가사·유저 단어·flashcard 를 한 번씩만 조회하고, 등급 계산은 메모리에서 한다. */
@Service
class SongCardGrader(
    private val songRepository: SongRepository,
    private val lyricRepository: LyricRepository,
    private val songTierCardService: SongTierCardService,
) {
    // 곡·활성 가사가 없는 곡은 결과에서 빠질 뿐 던지지 않는다 — 던지면 공유 트랜잭션이 rollback-only 가 되어 rating 까지 무너진다.
    @Transactional(readOnly = true)
    fun measure(userId: Long, songIds: Collection<Long>): List<SongAchievementDto> {
        if (songIds.isEmpty()) return emptyList()
        val artistIds = songRepository.findAllById(songIds).associate { it.id!! to it.artistId }
        val lyrics = lyricRepository.findActiveBySongIdIn(songIds).filter { it.songId in artistIds }
        return songTierCardService.tierCards(userId, lyrics).map { (songId, cards) ->
            SongAchievementDto(
                songId = songId,
                artistId = artistIds[songId],
                grade = SongCardGradeRule.of(cards.tiers.values.map { tier -> tier.map { it.second } }),
            )
        }
    }
}

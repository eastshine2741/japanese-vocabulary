package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.rewardcard.dto.ArtistCardDto
import com.japanese.vocabulary.rewardcard.dto.RewardCardRevealDto
import com.japanese.vocabulary.rewardcard.dto.SongAchievementDto
import com.japanese.vocabulary.rewardcard.dto.SongCardDto
import com.japanese.vocabulary.rewardcard.entity.ArtistCardEntity
import com.japanese.vocabulary.rewardcard.entity.SongCardEntity
import com.japanese.vocabulary.rewardcard.model.ArtistCardGrade
import com.japanese.vocabulary.rewardcard.model.RewardCardKind
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.rewardcard.repository.ArtistCardRepository
import com.japanese.vocabulary.rewardcard.repository.RewardCardSeqAllocator
import com.japanese.vocabulary.rewardcard.repository.SongCardRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.util.SortedSet

/**
 * 곡·아티스트 카드의 달성과 발급. 달성(행 생성·등급 오름)은 rating 트랜잭션 안에서 일어나고,
 * 발급(서명)과 연출 확인은 앱이 연출을 마친 뒤 따로 부른다.
 */
@Service
class RewardCardService(
    private val songCardRepository: SongCardRepository,
    private val artistCardRepository: ArtistCardRepository,
    private val seqAllocator: RewardCardSeqAllocator,
    private val clock: Clock,
) {

    @Transactional(readOnly = true)
    fun songGrades(userId: Long, songIds: Collection<Long>): Map<Long, SongCardGrade> =
        if (songIds.isEmpty()) emptyMap()
        else songCardRepository.findByUserIdAndSongIdIn(userId, songIds).associate { it.songId to it.grade }

    /**
     * 곡 카드들을 각자의 등급까지 올린다(없으면 만든다). 그 결과 생긴 연출을 곡 카드들 → 아티스트 카드들 순으로 돌려준다.
     * 곡 카드가 새로 생기거나, 처음 아티스트를 갖거나, 마스터가 되면 그 아티스트 카드를 맞춘다.
     *
     * 순번 행 락은 곡 id → 아티스트 id 오름차순으로만 잡는다. 카드 여러 장을 함께 만드는 rating 끼리 서로의 락을 엇갈려 기다리지 않게.
     */
    @Transactional
    fun achieveSongs(userId: Long, achievements: List<SongAchievementDto>): List<RewardCardRevealDto> {
        if (achievements.isEmpty()) return emptyList()
        val now = Instant.now(clock)
        val existing = songCardRepository.findByUserIdAndSongIdIn(userId, achievements.map { it.songId }).associateBy { it.songId }
        val reveals = mutableListOf<RewardCardRevealDto>()
        val artistIds = sortedSetOf<Long>()
        for (achievement in achievements.sortedBy { it.songId }) {
            val card = existing[achievement.songId]
            if (card == null) {
                val created = songCardRepository.save(
                    SongCardEntity(
                        userId = userId,
                        songId = achievement.songId,
                        artistId = achievement.artistId,
                        grade = achievement.grade,
                        acquiredSeq = seqAllocator.next(RewardCardKind.SONG, achievement.songId),
                        masteredAt = now.takeIf { achievement.grade == SongCardGrade.MASTER },
                        createdAt = now,
                    )
                )
                reveals += created.toReveal()
                created.artistId?.let { artistIds += it }
                continue
            }
            val raised = card.raiseTo(achievement.grade, now)
            if (raised) reveals += card.toReveal()
            // 곡의 아티스트 연결은 분석 뒤 배치가 하므로, 카드가 먼저 생겼으면 연결된 뒤의 rating 에서 잇는다.
            val linked = card.artistId == null && achievement.artistId != null
            if (linked) card.artistId = achievement.artistId
            val justMastered = raised && card.grade == SongCardGrade.MASTER
            val artistId = card.artistId
            if (artistId != null && (linked || justMastered)) artistIds += artistId
        }
        return reveals + syncArtistCards(userId, artistIds, now)
    }

    @Transactional(readOnly = true)
    fun pending(userId: Long): List<RewardCardRevealDto> =
        songCardRepository.findPending(userId).map { it.toReveal() } +
            artistCardRepository.findPending(userId).map { it.toReveal() }

    @Transactional(readOnly = true)
    fun songCards(userId: Long): List<SongCardDto> =
        songCardRepository.findByUserIdOrderByCreatedAtDesc(userId).map { it.toDto() }

    @Transactional(readOnly = true)
    fun artistCards(userId: Long): List<ArtistCardDto> =
        artistCardRepository.findByUserIdOrderByCreatedAtDesc(userId).map { it.toDto() }

    @Transactional
    fun issueSongCard(userId: Long, songId: Long, signature: List<String>, lyricLineIndexes: List<Int>): SongCardDto {
        validateSignature(signature)
        validateLyricLineIndexes(lyricLineIndexes, allowEmpty = true)
        return songCard(userId, songId).apply { issue(signature, lyricLineIndexes) }.toDto()
    }

    @Transactional
    fun issueArtistCard(userId: Long, artistId: Long, signature: List<String>): ArtistCardDto {
        validateSignature(signature)
        return artistCard(userId, artistId).apply { issue(signature) }.toDto()
    }

    @Transactional
    fun markSongCardSeen(userId: Long, songId: Long, grade: SongCardGrade): SongCardDto =
        songCard(userId, songId).apply { markSeen(grade) }.toDto()

    @Transactional
    fun markArtistCardSeen(userId: Long, artistId: Long, grade: ArtistCardGrade): ArtistCardDto =
        artistCard(userId, artistId).apply { markSeen(grade) }.toDto()

    @Transactional
    fun updateSongCardLyric(userId: Long, songId: Long, lyricLineIndexes: List<Int>): SongCardDto {
        validateLyricLineIndexes(lyricLineIndexes, allowEmpty = false)
        val card = songCard(userId, songId)
        if (!card.isIssued) throw BusinessException(ErrorCode.REWARD_CARD_NOT_ISSUED)
        card.lyricLineIndexes = lyricLineIndexes
        return card.toDto()
    }

    /** [artistIds] 는 오름차순이어야 한다. 곡 카드 변경이 먼저 flush 돼 이번에 마스터한 곡도 센다. */
    private fun syncArtistCards(userId: Long, artistIds: SortedSet<Long>, now: Instant): List<RewardCardRevealDto> {
        if (artistIds.isEmpty()) return emptyList()
        val masterCounts = songCardRepository.countMasteredByArtist(userId, artistIds).associate { it.artistId to it.count }
        val existing = artistCardRepository.findByUserIdAndArtistIdIn(userId, artistIds).associateBy { it.artistId }
        return artistIds.mapNotNull { artistId ->
            val target = ArtistCardGrade.forMasterCount((masterCounts[artistId] ?: 0L).toInt())
            val card = existing[artistId]
            if (card == null) {
                artistCardRepository.save(
                    ArtistCardEntity(
                        userId = userId,
                        artistId = artistId,
                        grade = target,
                        acquiredSeq = seqAllocator.next(RewardCardKind.ARTIST, artistId),
                        createdAt = now,
                    )
                ).toReveal()
            } else if (card.raiseTo(target)) {
                card.toReveal()
            } else {
                null
            }
        }
    }

    private fun songCard(userId: Long, songId: Long) =
        songCardRepository.findByUserIdAndSongId(userId, songId)
            ?: throw BusinessException(ErrorCode.REWARD_CARD_NOT_FOUND)

    private fun artistCard(userId: Long, artistId: Long) =
        artistCardRepository.findByUserIdAndArtistId(userId, artistId)
            ?: throw BusinessException(ErrorCode.REWARD_CARD_NOT_FOUND)

    private fun SongCardEntity.toReveal() = RewardCardRevealDto(
        kind = RewardCardKind.SONG,
        targetId = songId,
        grade = grade.name,
        seenGrade = seenGrade?.name,
        acquiredSeq = acquiredSeq,
    )

    private fun ArtistCardEntity.toReveal() = RewardCardRevealDto(
        kind = RewardCardKind.ARTIST,
        targetId = artistId,
        grade = grade.name,
        seenGrade = seenGrade?.name,
        acquiredSeq = acquiredSeq,
    )

    private fun SongCardEntity.toDto() = SongCardDto(
        songId = songId,
        artistId = artistId,
        grade = grade,
        seenGrade = seenGrade,
        acquiredSeq = acquiredSeq,
        lyricLineIndexes = lyricLineIndexes,
        signature = signature,
        masteredAt = masteredAt,
        createdAt = createdAt,
    )

    private fun ArtistCardEntity.toDto() = ArtistCardDto(
        artistId = artistId,
        grade = grade,
        seenGrade = seenGrade,
        acquiredSeq = acquiredSeq,
        signature = signature,
        createdAt = createdAt,
    )

    companion object {
        const val MAX_LYRIC_LINES = 2
        const val MAX_SIGNATURE_STROKES = 200
        const val MAX_SIGNATURE_CHARS = 60_000

        private fun validateSignature(signature: List<String>) {
            val valid = signature.isNotEmpty() &&
                signature.size <= MAX_SIGNATURE_STROKES &&
                signature.all { it.isNotBlank() } &&
                signature.sumOf { it.length } <= MAX_SIGNATURE_CHARS
            if (!valid) throw BusinessException(ErrorCode.INVALID_SIGNATURE)
        }

        // 가사 줄 수 상한은 가사를 아는 api 가 따로 본다.
        private fun validateLyricLineIndexes(indexes: List<Int>, allowEmpty: Boolean) {
            val valid = (allowEmpty || indexes.isNotEmpty()) &&
                indexes.size <= MAX_LYRIC_LINES &&
                indexes.all { it >= 0 } &&
                indexes.distinct().size == indexes.size
            if (!valid) throw BusinessException(ErrorCode.INVALID_CARD_LYRIC)
        }
    }
}

package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.rewardcard.dto.ArtistCardDto
import com.japanese.vocabulary.rewardcard.dto.BackfilledCardsDto
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

    /**
     * 카드 기능 전부터 담아 둔 곡 하나를 연출 없이 발급된 카드로 채운다(서명은 비운다). 새로 만든 카드를 알려 준다.
     * batch 가 곡 단어장을 만든 순서대로 부르므로, 순번은 그 곡을 먼저 담은 유저가 앞이다.
     * 이미 있는 곡 카드는 rating 이 잰 등급이라 건드리지 않고 아티스트만 잇는다. 순번 락은 곡 → 아티스트 순서라 [achieveSongs] 와 엇갈리지 않는다.
     */
    @Transactional
    fun backfillSong(userId: Long, achievement: SongAchievementDto): BackfilledCardsDto {
        val now = Instant.now(clock)
        val existing = songCardRepository.findByUserIdAndSongId(userId, achievement.songId)
        if (existing != null) {
            if (existing.artistId == null) existing.artistId = achievement.artistId
        } else {
            songCardRepository.saveAndFlush(
                SongCardEntity(
                    userId = userId,
                    songId = achievement.songId,
                    artistId = achievement.artistId,
                    grade = achievement.grade,
                    seenGrade = achievement.grade,
                    acquiredSeq = seqAllocator.next(RewardCardKind.SONG, achievement.songId),
                    masteredAt = now.takeIf { achievement.grade == SongCardGrade.MASTER },
                    createdAt = now,
                )
            )
        }
        val artistId = existing?.artistId ?: achievement.artistId
        val newArtist = artistId != null && artistCardRepository.findByUserIdAndArtistId(userId, artistId) == null
        if (artistId != null && newArtist) {
            val masters = songCardRepository.countMasteredByArtist(userId, listOf(artistId)).sumOf { it.count }
            val grade = ArtistCardGrade.forMasterCount(masters.toInt())
            artistCardRepository.save(
                ArtistCardEntity(
                    userId = userId,
                    artistId = artistId,
                    grade = grade,
                    seenGrade = grade,
                    acquiredSeq = seqAllocator.next(RewardCardKind.ARTIST, artistId),
                    createdAt = now,
                )
            )
        }
        return BackfilledCardsDto(song = existing == null, artist = newArtist)
    }

    /**
     * 채우기 끝에 유저의 카드를 전부 연출 없이 발급한다. 구버전 앱으로 rating 해 연출을 기다리던 카드가
     * 새 앱을 켜자마자 한꺼번에 뜨지 않게. 아티스트 카드는 채운 곡까지 센 마스터 수로 올린다.
     */
    @Transactional
    fun issueAllSilently(userId: Long) {
        val songCards = songCardRepository.findByUserIdOrderByCreatedAtDesc(userId)
        songCards.forEach { it.issueSilently() }
        val artistIds = songCards.mapNotNull { it.artistId }.toSortedSet()
        if (artistIds.isEmpty()) return
        val masterCounts = songCardRepository.countMasteredByArtist(userId, artistIds).associate { it.artistId to it.count }
        for (card in artistCardRepository.findByUserIdAndArtistIdIn(userId, artistIds)) {
            card.raiseTo(ArtistCardGrade.forMasterCount((masterCounts[card.artistId] ?: 0L).toInt()))
            card.issueSilently()
        }
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

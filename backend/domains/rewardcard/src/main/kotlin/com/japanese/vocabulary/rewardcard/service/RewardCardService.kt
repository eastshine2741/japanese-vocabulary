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
 * 곡·아티스트 카드의 달성과 발급. 곡 카드는 등급마다 새로 나오고, 아티스트 카드는 아티스트마다 한 장이 강화된다.
 * 달성(행 생성·강화)은 rating 트랜잭션 안에서 일어나고, 발급(서명)은 앱이 연출을 마친 뒤 따로 부른다.
 */
@Service
class RewardCardService(
    private val songCardRepository: SongCardRepository,
    private val artistCardRepository: ArtistCardRepository,
    private val seqAllocator: RewardCardSeqAllocator,
    private val clock: Clock,
) {

    /** 곡마다 이미 받은 등급. */
    @Transactional(readOnly = true)
    fun ownedSongGrades(userId: Long, songIds: Collection<Long>): Map<Long, Set<SongCardGrade>> =
        if (songIds.isEmpty()) emptyMap()
        else songCardRepository.findByUserIdAndSongIdIn(userId, songIds)
            .groupBy({ it.songId }, { it.grade })
            .mapValues { it.value.toSet() }

    /** 아티스트마다 지금 카드 등급. */
    @Transactional(readOnly = true)
    fun artistGrades(userId: Long, artistIds: Collection<Long>): Map<Long, ArtistCardGrade> =
        if (artistIds.isEmpty()) emptyMap()
        else artistCardRepository.findByUserIdAndArtistIdIn(userId, artistIds).associate { it.artistId to it.grade }

    @Transactional(readOnly = true)
    fun masterCounts(userId: Long, artistIds: Collection<Long>): Map<Long, Int> =
        if (artistIds.isEmpty()) emptyMap()
        else songCardRepository.countMasteredByArtist(userId, artistIds).associate { it.artistId to it.count.toInt() }

    /**
     * 곡마다 잰 등급까지 아직 없는 등급의 카드를 낮은 등급부터 새로 만든다. 그 결과 생긴 연출을 곡 카드들 → 아티스트 카드들 순으로 돌려준다.
     * 곡의 첫 카드가 생기거나, 처음 아티스트를 잇거나, 마스터 카드가 생기면 그 아티스트 카드를 만들거나 강화한다.
     *
     * 순번 행 락은 (곡 id, 등급) → 아티스트 id 오름차순으로만 잡는다. 카드 여러 장을 함께 만드는 rating 끼리 서로의 락을 엇갈려 기다리지 않게.
     */
    @Transactional
    fun achieveSongs(userId: Long, achievements: List<SongAchievementDto>): List<RewardCardRevealDto> {
        val (songCards, artistChanges) = achieve(userId, achievements, silent = false)
        // 서명 전 카드가 강화되면 남아 있는 획득 연출이 오른 등급으로 뜬다.
        return songCards.map { it.toReveal() } +
            artistChanges.filter { it.created || it.card.isIssued }.map { it.card.toReveal(fromGrade = it.from) }
    }

    /**
     * 카드 기능 전부터 담아 둔 곡 하나를 연출 없이 발급된 카드로 채운다(서명은 비운다).
     * batch 가 곡 단어장을 만든 순서대로 부르므로, 같은 등급의 순번은 그 곡을 먼저 담은 유저가 앞이다.
     */
    @Transactional
    fun backfillSong(userId: Long, achievement: SongAchievementDto): BackfilledCardsDto {
        val (songCards, artistChanges) = achieve(userId, listOf(achievement), silent = true)
        return BackfilledCardsDto(songCards = songCards.size, artistCards = artistChanges.count { it.created })
    }

    /**
     * 채우기 끝에 유저의 카드를 전부 연출 없이 발급한다. 구버전 앱으로 rating 해 연출을 기다리던 카드가
     * 새 앱을 켜자마자 한꺼번에 뜨지 않게. 아티스트 카드는 채운 곡까지 센 마스터 수에 맞춘다.
     */
    @Transactional
    fun issueAllSilently(userId: Long) {
        val now = Instant.now(clock)
        val artistIds = songCardRepository.findByUserIdOrderByCreatedAtDescIdDesc(userId).mapNotNull { it.artistId }.toSortedSet()
        syncArtistCards(userId, artistIds, now, silent = true)
        songCardRepository.findByUserIdAndIssuedAtIsNullOrderById(userId).forEach { it.issueSilently(now) }
        artistCardRepository.findPendingByUserId(userId).forEach { it.issueSilently(now) }
    }

    /** 유저마다 채우기로 카드가 생긴 곡을 채운 순서로, 곡마다 채운 가장 높은 등급과 함께. */
    @Transactional(readOnly = true)
    fun backfilledSongs(): Map<Long, List<SongAchievementDto>> =
        songCardRepository.findBackfilled().groupBy { it.userId }.mapValues { (_, cards) ->
            cards.groupBy { it.songId }.map { (songId, songCards) ->
                SongAchievementDto(songId, songCards.firstNotNullOfOrNull { it.artistId }, songCards.maxOf { it.grade })
            }
        }

    @Transactional(readOnly = true)
    fun songCardCount(userId: Long, songId: Long): Int = songCardRepository.countByUserIdAndSongId(userId, songId).toInt()

    /**
     * 곡 학습을 그만두면 그 곡 카드를 모두 지운다. 남겨 두면 복습할 단어가 사라져 낡지 않는 카드가 된다.
     * 아티스트 카드는 줄어든 마스터 곡 수에 맞춰 등급을 내리고, 팬 번호는 남겨 다시 BRONZE 에 닿으면 같은 번호를 쓴다.
     */
    @Transactional
    fun removeSongCards(userId: Long, songId: Long) {
        val cards = songCardRepository.findByUserIdAndSongIdIn(userId, listOf(songId))
        if (cards.isEmpty()) return
        songCardRepository.deleteAll(cards)
        songCardRepository.flush()
        val artistId = cards.firstNotNullOfOrNull { it.artistId } ?: return
        val card = artistCardRepository.findByUserIdAndArtistIdIn(userId, listOf(artistId)).singleOrNull() ?: return
        card.downgrade(ArtistCardGrade.forMasterCount(masterCounts(userId, listOf(artistId))[artistId] ?: 0))
    }

    @Transactional(readOnly = true)
    fun pending(userId: Long): List<RewardCardRevealDto> =
        songCardRepository.findByUserIdAndIssuedAtIsNullOrderById(userId).map { it.toReveal() } +
            artistCardRepository.findPendingByUserId(userId).map { it.toReveal(fromGrade = if (it.isIssued) it.seenGrade ?: ArtistCardGrade.BASIC else null) }

    /** 최근 획득순. */
    @Transactional(readOnly = true)
    fun songCards(userId: Long): List<SongCardDto> =
        songCardRepository.findByUserIdOrderByCreatedAtDescIdDesc(userId).map { it.toDto() }

    /** 최근 획득순. */
    @Transactional(readOnly = true)
    fun artistCards(userId: Long): List<ArtistCardDto> =
        artistCardRepository.findByUserIdOrderByCreatedAtDescIdDesc(userId).map { it.toDto() }

    @Transactional(readOnly = true)
    fun songCard(userId: Long, cardId: Long): SongCardDto = songCardEntity(userId, cardId).toDto()

    @Transactional
    fun issueSongCard(userId: Long, cardId: Long, signature: List<String>, lyricLineIndexes: List<Int>): SongCardDto {
        validateSignature(signature)
        validateLyricLineIndexes(lyricLineIndexes, allowEmpty = true)
        return songCardEntity(userId, cardId).apply { issue(signature, lyricLineIndexes, Instant.now(clock)) }.toDto()
    }

    @Transactional
    fun issueArtistCard(userId: Long, cardId: Long, signature: List<String>): ArtistCardDto {
        validateSignature(signature)
        val card = artistCardRepository.findByIdAndUserId(cardId, userId) ?: throw BusinessException(ErrorCode.REWARD_CARD_NOT_FOUND)
        return card.apply { issue(signature, Instant.now(clock)) }.toDto()
    }

    /** 강화 연출을 [grade] 까지 봤다. */
    @Transactional
    fun markArtistCardSeen(userId: Long, cardId: Long, grade: ArtistCardGrade) {
        val card = artistCardRepository.findByIdAndUserId(cardId, userId) ?: throw BusinessException(ErrorCode.REWARD_CARD_NOT_FOUND)
        card.markSeen(grade)
    }

    @Transactional
    fun updateSongCardLyric(userId: Long, cardId: Long, lyricLineIndexes: List<Int>): SongCardDto {
        validateLyricLineIndexes(lyricLineIndexes, allowEmpty = false)
        val card = songCardEntity(userId, cardId)
        if (!card.isIssued) throw BusinessException(ErrorCode.REWARD_CARD_NOT_ISSUED)
        card.lyricLineIndexes = lyricLineIndexes
        return card.toDto()
    }

    /** 새로 만든 곡 카드들(곡 id·등급 순)과 새로 만들거나 강화한 아티스트 카드들(아티스트 id 순). */
    private fun achieve(
        userId: Long,
        achievements: List<SongAchievementDto>,
        silent: Boolean,
    ): Pair<List<SongCardEntity>, List<ArtistCardChange>> {
        if (achievements.isEmpty()) return emptyList<SongCardEntity>() to emptyList()
        val now = Instant.now(clock)
        val existing = songCardRepository.findByUserIdAndSongIdIn(userId, achievements.map { it.songId }).groupBy { it.songId }
        val created = mutableListOf<SongCardEntity>()
        val artistIds = sortedSetOf<Long>()
        for (achievement in achievements.sortedBy { it.songId }) {
            val cards = existing[achievement.songId].orEmpty()
            // 곡의 아티스트 연결은 분석 뒤 배치가 하므로, 카드가 먼저 생겼으면 연결된 뒤의 rating 에서 잇는다.
            val linked = achievement.artistId != null && cards.any { it.artistId == null }
            if (linked) cards.filter { it.artistId == null }.forEach { it.artistId = achievement.artistId }
            val artistId = cards.firstNotNullOfOrNull { it.artistId } ?: achievement.artistId
            val owned = cards.map { it.grade }.toSet()
            val newCards = SongCardGrade.entries.filter { it <= achievement.grade && it !in owned }.map { grade ->
                songCardRepository.save(
                    SongCardEntity(
                        userId = userId,
                        songId = achievement.songId,
                        artistId = artistId,
                        grade = grade,
                        acquiredSeq = seqAllocator.next(RewardCardKind.SONG, achievement.songId, grade.name),
                        issuedAt = now.takeIf { silent },
                        createdAt = now,
                    )
                )
            }
            created += newCards
            if (artistId != null && (linked || newCards.isNotEmpty())) artistIds += artistId
        }
        songCardRepository.flush()
        return created to syncArtistCards(userId, artistIds, now, silent)
    }

    /**
     * [artistIds] 는 오름차순이어야 한다. 곡 카드가 먼저 flush 돼 이번에 마스터한 곡도 센다.
     * 팬 번호는 BRONZE 에 처음 닿을 때 매긴다 — 기본 카드는 단어 하나로 받아 팬이라 부르기엔 가볍다.
     */
    private fun syncArtistCards(userId: Long, artistIds: SortedSet<Long>, now: Instant, silent: Boolean): List<ArtistCardChange> {
        val masterCounts = masterCounts(userId, artistIds)
        val existing = artistCardRepository.findByUserIdAndArtistIdIn(userId, artistIds).associateBy { it.artistId }
        return artistIds.mapNotNull { artistId ->
            val target = ArtistCardGrade.forMasterCount(masterCounts[artistId] ?: 0)
            val card = existing[artistId]
            val change = when {
                card == null -> ArtistCardChange(
                    artistCardRepository.save(ArtistCardEntity(userId = userId, artistId = artistId, grade = target, createdAt = now)),
                    from = null,
                    created = true,
                )
                target > card.grade -> ArtistCardChange(card, from = card.seenGrade ?: card.grade, created = false).also { card.upgrade(target) }
                else -> return@mapNotNull null
            }
            if (change.card.fanNo == null && target >= ArtistCardGrade.BRONZE) {
                change.card.fanNo = seqAllocator.next(RewardCardKind.ARTIST, artistId, ArtistCardGrade.BRONZE.name)
            }
            if (silent) change.card.issueSilently(now)
            change
        }
    }

    /** [from] 은 강화 전에 유저가 본 등급. 새로 만든 카드면 null. */
    private class ArtistCardChange(val card: ArtistCardEntity, val from: ArtistCardGrade?, val created: Boolean)

    private fun songCardEntity(userId: Long, cardId: Long) =
        songCardRepository.findByIdAndUserId(cardId, userId) ?: throw BusinessException(ErrorCode.REWARD_CARD_NOT_FOUND)

    private fun SongCardEntity.toReveal() = RewardCardRevealDto(
        kind = RewardCardKind.SONG,
        cardId = id!!,
        targetId = songId,
        grade = grade.name,
        acquiredSeq = acquiredSeq,
    )

    private fun ArtistCardEntity.toReveal(fromGrade: ArtistCardGrade?) = RewardCardRevealDto(
        kind = RewardCardKind.ARTIST,
        cardId = id!!,
        targetId = artistId,
        grade = grade.name,
        acquiredSeq = shownFanNo,
        fromGrade = fromGrade?.name,
    )

    private fun SongCardEntity.toDto() = SongCardDto(
        id = id!!,
        songId = songId,
        artistId = artistId,
        grade = grade,
        acquiredSeq = acquiredSeq,
        lyricLineIndexes = lyricLineIndexes,
        signature = signature,
        issued = isIssued,
        createdAt = createdAt,
    )

    private fun ArtistCardEntity.toDto() = ArtistCardDto(
        id = id!!,
        artistId = artistId,
        grade = grade,
        fanNo = shownFanNo,
        signature = signature,
        issued = isIssued,
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

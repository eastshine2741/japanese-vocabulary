package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.rewardcard.dto.ArtistCardDto
import com.japanese.vocabulary.rewardcard.dto.ArtistCardResponse
import com.japanese.vocabulary.rewardcard.dto.MasteredSongResponse
import com.japanese.vocabulary.rewardcard.dto.RewardCardsResponse
import com.japanese.vocabulary.rewardcard.dto.SongCardDto
import com.japanese.vocabulary.rewardcard.dto.SongCardResponse
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.song.dto.songdetail.SongLyricLineDto
import com.japanese.vocabulary.song.entity.ArtistEntity
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.repository.ArtistRepository
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.songdetail.SongDetailQueryService
import com.japanese.vocabulary.word.model.SongTierCards
import com.japanese.vocabulary.word.service.songword.SongTierCardService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant

@Service
class RewardCardQueryService(
    private val rewardCardService: RewardCardService,
    private val songRepository: SongRepository,
    private val artistRepository: ArtistRepository,
    private val lyricRepository: LyricRepository,
    private val songDetailQueryService: SongDetailQueryService,
    private val songTierCardService: SongTierCardService,
    private val clock: Clock,
) {
    /** 카드 수와 상관없이 곡·아티스트·가사·유저 단어·flashcard 를 한 번씩만 조회한다. */
    @Transactional(readOnly = true)
    fun cards(userId: Long): RewardCardsResponse {
        val now = Instant.now(clock)
        val songCards = rewardCardService.songCards(userId)
        val songs = songRepository.findAllById(songCards.map { it.songId }.toSet()).associateBy { it.id!! }
        val lyrics = if (songs.isEmpty()) emptyList() else lyricRepository.findActiveBySongIdIn(songs.keys)
        val lines = lyrics.associate { it.songId to songDetailQueryService.lyricLines(it) }
        val tierCards = songTierCardService.tierCards(userId, lyrics)
        val topGrades = topGrades(songCards)
        val artistCards = rewardCardService.artistCards(userId)
        val artists = artistRepository.findAllById(artistCards.map { it.artistId }.toSet()).associateBy { it.id!! }
        val masteredByArtist = masteredByArtist(songCards)

        return RewardCardsResponse(
            songCards = songCards.mapNotNull { card ->
                songs[card.songId]?.let {
                    songCard(card, topGrades.getValue(card.songId), it, lines[card.songId].orEmpty(), tierCards[card.songId], now)
                }
            },
            artistCards = artistCards.mapNotNull { card ->
                artists[card.artistId]?.let { artistCard(card, it, masteredByArtist[card.artistId].orEmpty(), songs) }
            },
        )
    }

    /** 공유 링크로 남의 카드 한 장을 볼 때. [cards] 와 같은 모양이다. */
    @Transactional(readOnly = true)
    fun songCard(userId: Long, cardId: Long): SongCardResponse? {
        val songCards = rewardCardService.songCards(userId)
        val card = songCards.firstOrNull { it.id == cardId } ?: return null
        val song = songRepository.findById(card.songId).orElse(null) ?: return null
        val lyric = lyricRepository.findActiveBySongId(card.songId)
        val lines = lyric?.let { songDetailQueryService.lyricLines(it) }.orEmpty()
        val tierCards = lyric?.let { songTierCardService.tierCards(userId, listOf(it))[card.songId] }
        return songCard(card, topGrades(songCards).getValue(card.songId), song, lines, tierCards, Instant.now(clock))
    }

    @Transactional(readOnly = true)
    fun artistCard(userId: Long, cardId: Long): ArtistCardResponse? {
        val card = rewardCardService.artistCards(userId).firstOrNull { it.id == cardId } ?: return null
        val artist = artistRepository.findById(card.artistId).orElse(null) ?: return null
        val mastered = masteredByArtist(rewardCardService.songCards(userId))[card.artistId].orEmpty()
        val songs = songRepository.findAllById(mastered.map { it.songId }).associateBy { it.id!! }
        return artistCard(card, artist, mastered, songs)
    }

    /** 고른 줄이 그 곡의 가사 줄인지. 줄 수·중복 검사는 [RewardCardService] 가 한다. */
    @Transactional(readOnly = true)
    fun validateLyricLines(songId: Long, lyricLineIndexes: List<Int>) {
        if (lyricLineIndexes.isEmpty()) return
        val lines = lyricRepository.findActiveBySongId(songId)?.rawContent.orEmpty().map { it.index }.toSet()
        if (!lines.containsAll(lyricLineIndexes)) throw BusinessException(ErrorCode.INVALID_CARD_LYRIC)
    }

    /** 곡마다 받은 가장 높은 등급. 다음 등급 진행은 카드가 아니라 곡의 것이다. */
    private fun topGrades(songCards: List<SongCardDto>): Map<Long, SongCardGrade> =
        songCards.groupBy { it.songId }.mapValues { (_, cards) -> cards.maxOf { it.grade } }

    /** 아티스트마다 마스터 카드를 받은 순서대로. */
    private fun masteredByArtist(songCards: List<SongCardDto>): Map<Long, List<SongCardDto>> =
        songCards
            .filter { it.grade == SongCardGrade.MASTER && it.artistId != null }
            .sortedWith(compareBy({ it.createdAt }, { it.id }))
            .groupBy { it.artistId!! }

    private fun songCard(
        card: SongCardDto,
        topGrade: SongCardGrade,
        song: SongEntity,
        lines: List<SongLyricLineDto>,
        tierCards: SongTierCards?,
        now: Instant,
    ): SongCardResponse {
        val tiers = tierCards?.tiers?.values?.map { tier -> tier.map { it.second } }.orEmpty()
        return SongCardResponse(
            id = card.id,
            songId = card.songId,
            title = song.title,
            artist = song.artist,
            artworkUrl = song.artworkUrl,
            artistId = card.artistId,
            grade = card.grade,
            acquiredSeq = card.acquiredSeq,
            lyricLineIndexes = card.lyricLineIndexes,
            lyric = SongCardFace.lyric(lines, card.lyricLineIndexes),
            words = tierCards?.let { SongCardFace.words(it.words.words) }.orEmpty(),
            recall = SongCardFace.recall(tiers, card.createdAt, now),
            nextGoal = SongCardFace.nextGoal(topGrade, tiers),
            signature = card.signature,
            issued = card.issued,
            createdAt = card.createdAt,
        )
    }

    /** [mastered] 는 마스터한 순서다. 지난 재질의 카드는 다음 재질에 닿기 전까지의 곡만 싣는다. */
    private fun artistCard(card: ArtistCardDto, artist: ArtistEntity, mastered: List<SongCardDto>, songs: Map<Long, SongEntity>) =
        ArtistCardResponse(
            id = card.id,
            artistId = card.artistId,
            name = artist.name,
            artworkUrl = artist.artworkUrl,
            grade = card.grade,
            acquiredSeq = card.acquiredSeq,
            signature = card.signature,
            issued = card.issued,
            masteredSongs = mastered
                .take(card.grade.next?.let { it.minMasterCount - 1 } ?: mastered.size)
                .mapNotNull { master ->
                    songs[master.songId]?.let { MasteredSongResponse(songId = master.songId, title = it.title, artworkUrl = it.artworkUrl) }
                },
            createdAt = card.createdAt,
        )
}

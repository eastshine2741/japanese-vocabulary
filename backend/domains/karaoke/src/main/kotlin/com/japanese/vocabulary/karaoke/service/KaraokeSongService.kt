package com.japanese.vocabulary.karaoke.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.karaoke.dto.KaraokeDailyGroupDto
import com.japanese.vocabulary.karaoke.dto.KaraokeMonthlyDto
import com.japanese.vocabulary.karaoke.dto.KaraokeSongDto
import com.japanese.vocabulary.karaoke.dto.KaraokeSongRegistration
import com.japanese.vocabulary.karaoke.dto.toDto
import com.japanese.vocabulary.karaoke.entity.KaraokeSongEntity
import com.japanese.vocabulary.karaoke.entity.KaraokeVendor
import com.japanese.vocabulary.karaoke.repository.KaraokeSongRepository
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import org.slf4j.LoggerFactory
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.YearMonth

@Service
class KaraokeSongService(
    private val karaokeSongRepository: KaraokeSongRepository,
    private val songRepository: SongRepository,
    private val lyricRepository: LyricRepository,
    private val songAnalysisWorkService: SongAnalysisWorkService,
) {
    private val logger = LoggerFactory.getLogger(KaraokeSongService::class.java)

    @Transactional(readOnly = true)
    fun registeredNumbers(vendor: KaraokeVendor, numbers: Collection<Int>): Set<Int> =
        if (numbers.isEmpty()) emptySet()
        else karaokeSongRepository.findAllByVendorAndNumberIn(vendor, numbers).map { it.number }.toSet()

    /**
     * 행을 먼저 남기고 분석을 요청한다. 분석 요청이 실패해도 행은 남아 목록과 푸시에 나간다.
     * 트랜잭션을 묶지 않는 이유: 분석 요청의 중복 충돌은 그 트랜잭션을 통째로 롤백시킨다.
     */
    fun register(registration: KaraokeSongRegistration): KaraokeSongDto? {
        val analyzedSongId = findAnalyzedSongId(registration.title, registration.artist)
        val saved = try {
            karaokeSongRepository.saveAndFlush(
                KaraokeSongEntity(
                    vendor = registration.vendor,
                    number = registration.number,
                    title = registration.title,
                    artist = registration.artist,
                    artworkUrl = registration.artworkUrl,
                    listedOn = registration.listedOn,
                    songId = analyzedSongId,
                )
            )
        } catch (_: DataIntegrityViolationException) {
            return null
        }
        // 이미 분석된 곡을 다시 돌리면 COMPLETE 가 활성 가사를 갈아 끼운다.
        if (analyzedSongId == null) requestAnalysis(registration)
        return saved.toDto()
    }

    /** 분석이 끝난 곡을 아직 연결되지 않은 같은 이름의 행에 잇는다. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun linkCompleted(songId: Long): Int {
        val song = songRepository.findById(songId).orElse(null) ?: return 0
        val rows = karaokeSongRepository.findAllBySongIdIsNullAndTitleAndArtist(song.title, song.artist)
        rows.forEach { it.songId = songId }
        return rows.size
    }

    /** 완료 이벤트를 놓친 행을 다시 잇는다. */
    @Transactional
    fun backfillLinks(): Int {
        val rows = karaokeSongRepository.findAllBySongIdIsNull()
        var linked = 0
        rows.groupBy { it.title to it.artist }.forEach { (key, same) ->
            val songId = findAnalyzedSongId(key.first, key.second) ?: return@forEach
            same.forEach { it.songId = songId }
            linked += same.size
        }
        return linked
    }

    @Transactional(readOnly = true)
    fun findUnnotified(): List<KaraokeSongDto> =
        karaokeSongRepository.findAllByNotifiedAtIsNullOrderByIdAsc().map { it.toDto() }

    @Transactional
    fun markNotified(ids: Collection<Long>, at: Instant) {
        karaokeSongRepository.findAllById(ids).forEach { it.notifiedAt = at }
    }

    @Transactional(readOnly = true)
    fun daily(month: YearMonth): List<KaraokeDailyGroupDto> = KaraokeSongMerger.daily(rowsIn(month))

    @Transactional(readOnly = true)
    fun monthly(month: YearMonth): KaraokeMonthlyDto = KaraokeSongMerger.monthly(month, rowsIn(month))

    private fun rowsIn(month: YearMonth): List<KaraokeSongDto> =
        karaokeSongRepository.findAllByListedOnBetweenOrderByListedOnDescIdAsc(month.atDay(1), month.atEndOfMonth())
            .map { it.toDto() }

    private fun requestAnalysis(registration: KaraokeSongRegistration) {
        try {
            songAnalysisWorkService.createOrReuse(
                title = registration.title,
                artist = registration.artist,
                durationSeconds = registration.durationSeconds,
                artworkUrl = registration.artworkUrl,
                triggerSource = SongAnalysisTriggerSource.KARAOKE,
                createdByUserId = null,
            )
        } catch (e: BusinessException) {
            if (e.errorCode != ErrorCode.SONG_ANALYSIS_WORK_ALREADY_EXISTS) throw e
        } catch (e: Exception) {
            logger.warn("Karaoke song analysis request failed vendor={} number={}", registration.vendor, registration.number, e)
        }
    }

    private fun findAnalyzedSongId(title: String, artist: String): Long? {
        val songId = songRepository.findByArtistAndTitle(artist, title)?.id ?: return null
        val lyric = lyricRepository.findActiveBySongId(songId) ?: return null
        return songId.takeIf { lyric.analyzedContent != null }
    }
}

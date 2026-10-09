package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.song.service.SongAnalysisPreparationService
import com.japanese.vocabulary.song.service.SongAnalysisPreparationService.PreparedLyric
import com.japanese.vocabulary.songanalysis.dto.ClaimedSongAnalysisStage
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * CREATE_SONG_AND_LYRIC. 곡·가사 생성과 단계 완료가 한 트랜잭션이다 — 생성 뒤 완료 전에 worker 가
 * 죽어서 다른 worker 가 이 단계를 다시 돌려도 앞의 생성은 커밋되지 않았으므로 중복 곡이 생기지 않는다.
 * 펜스에 걸리면 던져서 생성까지 롤백한다.
 */
@Service
class SongAnalysisSongCreator(
    private val preparationService: SongAnalysisPreparationService,
    private val workService: SongAnalysisWorkService,
    private val codec: SongAnalysisStageCodec,
) {
    @Transactional
    fun create(claimed: ClaimedSongAnalysisStage, preparedLyric: PreparedLyric, youtubeUrl: String?) {
        val work = claimed.work
        val created = if (work.triggerSource == SongAnalysisTriggerSource.ADMIN && work.songId != null) {
            preparationService.createReplacementLyricForSong(work.songId!!, preparedLyric)
        } else {
            preparationService.saveSongAndLyric(
                title = work.rawTitle,
                artist = work.rawArtist,
                durationSeconds = work.durationSeconds,
                artworkUrl = work.artworkUrl,
                youtubeUrl = youtubeUrl,
                preparedLyric = preparedLyric,
            )
        }
        val songId = requireNotNull(created.song.id)
        val lyricId = requireNotNull(created.lyric.id)
        val current = workService.attachPlayerReady(claimed.ref, songId, lyricId, youtubeUrl) &&
            workService.completeStage(claimed.ref, codec.write(CreateSongAndLyricOutput(songId, lyricId)))
        if (!current) throw SongAnalysisStageSupersededException(claimed.ref)
    }
}

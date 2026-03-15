package com.japanese.vocabulary.song.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.song.client.LyricsNotFoundException
import com.japanese.vocabulary.song.client.lrclib.LrclibClient
import com.japanese.vocabulary.song.client.vocadb.VocadbClient
import com.japanese.vocabulary.song.client.youtube.YoutubeClient
import com.japanese.vocabulary.song.dto.*
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.parser.LrcParser
import com.japanese.vocabulary.song.client.gemini.dto.KoreanLyricLine
import com.japanese.vocabulary.song.entity.KoreanLyricEntity
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.repository.KoreanLyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import org.springframework.stereotype.Service

@Service
class LyricProcessingService(
    private val lrclibClient: LrclibClient,
    private val vocadbClient: VocadbClient,
    private val lrcParser: LrcParser,
    private val morphologicalAnalyzer: MorphologicalAnalyzer,
    private val songRepository: SongRepository,
    private val objectMapper: ObjectMapper,
    private val youtubeClient: YoutubeClient,
    private val recentSongService: RecentSongService,
    private val koreanLyricRepository: KoreanLyricRepository
) {

    fun analyze(title: String, artist: String, durationSeconds: Int?, artworkUrl: String? = null, userId: Long? = null): SongDTO {
        // Check if already exists in DB
        songRepository.findByArtistAndTitle(artist, title)?.let {
            if (userId != null) {
                recentSongService.recordListen(userId, it.id!!)
            }
            return buildResponseFromEntity(it)
        }

        // Fetch lyrics from LRCLIB, fallback to VocaDB
        val lyricsResult = try {
            lrclibClient.getLyrics(title, artist, durationSeconds)
        } catch (e: LyricsNotFoundException) {
            vocadbClient.searchLyrics(title, artist)
                ?: throw e
        }

        // Parse lyrics
        val parsedLines = lrcParser.parse(lyricsResult.lyrics, lyricsResult.isSynced)

        // Analyze each line with morphological analyzer
        val studyUnits = mutableListOf<StudyUnit>()
        val allVocabulary = mutableListOf<VocabularyData>()
        val seenWords = mutableSetOf<String>()

        parsedLines.forEach { line ->
            val tokens = morphologicalAnalyzer.analyze(line.text)

            val tokenDtos = tokens.map { token ->
                Token(
                    surface = token.surface,
                    baseForm = token.baseForm,
                    reading = token.reading,
                    partOfSpeech = token.partOfSpeech,
                    charStart = token.charStart,
                    charEnd = token.charEnd
                )
            }

            studyUnits.add(
                StudyUnit(
                    index = line.index,
                    originalText = line.text,
                    startTimeMs = line.startTimeMs,
                    tokens = tokenDtos
                )
            )

            // Collect unique vocabulary
            tokens.forEach { token ->
                val key = "${token.baseForm}:${token.partOfSpeech}"
                if (seenWords.add(key)) {
                    allVocabulary.add(
                        VocabularyData(
                            surface = token.surface,
                            baseForm = token.baseForm,
                            reading = token.reading,
                            partOfSpeech = token.partOfSpeech,
                            sourceLineIndex = line.index,
                            charStart = token.charStart,
                            charEnd = token.charEnd
                        )
                    )
                }
            }
        }

        // Prepare JSON content for storage
        val lyricLineData = parsedLines.map { line ->
            LyricLineData(
                index = line.index,
                startTimeMs = line.startTimeMs,
                text = line.text
            )
        }

        // Fetch YouTube MV URL
        val youtubeUrl = try {
            youtubeClient.searchMvUrl(title, artist)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }

        // Save to database
        val songEntity = SongEntity(
            title = title,
            artist = artist,
            durationSeconds = durationSeconds,
            lyricType = if (lyricsResult.isSynced) LyricType.SYNCED else LyricType.PLAIN,
            lyricContent = objectMapper.writeValueAsString(lyricLineData),
            vocabularyContent = objectMapper.writeValueAsString(allVocabulary),
            lrclibId = lyricsResult.lrclibId,
            vocadbId = lyricsResult.vocadbId,
            youtubeUrl = youtubeUrl,
            artworkUrl = artworkUrl
        )

        val savedSong = songRepository.save(songEntity)

        // Create PENDING korean lyric entry for async translation
        koreanLyricRepository.save(KoreanLyricEntity(songId = savedSong.id!!))

        if (userId != null) {
            recentSongService.recordListen(userId, savedSong.id!!)
        }

        // Build response
        val vocabularyCandidates = allVocabulary.map { vocab ->
            VocabularyCandidate(
                word = vocab.surface,
                reading = vocab.reading,
                baseForm = vocab.baseForm,
                partOfSpeech = vocab.partOfSpeech,
                sourceLineIndex = vocab.sourceLineIndex
            )
        }

        return SongDTO(
            song = SongInfo(
                id = savedSong.id!!,
                title = savedSong.title,
                artist = savedSong.artist,
                lyricType = savedSong.lyricType.name
            ),
            studyUnits = studyUnits,
            vocabularyCandidates = vocabularyCandidates,
            youtubeUrl = savedSong.youtubeUrl
        )
    }

    fun buildSongDTO(entity: SongEntity): SongDTO = buildResponseFromEntity(entity)

    private fun buildResponseFromEntity(entity: SongEntity): SongDTO {
        val lyricLines: List<LyricLineData> = objectMapper.readValue(
            entity.lyricContent,
            objectMapper.typeFactory.constructCollectionType(List::class.java, LyricLineData::class.java)
        )

        val vocabularyData: List<VocabularyData> = objectMapper.readValue(
            entity.vocabularyContent,
            objectMapper.typeFactory.constructCollectionType(List::class.java, VocabularyData::class.java)
        )

        // Load Korean lyrics if available
        val koreanLyricMap = koreanLyricRepository.findBySongId(entity.id!!)
            ?.takeIf { it.status == KoreanLyricStatus.COMPLETED && it.content != null }
            ?.let { koreanLyric ->
                val lines: List<KoreanLyricLine> = objectMapper.readValue(
                    koreanLyric.content,
                    objectMapper.typeFactory.constructCollectionType(List::class.java, KoreanLyricLine::class.java)
                )
                lines.associateBy { it.index }
            } ?: emptyMap()

        // Re-analyze to get tokens for study units
        val studyUnits = lyricLines.map { line ->
            val tokens = morphologicalAnalyzer.analyze(line.text)
            val korean = koreanLyricMap[line.index]
            StudyUnit(
                index = line.index,
                originalText = line.text,
                startTimeMs = line.startTimeMs,
                tokens = tokens.map { token ->
                    Token(
                        surface = token.surface,
                        baseForm = token.baseForm,
                        reading = token.reading,
                        partOfSpeech = token.partOfSpeech,
                        charStart = token.charStart,
                        charEnd = token.charEnd
                    )
                },
                koreanLyrics = korean?.koreanLyrics,
                koreanPronounciation = korean?.koreanPronounciation
            )
        }

        val vocabularyCandidates = vocabularyData.map { vocab ->
            VocabularyCandidate(
                word = vocab.surface,
                reading = vocab.reading,
                baseForm = vocab.baseForm,
                partOfSpeech = vocab.partOfSpeech,
                sourceLineIndex = vocab.sourceLineIndex
            )
        }

        return SongDTO(
            song = SongInfo(
                id = entity.id!!,
                title = entity.title,
                artist = entity.artist,
                lyricType = entity.lyricType.name
            ),
            studyUnits = studyUnits,
            vocabularyCandidates = vocabularyCandidates,
            youtubeUrl = entity.youtubeUrl
        )
    }
}

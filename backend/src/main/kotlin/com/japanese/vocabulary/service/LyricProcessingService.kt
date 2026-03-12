package com.japanese.vocabulary.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.client.LrclibClient
import com.japanese.vocabulary.client.LyricsNotFoundException
import com.japanese.vocabulary.client.VocadbClient
import com.japanese.vocabulary.client.YoutubeClient
import com.japanese.vocabulary.entity.LyricType
import com.japanese.vocabulary.entity.SongEntity
import com.japanese.vocabulary.model.*
import com.japanese.vocabulary.parser.LrcParser
import com.japanese.vocabulary.repository.SongRepository
import org.springframework.stereotype.Service

@Service
class LyricProcessingService(
    private val lrclibClient: LrclibClient,
    private val vocadbClient: VocadbClient,
    private val lrcParser: LrcParser,
    private val morphologicalAnalyzer: MorphologicalAnalyzer,
    private val songRepository: SongRepository,
    private val objectMapper: ObjectMapper,
    private val youtubeClient: YoutubeClient
) {

    fun analyze(title: String, artist: String, durationSeconds: Int?): SongDTO {
        // Check if already exists in DB
        songRepository.findByArtistAndTitle(artist, title)?.let {
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
            youtubeUrl = youtubeUrl
        )

        val savedSong = songRepository.save(songEntity)

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

    private fun buildResponseFromEntity(entity: SongEntity): SongDTO {
        val lyricLines: List<LyricLineData> = objectMapper.readValue(
            entity.lyricContent,
            objectMapper.typeFactory.constructCollectionType(List::class.java, LyricLineData::class.java)
        )

        val vocabularyData: List<VocabularyData> = objectMapper.readValue(
            entity.vocabularyContent,
            objectMapper.typeFactory.constructCollectionType(List::class.java, VocabularyData::class.java)
        )

        // Re-analyze to get tokens for study units
        val studyUnits = lyricLines.map { line ->
            val tokens = morphologicalAnalyzer.analyze(line.text)
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
                }
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

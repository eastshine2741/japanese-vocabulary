package com.japanese.vocabulary.word

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.flashcard.event.FlashcardDeletedEvent
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.test.fixtures.TestWordBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.word.dto.AddWordRequest
import com.japanese.vocabulary.word.dto.BatchAddWordRequest
import com.japanese.vocabulary.word.dto.BatchAddWordResponse
import com.japanese.vocabulary.word.dto.UpdateWordRequest
import com.japanese.vocabulary.word.dto.WordDetailResponse
import com.japanese.vocabulary.word.dto.WordListResponse
import com.japanese.vocabulary.word.model.WordMeaning
import com.japanese.vocabulary.word.entity.SongWordEntity
import com.japanese.vocabulary.word.entity.WordEntity
import com.japanese.vocabulary.word.event.SongWordCreatedEvent
import com.japanese.vocabulary.word.repository.SongWordRepository
import com.japanese.vocabulary.word.repository.WordRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.event.ApplicationEvents
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.MockHttpServletRequestDsl
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put

@AutoConfigureMockMvc
class WordControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil
    @Autowired private lateinit var wordRepository: WordRepository
    @Autowired private lateinit var songWordRepository: SongWordRepository
    @Autowired private lateinit var flashcardRepository: FlashcardRepository
    @Autowired private lateinit var applicationEvents: ApplicationEvents

    private fun newUser(): UserEntity = TestUserBuilder(entityManager).build()
    private fun newSong(): SongEntity = TestSongBuilder(entityManager).build()
    private fun newWord(user: UserEntity, japanese: String? = null): WordEntity =
        TestWordBuilder(entityManager).forUser(user).let {
            if (japanese != null) it.withJapaneseText(japanese) else it
        }.build()

    private fun newSongWord(word: WordEntity, song: SongEntity, lyricLine: String): SongWordEntity =
        SongWordEntity(wordId = word.id!!, songId = song.id!!, lyricLine = lyricLine).also {
            entityManager.persist(it)
            entityManager.flush()
        }

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    private fun MockHttpServletRequestDsl.jsonBody(body: Any) {
        contentType = MediaType.APPLICATION_JSON
        content = objectMapper.writeValueAsString(body)
    }

    private inline fun <reified T> readBody(json: String): T = objectMapper.readValue(json, T::class.java)

    @Nested
    inner class AddWordDto {

        @Test
        fun `creates Word, SongWord, FlashcardDto and publishes SongWordCreatedEvent`() {
            val me = newUser()
            val song = newSong()

            val body = mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(
                    AddWordRequest(
                        japanese = "言葉",
                        reading = "ことば",
                        koreanText = "단어",
                        partOfSpeech = "noun",
                        songId = song.id!!,
                        lyricLine = "美しい言葉",
                    ),
                )
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val wordId = readBody<Map<String, Long>>(body)["id"]!!
            entityManager.flush(); entityManager.clear()

            val word = wordRepository.findById(wordId).get()
            assertThat(word.userId).isEqualTo(me.id)
            assertThat(word.meanings).containsExactly(WordMeaning(text = "단어", partOfSpeech = "noun"))

            val songWords = songWordRepository.findByWordId(wordId)
            assertThat(songWords).hasSize(1)
            assertThat(songWords.single().songId).isEqualTo(song.id)
            assertThat(songWords.single().lyricLine).isEqualTo("美しい言葉")

            val flashcard = flashcardRepository.findByWordId(wordId)
            assertThat(flashcard).isNotNull
            assertThat(flashcard!!.userId).isEqualTo(me.id)

            val events = applicationEvents.stream(SongWordCreatedEvent::class.java).toList()
            assertThat(events).hasSize(1)
            assertThat(events.single().wordId).isEqualTo(wordId)
            assertThat(events.single().songId).isEqualTo(song.id)
            assertThat(events.single().flashcardId).isEqualTo(flashcard.id)
        }

        @Test
        fun `same word+meaning+lyric is idempotent and emits no event`() {
            val me = newUser()
            val song = newSong()
            val req = AddWordRequest(
                japanese = "繰り返し",
                reading = "くりかえし",
                koreanText = "반복",
                songId = song.id!!,
                lyricLine = "繰り返しの夜",
            )

            mockMvc.post("/api/words") {
                header("Authorization", bearer(me)); jsonBody(req)
            }.andExpect { status { isOk() } }

            // First call already published an event; clear by reading current count.
            val baselineEvents = applicationEvents.stream(SongWordCreatedEvent::class.java).count()

            mockMvc.post("/api/words") {
                header("Authorization", bearer(me)); jsonBody(req)
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "繰り返し")!!
            assertThat(word.meanings).hasSize(1)
            assertThat(songWordRepository.findByWordId(word.id!!)).hasSize(1)
            assertThat(applicationEvents.stream(SongWordCreatedEvent::class.java).count())
                .isEqualTo(baselineEvents)
        }

        @Test
        fun `same word with new meaning appends to meanings`() {
            val me = newUser()
            val song = newSong()
            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(AddWordRequest(japanese = "光", reading = "ひかり", koreanText = "빛", songId = song.id!!, lyricLine = "光の道"))
            }.andExpect { status { isOk() } }

            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(AddWordRequest(japanese = "光", reading = "ひかり", koreanText = "광선", songId = song.id!!, lyricLine = "光の道"))
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "光")!!
            assertThat(word.meanings.map { it.text }).containsExactlyInAnyOrder("빛", "광선")
        }

        @Test
        fun `same word with new lyricLine adds another SongWord`() {
            val me = newUser()
            val song = newSong()
            val baseReq = AddWordRequest(japanese = "夜", reading = "よる", koreanText = "밤", songId = song.id!!, lyricLine = "夜の街")
            mockMvc.post("/api/words") { header("Authorization", bearer(me)); jsonBody(baseReq) }
                .andExpect { status { isOk() } }

            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(baseReq.copy(lyricLine = "夜が更ける"))
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "夜")!!
            assertThat(songWordRepository.findByWordId(word.id!!).map { it.lyricLine })
                .containsExactlyInAnyOrder("夜の街", "夜が更ける")
        }

        @Test
        fun `nonexistent songId returns SONG_NOT_FOUND`() {
            val me = newUser()
            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(AddWordRequest(japanese = "存在", reading = "そんざい", koreanText = "존재", songId = 99999, lyricLine = "ない"))
            }.andExpect { status { isNotFound() } }
        }
    }

    @Nested
    inner class BatchAdd {

        @Test
        fun `mixes savedCount and skippedCount based on existing rows`() {
            val me = newUser()
            val song = newSong()
            val existing = AddWordRequest(japanese = "既存", reading = "きそん", koreanText = "기존", songId = song.id!!, lyricLine = "既存の単語")
            mockMvc.post("/api/words") { header("Authorization", bearer(me)); jsonBody(existing) }
                .andExpect { status { isOk() } }

            val body = mockMvc.post("/api/words/batch") {
                header("Authorization", bearer(me))
                jsonBody(
                    BatchAddWordRequest(
                        words = listOf(
                            existing, // duplicate → skipped
                            existing.copy(japanese = "新規", reading = "しんき", koreanText = "신규", lyricLine = "新規ライン"),
                        ),
                    ),
                )
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val resp = readBody<BatchAddWordResponse>(body)
            assertThat(resp.savedCount).isEqualTo(1)
            assertThat(resp.skippedCount).isEqualTo(1)
        }
    }

    @Nested
    inner class GetUserWords {

        @Test
        fun `paginates by cursor and excludes other users' words`() {
            val me = newUser()
            val other = newUser()
            val myWords = (1..3).map { newWord(me, japanese = "私の$it") }
            newWord(other, japanese = "他人の単語")

            val firstBody = mockMvc.get("/api/words") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString
            val firstPage = readBody<WordListResponse>(firstBody)

            assertThat(firstPage.words.map { it.japanese }).containsExactlyInAnyOrderElementsOf(myWords.map { it.japaneseText })
            assertThat(firstPage.words.map { it.japanese }).noneMatch { it == "他人の単語" }
        }
    }

    @Nested
    inner class UpdateWordDto {

        @Test
        fun `updates reading and meanings`() {
            val me = newUser()
            val word = newWord(me)

            mockMvc.put("/api/words/${word.id}") {
                header("Authorization", bearer(me))
                jsonBody(
                    UpdateWordRequest(
                        reading = "あたらしいよみ",
                        meanings = listOf(WordMeaning(text = "새의미", partOfSpeech = "noun")),
                    ),
                )
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val reloaded = wordRepository.findById(word.id!!).get()
            assertThat(reloaded.reading).isEqualTo("あたらしいよみ")
            assertThat(reloaded.meanings).containsExactly(WordMeaning(text = "새의미", partOfSpeech = "noun"))
        }

        @Test
        fun `another user's word is forbidden`() {
            val me = newUser()
            val other = newUser()
            val theirWord = newWord(other)

            mockMvc.put("/api/words/${theirWord.id}") {
                header("Authorization", bearer(me))
                jsonBody(UpdateWordRequest(reading = null, meanings = listOf(WordMeaning("x", ""))))
            }.andExpect { status { isForbidden() } }
        }

        @Test
        fun `empty meanings returns MEANING_REQUIRED`() {
            val me = newUser()
            val word = newWord(me)

            mockMvc.put("/api/words/${word.id}") {
                header("Authorization", bearer(me))
                jsonBody(UpdateWordRequest(reading = "x", meanings = emptyList()))
            }.andExpect { status { isBadRequest() } }
        }

        @Test
        fun `deleteExampleIds removes only matching SongWords`() {
            val me = newUser()
            val song = newSong()
            val word = newWord(me)
            val sw1 = newSongWord(word, song, "행")
            val sw2 = newSongWord(word, song, "다른 행")

            mockMvc.put("/api/words/${word.id}") {
                header("Authorization", bearer(me))
                jsonBody(
                    UpdateWordRequest(
                        reading = word.reading,
                        meanings = word.meanings,
                        deleteExampleIds = listOf(sw1.id!!),
                    ),
                )
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            assertThat(songWordRepository.findByWordId(word.id!!).map { it.id }).containsExactly(sw2.id)
        }

        @Test
        fun `deleteExampleIds belonging to another word returns INVALID_EXAMPLES`() {
            val me = newUser()
            val song = newSong()
            val myWord = newWord(me, japanese = "내단어")
            val otherWord = newWord(me, japanese = "다른단어")
            val foreignSw = newSongWord(otherWord, song, "라인")

            mockMvc.put("/api/words/${myWord.id}") {
                header("Authorization", bearer(me))
                jsonBody(
                    UpdateWordRequest(
                        reading = myWord.reading,
                        meanings = myWord.meanings,
                        deleteExampleIds = listOf(foreignSw.id!!),
                    ),
                )
            }.andExpect { status { isBadRequest() } }

            entityManager.flush(); entityManager.clear()
            assertThat(songWordRepository.findById(foreignSw.id!!)).isPresent
        }

        @Test
        fun `resetFlashcard true resets the flashcard state`() {
            val me = newUser()
            val song = newSong()
            // Use addWord endpoint so a flashcard is created in the canonical way.
            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(AddWordRequest(japanese = "リセット", reading = "りせっと", koreanText = "리셋", songId = song.id!!, lyricLine = "x"))
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "リセット")!!
            val flashcardBefore = flashcardRepository.findByWordId(word.id!!)!!
            // Manually mutate state so reset has something to undo.
            flashcardBefore.state = 1
            flashcardBefore.stability = 5.0
            flashcardBefore.fsrsCardJson = """{"foo":"bar"}"""
            entityManager.flush(); entityManager.clear()

            mockMvc.put("/api/words/${word.id}") {
                header("Authorization", bearer(me))
                jsonBody(
                    UpdateWordRequest(
                        reading = word.reading,
                        meanings = word.meanings,
                        resetFlashcard = true,
                    ),
                )
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val after = flashcardRepository.findByWordId(word.id!!)!!
            assertThat(after.state).isZero
            assertThat(after.stability).isZero
            assertThat(after.fsrsCardJson).isEqualTo("{}")
        }
    }

    @Nested
    inner class DeleteWord {

        @Test
        fun `removes Word, SongWord, FlashcardDto and publishes FlashcardDeletedEvent`() {
            val me = newUser()
            val song = newSong()
            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(AddWordRequest(japanese = "削除", reading = "さくじょ", koreanText = "삭제", songId = song.id!!, lyricLine = "x"))
            }.andExpect { status { isOk() } }
            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "削除")!!
            val flashcard = flashcardRepository.findByWordId(word.id!!)!!

            mockMvc.delete("/api/words/${word.id}") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            assertThat(wordRepository.findById(word.id!!)).isEmpty
            assertThat(songWordRepository.findByWordId(word.id!!)).isEmpty()
            assertThat(flashcardRepository.findByWordId(word.id!!)).isNull()

            val events = applicationEvents.stream(FlashcardDeletedEvent::class.java).toList()
            assertThat(events.map { it.flashcardId }).contains(flashcard.id)
        }

        @Test
        fun `another user's word delete is forbidden`() {
            val me = newUser()
            val other = newUser()
            val theirWord = newWord(other)

            mockMvc.delete("/api/words/${theirWord.id}") {
                header("Authorization", bearer(me))
            }.andExpect { status { isForbidden() } }

            entityManager.flush(); entityManager.clear()
            assertThat(wordRepository.findById(theirWord.id!!)).isPresent
        }

        @Test
        fun `unknown word id returns WORD_NOT_FOUND`() {
            val me = newUser()
            mockMvc.delete("/api/words/999999") {
                header("Authorization", bearer(me))
            }.andExpect { status { isNotFound() } }
        }
    }

    @Nested
    inner class LookupByText {

        @Test
        fun `returns detail for own word`() {
            val me = newUser()
            val word = newWord(me, japanese = "ルックアップ")

            val body = mockMvc.get("/api/words/by-text") {
                header("Authorization", bearer(me))
                param("japanese", "ルックアップ")
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            assertThat(readBody<WordDetailResponse>(body).id).isEqualTo(word.id)
        }

        @Test
        fun `unknown text returns 204 No Content`() {
            val me = newUser()
            mockMvc.get("/api/words/by-text") {
                header("Authorization", bearer(me))
                param("japanese", "そんなのない")
            }.andExpect { status { isNoContent() } }
        }
    }

    @Nested
    inner class LookupById {

        @Test
        fun `returns detail for own word`() {
            val me = newUser()
            val word = newWord(me)

            mockMvc.get("/api/words/${word.id}") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }
        }

        @Test
        fun `another user's word returns 404`() {
            val me = newUser()
            val other = newUser()
            val theirWord = newWord(other)

            mockMvc.get("/api/words/${theirWord.id}") {
                header("Authorization", bearer(me))
            }.andExpect { status { isNotFound() } }
        }
    }
}

package com.japanese.vocabulary.word

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckWordEntity
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.deck.repository.DeckWordRepository
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
import com.japanese.vocabulary.word.entity.WordEntity
import com.japanese.vocabulary.word.model.SenseExample
import com.japanese.vocabulary.word.model.WordSense
import com.japanese.vocabulary.word.repository.WordRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.data.domain.Pageable
import org.springframework.http.MediaType
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
    @Autowired private lateinit var flashcardRepository: FlashcardRepository
    @Autowired private lateinit var deckWordRepository: DeckWordRepository
    @Autowired private lateinit var deckRepository: DeckRepository

    private fun newUser(): UserEntity = TestUserBuilder(entityManager).build()
    private fun newSong(): SongEntity = TestSongBuilder(entityManager).build()
    private fun newWord(user: UserEntity, japanese: String? = null): WordEntity =
        TestWordBuilder(entityManager).forUser(user).let {
            if (japanese != null) it.withJapaneseText(japanese) else it
        }.build()

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    private fun MockHttpServletRequestDsl.jsonBody(body: Any) {
        contentType = MediaType.APPLICATION_JSON
        content = objectMapper.writeValueAsString(body)
    }

    private inline fun <reified T> readBody(json: String): T = objectMapper.readValue(json, T::class.java)

    private fun sense(
        meaning: String,
        partOfSpeech: String = "noun",
        jlpt: String? = null,
        examples: List<SenseExample> = emptyList(),
    ) = WordSense(meaning = meaning, partOfSpeech = partOfSpeech, jlpt = jlpt, examples = examples)

    private fun example(song: SongEntity, text: String, lineIndex: Int? = null) =
        SenseExample(text = text, translation = null, songId = song.id, lineIndex = lineIndex)

    @Nested
    inner class AddWord {

        @Test
        fun `creates the word with senses, its flashcard and both deck links in one request`() {
            val me = newUser()
            val song = newSong()

            val body = mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(
                    AddWordRequest(
                        japanese = "言葉",
                        reading = "ことば",
                        senses = listOf(
                            sense("단어", jlpt = "N5", examples = listOf(example(song, "美しい言葉", lineIndex = 3))),
                        ),
                        songId = song.id!!,
                    ),
                )
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val wordId = readBody<Map<String, Long>>(body)["id"]!!
            entityManager.flush(); entityManager.clear()

            val word = wordRepository.findById(wordId).get()
            assertThat(word.userId).isEqualTo(me.id)
            assertThat(word.senses).hasSize(1)
            with(word.senses.single()) {
                assertThat(meaning).isEqualTo("단어")
                assertThat(partOfSpeech).isEqualTo("noun")
                assertThat(jlpt).isEqualTo("N5")
                assertThat(examples).containsExactly(
                    SenseExample(text = "美しい言葉", translation = null, songId = song.id, lineIndex = 3),
                )
            }

            val flashcard = flashcardRepository.findByWordId(wordId)
            assertThat(flashcard).isNotNull
            assertThat(flashcard!!.userId).isEqualTo(me.id)

            // 같은 트랜잭션에서 곡 단어장과 전체 단어장 연결까지 끝나 있어야 한다.
            val songDeck = deckRepository.findByUserIdAndSongId(me.id!!, song.id!!)!!
            assertThat(songDeck.title).isEqualTo(song.title)
            assertThat(deckWordRepository.existsByDeckIdAndWordId(songDeck.id!!, wordId)).isTrue
            val defaultDeck = deckRepository.findByUserIdAndIsDefaultTrue(me.id!!)!!
            assertThat(deckWordRepository.existsByDeckIdAndWordId(defaultDeck.id!!, wordId)).isTrue
        }

        @Test
        fun `song id is optional so a word can be saved outside a song`() {
            val me = newUser()

            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(AddWordRequest(japanese = "独立", reading = "どくりつ", senses = listOf(sense("독립"))))
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "独立")!!
            // 곡 단어장은 안 생기지만 전체 단어장 연결은 불변식이라 반드시 있어야 한다.
            val defaultDeck = deckRepository.findByUserIdAndIsDefaultTrue(me.id!!)!!
            assertThat(deckWordRepository.existsByDeckIdAndWordId(defaultDeck.id!!, word.id!!)).isTrue
            assertThat(deckRepository.findByUserIdOrderByCreatedAtDesc(me.id!!, Pageable.unpaged())).hasSize(1)
        }

        @Test
        fun `re-adding the same word and sense changes nothing`() {
            val me = newUser()
            val song = newSong()
            val req = AddWordRequest(
                japanese = "繰り返し",
                reading = "くりかえし",
                senses = listOf(sense("반복", examples = listOf(example(song, "繰り返しの夜", lineIndex = 1)))),
                songId = song.id!!,
            )

            mockMvc.post("/api/words") { header("Authorization", bearer(me)); jsonBody(req) }
                .andExpect { status { isOk() } }
            mockMvc.post("/api/words") { header("Authorization", bearer(me)); jsonBody(req) }
                .andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "繰り返し")!!
            assertThat(word.senses).hasSize(1)
            assertThat(word.senses.single().examples).hasSize(1)
        }

        @Test
        fun `a new meaning is appended as a new sense`() {
            val me = newUser()
            val song = newSong()
            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(AddWordRequest(japanese = "光", reading = "ひかり", senses = listOf(sense("빛")), songId = song.id!!))
            }.andExpect { status { isOk() } }

            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(AddWordRequest(japanese = "光", reading = "ひかり", senses = listOf(sense("광선")), songId = song.id!!))
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "光")!!
            assertThat(word.senses.map { it.meaning }).containsExactly("빛", "광선")
        }

        @Test
        fun `overlapping senses merge without dropping existing ones`() {
            val me = newUser()
            val song = newSong()
            TestWordBuilder(entityManager)
                .forUser(me)
                .withJapaneseText("重なる")
                .withSenses(listOf(sense("a", "VERB"), sense("b", "VERB")))
                .build()

            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(
                    AddWordRequest(
                        japanese = "重なる",
                        reading = "かさなる",
                        senses = listOf(sense("b", "VERB"), sense("c", "VERB")),
                        songId = song.id!!,
                    ),
                )
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "重なる")!!
            assertThat(word.senses.map { it.meaning }).containsExactly("a", "b", "c")
        }

        @Test
        fun `examples are capped at five per sense and counted independently per sense`() {
            val me = newUser()
            val song = newSong()
            TestWordBuilder(entityManager)
                .forUser(me)
                .withJapaneseText("限界")
                .withSenses(
                    listOf(
                        sense("기존", examples = (1..4).map { example(song, "既存$it", lineIndex = it) }),
                    ),
                )
                .build()

            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(
                    AddWordRequest(
                        japanese = "限界",
                        reading = "げんかい",
                        senses = listOf(
                            sense("기존", examples = (1..3).map { example(song, "新規$it", lineIndex = 100 + it) }),
                            sense("한계", examples = (1..7).map { example(song, "別$it", lineIndex = 200 + it) }),
                        ),
                        songId = song.id!!,
                    ),
                )
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "限界")!!
            val bySense = word.senses.associateBy { it.meaning }
            // 기존 sense: 4 existing + 1 appended = 5 (상한), 나머지 신규 예문은 버려진다.
            assertThat(bySense.getValue("기존").examples.map { it.text })
                .containsExactly("既存1", "既存2", "既存3", "既存4", "新規1")
            // 한계 sense 는 자기 상한을 따로 가진다.
            assertThat(bySense.getValue("한계").examples.map { it.text })
                .containsExactly("別1", "別2", "別3", "別4", "別5")
        }

        @Test
        fun `a comma-joined meaning becomes one sense per meaning`() {
            val me = newUser()
            val song = newSong()

            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(
                    AddWordRequest(
                        japanese = "愛",
                        reading = "あい",
                        senses = listOf(
                            sense("사랑, 애정", jlpt = "N3", examples = listOf(example(song, "愛の歌", lineIndex = 2))),
                        ),
                        songId = song.id!!,
                    ),
                )
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "愛")!!
            assertThat(word.senses.map { it.meaning }).containsExactly("사랑", "애정")
            assertThat(word.senses.map { it.jlpt }).containsOnly("N3")
            // 예문은 첫 조각만 갖는다 — 어느 뜻으로 쓰인 줄인지 모르는 채 복제하지 않는다.
            assertThat(word.senses[0].examples.map { it.text }).containsExactly("愛の歌")
            assertThat(word.senses[1].examples).isEmpty()
        }

        @Test
        fun `an already saved meaning only gains the example while a new one becomes a sense`() {
            val me = newUser()
            val song = newSong()
            TestWordBuilder(entityManager)
                .forUser(me)
                .withJapaneseText("愛")
                .withSenses(listOf(sense("사랑", examples = listOf(example(song, "愛の歌", lineIndex = 2)))))
                .build()

            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(
                    AddWordRequest(
                        japanese = "愛",
                        reading = "あい",
                        senses = listOf(sense("사랑, 애정", examples = listOf(example(song, "愛してる", lineIndex = 5)))),
                        songId = song.id!!,
                    ),
                )
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "愛")!!
            val bySense = word.senses.associateBy { it.meaning }
            assertThat(word.senses.map { it.meaning }).containsExactly("사랑", "애정")
            assertThat(bySense.getValue("사랑").examples.map { it.text }).containsExactly("愛の歌", "愛してる")
            // 새로 생긴 뒷 조각은 예문 없이 시작한다 — 나중에 그 뜻으로 담길 때 자기 예문을 갖는다.
            assertThat(bySense.getValue("애정").examples).isEmpty()
        }

        @Test
        fun `a lyric line repeated in the song is kept as one example even at another line index`() {
            val me = newUser()
            val song = newSong()
            TestWordBuilder(entityManager)
                .forUser(me)
                .withJapaneseText("愛")
                .withSenses(listOf(sense("사랑", examples = listOf(example(song, "愛してる", lineIndex = 2)))))
                .build()

            // 후렴이 반복되는 곡에서 같은 줄을 또 담은 상황 — 줄 번호만 다르다.
            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(
                    AddWordRequest(
                        japanese = "愛",
                        reading = "あい",
                        senses = listOf(sense("사랑", examples = listOf(example(song, "愛してる", lineIndex = 18)))),
                        songId = song.id!!,
                    ),
                )
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "愛")!!
            assertThat(word.senses.single().examples.map { it.text }).containsExactly("愛してる")
        }

        @Test
        fun `an example already held by another sense is not repeated in a new sense`() {
            val me = newUser()
            val song = newSong()
            TestWordBuilder(entityManager)
                .forUser(me)
                .withJapaneseText("愛")
                .withSenses(
                    listOf(
                        sense("사랑", examples = listOf(example(song, "愛の歌", lineIndex = 2))),
                        sense("애정"),
                    ),
                )
                .build()

            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(
                    AddWordRequest(
                        japanese = "愛",
                        reading = "あい",
                        senses = listOf(sense("애정", examples = listOf(example(song, "愛の歌", lineIndex = 40)))),
                        songId = song.id!!,
                    ),
                )
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "愛")!!
            val bySense = word.senses.associateBy { it.meaning }
            // 한 가사 줄은 뜻 하나에만 붙는다 — 이미 다른 뜻이 들고 있으면 새 뜻엔 붙지 않는다.
            assertThat(bySense.getValue("사랑").examples.map { it.text }).containsExactly("愛の歌")
            assertThat(bySense.getValue("애정").examples).isEmpty()
        }

        @Test
        fun `nonexistent songId returns SONG_NOT_FOUND`() {
            val me = newUser()
            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(AddWordRequest(japanese = "存在", reading = "そんざい", senses = listOf(sense("존재")), songId = 99999))
            }.andExpect { status { isNotFound() } }
        }

        @Test
        fun `empty senses returns MEANING_REQUIRED`() {
            val me = newUser()
            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(AddWordRequest(japanese = "空", reading = "から", senses = emptyList()))
            }.andExpect { status { isBadRequest() } }
        }
    }

    @Nested
    inner class BatchAdd {

        @Test
        fun `mixes savedCount and skippedCount based on existing rows`() {
            val me = newUser()
            val song = newSong()
            val existing = AddWordRequest(
                japanese = "既存",
                reading = "きそん",
                senses = listOf(sense("기존", examples = listOf(example(song, "既存の単語", lineIndex = 1)))),
                songId = song.id!!,
            )
            mockMvc.post("/api/words") { header("Authorization", bearer(me)); jsonBody(existing) }
                .andExpect { status { isOk() } }

            val body = mockMvc.post("/api/words/batch") {
                header("Authorization", bearer(me))
                jsonBody(
                    BatchAddWordRequest(
                        words = listOf(
                            existing, // duplicate → skipped
                            existing.copy(japanese = "新規", reading = "しんき", senses = listOf(sense("신규"))),
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

        @Test
        fun `list items expose senses with song metadata resolved for examples`() {
            val me = newUser()
            val song = newSong()
            TestWordBuilder(entityManager)
                .forUser(me)
                .withJapaneseText("歌詞")
                .withSenses(listOf(sense("가사", examples = listOf(example(song, "歌詞の行", lineIndex = 7)))))
                .build()

            val body = mockMvc.get("/api/words") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val item = readBody<WordListResponse>(body).words.single { it.japanese == "歌詞" }
            val savedExample = item.senses.single().examples.single()
            assertThat(savedExample.songId).isEqualTo(song.id)
            assertThat(savedExample.lineIndex).isEqualTo(7)
            assertThat(savedExample.songTitle).isEqualTo(song.title)
        }
    }

    @Nested
    inner class UpdateWord {

        @Test
        fun `replaces reading and the whole senses array`() {
            val me = newUser()
            val song = newSong()
            val word = TestWordBuilder(entityManager)
                .forUser(me)
                .withJapaneseText("置換")
                .withSenses(
                    listOf(
                        sense("옛의미", examples = listOf(example(song, "古い行", lineIndex = 1))),
                        sense("지울의미"),
                    ),
                )
                .build()

            mockMvc.put("/api/words/${word.id}") {
                header("Authorization", bearer(me))
                jsonBody(
                    UpdateWordRequest(
                        reading = "あたらしいよみ",
                        senses = listOf(sense("새의미", examples = listOf(example(song, "新しい行", lineIndex = 2)))),
                    ),
                )
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val reloaded = wordRepository.findById(word.id!!).get()
            assertThat(reloaded.reading).isEqualTo("あたらしいよみ")
            assertThat(reloaded.senses.map { it.meaning }).containsExactly("새의미")
            assertThat(reloaded.senses.single().examples.map { it.text }).containsExactly("新しい行")
        }

        @Test
        fun `caps examples at five per sense on replace`() {
            val me = newUser()
            val song = newSong()
            val word = newWord(me, japanese = "上限")

            mockMvc.put("/api/words/${word.id}") {
                header("Authorization", bearer(me))
                jsonBody(
                    UpdateWordRequest(
                        reading = null,
                        senses = listOf(sense("의미", examples = (1..8).map { example(song, "行$it", lineIndex = it) })),
                    ),
                )
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            assertThat(wordRepository.findById(word.id!!).get().senses.single().examples).hasSize(5)
        }

        @Test
        fun `another user's word is forbidden`() {
            val me = newUser()
            val other = newUser()
            val theirWord = newWord(other)

            mockMvc.put("/api/words/${theirWord.id}") {
                header("Authorization", bearer(me))
                jsonBody(UpdateWordRequest(reading = null, senses = listOf(sense("x", ""))))
            }.andExpect { status { isForbidden() } }
        }

        @Test
        fun `empty senses returns MEANING_REQUIRED`() {
            val me = newUser()
            val word = newWord(me)

            mockMvc.put("/api/words/${word.id}") {
                header("Authorization", bearer(me))
                jsonBody(UpdateWordRequest(reading = "x", senses = emptyList()))
            }.andExpect { status { isBadRequest() } }
        }

        @Test
        fun `resetFlashcard true resets the flashcard state`() {
            val me = newUser()
            val song = newSong()
            // Use addWord endpoint so a flashcard is created in the canonical way.
            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(AddWordRequest(japanese = "リセット", reading = "りせっと", senses = listOf(sense("리셋")), songId = song.id!!))
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
                jsonBody(UpdateWordRequest(reading = word.reading, senses = word.senses, resetFlashcard = true))
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
        fun `removes the word and its flashcard, unlinks both decks, and keeps the decks`() {
            val me = newUser()
            val song = newSong()
            mockMvc.post("/api/words") {
                header("Authorization", bearer(me))
                jsonBody(AddWordRequest(japanese = "削除", reading = "さくじょ", senses = listOf(sense("삭제")), songId = song.id!!))
            }.andExpect { status { isOk() } }
            entityManager.flush(); entityManager.clear()

            val word = wordRepository.findByUserIdAndJapaneseText(me.id!!, "削除")!!
            assertThat(flashcardRepository.findByWordId(word.id!!)).isNotNull
            val songDeck = deckRepository.findByUserIdAndSongId(me.id!!, song.id!!)!!
            val defaultDeck = deckRepository.findByUserIdAndIsDefaultTrue(me.id!!)!!
            assertThat(deckWordRepository.existsByDeckIdAndWordId(songDeck.id!!, word.id!!)).isTrue
            assertThat(deckWordRepository.existsByDeckIdAndWordId(defaultDeck.id!!, word.id!!)).isTrue

            mockMvc.delete("/api/words/${word.id}") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            assertThat(wordRepository.findById(word.id!!)).isEmpty
            assertThat(flashcardRepository.findByWordId(word.id!!)).isNull()
            assertThat(deckWordRepository.existsByDeckIdAndWordId(songDeck.id!!, word.id!!)).isFalse
            assertThat(deckWordRepository.existsByDeckIdAndWordId(defaultDeck.id!!, word.id!!)).isFalse
            // 단어장은 word 보다 오래 산다 — 안이 비어도 남아야 한다.
            assertThat(deckRepository.findById(songDeck.id!!)).isPresent
            assertThat(deckRepository.findById(defaultDeck.id!!)).isPresent
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

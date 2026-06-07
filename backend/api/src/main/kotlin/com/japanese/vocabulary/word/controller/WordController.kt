package com.japanese.vocabulary.word.controller

import com.japanese.vocabulary.word.dto.AddWordRequest
import com.japanese.vocabulary.word.dto.BatchAddWordRequest
import com.japanese.vocabulary.word.dto.BatchAddWordResponse
import com.japanese.vocabulary.word.dto.UpdateWordRequest
import com.japanese.vocabulary.word.dto.WordDetailResponse
import com.japanese.vocabulary.word.dto.WordListResponse
import com.japanese.vocabulary.word.dto.AddWordDto
import com.japanese.vocabulary.word.dto.BatchAddWordDto
import com.japanese.vocabulary.word.dto.BatchAddWordResultDto
import com.japanese.vocabulary.word.dto.UpdateWordDto
import com.japanese.vocabulary.word.dto.WordDetailDto
import com.japanese.vocabulary.word.dto.WordListDto
import com.japanese.vocabulary.word.service.WordService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/words")
class WordController(
    private val wordService: WordService,
) {
    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long

    @PostMapping
    fun addWord(@RequestBody request: AddWordRequest): Map<String, Long> {
        val wordId = wordService.addWord(currentUserId(), request.toDto())
        return mapOf("id" to wordId)
    }

    @PostMapping("/batch")
    fun batchAddWords(@RequestBody request: BatchAddWordRequest): BatchAddWordResponse =
        wordService.batchAddWords(currentUserId(), request.toDto()).toResponse()

    @GetMapping
    fun getUserWords(@RequestParam(required = false) cursor: Long?): WordListResponse =
        wordService.getUserWords(currentUserId(), cursor).toResponse()

    @PutMapping("/{id}")
    fun updateWord(@PathVariable id: Long, @RequestBody request: UpdateWordRequest): WordDetailResponse =
        wordService.updateWord(currentUserId(), id, request.toDto()).toResponse()

    @DeleteMapping("/{id}")
    fun deleteWord(@PathVariable id: Long) {
        wordService.deleteWord(currentUserId(), id)
    }

    @GetMapping("/by-text")
    fun getWord(@RequestParam japanese: String): ResponseEntity<WordDetailResponse> {
        val result = wordService.getWord(currentUserId(), japanese)
        return if (result != null) ResponseEntity.ok(result.toResponse())
        else ResponseEntity.noContent().build()
    }

    @GetMapping("/{id}")
    fun getWordById(@PathVariable id: Long): ResponseEntity<WordDetailResponse> {
        val result = wordService.getWordById(currentUserId(), id)
        return if (result != null) ResponseEntity.ok(result.toResponse())
        else ResponseEntity.notFound().build()
    }

    private fun AddWordRequest.toDto() = AddWordDto(
        japanese = japanese,
        reading = reading,
        koreanText = koreanText,
        partOfSpeech = partOfSpeech,
        songId = songId,
        lyricLine = lyricLine,
        koreanLyricLine = koreanLyricLine,
    )

    private fun BatchAddWordRequest.toDto() = BatchAddWordDto(words = words.map { it.toDto() })

    private fun UpdateWordRequest.toDto() = UpdateWordDto(
        reading = reading,
        meanings = meanings,
        resetFlashcard = resetFlashcard,
        deleteExampleIds = deleteExampleIds,
    )

    private fun BatchAddWordResultDto.toResponse() = BatchAddWordResponse(
        savedCount = savedCount,
        skippedCount = skippedCount,
    )

    private fun WordDetailDto.toResponse() = WordDetailResponse(
        id = id,
        japanese = japanese,
        reading = reading,
        meanings = meanings,
        examples = examples,
    )

    private fun WordListDto.toResponse() = WordListResponse(
        words = items,
        nextCursor = nextCursor,
    )
}

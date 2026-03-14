package com.japanese.vocabulary.word.controller

import com.japanese.vocabulary.word.dto.AddWordRequest
import com.japanese.vocabulary.word.dto.WordDefinitionDTO
import com.japanese.vocabulary.word.dto.WordDetailResponse
import com.japanese.vocabulary.word.dto.WordListResponse
import com.japanese.vocabulary.word.service.WordService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/words")
class WordController(
    private val wordService: WordService
) {
    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long

    @GetMapping("/lookup")
    fun lookupWord(@RequestParam word: String): WordDefinitionDTO {
        return wordService.lookupWord(word)
    }

    @PostMapping
    fun addWord(@RequestBody request: AddWordRequest): Map<String, Long> {
        val userId = currentUserId()
        val wordId = wordService.addWord(userId, request)
        return mapOf("id" to wordId)
    }

    @GetMapping
    fun getUserWords(@RequestParam(required = false) cursor: Long?): WordListResponse {
        val userId = currentUserId()
        return wordService.getUserWords(userId, cursor)
    }

    @GetMapping("/by-text")
    fun getWord(@RequestParam japanese: String): ResponseEntity<WordDetailResponse> {
        val userId = currentUserId()
        val result = wordService.getWord(userId, japanese)
        return if (result != null) ResponseEntity.ok(result)
        else ResponseEntity.notFound().build()
    }
}

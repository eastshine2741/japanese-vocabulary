package com.japanese.vocabulary.controller

import com.japanese.vocabulary.model.AddWordRequest
import com.japanese.vocabulary.model.WordDefinitionDTO
import com.japanese.vocabulary.model.WordListResponse
import com.japanese.vocabulary.service.WordService
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
}

package com.japanese.vocabulary.deck.controller

import com.japanese.vocabulary.deck.dto.DeckDetailResponse
import com.japanese.vocabulary.deck.dto.DeckListResponse
import com.japanese.vocabulary.deck.dto.DeckWordListResponse
import com.japanese.vocabulary.deck.service.DeckService
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/decks")
class DeckController(private val deckService: DeckService) {

    @GetMapping
    fun getDeckList(): DeckListResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return deckService.getDeckList(userId)
    }

    @GetMapping("/all")
    fun getAllDeckDetail(): DeckDetailResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return deckService.getDeckDetail(userId, null)
    }

    @GetMapping("/{songId}")
    fun getSongDeckDetail(@PathVariable songId: Long): DeckDetailResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return deckService.getDeckDetail(userId, songId)
    }

    @GetMapping("/all/words")
    fun getAllDeckWords(@RequestParam(required = false) cursor: Long?): DeckWordListResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return deckService.getDeckWords(userId, null, cursor)
    }

    @GetMapping("/{songId}/words")
    fun getSongDeckWords(@PathVariable songId: Long, @RequestParam(required = false) cursor: Long?): DeckWordListResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return deckService.getDeckWords(userId, songId, cursor)
    }
}

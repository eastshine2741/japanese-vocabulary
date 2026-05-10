package com.japanese.vocabulary.deck.controller

import com.japanese.vocabulary.deck.dto.DeckDetailResponse
import com.japanese.vocabulary.deck.dto.DeckListResponse
import com.japanese.vocabulary.deck.dto.DeckWordListResponse
import com.japanese.vocabulary.deck.service.DeckService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/decks")
class DeckController(private val deckService: DeckService) {

    @GetMapping
    fun getDeckList(@RequestParam(required = false) cursor: Long?): DeckListResponse {
        val userId = currentUserId()
        return deckService.getDeckList(userId, cursor)
    }

    @GetMapping("/all")
    fun getAllDeckDetail(): DeckDetailResponse {
        return deckService.getAllDeckDetail(currentUserId())
    }

    @GetMapping("/all/words")
    fun getAllDeckWords(@RequestParam(required = false) cursor: Long?): DeckWordListResponse {
        return deckService.getAllDeckWords(currentUserId(), cursor)
    }

    @GetMapping("/by-song/{songId}")
    fun getDeckBySongId(@PathVariable songId: Long): ResponseEntity<DeckDetailResponse> {
        val userId = currentUserId()
        val deck = deckService.findBySongId(userId, songId) ?: return ResponseEntity.noContent().build()
        return ResponseEntity.ok(deckService.getDeckDetail(userId, deck.id!!))
    }

    @GetMapping("/{deckId}")
    fun getDeckDetail(@PathVariable deckId: Long): DeckDetailResponse {
        return deckService.getDeckDetail(currentUserId(), deckId)
    }

    @GetMapping("/{deckId}/words")
    fun getDeckWords(
        @PathVariable deckId: Long,
        @RequestParam(required = false) cursor: Long?,
    ): DeckWordListResponse {
        return deckService.getDeckWords(currentUserId(), deckId, cursor)
    }

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long
}

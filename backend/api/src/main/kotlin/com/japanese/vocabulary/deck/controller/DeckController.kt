package com.japanese.vocabulary.deck.controller

import com.japanese.vocabulary.deck.dto.DeckDetailResponse
import com.japanese.vocabulary.deck.dto.DeckListResponse
import com.japanese.vocabulary.deck.dto.DeckWordItemDto
import com.japanese.vocabulary.deck.dto.DeckWordListResponse
import com.japanese.vocabulary.deck.dto.SongDeckSummaryDto
import com.japanese.vocabulary.deck.dto.DeckDetailDto
import com.japanese.vocabulary.deck.dto.DeckListDto
import com.japanese.vocabulary.deck.dto.DeckSummaryDto
import com.japanese.vocabulary.deck.service.DeckService
import com.japanese.vocabulary.word.dto.WordListDto
import com.japanese.vocabulary.word.dto.WordListItemDto
import org.springframework.http.ResponseEntity
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/decks")
class DeckController(private val deckService: DeckService) {

    @GetMapping
    fun getDeckList(@RequestParam(required = false) cursor: Long?): DeckListResponse =
        deckService.getDeckList(currentUserId(), cursor).toResponse()

    @GetMapping("/all")
    fun getAllDeckDetail(): DeckDetailResponse =
        deckService.getAllDeckDetail(currentUserId()).toResponse()

    @GetMapping("/all/words")
    fun getAllDeckWords(@RequestParam(required = false) cursor: Long?): DeckWordListResponse =
        deckService.getAllDeckWords(currentUserId(), cursor).toResponse()

    @GetMapping("/by-song/{songId}")
    fun getDeckBySongId(@PathVariable songId: Long): ResponseEntity<DeckDetailResponse> {
        val userId = currentUserId()
        val deck = deckService.findBySongId(userId, songId) ?: return ResponseEntity.noContent().build()
        return ResponseEntity.ok(deckService.getDeckDetail(userId, deck.id).toResponse())
    }

    @GetMapping("/{deckId}")
    fun getDeckDetail(@PathVariable deckId: Long): DeckDetailResponse =
        deckService.getDeckDetail(currentUserId(), deckId).toResponse()

    @GetMapping("/{deckId}/words")
    fun getDeckWords(
        @PathVariable deckId: Long,
        @RequestParam(required = false) cursor: Long?,
    ): DeckWordListResponse = deckService.getDeckWords(currentUserId(), deckId, cursor).toResponse()

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long

    private fun DeckListDto.toResponse() = DeckListResponse(
        songDecks = items.map { it.toResponse() },
        nextCursor = nextCursor,
    )

    private fun DeckSummaryDto.toResponse() = SongDeckSummaryDto(
        deckId = deckId,
        songId = songId,
        title = title,
        artist = artist,
        artworkUrl = artworkUrl,
        wordCount = wordCount,
        dueCount = dueCount,
        masteredCount = masteredCount,
    )

    private fun DeckDetailDto.toResponse() = DeckDetailResponse(
        deckId = deckId,
        songId = songId,
        title = title,
        artist = artist,
        artworkUrl = artworkUrl,
        wordCount = wordCount,
        dueCount = dueCount,
        masteredCount = masteredCount,
        studyingCount = studyingCount,
        newWordCount = newWordCount,
    )

    private fun WordListDto.toResponse() = DeckWordListResponse(
        words = items.map { it.toResponse() },
        nextCursor = nextCursor,
    )

    private fun WordListItemDto.toResponse() = DeckWordItemDto(
        id = id,
        japanese = japanese,
        reading = reading,
        meanings = meanings,
    )
}

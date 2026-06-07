package com.japanese.vocabulary.flashcard.controller

import com.japanese.vocabulary.flashcard.dto.DueFlashcardsDto
import com.japanese.vocabulary.flashcard.dto.DueFlashcardsResponse
import com.japanese.vocabulary.flashcard.dto.FlashcardStatsDto
import com.japanese.vocabulary.flashcard.dto.FlashcardStatsResponse
import com.japanese.vocabulary.flashcard.dto.ReviewRequest
import com.japanese.vocabulary.flashcard.dto.ReviewResponse
import com.japanese.vocabulary.flashcard.dto.ReviewResultDto
import com.japanese.vocabulary.flashcard.service.FlashcardService
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/flashcards")
class FlashcardController(private val flashcardService: FlashcardService) {

    @GetMapping("/due")
    fun getDueFlashcards(@RequestParam(required = false) songId: Long?): DueFlashcardsResponse =
        flashcardService.getDueFlashcards(currentUserId(), songId).toResponse()

    @PostMapping("/{id}/review")
    fun reviewCard(@PathVariable id: Long, @RequestBody request: ReviewRequest): ReviewResponse =
        flashcardService.reviewCard(currentUserId(), id, request.rating).toResponse()

    @GetMapping("/stats")
    fun getStats(): FlashcardStatsResponse =
        flashcardService.getStats(currentUserId()).toResponse()

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long

    private fun DueFlashcardsDto.toResponse() = DueFlashcardsResponse(
        cards = items,
        totalCount = totalCount,
    )

    private fun ReviewResultDto.toResponse() = ReviewResponse(
        id = id,
        state = state,
        due = due,
        stability = stability,
        difficulty = difficulty,
    )

    private fun FlashcardStatsDto.toResponse() = FlashcardStatsResponse(
        total = total,
        due = due,
        newCount = newCount,
        learning = learning,
        review = review,
    )
}

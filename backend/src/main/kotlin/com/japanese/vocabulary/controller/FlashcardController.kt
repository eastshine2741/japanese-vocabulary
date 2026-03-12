package com.japanese.vocabulary.controller

import com.japanese.vocabulary.model.*
import com.japanese.vocabulary.service.FlashcardService
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/flashcards")
class FlashcardController(private val flashcardService: FlashcardService) {

    @GetMapping("/due")
    fun getDueFlashcards(): DueFlashcardsResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return flashcardService.getDueFlashcards(userId)
    }

    @PostMapping("/{id}/review")
    fun reviewCard(@PathVariable id: Long, @RequestBody request: ReviewRequest): ReviewResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return flashcardService.reviewCard(userId, id, request.rating)
    }

    @GetMapping("/stats")
    fun getStats(): FlashcardStatsResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return flashcardService.getStats(userId)
    }
}

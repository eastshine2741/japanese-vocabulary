package com.japanese.vocabulary.song.controller

import com.japanese.vocabulary.song.service.SearchHistoryService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/search-history")
class SearchHistoryController(
    private val searchHistoryService: SearchHistoryService,
) {
    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long

    @GetMapping
    fun getHistory(): ResponseEntity<List<String>> =
        ResponseEntity.ok(searchHistoryService.getHistory(currentUserId()))

    @DeleteMapping
    fun deleteHistory(@RequestParam term: String): ResponseEntity<Void> {
        searchHistoryService.delete(currentUserId(), term)
        return ResponseEntity.noContent().build()
    }
}

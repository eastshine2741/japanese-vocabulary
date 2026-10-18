package com.japanese.vocabulary.rewardcard.controller

import com.japanese.vocabulary.rewardcard.dto.IssueArtistCardRequest
import com.japanese.vocabulary.rewardcard.dto.IssueSongCardRequest
import com.japanese.vocabulary.rewardcard.dto.MarkArtistCardSeenRequest
import com.japanese.vocabulary.rewardcard.dto.PendingRewardCardsResponse
import com.japanese.vocabulary.rewardcard.dto.RewardCardsResponse
import com.japanese.vocabulary.rewardcard.dto.UpdateSongCardLyricRequest
import com.japanese.vocabulary.rewardcard.service.RewardCardQueryService
import com.japanese.vocabulary.rewardcard.service.RewardCardService
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/reward-cards")
class RewardCardController(
    private val rewardCardService: RewardCardService,
    private val rewardCardQueryService: RewardCardQueryService,
) {
    @GetMapping
    fun cards(): RewardCardsResponse = rewardCardQueryService.cards(currentUserId())

    /** 앱을 열 때 남은 연출. 서명 전에 앱을 끈 카드와 못 본 아티스트 카드 강화가 여기 남는다. */
    @GetMapping("/pending")
    fun pending(): PendingRewardCardsResponse = PendingRewardCardsResponse(rewardCardService.pending(currentUserId()))

    @PostMapping("/song-cards/{cardId}/issue")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun issueSongCard(@PathVariable cardId: Long, @RequestBody request: IssueSongCardRequest) {
        val userId = currentUserId()
        rewardCardQueryService.validateLyricLines(rewardCardService.songCard(userId, cardId).songId, request.lyricLineIndexes)
        rewardCardService.issueSongCard(userId, cardId, request.signature, request.lyricLineIndexes)
    }

    @PostMapping("/artist-cards/{cardId}/issue")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun issueArtistCard(@PathVariable cardId: Long, @RequestBody request: IssueArtistCardRequest) {
        rewardCardService.issueArtistCard(currentUserId(), cardId, request.signature)
    }

    @PostMapping("/artist-cards/{cardId}/seen")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun markArtistCardSeen(@PathVariable cardId: Long, @RequestBody request: MarkArtistCardSeenRequest) {
        rewardCardService.markArtistCardSeen(currentUserId(), cardId, request.grade)
    }

    @PutMapping("/song-cards/{cardId}/lyric")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updateSongCardLyric(@PathVariable cardId: Long, @RequestBody request: UpdateSongCardLyricRequest) {
        val userId = currentUserId()
        rewardCardQueryService.validateLyricLines(rewardCardService.songCard(userId, cardId).songId, request.lyricLineIndexes)
        rewardCardService.updateSongCardLyric(userId, cardId, request.lyricLineIndexes)
    }

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long
}

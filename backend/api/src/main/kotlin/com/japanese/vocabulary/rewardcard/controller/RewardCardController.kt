package com.japanese.vocabulary.rewardcard.controller

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.rewardcard.dto.IssueArtistCardRequest
import com.japanese.vocabulary.rewardcard.dto.IssueSongCardRequest
import com.japanese.vocabulary.rewardcard.dto.MarkRewardCardSeenRequest
import com.japanese.vocabulary.rewardcard.dto.PendingRewardCardsResponse
import com.japanese.vocabulary.rewardcard.dto.RewardCardsResponse
import com.japanese.vocabulary.rewardcard.dto.UpdateSongCardLyricRequest
import com.japanese.vocabulary.rewardcard.model.ArtistCardGrade
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
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

    /** 앱을 열 때 남은 연출. 서명 전에 앱을 끈 카드와 못 본 등급 오름이 여기 남는다. */
    @GetMapping("/pending")
    fun pending(): PendingRewardCardsResponse = PendingRewardCardsResponse(rewardCardService.pending(currentUserId()))

    @PostMapping("/songs/{songId}/issue")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun issueSongCard(@PathVariable songId: Long, @RequestBody request: IssueSongCardRequest) {
        rewardCardQueryService.validateLyricLines(songId, request.lyricLineIndexes)
        rewardCardService.issueSongCard(currentUserId(), songId, request.signature, request.lyricLineIndexes)
    }

    @PostMapping("/artists/{artistId}/issue")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun issueArtistCard(@PathVariable artistId: Long, @RequestBody request: IssueArtistCardRequest) {
        rewardCardService.issueArtistCard(currentUserId(), artistId, request.signature)
    }

    @PostMapping("/songs/{songId}/seen")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun markSongCardSeen(@PathVariable songId: Long, @RequestBody request: MarkRewardCardSeenRequest) {
        rewardCardService.markSongCardSeen(currentUserId(), songId, parse<SongCardGrade>(request.grade))
    }

    @PostMapping("/artists/{artistId}/seen")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun markArtistCardSeen(@PathVariable artistId: Long, @RequestBody request: MarkRewardCardSeenRequest) {
        rewardCardService.markArtistCardSeen(currentUserId(), artistId, parse<ArtistCardGrade>(request.grade))
    }

    @PutMapping("/songs/{songId}/lyric")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updateSongCardLyric(@PathVariable songId: Long, @RequestBody request: UpdateSongCardLyricRequest) {
        rewardCardQueryService.validateLyricLines(songId, request.lyricLineIndexes)
        rewardCardService.updateSongCardLyric(currentUserId(), songId, request.lyricLineIndexes)
    }

    private inline fun <reified E : Enum<E>> parse(grade: String): E =
        enumValues<E>().firstOrNull { it.name == grade } ?: throw BusinessException(ErrorCode.INVALID_REWARD_CARD_GRADE)

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long
}

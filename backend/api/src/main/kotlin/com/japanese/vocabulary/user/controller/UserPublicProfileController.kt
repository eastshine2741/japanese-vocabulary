package com.japanese.vocabulary.user.controller

import com.japanese.vocabulary.deck.dto.DeckListResponse
import com.japanese.vocabulary.deck.dto.toResponse
import com.japanese.vocabulary.deck.service.DeckService
import com.japanese.vocabulary.flashcard.dto.FlashcardStatsResponse
import com.japanese.vocabulary.flashcard.dto.toResponse
import com.japanese.vocabulary.flashcard.service.FlashcardService
import com.japanese.vocabulary.rewardcard.dto.RewardCardsResponse
import com.japanese.vocabulary.rewardcard.service.RewardCardQueryService
import com.japanese.vocabulary.studystats.dto.HeatmapResponse
import com.japanese.vocabulary.studystats.dto.toHeatmapDay
import com.japanese.vocabulary.studystats.service.StudyStatsService
import com.japanese.vocabulary.user.dto.PublicUserProfileResponse
import com.japanese.vocabulary.user.service.ProfileImageService
import com.japanese.vocabulary.user.service.UserProfileService
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/** 다른 유저의 프로필(카드·학습 탭). 모두 읽기 전용이고, 내 프로필 API(`/me`, `/api/reward-cards` 등)와 같은 모양을 돌려준다. */
@RestController
@RequestMapping("/api/users/{userId}")
class UserPublicProfileController(
    private val userProfileService: UserProfileService,
    private val profileImageService: ProfileImageService,
    private val rewardCardQueryService: RewardCardQueryService,
    private val flashcardService: FlashcardService,
    private val deckService: DeckService,
    private val studyStatsService: StudyStatsService,
) {
    @GetMapping
    fun profile(@PathVariable userId: Long): PublicUserProfileResponse {
        val user = userProfileService.getPublicProfile(userId)
        return PublicUserProfileResponse(
            userId = user.id,
            username = user.username,
            name = user.name,
            profileImageUrl = profileImageService.publicUrl(user.profileImageKey),
            me = user.id == currentUserId(),
        )
    }

    /** 서명 전 카드는 주인도 아직 받지 않은 카드라 빼고 보낸다. */
    @GetMapping("/reward-cards")
    fun rewardCards(@PathVariable userId: Long): RewardCardsResponse {
        userProfileService.getPublicProfile(userId)
        val cards = rewardCardQueryService.cards(userId)
        return cards.copy(
            songCards = cards.songCards.filter { it.issued },
            artistCards = cards.artistCards.filter { it.issued },
        )
    }

    @GetMapping("/flashcard-stats")
    fun flashcardStats(@PathVariable userId: Long): FlashcardStatsResponse {
        userProfileService.getPublicProfile(userId)
        return flashcardService.getStats(userId).toResponse()
    }

    @GetMapping("/decks")
    fun decks(@PathVariable userId: Long, @RequestParam(required = false) cursor: Long?): DeckListResponse {
        userProfileService.getPublicProfile(userId)
        return deckService.getDeckList(userId, cursor).toResponse()
    }

    @GetMapping("/study-stats/heatmap")
    fun heatmap(@PathVariable userId: Long): HeatmapResponse {
        userProfileService.getPublicProfile(userId)
        return HeatmapResponse(days = studyStatsService.heatmap(userId).map { it.toHeatmapDay() })
    }

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long
}

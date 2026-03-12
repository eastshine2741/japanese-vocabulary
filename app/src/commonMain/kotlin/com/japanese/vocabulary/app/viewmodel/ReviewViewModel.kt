package com.japanese.vocabulary.app.viewmodel

import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import com.japanese.vocabulary.app.model.FlashcardDTO
import com.japanese.vocabulary.app.model.FlashcardStatsResponse
import com.japanese.vocabulary.app.network.FlashcardRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

sealed class ReviewState {
    object Loading : ReviewState()
    data class NoCards(val stats: FlashcardStatsResponse? = null) : ReviewState()
    data class Reviewing(
        val cards: List<FlashcardDTO>,
        val currentIndex: Int,
        val isRevealed: Boolean,
        val totalCount: Int
    ) : ReviewState()
    data class Summary(
        val totalReviewed: Int,
        val ratingCounts: Map<Int, Int>
    ) : ReviewState()
    data class Error(val message: String) : ReviewState()
}

class ReviewViewModel(private val repository: FlashcardRepository = FlashcardRepository()) {
    val state: MutableState<ReviewState> = mutableStateOf(ReviewState.Loading)
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val ratingCounts = mutableMapOf<Int, Int>()
    private var totalReviewed = 0

    fun loadDueCards() {
        state.value = ReviewState.Loading
        scope.launch {
            try {
                val response = repository.getDueFlashcards()
                if (response.cards.isEmpty()) {
                    val stats = try { repository.getStats() } catch (_: Exception) { null }
                    state.value = ReviewState.NoCards(stats = stats)
                } else {
                    ratingCounts.clear()
                    totalReviewed = 0
                    state.value = ReviewState.Reviewing(
                        cards = response.cards,
                        currentIndex = 0,
                        isRevealed = false,
                        totalCount = response.totalCount
                    )
                }
            } catch (e: Exception) {
                state.value = ReviewState.Error(e.message ?: "Failed to load flashcards")
            }
        }
    }

    fun reveal() {
        val current = state.value as? ReviewState.Reviewing ?: return
        state.value = current.copy(isRevealed = true)
    }

    fun rate(rating: Int) {
        val current = state.value as? ReviewState.Reviewing ?: return
        val card = current.cards[current.currentIndex]

        scope.launch {
            try {
                repository.reviewCard(card.id, rating)
                ratingCounts[rating] = (ratingCounts[rating] ?: 0) + 1
                totalReviewed++

                if (current.currentIndex + 1 < current.cards.size) {
                    state.value = ReviewState.Reviewing(
                        cards = current.cards,
                        currentIndex = current.currentIndex + 1,
                        isRevealed = false,
                        totalCount = current.totalCount
                    )
                } else {
                    state.value = ReviewState.Summary(
                        totalReviewed = totalReviewed,
                        ratingCounts = ratingCounts.toMap()
                    )
                }
            } catch (e: Exception) {
                state.value = ReviewState.Error(e.message ?: "Failed to submit review")
            }
        }
    }
}

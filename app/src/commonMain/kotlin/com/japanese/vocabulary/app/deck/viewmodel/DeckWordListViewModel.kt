package com.japanese.vocabulary.app.deck.viewmodel

import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import com.japanese.vocabulary.app.deck.dto.DeckWordItem
import com.japanese.vocabulary.app.deck.repository.DeckRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

sealed class DeckWordListState {
    object Loading : DeckWordListState()
    data class Success(val words: List<DeckWordItem>, val nextCursor: Long?) : DeckWordListState()
    data class Error(val message: String) : DeckWordListState()
}

class DeckWordListViewModel(private val repository: DeckRepository = DeckRepository()) {
    val state: MutableState<DeckWordListState> = mutableStateOf(DeckWordListState.Loading)
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var allWords = mutableListOf<DeckWordItem>()

    fun load(songId: Long?) {
        state.value = DeckWordListState.Loading
        allWords.clear()
        scope.launch {
            try {
                val response = repository.getDeckWords(songId)
                allWords.addAll(response.words)
                state.value = DeckWordListState.Success(allWords.toList(), response.nextCursor)
            } catch (e: Exception) {
                state.value = DeckWordListState.Error(e.message ?: "Failed to load words")
            }
        }
    }

    fun loadMore(songId: Long?) {
        val current = state.value as? DeckWordListState.Success ?: return
        val cursor = current.nextCursor ?: return
        scope.launch {
            try {
                val response = repository.getDeckWords(songId, cursor)
                allWords.addAll(response.words)
                state.value = DeckWordListState.Success(allWords.toList(), response.nextCursor)
            } catch (e: Exception) {
                // Keep current state on load more failure
            }
        }
    }
}

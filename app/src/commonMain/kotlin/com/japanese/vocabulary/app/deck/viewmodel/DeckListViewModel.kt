package com.japanese.vocabulary.app.deck.viewmodel

import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import com.japanese.vocabulary.app.deck.dto.DeckListResponse
import com.japanese.vocabulary.app.deck.repository.DeckRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

sealed class DeckListState {
    object Loading : DeckListState()
    data class Success(val data: DeckListResponse) : DeckListState()
    data class Error(val message: String) : DeckListState()
}

class DeckListViewModel(private val repository: DeckRepository = DeckRepository()) {
    val state: MutableState<DeckListState> = mutableStateOf(DeckListState.Loading)
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    fun load() {
        state.value = DeckListState.Loading
        scope.launch {
            try {
                val response = repository.getDeckList()
                state.value = DeckListState.Success(response)
            } catch (e: Exception) {
                state.value = DeckListState.Error(e.message ?: "Failed to load decks")
            }
        }
    }
}

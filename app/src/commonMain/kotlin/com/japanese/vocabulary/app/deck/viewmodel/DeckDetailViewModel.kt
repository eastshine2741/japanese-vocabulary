package com.japanese.vocabulary.app.deck.viewmodel

import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import com.japanese.vocabulary.app.deck.dto.DeckDetailResponse
import com.japanese.vocabulary.app.deck.repository.DeckRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

sealed class DeckDetailState {
    object Loading : DeckDetailState()
    data class Success(val data: DeckDetailResponse) : DeckDetailState()
    data class Error(val message: String) : DeckDetailState()
}

class DeckDetailViewModel(private val repository: DeckRepository = DeckRepository()) {
    val state: MutableState<DeckDetailState> = mutableStateOf(DeckDetailState.Loading)
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    fun load(songId: Long?) {
        state.value = DeckDetailState.Loading
        scope.launch {
            try {
                val response = repository.getDeckDetail(songId)
                state.value = DeckDetailState.Success(response)
            } catch (e: Exception) {
                state.value = DeckDetailState.Error(e.message ?: "Failed to load deck detail")
            }
        }
    }
}

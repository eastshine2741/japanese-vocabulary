package com.japanese.vocabulary.app.viewmodel

import com.japanese.vocabulary.app.model.SongSearchItem
import com.japanese.vocabulary.app.network.SongRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class SearchUiState {
    object Idle : SearchUiState()
    object Loading : SearchUiState()
    data class Success(
        val items: List<SongSearchItem>,
        val nextPageToken: String?,
        val isLoadingMore: Boolean = false
    ) : SearchUiState()
    data class Error(val message: String) : SearchUiState()
}

class SearchViewModel(private val repository: SongRepository = SongRepository()) {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val _state = MutableStateFlow<SearchUiState>(SearchUiState.Idle)
    val state: StateFlow<SearchUiState> = _state.asStateFlow()
    private var currentQuery = ""

    fun search(query: String) {
        currentQuery = query
        _state.value = SearchUiState.Loading
        scope.launch {
            try {
                val response = repository.search(query)
                _state.value = SearchUiState.Success(
                    items = response.items,
                    nextPageToken = response.nextPageToken
                )
            } catch (e: Exception) {
                _state.value = SearchUiState.Error(e.message ?: "Unknown error")
            }
        }
    }

    fun loadMore() {
        val current = _state.value as? SearchUiState.Success ?: return
        if (current.isLoadingMore || current.nextPageToken == null) return
        _state.value = current.copy(isLoadingMore = true)
        scope.launch {
            try {
                val response = repository.search(currentQuery, pageToken = current.nextPageToken)
                _state.value = SearchUiState.Success(
                    items = current.items + response.items,
                    nextPageToken = response.nextPageToken
                )
            } catch (e: Exception) {
                _state.value = SearchUiState.Error(e.message ?: "Unknown error")
            }
        }
    }
}

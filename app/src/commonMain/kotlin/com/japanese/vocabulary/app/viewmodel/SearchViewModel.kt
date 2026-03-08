package com.japanese.vocabulary.app.viewmodel

import com.japanese.vocabulary.app.model.SongSearchItem
import com.japanese.vocabulary.app.model.SongStudyData
import com.japanese.vocabulary.app.network.SongRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class AnalyzeUiState {
    object Idle : AnalyzeUiState()
    object Loading : AnalyzeUiState()
    data class Success(val result: SongStudyData) : AnalyzeUiState()
    data class Error(val message: String) : AnalyzeUiState()
}

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
    private val _analyzeState = MutableStateFlow<AnalyzeUiState>(AnalyzeUiState.Idle)
    val analyzeState: StateFlow<AnalyzeUiState> = _analyzeState.asStateFlow()
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

    fun analyze(item: SongSearchItem) {
        _analyzeState.value = AnalyzeUiState.Loading
        scope.launch {
            try {
                val result = repository.analyze(item.title, item.channelTitle, item.durationSeconds)
                _analyzeState.value = AnalyzeUiState.Success(result)
            } catch (e: Exception) {
                _analyzeState.value = AnalyzeUiState.Error(e.message ?: "Unknown error")
            }
        }
    }

    fun resetAnalyze() {
        _analyzeState.value = AnalyzeUiState.Idle
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

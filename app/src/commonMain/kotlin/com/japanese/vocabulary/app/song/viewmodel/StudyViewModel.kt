package com.japanese.vocabulary.app.song.viewmodel

import com.japanese.vocabulary.app.song.dto.SongStudyData
import com.japanese.vocabulary.app.song.repository.SongRepository
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

sealed class StudyUiState {
    object Idle : StudyUiState()
    object Loading : StudyUiState()
    data class Success(val data: SongStudyData) : StudyUiState()
    data class Error(val message: String) : StudyUiState()
}

class StudyViewModel(private val repository: SongRepository = SongRepository()) {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val _state = MutableStateFlow<StudyUiState>(StudyUiState.Idle)
    val state: StateFlow<StudyUiState> = _state.asStateFlow()

    fun load(title: String, artist: String, durationSeconds: Int? = null) {
        scope.launch {
            _state.value = StudyUiState.Loading
            _state.value = try {
                StudyUiState.Success(repository.analyze(title, artist, durationSeconds))
            } catch (e: Exception) {
                StudyUiState.Error(e.message ?: "Unknown error")
            }
        }
    }
}

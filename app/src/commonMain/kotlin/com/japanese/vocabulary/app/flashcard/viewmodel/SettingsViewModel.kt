package com.japanese.vocabulary.app.flashcard.viewmodel

import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import com.japanese.vocabulary.app.flashcard.dto.UserSettingsDTO
import com.japanese.vocabulary.app.flashcard.repository.FlashcardRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

sealed class SettingsState {
    object Loading : SettingsState()
    data class Loaded(
        val requestRetention: Double,
        val showIntervals: Boolean = true,
        val isSaving: Boolean = false,
        val saveSuccess: Boolean = false
    ) : SettingsState()
    data class Error(val message: String) : SettingsState()
}

class SettingsViewModel(private val repository: FlashcardRepository = FlashcardRepository()) {
    val state: MutableState<SettingsState> = mutableStateOf(SettingsState.Loading)
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    fun loadSettings() {
        state.value = SettingsState.Loading
        scope.launch {
            try {
                val settings = repository.getSettings()
                state.value = SettingsState.Loaded(
                    requestRetention = settings.requestRetention,
                    showIntervals = settings.showIntervals
                )
            } catch (e: Exception) {
                state.value = SettingsState.Error(e.message ?: "Failed to load settings")
            }
        }
    }

    fun updateRetention(value: Double) {
        val current = state.value as? SettingsState.Loaded ?: return
        state.value = current.copy(requestRetention = value, saveSuccess = false)
    }

    fun updateShowIntervals(value: Boolean) {
        val current = state.value as? SettingsState.Loaded ?: return
        state.value = current.copy(showIntervals = value, saveSuccess = false)
    }

    fun saveSettings() {
        val current = state.value as? SettingsState.Loaded ?: return
        state.value = current.copy(isSaving = true)
        scope.launch {
            try {
                val result = repository.updateSettings(
                    UserSettingsDTO(
                        requestRetention = current.requestRetention,
                        showIntervals = current.showIntervals
                    )
                )
                state.value = SettingsState.Loaded(
                    requestRetention = result.requestRetention,
                    showIntervals = result.showIntervals,
                    isSaving = false,
                    saveSuccess = true
                )
            } catch (e: Exception) {
                state.value = SettingsState.Error(e.message ?: "Failed to save settings")
            }
        }
    }
}

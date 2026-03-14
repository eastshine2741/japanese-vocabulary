package com.japanese.vocabulary.app.viewmodel

import com.japanese.vocabulary.app.model.RecentSongItem
import com.japanese.vocabulary.app.network.SongRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class RecentSongsState {
    object Loading : RecentSongsState()
    data class Success(val songs: List<RecentSongItem>) : RecentSongsState()
    data class Error(val message: String) : RecentSongsState()
}

class HomeViewModel(private val repository: SongRepository = SongRepository()) {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val _recentSongs = MutableStateFlow<RecentSongsState>(RecentSongsState.Loading)
    val recentSongs: StateFlow<RecentSongsState> = _recentSongs.asStateFlow()

    fun loadRecentSongs() {
        _recentSongs.value = RecentSongsState.Loading
        scope.launch {
            try {
                val songs = repository.getRecentSongs()
                _recentSongs.value = RecentSongsState.Success(songs)
            } catch (e: Exception) {
                _recentSongs.value = RecentSongsState.Error(e.message ?: "Failed to load recent songs")
            }
        }
    }
}

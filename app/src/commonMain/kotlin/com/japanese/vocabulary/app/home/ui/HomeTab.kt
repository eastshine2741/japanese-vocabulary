package com.japanese.vocabulary.app.home.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.flashcard.dto.FlashcardStatsResponse
import com.japanese.vocabulary.app.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.app.home.viewmodel.HomeViewModel
import com.japanese.vocabulary.app.home.viewmodel.RecentSongsState
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.song.viewmodel.AnalyzeUiState
import com.japanese.vocabulary.app.song.viewmodel.SearchViewModel
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppDimens
import com.japanese.vocabulary.app.ui.components.SongCard
import com.japanese.vocabulary.app.ui.components.StatsCard

@Composable
fun HomeTab(
    onNavigate: (Screen) -> Unit,
    homeViewModel: HomeViewModel,
    searchViewModel: SearchViewModel
) {
    val recentSongsState by homeViewModel.recentSongs.collectAsState()
    val analyzeState by searchViewModel.analyzeState.collectAsState()

    var stats by remember { mutableStateOf<FlashcardStatsResponse?>(null) }

    LaunchedEffect(Unit) {
        homeViewModel.loadRecentSongs()
        try {
            stats = FlashcardRepository().getStats()
        } catch (_: Exception) {}
    }

    LaunchedEffect(analyzeState) {
        if (analyzeState is AnalyzeUiState.Success) {
            onNavigate(Screen.Player())
        }
    }

    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(AppDimens.ScreenPadding),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Search bar
        item(span = { GridItemSpan(3) }) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onNavigate(Screen.Search) },
                shape = RoundedCornerShape(AppDimens.SmallCornerRadius),
                color = AppColors.Surface,
                border = CardDefaults.outlinedCardBorder()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Search,
                        contentDescription = "Search",
                        tint = AppColors.TextTertiary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Search for a song...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppColors.TextTertiary
                    )
                }
            }
        }

        // Stats card
        item(span = { GridItemSpan(3) }) {
            StatsCard(
                wordCount = stats?.total?.toInt() ?: 0,
                dueToday = stats?.due?.toInt() ?: 0,
                onAction = { onNavigate(Screen.Review(null)) },
                actionLabel = "Resume Learning"
            )
        }

        // Recently Played heading
        item(span = { GridItemSpan(3) }) {
            when (recentSongsState) {
                is RecentSongsState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(40.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp))
                    }
                }
                is RecentSongsState.Error -> {
                    Column {
                        Text(
                            "Recently Played",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                            color = AppColors.TextPrimary
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            (recentSongsState as RecentSongsState.Error).message,
                            style = MaterialTheme.typography.bodySmall,
                            color = AppColors.TextSecondary
                        )
                        TextButton(onClick = { homeViewModel.loadRecentSongs() }) {
                            Text("Retry")
                        }
                    }
                }
                is RecentSongsState.Success -> {
                    Text(
                        "Recently Played",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                        color = AppColors.TextPrimary
                    )
                }
            }
        }

        // Recent songs grid
        if (recentSongsState is RecentSongsState.Success) {
            val songs = (recentSongsState as RecentSongsState.Success).songs
            if (songs.isEmpty()) {
                item(span = { GridItemSpan(3) }) {
                    Text(
                        "No recent songs yet. Search for a song to get started!",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppColors.TextSecondary
                    )
                }
            } else {
                items(songs) { song ->
                    SongCard(
                        artworkUrl = song.artworkUrl,
                        title = song.title,
                        artist = song.artist,
                        onClick = { searchViewModel.loadById(song.id) }
                    )
                }
            }
        }

        // Loading overlay indicator
        if (analyzeState is AnalyzeUiState.Loading) {
            item(span = { GridItemSpan(3) }) {
                Box(
                    modifier = Modifier.fillMaxWidth().height(80.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = AppColors.Primary)
                }
            }
        }
    }
}

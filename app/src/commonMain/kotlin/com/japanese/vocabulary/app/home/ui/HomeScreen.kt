package com.japanese.vocabulary.app.home.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.song.dto.RecentSongItem
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.song.viewmodel.AnalyzeUiState
import com.japanese.vocabulary.app.home.viewmodel.HomeViewModel
import com.japanese.vocabulary.app.home.viewmodel.RecentSongsState
import com.japanese.vocabulary.app.song.viewmodel.SearchViewModel
import io.kamel.image.KamelImage
import io.kamel.image.asyncPainterResource
import io.ktor.http.Url

@Composable
fun HomeScreen(
    onNavigate: (Screen) -> Unit,
    homeViewModel: HomeViewModel,
    searchViewModel: SearchViewModel
) {
    val recentSongsState by homeViewModel.recentSongs.collectAsState()
    val analyzeState by searchViewModel.analyzeState.collectAsState()

    LaunchedEffect(Unit) {
        homeViewModel.loadRecentSongs()
    }

    LaunchedEffect(analyzeState) {
        if (analyzeState is AnalyzeUiState.Success) {
            onNavigate(Screen.Player(origin = Screen.Home))
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Japanese Vocabulary", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text("Learn through songs", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(32.dp))
        Button(onClick = { onNavigate(Screen.Search) }, modifier = Modifier.fillMaxWidth()) {
            Text("Find a Song")
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = { onNavigate(Screen.Review()) }, modifier = Modifier.fillMaxWidth()) {
            Text("Review")
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = { onNavigate(Screen.DeckList) }, modifier = Modifier.fillMaxWidth()) {
            Text("Decks")
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = { onNavigate(Screen.Vocabulary) }, modifier = Modifier.fillMaxWidth()) {
            Text("Vocabulary")
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = { onNavigate(Screen.Settings) }, modifier = Modifier.fillMaxWidth()) {
            Text("Settings")
        }

        Spacer(Modifier.height(32.dp))

        RecentSongsSection(
            state = recentSongsState,
            analyzeState = analyzeState,
            onSongClick = { song -> searchViewModel.loadById(song.id) },
            onRetry = { homeViewModel.loadRecentSongs() }
        )
    }
}

@Composable
private fun RecentSongsSection(
    state: RecentSongsState,
    analyzeState: AnalyzeUiState,
    onSongClick: (RecentSongItem) -> Unit,
    onRetry: () -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            "Recent Songs",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(bottom = 12.dp)
        )

        when (state) {
            is RecentSongsState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxWidth().height(120.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp))
                }
            }
            is RecentSongsState.Error -> {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        state.message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    TextButton(onClick = onRetry) {
                        Text("Retry")
                    }
                }
            }
            is RecentSongsState.Success -> {
                if (state.songs.isEmpty()) {
                    Text(
                        "No recent songs yet",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    Box {
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(state.songs) { song ->
                                RecentSongCard(song = song, onClick = { onSongClick(song) })
                            }
                        }

                        if (analyzeState is AnalyzeUiState.Loading) {
                            Box(
                                modifier = Modifier.matchParentSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator()
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RecentSongCard(song: RecentSongItem, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .width(120.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column {
            if (song.artworkUrl != null) {
                KamelImage(
                    resource = asyncPainterResource(Url(song.artworkUrl)),
                    contentDescription = song.title,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                        .clip(RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp)),
                    onLoading = {
                        Surface(
                            color = Color.LightGray,
                            modifier = Modifier.fillMaxWidth().height(120.dp)
                        ) {}
                    },
                    onFailure = {
                        Surface(
                            color = Color.LightGray,
                            modifier = Modifier.fillMaxWidth().height(120.dp)
                        ) {}
                    }
                )
            } else {
                Surface(
                    color = Color.LightGray,
                    modifier = Modifier.fillMaxWidth().height(120.dp)
                        .clip(RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp))
                ) {}
            }
            Column(modifier = Modifier.padding(8.dp)) {
                Text(
                    song.title,
                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    song.artist,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

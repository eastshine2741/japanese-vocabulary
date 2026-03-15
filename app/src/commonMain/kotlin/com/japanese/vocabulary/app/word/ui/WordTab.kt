package com.japanese.vocabulary.app.word.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.deck.viewmodel.DeckListState
import com.japanese.vocabulary.app.deck.viewmodel.DeckListViewModel
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppDimens
import com.japanese.vocabulary.app.ui.components.SongListItem
import com.japanese.vocabulary.app.ui.components.StatsCard

@Composable
fun WordTab(
    onNavigate: (Screen) -> Unit,
    deckListViewModel: DeckListViewModel
) {
    val deckListState by deckListViewModel.state

    LaunchedEffect(Unit) {
        deckListViewModel.load()
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = AppDimens.ScreenPadding)
    ) {
        Spacer(Modifier.height(16.dp))
        Text(
            "My Words",
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
            color = AppColors.TextPrimary
        )
        Spacer(Modifier.height(16.dp))

        when (val state = deckListState) {
            is DeckListState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AppColors.Primary)
                }
            }
            is DeckListState.Error -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.message, color = AppColors.RatingAgain)
                        Spacer(Modifier.height(16.dp))
                        Button(
                            onClick = { deckListViewModel.load() },
                            colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
                        ) {
                            Text("Retry")
                        }
                    }
                }
            }
            is DeckListState.Success -> {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        StatsCard(
                            wordCount = state.data.allDeck.wordCount,
                            dueToday = 0,
                            onAction = { onNavigate(Screen.DeckDetail(null)) },
                            actionLabel = "View All Words"
                        )
                    }

                    item {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "By Song",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                            color = AppColors.TextPrimary
                        )
                        Spacer(Modifier.height(4.dp))
                    }

                    items(state.data.songDecks) { deck ->
                        SongListItem(
                            artworkUrl = deck.artworkUrl,
                            title = deck.title,
                            subtitle = "${deck.artist} · ${deck.wordCount} words",
                            trailing = deck.avgRetrievability?.let { "${(it * 100).toInt()}%" },
                            onClick = { onNavigate(Screen.DeckDetail(deck.songId)) }
                        )
                    }

                    if (state.data.songDecks.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    "No words saved yet. Start by studying a song!",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = AppColors.TextSecondary
                                )
                            }
                        }
                    }

                    item { Spacer(Modifier.height(16.dp)) }
                }
            }
        }
    }
}

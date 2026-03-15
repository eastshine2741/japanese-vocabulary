package com.japanese.vocabulary.app.deck.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.deck.dto.SongDeckSummary
import com.japanese.vocabulary.app.deck.viewmodel.DeckListState
import com.japanese.vocabulary.app.deck.viewmodel.DeckListViewModel
import io.kamel.image.KamelImage
import io.kamel.image.asyncPainterResource
import io.ktor.http.Url

@Composable
fun DeckListScreen(
    viewModel: DeckListViewModel,
    onNavigateBack: () -> Unit,
    onNavigateAllDeck: () -> Unit,
    onNavigateSongDeck: (Long) -> Unit
) {
    val deckListState by viewModel.state

    LaunchedEffect(Unit) {
        viewModel.load()
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onNavigateBack) { Text("\u2190 Back") }
            Spacer(Modifier.weight(1f))
            Text("Decks", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(end = 16.dp))
        }

        when (val state = deckListState) {
            is DeckListState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is DeckListState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.message, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = { viewModel.load() }) { Text("Retry") }
                    }
                }
            }
            is DeckListState.Success -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(vertical = 8.dp)
                ) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth().clickable { onNavigateAllDeck() },
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("All Words", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                                    Text(
                                        "${state.data.allDeck.wordCount} words",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                state.data.allDeck.avgRetrievability?.let { r ->
                                    Text(
                                        "${(r * 100).toInt()}%",
                                        style = MaterialTheme.typography.titleMedium,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        }
                    }

                    items(state.data.songDecks) { deck ->
                        SongDeckCard(deck = deck, onClick = { onNavigateSongDeck(deck.songId) })
                    }
                }
            }
        }
    }
}

@Composable
private fun SongDeckCard(deck: SongDeckSummary, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (deck.artworkUrl != null) {
                KamelImage(
                    resource = asyncPainterResource(Url(deck.artworkUrl)),
                    contentDescription = deck.title,
                    modifier = Modifier.size(48.dp).clip(RoundedCornerShape(6.dp)),
                    onLoading = {
                        Surface(color = Color.LightGray, modifier = Modifier.size(48.dp)) {}
                    },
                    onFailure = {
                        Surface(color = Color.LightGray, modifier = Modifier.size(48.dp)) {}
                    }
                )
                Spacer(Modifier.width(12.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    deck.title,
                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    "${deck.artist} · ${deck.wordCount} words",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            deck.avgRetrievability?.let { r ->
                Text(
                    "${(r * 100).toInt()}%",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

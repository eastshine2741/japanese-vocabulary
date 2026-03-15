package com.japanese.vocabulary.app.deck.ui

import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.deck.dto.DeckDetailResponse
import com.japanese.vocabulary.app.deck.viewmodel.DeckDetailState
import com.japanese.vocabulary.app.deck.viewmodel.DeckDetailViewModel
import io.kamel.image.KamelImage
import io.kamel.image.asyncPainterResource
import io.ktor.http.Url

@Composable
fun DeckDetailScreen(
    songId: Long?,
    viewModel: DeckDetailViewModel,
    onNavigateBack: () -> Unit,
    onStartReview: (Long?) -> Unit,
    onViewWords: (Long?) -> Unit
) {
    val detailState by viewModel.state

    LaunchedEffect(songId) {
        viewModel.load(songId)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onNavigateBack) { Text("\u2190 Back") }
            Spacer(Modifier.weight(1f))
            Text(
                if (songId != null) "Deck" else "All Words",
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.padding(end = 16.dp)
            )
        }

        when (val state = detailState) {
            is DeckDetailState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is DeckDetailState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.message, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = { viewModel.load(songId) }) { Text("Retry") }
                    }
                }
            }
            is DeckDetailState.Success -> {
                DeckDetailContent(
                    detail = state.data,
                    songId = songId,
                    onStartReview = onStartReview,
                    onViewWords = onViewWords
                )
            }
        }
    }
}

@Composable
private fun DeckDetailContent(
    detail: DeckDetailResponse,
    songId: Long?,
    onStartReview: (Long?) -> Unit,
    onViewWords: (Long?) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (detail.artworkUrl != null) {
            KamelImage(
                resource = asyncPainterResource(Url(detail.artworkUrl)),
                contentDescription = detail.title,
                modifier = Modifier.size(120.dp).clip(RoundedCornerShape(12.dp)),
                onLoading = { Surface(color = Color.LightGray, modifier = Modifier.size(120.dp)) {} },
                onFailure = { Surface(color = Color.LightGray, modifier = Modifier.size(120.dp)) {} }
            )
            Spacer(Modifier.height(16.dp))
        }

        if (detail.title != null) {
            Text(detail.title, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
        }
        if (detail.artist != null) {
            Text(detail.artist, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        Spacer(Modifier.height(24.dp))

        // Stats card
        Card(
            modifier = Modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Total Words", style = MaterialTheme.typography.bodyMedium)
                    Text("${detail.wordCount}", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                }
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Due Today", style = MaterialTheme.typography.bodyMedium)
                    Text("${detail.dueCount}", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                }
                if (detail.avgRetrievability != null) {
                    Spacer(Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Retrievability", style = MaterialTheme.typography.bodyMedium)
                        Text("${(detail.avgRetrievability * 100).toInt()}%", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // State breakdown
        Card(
            modifier = Modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StateChip("New", detail.stateCounts.new)
                StateChip("Learning", detail.stateCounts.learning)
                StateChip("Review", detail.stateCounts.review)
                StateChip("Relearn", detail.stateCounts.relearning)
            }
        }

        Spacer(Modifier.height(24.dp))

        Button(
            onClick = { onStartReview(songId) },
            modifier = Modifier.fillMaxWidth(),
            enabled = detail.dueCount > 0
        ) {
            Text(if (detail.dueCount > 0) "Review ${detail.dueCount} Cards" else "No Cards Due")
        }

        Spacer(Modifier.height(12.dp))

        OutlinedButton(
            onClick = { onViewWords(songId) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("View Words")
        }
    }
}

@Composable
private fun StateChip(label: String, count: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text("$count", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

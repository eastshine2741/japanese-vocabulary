package com.japanese.vocabulary.app.flashcard.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.japanese.vocabulary.app.flashcard.dto.FlashcardDTO
import com.japanese.vocabulary.app.flashcard.dto.FlashcardStatsResponse
import com.japanese.vocabulary.app.flashcard.viewmodel.ReviewState
import com.japanese.vocabulary.app.flashcard.viewmodel.ReviewViewModel

@Composable
fun ReviewScreen(viewModel: ReviewViewModel, onNavigateHome: () -> Unit) {
    val reviewState by viewModel.state

    LaunchedEffect(Unit) {
        viewModel.loadDueCards()
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onNavigateHome) {
                Text("\u2190 \ud648\uc73c\ub85c")
            }
            Spacer(Modifier.weight(1f))
            Text("Review", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(end = 16.dp))
        }

        when (val state = reviewState) {
            is ReviewState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is ReviewState.NoCards -> {
                NoCardsContent(stats = state.stats, onNavigateHome = onNavigateHome)
            }
            is ReviewState.Reviewing -> {
                ReviewingContent(
                    state = state,
                    onReveal = { viewModel.reveal() },
                    onRate = { rating -> viewModel.rate(rating) }
                )
            }
            is ReviewState.Summary -> {
                SummaryContent(state = state, onDone = onNavigateHome)
            }
            is ReviewState.Error -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            state.message,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadDueCards() }) {
                            Text("Retry")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NoCardsContent(stats: FlashcardStatsResponse?, onNavigateHome: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                "No cards due for review",
                style = MaterialTheme.typography.headlineSmall,
                textAlign = TextAlign.Center
            )
            if (stats != null) {
                Spacer(Modifier.height(16.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Stats", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                        Spacer(Modifier.height(8.dp))
                        Text("Total: ${stats.total}", style = MaterialTheme.typography.bodyMedium)
                        Text("New: ${stats.newCount}", style = MaterialTheme.typography.bodyMedium)
                        Text("Learning: ${stats.learning}", style = MaterialTheme.typography.bodyMedium)
                        Text("Review: ${stats.review}", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            Spacer(Modifier.height(32.dp))
            Button(onClick = onNavigateHome) {
                Text("Back to Home")
            }
        }
    }
}

@Composable
private fun ReviewingContent(
    state: ReviewState.Reviewing,
    onReveal: () -> Unit,
    onRate: (Int) -> Unit
) {
    val card = state.cards[state.currentIndex]

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            "${state.currentIndex + 1} / ${state.totalCount}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(16.dp))

        Card(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .then(if (!state.isRevealed) Modifier.clickable { onReveal() } else Modifier),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Box(
                modifier = Modifier.fillMaxSize().padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        card.japanese,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )

                    if (state.isRevealed) {
                        Spacer(Modifier.height(16.dp))
                        if (card.reading != null) {
                            Text(
                                card.reading,
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(Modifier.height(8.dp))
                        }
                        if (card.koreanText != null) {
                            Text(
                                card.koreanText,
                                style = MaterialTheme.typography.titleLarge,
                                textAlign = TextAlign.Center
                            )
                        }
                        if (card.examples.isNotEmpty()) {
                            Spacer(Modifier.height(16.dp))
                            HorizontalDivider()
                            Spacer(Modifier.height(8.dp))
                            card.examples.forEach { example ->
                                Column(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    if (example.songTitle != null) {
                                        Text(
                                            example.songTitle,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            textAlign = TextAlign.Center
                                        )
                                    }
                                    if (example.lyricLine != null) {
                                        Text(
                                            example.lyricLine,
                                            style = MaterialTheme.typography.bodyMedium.copy(fontStyle = FontStyle.Italic),
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            textAlign = TextAlign.Center
                                        )
                                    }
                                }
                            }
                        }
                    } else {
                        Spacer(Modifier.height(24.dp))
                        Text(
                            "Tap to reveal",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        if (state.isRevealed) {
            Spacer(Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val labels = listOf(1 to "Again", 2 to "Hard", 3 to "Good", 4 to "Easy")
                val colors = listOf(
                    MaterialTheme.colorScheme.error,
                    MaterialTheme.colorScheme.tertiary,
                    MaterialTheme.colorScheme.primary,
                    MaterialTheme.colorScheme.secondary
                )
                labels.forEachIndexed { index, (rating, label) ->
                    Button(
                        onClick = { onRate(rating) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = colors[index])
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(label, fontSize = 12.sp)
                            val interval = card.intervals?.get(rating)
                            if (interval != null) {
                                Text(interval, fontSize = 10.sp)
                            }
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun SummaryContent(state: ReviewState.Summary, onDone: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                "Session Complete",
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(16.dp))
            Text(
                "Cards reviewed: ${state.totalReviewed}",
                style = MaterialTheme.typography.titleMedium
            )
            Spacer(Modifier.height(16.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    val labels = mapOf(1 to "Again", 2 to "Hard", 3 to "Good", 4 to "Easy")
                    labels.forEach { (rating, label) ->
                        val count = state.ratingCounts[rating] ?: 0
                        if (count > 0) {
                            Text("$label: $count", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
            Spacer(Modifier.height(32.dp))
            Button(onClick = onDone) {
                Text("Done")
            }
        }
    }
}

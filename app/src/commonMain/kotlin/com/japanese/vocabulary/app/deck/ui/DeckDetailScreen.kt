package com.japanese.vocabulary.app.deck.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.deck.dto.DeckDetailResponse
import com.japanese.vocabulary.app.deck.viewmodel.DeckDetailState
import com.japanese.vocabulary.app.deck.viewmodel.DeckDetailViewModel
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppDimens
import com.japanese.vocabulary.app.ui.components.AppTopBar
import com.japanese.vocabulary.app.ui.components.ArtworkImage

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

    Column(
        modifier = Modifier.fillMaxSize().background(AppColors.Background)
    ) {
        AppTopBar(
            title = if (songId != null) "Deck" else "All Words",
            onBack = onNavigateBack
        )

        when (val state = detailState) {
            is DeckDetailState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AppColors.Primary)
                }
            }
            is DeckDetailState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.message, color = AppColors.RatingAgain)
                        Spacer(Modifier.height(16.dp))
                        Button(
                            onClick = { viewModel.load(songId) },
                            colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
                        ) {
                            Text("Retry")
                        }
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
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(AppDimens.ScreenPadding),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(16.dp))

        // Large centered artwork
        if (detail.artworkUrl != null) {
            ArtworkImage(
                url = detail.artworkUrl,
                size = 160.dp,
                cornerRadius = 16.dp
            )
            Spacer(Modifier.height(20.dp))
        }

        // Song info
        if (detail.title != null) {
            Text(
                detail.title,
                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                textAlign = TextAlign.Center,
                color = AppColors.TextPrimary
            )
        }
        if (detail.artist != null) {
            Text(
                detail.artist,
                style = MaterialTheme.typography.bodyLarge,
                color = AppColors.TextSecondary
            )
        }

        Spacer(Modifier.height(24.dp))

        // Stats card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(AppDimens.CardCornerRadius),
            colors = CardDefaults.cardColors(containerColor = AppColors.Surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            border = CardDefaults.outlinedCardBorder()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                StatRow("Total Words", "${detail.wordCount}")
                StatRow("Due Today", "${detail.dueCount}")
                if (detail.avgRetrievability != null) {
                    StatRow("Retrievability", "${(detail.avgRetrievability * 100).toInt()}%")
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        // State breakdown
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(AppDimens.CardCornerRadius),
            colors = CardDefaults.cardColors(containerColor = AppColors.Surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            border = CardDefaults.outlinedCardBorder()
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

        // Start Review button
        Button(
            onClick = { onStartReview(songId) },
            modifier = Modifier.fillMaxWidth(),
            enabled = detail.dueCount > 0,
            shape = RoundedCornerShape(AppDimens.SmallCornerRadius),
            colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
        ) {
            Text(
                if (detail.dueCount > 0) "Start Review (${detail.dueCount})" else "No Cards Due",
                modifier = Modifier.padding(vertical = 4.dp)
            )
        }

        Spacer(Modifier.height(12.dp))

        OutlinedButton(
            onClick = { onViewWords(songId) },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(AppDimens.SmallCornerRadius)
        ) {
            Text("View Words", modifier = Modifier.padding(vertical = 4.dp))
        }
    }
}

@Composable
private fun StatRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = AppColors.TextSecondary)
        Text(value, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold), color = AppColors.TextPrimary)
    }
}

@Composable
private fun StateChip(label: String, count: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            "$count",
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
            color = AppColors.Primary
        )
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = AppColors.TextSecondary
        )
    }
}

// --- Previews ---

@org.jetbrains.compose.ui.tooling.preview.Preview
@Composable
private fun PreviewDeckDetailSongDeck() {
    com.japanese.vocabulary.app.theme.AppTheme {
        DeckDetailContent(
            detail = DeckDetailResponse(
                songId = 1,
                title = "Lemon",
                artist = "米津玄師",
                artworkUrl = "https://example.com/artwork.jpg",
                wordCount = 42,
                dueCount = 8,
                stateCounts = com.japanese.vocabulary.app.deck.dto.StateCounts(
                    new = 12, learning = 5, review = 20, relearning = 5
                ),
                avgRetrievability = 0.85
            ),
            songId = 1,
            onStartReview = {},
            onViewWords = {}
        )
    }
}

@org.jetbrains.compose.ui.tooling.preview.Preview
@Composable
private fun PreviewDeckDetailAllDeck() {
    com.japanese.vocabulary.app.theme.AppTheme {
        DeckDetailContent(
            detail = DeckDetailResponse(
                songId = null,
                title = null,
                artist = null,
                artworkUrl = null,
                wordCount = 156,
                dueCount = 23,
                stateCounts = com.japanese.vocabulary.app.deck.dto.StateCounts(
                    new = 30, learning = 18, review = 95, relearning = 13
                ),
                avgRetrievability = 0.72
            ),
            songId = null,
            onStartReview = {},
            onViewWords = {}
        )
    }
}

@org.jetbrains.compose.ui.tooling.preview.Preview
@Composable
private fun PreviewDeckDetailWithDueCards() {
    com.japanese.vocabulary.app.theme.AppTheme {
        DeckDetailContent(
            detail = DeckDetailResponse(
                songId = 2,
                title = "花に亡霊",
                artist = "ヨルシカ",
                artworkUrl = "https://example.com/artwork2.jpg",
                wordCount = 35,
                dueCount = 15,
                stateCounts = com.japanese.vocabulary.app.deck.dto.StateCounts(
                    new = 8, learning = 7, review = 18, relearning = 2
                ),
                avgRetrievability = 0.68
            ),
            songId = 2,
            onStartReview = {},
            onViewWords = {}
        )
    }
}

@org.jetbrains.compose.ui.tooling.preview.Preview
@Composable
private fun PreviewDeckDetailNoDueCards() {
    com.japanese.vocabulary.app.theme.AppTheme {
        DeckDetailContent(
            detail = DeckDetailResponse(
                songId = 3,
                title = "夜に駆ける",
                artist = "YOASOBI",
                artworkUrl = "https://example.com/artwork3.jpg",
                wordCount = 28,
                dueCount = 0,
                stateCounts = com.japanese.vocabulary.app.deck.dto.StateCounts(
                    new = 0, learning = 0, review = 28, relearning = 0
                ),
                avgRetrievability = 0.95
            ),
            songId = 3,
            onStartReview = {},
            onViewWords = {}
        )
    }
}

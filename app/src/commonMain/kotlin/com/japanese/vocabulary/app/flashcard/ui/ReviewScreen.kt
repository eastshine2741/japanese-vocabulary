package com.japanese.vocabulary.app.flashcard.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.flashcard.dto.FlashcardStatsResponse
import com.japanese.vocabulary.app.flashcard.viewmodel.ReviewState
import com.japanese.vocabulary.app.flashcard.viewmodel.ReviewViewModel
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppDimens
import com.japanese.vocabulary.app.ui.components.AppTopBar
import com.japanese.vocabulary.app.ui.components.FlashcardView
import com.japanese.vocabulary.app.ui.components.RatingButtonRow

@Composable
fun ReviewScreen(viewModel: ReviewViewModel, songId: Long? = null, onNavigateBack: () -> Unit) {
    val reviewState by viewModel.state

    LaunchedEffect(songId) {
        viewModel.loadDueCards(songId)
    }

    Column(
        modifier = Modifier.fillMaxSize().background(AppColors.Background)
    ) {
        AppTopBar(title = "Review", onClose = onNavigateBack)

        when (val state = reviewState) {
            is ReviewState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AppColors.Primary)
                }
            }
            is ReviewState.NoCards -> {
                NoCardsContent(stats = state.stats, onDone = onNavigateBack)
            }
            is ReviewState.Reviewing -> {
                ReviewingContent(
                    state = state,
                    onReveal = { viewModel.reveal() },
                    onRate = { rating -> viewModel.rate(rating) }
                )
            }
            is ReviewState.Summary -> {
                SummaryContent(state = state, onDone = onNavigateBack)
            }
            is ReviewState.Error -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            state.message,
                            color = AppColors.RatingAgain,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(
                            onClick = { viewModel.loadDueCards(songId) },
                            colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
                        ) {
                            Text("Retry")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NoCardsContent(stats: FlashcardStatsResponse?, onDone: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                "All caught up!",
                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                textAlign = TextAlign.Center,
                color = AppColors.TextPrimary
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "No cards due for review",
                style = MaterialTheme.typography.bodyMedium,
                color = AppColors.TextSecondary,
                textAlign = TextAlign.Center
            )
            if (stats != null) {
                Spacer(Modifier.height(24.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(AppDimens.CardCornerRadius),
                    colors = CardDefaults.cardColors(containerColor = AppColors.Surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                    border = CardDefaults.outlinedCardBorder()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        StatRow("Total", stats.total.toString())
                        StatRow("New", stats.newCount.toString())
                        StatRow("Learning", stats.learning.toString())
                        StatRow("Review", stats.review.toString())
                    }
                }
            }
            Spacer(Modifier.height(32.dp))
            Button(
                onClick = onDone,
                shape = RoundedCornerShape(AppDimens.SmallCornerRadius),
                colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
            ) {
                Text("Done")
            }
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
        Text(value, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium), color = AppColors.TextPrimary)
    }
}

@Composable
private fun ReviewingContent(
    state: ReviewState.Reviewing,
    onReveal: () -> Unit,
    onRate: (Int) -> Unit
) {
    val card = state.cards[state.currentIndex]
    val progress = (state.currentIndex + 1).toFloat() / state.totalCount
    val pct = ((state.currentIndex + 1) * 100 / state.totalCount)

    Column(
        modifier = Modifier.fillMaxSize().padding(AppDimens.ScreenPadding),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Progress
        Text(
            "PROGRESS ${state.currentIndex + 1}/${state.totalCount} ($pct%)",
            style = MaterialTheme.typography.labelSmall,
            color = AppColors.TextSecondary
        )
        Spacer(Modifier.height(8.dp))
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier.fillMaxWidth().height(4.dp),
            color = AppColors.Primary,
            trackColor = AppColors.CardBorder
        )

        Spacer(Modifier.height(16.dp))

        // Flashcard
        FlashcardView(
            card = card,
            isRevealed = state.isRevealed,
            onReveal = onReveal,
            modifier = Modifier.weight(1f)
        )

        // Rating buttons
        if (state.isRevealed) {
            Spacer(Modifier.height(16.dp))
            RatingButtonRow(
                intervals = card.intervals,
                onRate = onRate
            )
        }

        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun FlashcardView(
    card: com.japanese.vocabulary.app.flashcard.dto.FlashcardDTO,
    isRevealed: Boolean,
    onReveal: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(modifier = modifier) {
        com.japanese.vocabulary.app.ui.components.FlashcardView(
            card = card,
            isRevealed = isRevealed,
            onReveal = onReveal
        )
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
                "Session Complete!",
                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                textAlign = TextAlign.Center,
                color = AppColors.TextPrimary
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Cards reviewed: ${state.totalReviewed}",
                style = MaterialTheme.typography.titleMedium,
                color = AppColors.TextSecondary
            )
            Spacer(Modifier.height(24.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(AppDimens.CardCornerRadius),
                colors = CardDefaults.cardColors(containerColor = AppColors.Surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                border = CardDefaults.outlinedCardBorder()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    val labels = mapOf(
                        1 to Pair("Again", AppColors.RatingAgain),
                        2 to Pair("Hard", AppColors.RatingHard),
                        3 to Pair("Good", AppColors.RatingGood),
                        4 to Pair("Easy", AppColors.RatingEasy)
                    )
                    labels.forEach { (rating, labelColor) ->
                        val count = state.ratingCounts[rating] ?: 0
                        if (count > 0) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    labelColor.first,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = labelColor.second
                                )
                                Text(
                                    "$count",
                                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                    color = AppColors.TextPrimary
                                )
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(32.dp))
            Button(
                onClick = onDone,
                shape = RoundedCornerShape(AppDimens.SmallCornerRadius),
                colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
            ) {
                Text("Done")
            }
        }
    }
}

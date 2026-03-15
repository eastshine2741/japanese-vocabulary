package com.japanese.vocabulary.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.japanese.vocabulary.app.flashcard.dto.FlashcardDTO
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppDimens
import com.japanese.vocabulary.app.theme.AppTheme
import com.japanese.vocabulary.app.word.dto.ExampleSentence
import org.jetbrains.compose.ui.tooling.preview.Preview

@Composable
fun FlashcardView(
    card: FlashcardDTO,
    isRevealed: Boolean,
    onReveal: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (!isRevealed) Modifier.clickable { onReveal() } else Modifier),
        shape = RoundedCornerShape(AppDimens.CardCornerRadius),
        colors = CardDefaults.cardColors(containerColor = AppColors.Surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Box(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            if (!isRevealed) {
                // Front: kanji only
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        card.japanese,
                        fontSize = 40.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        color = AppColors.TextPrimary
                    )
                    Spacer(Modifier.height(24.dp))
                    Text(
                        "Tap to reveal",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppColors.TextTertiary
                    )
                }
            } else {
                // Back: full info
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    if (card.reading != null) {
                        Text(
                            card.reading,
                            style = MaterialTheme.typography.titleMedium,
                            color = AppColors.TextSecondary
                        )
                        Spacer(Modifier.height(8.dp))
                    }
                    Text(
                        card.japanese,
                        fontSize = 36.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        color = AppColors.TextPrimary
                    )
                    Spacer(Modifier.height(16.dp))

                    if (card.koreanText != null) {
                        Text(
                            card.koreanText,
                            style = MaterialTheme.typography.titleLarge,
                            textAlign = TextAlign.Center,
                            color = AppColors.TextPrimary
                        )
                    }

                    if (card.examples.isNotEmpty()) {
                        Spacer(Modifier.height(16.dp))
                        HorizontalDivider(color = AppColors.CardBorder)
                        Spacer(Modifier.height(12.dp))
                        card.examples.forEach { example ->
                            Column(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                if (example.songTitle != null) {
                                    Text(
                                        example.songTitle,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = AppColors.TextTertiary,
                                        textAlign = TextAlign.Center
                                    )
                                }
                                if (example.lyricLine != null) {
                                    Text(
                                        example.lyricLine,
                                        style = MaterialTheme.typography.bodyMedium.copy(fontStyle = FontStyle.Italic),
                                        color = AppColors.TextSecondary,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Preview
@Composable
private fun PreviewFlashcardViewFront() {
    AppTheme {
        FlashcardView(
            card = FlashcardDTO(
                id = 1, wordId = 1, japanese = "食べる", reading = "たべる",
                koreanText = "먹다", state = 0, due = "2026-03-15"
            ),
            isRevealed = false,
            onReveal = {}
        )
    }
}

@Preview
@Composable
private fun PreviewFlashcardViewRevealed() {
    AppTheme {
        FlashcardView(
            card = FlashcardDTO(
                id = 1, wordId = 1, japanese = "食べる", reading = "たべる",
                koreanText = "먹다", state = 0, due = "2026-03-15"
            ),
            isRevealed = true,
            onReveal = {}
        )
    }
}

@Preview
@Composable
private fun PreviewFlashcardViewRevealedWithExamples() {
    AppTheme {
        FlashcardView(
            card = FlashcardDTO(
                id = 2, wordId = 2, japanese = "走る", reading = "はしる",
                koreanText = "달리다", state = 1, due = "2026-03-15",
                examples = listOf(
                    ExampleSentence(songId = 1, songTitle = "夜に駆ける", lyricLine = "君が走り出した夜を追いかけて"),
                    ExampleSentence(songId = 2, songTitle = "Lemon", lyricLine = "走り抜けた道の先で")
                )
            ),
            isRevealed = true,
            onReveal = {}
        )
    }
}

package com.japanese.vocabulary.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.song.dto.Token
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.word.dto.ExampleSentence
import com.japanese.vocabulary.app.word.dto.WordDefinitionDTO
import com.japanese.vocabulary.app.word.viewmodel.AddState
import com.japanese.vocabulary.app.word.viewmodel.GetWordState
import com.japanese.vocabulary.app.word.viewmodel.LookupState

@Composable
fun WordAnalysisSheet(
    token: Token,
    lookupState: LookupState,
    addState: AddState,
    getWordState: GetWordState,
    songId: Long,
    lyricLine: String,
    onAddWord: (WordDefinitionDTO) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 16.dp)
    ) {
        // Word + reading
        Text(
            token.surface,
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
            color = AppColors.TextPrimary
        )
        if (token.reading != null) {
            Text(
                token.reading,
                style = MaterialTheme.typography.bodyLarge,
                color = AppColors.TextSecondary
            )
        }
        Spacer(Modifier.height(8.dp))

        // POS badge
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PosBadge(token.partOfSpeech)
        }

        Spacer(Modifier.height(12.dp))

        // Existing examples
        if (getWordState is GetWordState.Found && getWordState.word.examples.isNotEmpty()) {
            Text(
                "Saved examples",
                style = MaterialTheme.typography.labelMedium,
                color = AppColors.TextSecondary
            )
            Spacer(Modifier.height(4.dp))
            getWordState.word.examples.forEach { example ->
                ExampleRow(example)
            }
            Spacer(Modifier.height(12.dp))
        }

        HorizontalDivider(color = AppColors.CardBorder)
        Spacer(Modifier.height(16.dp))

        when (lookupState) {
            is LookupState.Loading -> {
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AppColors.Primary)
                }
            }
            is LookupState.Error -> {
                Text(
                    text = lookupState.message,
                    color = AppColors.RatingAgain,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            is LookupState.Success -> {
                val definition = lookupState.definition

                // JLPT + POS badges
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    JlptBadge(definition.jlptLevel)
                    definition.partsOfSpeech.forEach { pos -> PosBadge(pos) }
                }
                Spacer(Modifier.height(12.dp))

                // Korean translation
                Text(
                    definition.meanings.joinToString(", "),
                    style = MaterialTheme.typography.titleMedium,
                    color = AppColors.TextPrimary
                )
                Spacer(Modifier.height(20.dp))

                // Action button
                when {
                    addState is AddState.Success -> {
                        val wasNewWord = getWordState is GetWordState.Found &&
                                getWordState.word.examples.size <= 1
                        Button(
                            onClick = {},
                            enabled = false,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(if (wasNewWord) "Added" else "Example added")
                        }
                    }
                    addState is AddState.Loading -> {
                        Button(
                            onClick = {},
                            enabled = false,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        }
                    }
                    getWordState is GetWordState.Found -> {
                        val alreadyHasExample = getWordState.word.examples.any {
                            it.songId == songId && it.lyricLine == lyricLine
                        }
                        if (alreadyHasExample) {
                            Button(
                                onClick = {},
                                enabled = false,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("Already added")
                            }
                        } else {
                            Button(
                                onClick = { onAddWord(definition) },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
                            ) {
                                Text("Add example")
                            }
                        }
                    }
                    else -> {
                        Button(
                            onClick = { onAddWord(definition) },
                            enabled = getWordState !is GetWordState.Loading,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
                        ) {
                            Text("Add to My Vocabulary")
                        }
                    }
                }

                if (addState is AddState.Error) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = addState.message,
                        color = AppColors.RatingAgain,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
            is LookupState.Idle -> {}
        }

        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun ExampleRow(example: ExampleSentence) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            "  ",
            style = MaterialTheme.typography.bodySmall,
            color = AppColors.TextTertiary
        )
        Column {
            if (example.songTitle != null) {
                Text(
                    example.songTitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = AppColors.TextSecondary,
                    fontWeight = FontWeight.Medium
                )
            }
            if (example.lyricLine != null) {
                Text(
                    example.lyricLine,
                    style = MaterialTheme.typography.bodySmall,
                    color = AppColors.TextTertiary
                )
            }
        }
    }
}

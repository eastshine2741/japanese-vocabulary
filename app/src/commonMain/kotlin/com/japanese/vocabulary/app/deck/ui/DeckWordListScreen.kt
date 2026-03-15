package com.japanese.vocabulary.app.deck.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.deck.dto.DeckWordItem
import com.japanese.vocabulary.app.deck.viewmodel.DeckWordListState
import com.japanese.vocabulary.app.deck.viewmodel.DeckWordListViewModel
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppDimens
import com.japanese.vocabulary.app.ui.components.AppTopBar

@Composable
fun DeckWordListScreen(
    songId: Long?,
    viewModel: DeckWordListViewModel,
    onNavigateBack: () -> Unit
) {
    val wordListState by viewModel.state

    LaunchedEffect(songId) {
        viewModel.load(songId)
    }

    Column(
        modifier = Modifier.fillMaxSize().background(AppColors.Background)
    ) {
        AppTopBar(title = "Words", onBack = onNavigateBack)

        when (val state = wordListState) {
            is DeckWordListState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AppColors.Primary)
                }
            }
            is DeckWordListState.Error -> {
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
            is DeckWordListState.Success -> {
                val listState = rememberLazyListState()

                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize().padding(horizontal = AppDimens.ScreenPadding),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    contentPadding = PaddingValues(vertical = 8.dp)
                ) {
                    items(state.words) { word ->
                        WordRow(word)
                    }
                    if (state.nextCursor != null) {
                        item {
                            LaunchedEffect(Unit) {
                                viewModel.loadMore(songId)
                            }
                            Box(
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(modifier = Modifier.size(24.dp), color = AppColors.Primary)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WordRow(word: DeckWordItem) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(AppDimens.SmallCornerRadius),
        colors = CardDefaults.cardColors(containerColor = AppColors.Surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    word.japanese,
                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
                    color = AppColors.TextPrimary
                )
                if (word.reading.isNotEmpty()) {
                    Text(
                        word.reading,
                        style = MaterialTheme.typography.bodySmall,
                        color = AppColors.TextSecondary
                    )
                }
            }
            Text(
                word.koreanText,
                style = MaterialTheme.typography.bodyMedium,
                color = AppColors.TextSecondary
            )
        }
    }
}

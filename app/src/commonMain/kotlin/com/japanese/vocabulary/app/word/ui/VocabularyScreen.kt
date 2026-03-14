package com.japanese.vocabulary.app.word.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.word.dto.WordListItem
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.word.viewmodel.VocabularyViewModel
import com.japanese.vocabulary.app.word.viewmodel.WordListState

@Composable
fun VocabularyScreen(onNavigate: (Screen) -> Unit) {
    val viewModel = remember { VocabularyViewModel() }
    val listState = rememberLazyListState()
    val wordListState by viewModel.wordListState

    LaunchedEffect(Unit) {
        viewModel.loadWords()
    }

    // Detect reaching the bottom for infinite scroll
    val currentState = wordListState
    if (currentState is WordListState.Success && currentState.nextCursor != null && !currentState.isLoadingMore) {
        val lastVisibleIndex = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1
        val totalItems = listState.layoutInfo.totalItemsCount
        if (totalItems > 0 && lastVisibleIndex >= totalItems - 2) {
            LaunchedEffect(lastVisibleIndex) {
                viewModel.loadMoreWords()
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBarSection(onNavigate)

        when (val state = wordListState) {
            is WordListState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is WordListState.Error -> {
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
                        Button(onClick = { viewModel.loadWords() }) {
                            Text("다시 시도")
                        }
                    }
                }
            }
            is WordListState.Success -> {
                if (state.words.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize().padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("저장된 단어가 없습니다.", style = MaterialTheme.typography.bodyMedium)
                    }
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        itemsIndexed(state.words) { _, word ->
                            WordCard(word)
                        }
                        if (state.isLoadingMore) {
                            item {
                                Box(
                                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(modifier = Modifier.size(24.dp))
                                }
                            }
                        }
                    }
                }
            }
            is WordListState.Idle -> {}
        }
    }
}

@Composable
private fun TopAppBarSection(onNavigate: (Screen) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        TextButton(onClick = { onNavigate(Screen.Home) }) {
            Text("← 홈으로")
        }
        Spacer(Modifier.weight(1f))
        Text("단어장", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(end = 16.dp))
    }
}

@Composable
private fun WordCard(word: WordListItem) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    word.japanese,
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    word.reading,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(Modifier.height(4.dp))
            Text(word.koreanText, style = MaterialTheme.typography.bodyLarge)

            if (word.songTitle != null || word.lyricLine != null) {
                Spacer(Modifier.height(8.dp))
                HorizontalDivider()
                Spacer(Modifier.height(8.dp))
                if (word.songTitle != null) {
                    Text(
                        "노래: ${word.songTitle}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (word.lyricLine != null) {
                    Text(
                        "예문: ${word.lyricLine}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

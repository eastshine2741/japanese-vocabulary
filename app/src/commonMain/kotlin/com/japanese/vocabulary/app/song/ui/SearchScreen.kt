package com.japanese.vocabulary.app.song.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.background
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.platform.BackHandler
import com.japanese.vocabulary.app.song.viewmodel.AnalyzeUiState
import com.japanese.vocabulary.app.song.viewmodel.SearchUiState
import com.japanese.vocabulary.app.song.viewmodel.SearchViewModel
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppDimens
import com.japanese.vocabulary.app.ui.components.AppTopBar
import com.japanese.vocabulary.app.ui.components.SongListItem
import androidx.compose.ui.graphics.Color

@Composable
fun SearchScreen(onNavigate: (Screen) -> Unit, viewModel: SearchViewModel) {
    val state by viewModel.state.collectAsState()
    val analyzeState by viewModel.analyzeState.collectAsState()
    var query by remember { mutableStateOf("") }

    BackHandler { onNavigate(Screen.Main) }

    LaunchedEffect(analyzeState) {
        if (analyzeState is AnalyzeUiState.Success) {
            onNavigate(Screen.Player(origin = com.japanese.vocabulary.app.navigation.Tab.Home))
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(AppColors.Background)) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(title = "Search", onBack = { onNavigate(Screen.Main) })

            // Search input
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = AppDimens.ScreenPadding, vertical = 8.dp),
                placeholder = { Text("Search for a song...", color = AppColors.TextTertiary) },
                singleLine = true,
                shape = RoundedCornerShape(AppDimens.SmallCornerRadius),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { viewModel.search(query) }),
                trailingIcon = {
                    if (query.isNotEmpty()) {
                        IconButton(onClick = { query = "" }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear", tint = AppColors.TextTertiary)
                        }
                    }
                }
            )

            // Results
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when (val s = state) {
                    is SearchUiState.Idle -> {
                        Text(
                            "Search for a song to study",
                            modifier = Modifier.align(Alignment.Center),
                            style = MaterialTheme.typography.bodyMedium,
                            color = AppColors.TextSecondary
                        )
                    }
                    is SearchUiState.Loading -> {
                        CircularProgressIndicator(
                            modifier = Modifier.align(Alignment.Center),
                            color = AppColors.Primary
                        )
                    }
                    is SearchUiState.Error -> {
                        Column(
                            modifier = Modifier.align(Alignment.Center),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(s.message, style = MaterialTheme.typography.bodyMedium, color = AppColors.TextSecondary)
                            Spacer(Modifier.height(8.dp))
                            TextButton(onClick = { viewModel.search(query) }) {
                                Text("Retry", color = AppColors.Primary)
                            }
                        }
                    }
                    is SearchUiState.Success -> {
                        val listState = rememberLazyListState()
                        val reachedEnd by remember {
                            derivedStateOf {
                                val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
                                val total = listState.layoutInfo.totalItemsCount
                                total > 0 && lastVisible >= total - 3
                            }
                        }
                        LaunchedEffect(reachedEnd) {
                            if (reachedEnd) viewModel.loadMore()
                        }

                        LazyColumn(
                            state = listState,
                            modifier = Modifier.fillMaxSize().padding(horizontal = AppDimens.ScreenPadding),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                            contentPadding = PaddingValues(vertical = 8.dp)
                        ) {
                            items(s.items.size) { index ->
                                val item = s.items[index]
                                SongListItem(
                                    artworkUrl = item.thumbnail,
                                    title = item.title,
                                    subtitle = item.artistName,
                                    trailing = formatDuration(item.durationSeconds),
                                    isHighlighted = index == 0,
                                    onClick = { viewModel.analyze(item) }
                                )
                            }
                            if (s.isLoadingMore) {
                                item {
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

        // Analyze loading overlay
        if (analyzeState is AnalyzeUiState.Loading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.5f)),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = Color.White)
            }
        }

        // Analyze error
        if (analyzeState is AnalyzeUiState.Error) {
            val errorMsg = (analyzeState as AnalyzeUiState.Error).message
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .padding(AppDimens.ScreenPadding)
            ) {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(AppDimens.SmallCornerRadius)
                ) {
                    Text(
                        errorMsg,
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}

private fun formatDuration(seconds: Int): String {
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}

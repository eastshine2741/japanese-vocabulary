package com.japanese.vocabulary.app.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.model.StudyUnit
import com.japanese.vocabulary.app.model.Token
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.player.YouTubePlayer
import com.japanese.vocabulary.app.viewmodel.AnalyzeUiState
import com.japanese.vocabulary.app.viewmodel.SearchViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SongResultScreen(onNavigate: (Screen) -> Unit, viewModel: SearchViewModel) {
    val analyzeState by viewModel.analyzeState.collectAsState()
    val result = (analyzeState as? AnalyzeUiState.Success)?.result

    var currentMs by remember { mutableLongStateOf(0L) }
    var selectedToken by remember { mutableStateOf<Token?>(null) }
    var showBottomSheet by remember { mutableStateOf(false) }

    if (result == null) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            TextButton(onClick = { viewModel.resetAnalyze(); onNavigate(Screen.Search) }) {
                Text("← 검색으로 돌아가기")
            }
        }
        return
    }

    val isSynced = result.song.lyricType == "SYNCED"
    val currentLineIndex by remember(currentMs) {
        derivedStateOf {
            if (!isSynced) -1
            else result.studyUnits
                .filter { it.startTimeMs != null && it.startTimeMs <= currentMs }
                .maxByOrNull { it.startTimeMs!! }?.index ?: -1
        }
    }

    val videoId = result.youtubeUrl
        ?.let { url ->
            when {
                url.contains("v=") -> url.substringAfter("v=").substringBefore("&")
                url.contains("youtu.be/") -> url.substringAfter("youtu.be/").substringBefore("?")
                else -> null
            }
        } ?: ""

    Column(modifier = Modifier.fillMaxSize()) {
        if (videoId.isNotEmpty()) {
            YouTubePlayer(
                videoId = videoId,
                modifier = Modifier.fillMaxWidth().height(220.dp),
                onSecondChanged = { currentMs = (it * 1000).toLong() }
            )
        }

        LazyColumn(modifier = Modifier.weight(1f).padding(horizontal = 16.dp)) {
            item {
                TextButton(onClick = { viewModel.resetAnalyze(); onNavigate(Screen.Search) }) {
                    Text("← 검색으로 돌아가기")
                }
                Text(result.song.title, style = MaterialTheme.typography.headlineSmall)
                Text(result.song.artist, style = MaterialTheme.typography.bodyLarge)
                Spacer(Modifier.height(12.dp))
            }
            items(result.studyUnits) { unit ->
                LyricLineRow(
                    unit = unit,
                    isCurrent = unit.index == currentLineIndex,
                    isSynced = isSynced,
                    onTokenClick = { token ->
                        selectedToken = token
                        showBottomSheet = true
                    }
                )
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }

    if (showBottomSheet && selectedToken != null) {
        ModalBottomSheet(onDismissRequest = { showBottomSheet = false }) {
            TokenDetailSheet(token = selectedToken!!)
        }
    }
}

@Composable
private fun LyricLineRow(
    unit: StudyUnit,
    isCurrent: Boolean,
    isSynced: Boolean,
    onTokenClick: (Token) -> Unit
) {
    val isHighlighted = isCurrent || !isSynced
    val alpha = if (isHighlighted) 1f else 0.35f
    val fontWeight = if (isHighlighted) FontWeight.Bold else FontWeight.Normal

    val annotated = buildAnnotatedString {
        val text = unit.originalText
        append(text)
        addStyle(
            style = SpanStyle(fontWeight = fontWeight),
            start = 0,
            end = text.length
        )
        unit.tokens.forEach { token ->
            val end = token.charEnd.coerceAtMost(text.length)
            val start = token.charStart.coerceAtMost(end)
            if (start < end) {
                addStyle(
                    style = SpanStyle(textDecoration = TextDecoration.Underline),
                    start = start,
                    end = end
                )
            }
        }
    }

    ClickableText(
        text = annotated,
        style = MaterialTheme.typography.bodyLarge.copy(
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = alpha)
        ),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        onClick = { offset ->
            val token = unit.tokens.firstOrNull { offset >= it.charStart && offset < it.charEnd }
            if (token != null) onTokenClick(token)
        }
    )
}

@Composable
private fun TokenDetailSheet(token: Token) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 16.dp)
    ) {
        Text("단어", style = MaterialTheme.typography.labelMedium)
        Text(token.surface, style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(12.dp))
        DetailRow("읽기", token.reading ?: "-")
        DetailRow("기본형", token.baseForm)
        DetailRow("품사", token.partOfSpeech)
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(64.dp)
        )
        Text(value, style = MaterialTheme.typography.bodyLarge)
    }
}

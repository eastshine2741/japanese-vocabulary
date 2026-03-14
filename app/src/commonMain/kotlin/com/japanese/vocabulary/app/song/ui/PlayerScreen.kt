package com.japanese.vocabulary.app.song.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.song.dto.StudyUnit
import com.japanese.vocabulary.app.song.dto.Token
import com.japanese.vocabulary.app.word.dto.ExampleSentence
import com.japanese.vocabulary.app.word.dto.WordDefinitionDTO
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.platform.YouTubePlayer
import com.japanese.vocabulary.app.word.viewmodel.AddState
import com.japanese.vocabulary.app.song.viewmodel.AnalyzeUiState
import com.japanese.vocabulary.app.word.viewmodel.GetWordState
import com.japanese.vocabulary.app.word.viewmodel.LookupState
import com.japanese.vocabulary.app.song.viewmodel.SearchViewModel
import com.japanese.vocabulary.app.word.viewmodel.VocabularyViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerScreen(onNavigate: (Screen) -> Unit, viewModel: SearchViewModel, screen: Screen.Player) {
    val analyzeState by viewModel.analyzeState.collectAsState()
    val result = (analyzeState as? AnalyzeUiState.Success)?.result

    val vocabViewModel = remember { VocabularyViewModel() }

    var currentMs by remember { mutableLongStateOf(0L) }
    var selectedToken by remember { mutableStateOf<Token?>(null) }
    var selectedLyricLine by remember { mutableStateOf("") }
    var showBottomSheet by remember { mutableStateOf(false) }

    if (result == null) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            TextButton(onClick = { viewModel.resetAnalyze(); onNavigate(screen.origin) }) {
                Text("← 돌아가기")
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
                TextButton(onClick = { viewModel.resetAnalyze(); onNavigate(screen.origin) }) {
                    Text("← 돌아가기")
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
                        selectedLyricLine = unit.originalText
                        showBottomSheet = true
                        vocabViewModel.lookupWord(token.baseForm)
                    }
                )
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }

    if (showBottomSheet && selectedToken != null) {
        ModalBottomSheet(onDismissRequest = {
            showBottomSheet = false
        }) {
            WordDetailSheet(
                token = selectedToken!!,
                lookupState = vocabViewModel.lookupState.value,
                addState = vocabViewModel.addState.value,
                getWordState = vocabViewModel.getWordState.value,
                songId = result.song.id,
                lyricLine = selectedLyricLine,
                onAddWord = { definition ->
                    vocabViewModel.addWord(definition, result.song.id, selectedLyricLine)
                }
            )
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
private fun WordDetailSheet(
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
        // Always show morphology info from token
        Text("단어", style = MaterialTheme.typography.labelMedium)
        Text(token.surface, style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        DetailRow("읽기", token.reading ?: "-")
        DetailRow("기본형", token.baseForm)
        DetailRow("품사", token.partOfSpeech)
        Spacer(Modifier.height(16.dp))

        // Show existing examples if word is already saved
        if (getWordState is GetWordState.Found && getWordState.word.examples.isNotEmpty()) {
            Text("저장된 예문", style = MaterialTheme.typography.labelMedium)
            Spacer(Modifier.height(4.dp))
            getWordState.word.examples.forEach { example ->
                ExampleRow(example)
            }
            Spacer(Modifier.height(16.dp))
        }

        HorizontalDivider()
        Spacer(Modifier.height(16.dp))

        when (lookupState) {
            is LookupState.Loading -> {
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is LookupState.Error -> {
                Text(
                    text = lookupState.message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            is LookupState.Success -> {
                val definition = lookupState.definition
                Text("일본어 철자", style = MaterialTheme.typography.labelMedium)
                Text(definition.japanese, style = MaterialTheme.typography.headlineSmall)
                Spacer(Modifier.height(4.dp))
                Text(definition.reading, style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(12.dp))
                DetailRow("뜻", definition.meanings.joinToString(", "))
                DetailRow("품사", definition.partsOfSpeech.joinToString(", "))
                if (definition.jlptLevel != null) {
                    DetailRow("JLPT", definition.jlptLevel)
                }
                Spacer(Modifier.height(20.dp))

                // Button logic derived from addState + getWordState
                when {
                    addState is AddState.Success -> {
                        Button(
                            onClick = {},
                            enabled = false,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            val wasNewWord = getWordState is GetWordState.Found &&
                                    getWordState.word.examples.size <= 1
                            Text(if (wasNewWord) "추가됨" else "예문 추가됨")
                        }
                    }
                    addState is AddState.Loading -> {
                        Button(
                            onClick = {},
                            enabled = false,
                            modifier = Modifier.fillMaxWidth()
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
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("이미 추가됨")
                            }
                        } else {
                            Button(
                                onClick = { onAddWord(definition) },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("예문 추가")
                            }
                        }
                    }
                    else -> {
                        // NotFound, Idle, Loading, Error → show "단어 추가"
                        Button(
                            onClick = { onAddWord(definition) },
                            enabled = getWordState !is GetWordState.Loading,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("단어 추가")
                        }
                    }
                }

                if (addState is AddState.Error) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = addState.message,
                        color = MaterialTheme.colorScheme.error,
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
        Text("• ", style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Column {
            if (example.songTitle != null) {
                Text(
                    example.songTitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.Medium
                )
            }
            if (example.lyricLine != null) {
                Text(
                    example.lyricLine,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
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

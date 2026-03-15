package com.japanese.vocabulary.app.song.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.navigation.Tab
import com.japanese.vocabulary.app.platform.YouTubePlayer
import com.japanese.vocabulary.app.song.dto.StudyUnit
import com.japanese.vocabulary.app.song.dto.Token
import com.japanese.vocabulary.app.song.viewmodel.AnalyzeUiState
import com.japanese.vocabulary.app.song.viewmodel.SearchViewModel
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppDimens
import com.japanese.vocabulary.app.ui.components.SkeletonBox
import com.japanese.vocabulary.app.ui.components.WordAnalysisSheet
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

    val navigateBack = {
        viewModel.resetAnalyze()
        onNavigate(Screen.Main)
    }

    if (result == null) {
        // Loading state
        Column(
            modifier = Modifier.fillMaxSize().background(AppColors.Background)
        ) {
            Box(
                modifier = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 4.dp),
                contentAlignment = Alignment.CenterStart
            ) {
                IconButton(onClick = navigateBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = AppColors.TextPrimary)
                }
            }
            // Skeleton loading
            Column(modifier = Modifier.padding(AppDimens.ScreenPadding)) {
                SkeletonBox(modifier = Modifier.fillMaxWidth().height(220.dp))
                Spacer(Modifier.height(16.dp))
                SkeletonBox(modifier = Modifier.fillMaxWidth(0.6f).height(24.dp))
                Spacer(Modifier.height(8.dp))
                SkeletonBox(modifier = Modifier.fillMaxWidth(0.4f).height(16.dp))
                Spacer(Modifier.height(24.dp))
                repeat(8) {
                    SkeletonBox(modifier = Modifier.fillMaxWidth().height(20.dp))
                    Spacer(Modifier.height(12.dp))
                }
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

    Column(modifier = Modifier.fillMaxSize().background(AppColors.Background)) {
        // Top bar with back button and song info
        Surface(color = AppColors.Surface) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = navigateBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = AppColors.TextPrimary)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        result.song.title,
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                        color = AppColors.TextPrimary,
                        maxLines = 1
                    )
                    Text(
                        result.song.artist,
                        style = MaterialTheme.typography.bodySmall,
                        color = AppColors.TextSecondary,
                        maxLines = 1
                    )
                }
            }
        }

        // YouTube player
        if (videoId.isNotEmpty()) {
            YouTubePlayer(
                videoId = videoId,
                modifier = Modifier.fillMaxWidth().height(220.dp),
                onSecondChanged = { currentMs = (it * 1000).toLong() }
            )
        }

        // Lyrics
        LazyColumn(
            modifier = Modifier.weight(1f).padding(horizontal = AppDimens.ScreenPadding),
            contentPadding = PaddingValues(vertical = 12.dp)
        ) {
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

    // Word bottom sheet
    if (showBottomSheet && selectedToken != null) {
        ModalBottomSheet(
            onDismissRequest = { showBottomSheet = false },
            containerColor = AppColors.Surface
        ) {
            WordAnalysisSheet(
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
    val fontSize = if (isHighlighted) 18.sp else 16.sp

    val annotated = buildAnnotatedString {
        val text = unit.originalText
        append(text)
        addStyle(
            style = SpanStyle(fontWeight = fontWeight, fontSize = fontSize),
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

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
    ) {
        ClickableText(
            text = annotated,
            style = MaterialTheme.typography.bodyLarge.copy(
                color = AppColors.TextPrimary.copy(alpha = alpha)
            ),
            modifier = Modifier.fillMaxWidth(),
            onClick = { offset ->
                val token = unit.tokens.firstOrNull { offset >= it.charStart && offset < it.charEnd }
                if (token != null) onTokenClick(token)
            }
        )
        if (unit.koreanPronounciation != null) {
            Text(
                text = unit.koreanPronounciation,
                style = MaterialTheme.typography.bodySmall,
                color = AppColors.TextTertiary.copy(alpha = alpha * 0.7f)
            )
        }
        if (unit.koreanLyrics != null) {
            Text(
                text = unit.koreanLyrics,
                style = MaterialTheme.typography.bodySmall,
                color = AppColors.TextSecondary.copy(alpha = alpha * 0.7f)
            )
        }
    }
}

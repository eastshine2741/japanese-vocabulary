package com.japanese.vocabulary.app.screen

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.viewmodel.AnalyzeUiState
import com.japanese.vocabulary.app.viewmodel.SearchViewModel

@Composable
fun SongResultScreen(onNavigate: (Screen) -> Unit, viewModel: SearchViewModel) {
    val analyzeState by viewModel.analyzeState.collectAsState()
    val result = (analyzeState as? AnalyzeUiState.Success)?.result

    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        TextButton(onClick = { viewModel.resetAnalyze(); onNavigate(Screen.Search) }) {
            Text("← 검색으로 돌아가기")
        }
        Spacer(Modifier.height(16.dp))
        if (result != null) {
            Text(result.song.title, style = MaterialTheme.typography.headlineSmall)
            Text(result.song.artist, style = MaterialTheme.typography.bodyLarge)
            Text("가사 유형: ${result.song.lyricType}", style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(8.dp))
            Text("학습 단위: ${result.studyUnits.size}개", style = MaterialTheme.typography.bodyMedium)
            Text("어휘 후보: ${result.vocabularyCandidates.size}개", style = MaterialTheme.typography.bodyMedium)
        }
    }
}

package com.japanese.vocabulary.app.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.model.SongStudyData
import com.japanese.vocabulary.app.model.StudyUnit
import com.japanese.vocabulary.app.model.VocabularyCandidate
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.viewmodel.StudyUiState
import com.japanese.vocabulary.app.viewmodel.StudyViewModel

@Composable
fun StudyScreen(
    viewModel: StudyViewModel,
    onNavigate: (Screen) -> Unit
) {
    val state by viewModel.state.collectAsState()

    when (val s = state) {
        is StudyUiState.Idle -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No song loaded.")
            }
        }
        is StudyUiState.Loading -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
        is StudyUiState.Error -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Error: ${s.message}", color = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.height(16.dp))
                    TextButton(onClick = { onNavigate(Screen.Search) }) { Text("Back") }
                }
            }
        }
        is StudyUiState.Success -> {
            StudyContent(data = s.data, onBack = { onNavigate(Screen.Search) })
        }
    }
}

@Composable
private fun StudyContent(data: SongStudyData, onBack: () -> Unit) {
    Scaffold(
        topBar = {
            StudyTopBar(
                title = data.song.title,
                artist = data.song.artist,
                onBack = onBack
            )
        }
    ) { padding ->
        LazyColumn(
            contentPadding = PaddingValues(
                start = 16.dp,
                end = 16.dp,
                top = padding.calculateTopPadding() + 8.dp,
                bottom = 24.dp
            ),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                SectionHeader("Lyrics")
            }
            items(data.studyUnits) { unit ->
                StudyUnitCard(unit)
            }
            item {
                Spacer(Modifier.height(16.dp))
                SectionHeader("Vocabulary Candidates")
            }
            items(data.vocabularyCandidates) { candidate ->
                VocabCandidateRow(candidate)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StudyTopBar(title: String, artist: String, onBack: () -> Unit) {
    TopAppBar(
        title = {
            Column {
                Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(artist, style = MaterialTheme.typography.bodySmall)
            }
        },
        navigationIcon = {
            TextButton(onClick = onBack) { Text("Back") }
        }
    )
}

@Composable
private fun SectionHeader(label: String) {
    Text(
        text = label,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(vertical = 4.dp)
    )
}

@Composable
private fun StudyUnitCard(unit: StudyUnit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = unit.originalText,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = unit.readingHint ?: "—",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun VocabCandidateRow(candidate: VocabularyCandidate) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = candidate.word,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f)
        )
        Text(
            text = candidate.reading ?: "—",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f)
        )
    }
    HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outlineVariant)
}

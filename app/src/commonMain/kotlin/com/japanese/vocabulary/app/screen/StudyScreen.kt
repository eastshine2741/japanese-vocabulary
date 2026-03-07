package com.japanese.vocabulary.app.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.model.SongStudyData
import com.japanese.vocabulary.app.model.StudyUnit
import com.japanese.vocabulary.app.model.VocabularyCandidate
import com.japanese.vocabulary.app.navigation.Screen

// TODO: replace with API call to POST /api/songs/analyze
private val mockStudyData = SongStudyData(
    song = com.japanese.vocabulary.app.model.Song(
        id = null,
        title = "夜に駆ける",
        artist = "YOASOBI",
        language = "ja"
    ),
    studyUnits = listOf(
        StudyUnit(0, "沈んでいく感覚に 溺れてしまいそうだ"),
        StudyUnit(1, "君の声が聞こえる 夢の中で"),
        StudyUnit(2, "もう一度だけ 触れたいと"),
        StudyUnit(3, "願い続けていた あの頃の"),
        StudyUnit(4, "光を追いかけて 夜に駆けていく"),
        StudyUnit(5, "消えない想いを 胸に抱いたまま"),
        StudyUnit(6, "二人で笑った 日々が眩しくて"),
        StudyUnit(7, "忘れられないよ どこにいても")
    ),
    vocabularyCandidates = listOf(
        VocabularyCandidate("沈んでいく感覚に", "沈んでいく感覚に", null, 0),
        VocabularyCandidate("溺れてしまいそうだ", "溺れてしまいそうだ", null, 0),
        VocabularyCandidate("君の声が聞こえる", "君の声が聞こえる", null, 1),
        VocabularyCandidate("夢の中で", "夢の中で", null, 1),
        VocabularyCandidate("もう一度だけ", "もう一度だけ", null, 2),
        VocabularyCandidate("触れたいと", "触れたいと", null, 2),
        VocabularyCandidate("願い続けていた", "願い続けていた", null, 3),
        VocabularyCandidate("あの頃の", "あの頃の", null, 3),
        VocabularyCandidate("光を追いかけて", "光を追いかけて", null, 4),
        VocabularyCandidate("夜に駆けていく", "夜に駆けていく", null, 4),
        VocabularyCandidate("消えない想いを", "消えない想いを", null, 5),
        VocabularyCandidate("胸に抱いたまま", "胸に抱いたまま", null, 5),
        VocabularyCandidate("二人で笑った", "二人で笑った", null, 6),
        VocabularyCandidate("日々が眩しくて", "日々が眩しくて", null, 6),
        VocabularyCandidate("忘れられないよ", "忘れられないよ", null, 7),
        VocabularyCandidate("どこにいても", "どこにいても", null, 7)
    )
)

@Composable
fun StudyScreen(
    studyData: SongStudyData = mockStudyData,
    onNavigate: (Screen) -> Unit
) {
    Scaffold(
        topBar = {
            StudyTopBar(
                title = studyData.song.title,
                artist = studyData.song.artist,
                onBack = { onNavigate(Screen.Home) }
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
            items(studyData.studyUnits) { unit ->
                StudyUnitCard(unit)
            }
            item {
                Spacer(Modifier.height(16.dp))
                SectionHeader("Vocabulary Candidates")
            }
            items(studyData.vocabularyCandidates) { candidate ->
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
            text = candidate.reading,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f)
        )
    }
    HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outlineVariant)
}

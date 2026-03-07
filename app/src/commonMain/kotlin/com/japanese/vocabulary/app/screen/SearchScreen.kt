package com.japanese.vocabulary.app.screen

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.viewmodel.StudyViewModel

private const val SAMPLE_TITLE = "夜に駆ける"
private const val SAMPLE_ARTIST = "YOASOBI"
private const val SAMPLE_LYRICS = """沈んでいく感覚に 溺れてしまいそうだ
君の声が聞こえる 夢の中で
もう一度だけ 触れたいと
願い続けていた あの頃の
光を追いかけて 夜に駆けていく
消えない想いを 胸に抱いたまま
二人で笑った 日々が眩しくて
忘れられないよ どこにいても"""

@Composable
fun SearchScreen(onNavigate: (Screen) -> Unit, viewModel: StudyViewModel) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Search", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text("Song search coming soon", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(32.dp))
        Button(onClick = {
            viewModel.load(SAMPLE_TITLE, SAMPLE_ARTIST, SAMPLE_LYRICS)
            onNavigate(Screen.Study)
        }) {
            Text("Open Sample Study")
        }
        Spacer(Modifier.height(12.dp))
        TextButton(onClick = { onNavigate(Screen.Home) }) {
            Text("Back")
        }
    }
}

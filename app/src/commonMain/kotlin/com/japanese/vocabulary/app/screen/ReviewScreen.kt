package com.japanese.vocabulary.app.screen

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.navigation.Screen

// Stub: spaced repetition flashcard review (future sprint)
@Composable
fun ReviewScreen(onNavigate: (Screen) -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Review", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text("Flashcard review coming soon", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(32.dp))
        TextButton(onClick = { onNavigate(Screen.Home) }) {
            Text("Back")
        }
    }
}

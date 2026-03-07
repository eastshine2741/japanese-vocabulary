package com.japanese.vocabulary.app.screen

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.navigation.Screen

// Stub: song search and selection (future sprint)
@Composable
fun SearchScreen(onNavigate: (Screen) -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Search", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text("Song search coming soon", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(32.dp))
        // Demo shortcut: go directly to study with mock data
        Button(onClick = { onNavigate(Screen.Study) }) {
            Text("Open Sample Study")
        }
        Spacer(Modifier.height(12.dp))
        TextButton(onClick = { onNavigate(Screen.Home) }) {
            Text("Back")
        }
    }
}

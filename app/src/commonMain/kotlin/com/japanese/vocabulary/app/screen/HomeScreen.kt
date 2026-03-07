package com.japanese.vocabulary.app.screen

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.navigation.Screen

@Composable
fun HomeScreen(onNavigate: (Screen) -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Japanese Vocabulary", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text("Learn through songs", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(32.dp))
        Button(onClick = { onNavigate(Screen.Search) }, modifier = Modifier.fillMaxWidth()) {
            Text("Find a Song")
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = { onNavigate(Screen.Review) }, modifier = Modifier.fillMaxWidth()) {
            Text("Review")
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = { onNavigate(Screen.Vocabulary) }, modifier = Modifier.fillMaxWidth()) {
            Text("Vocabulary")
        }
    }
}

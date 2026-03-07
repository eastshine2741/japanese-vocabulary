package com.japanese.vocabulary.app

import androidx.compose.runtime.*
import androidx.compose.material3.MaterialTheme
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.screen.*

@Composable
fun App() {
    MaterialTheme {
        var currentScreen by remember { mutableStateOf<Screen>(Screen.Home) }

        val navigate: (Screen) -> Unit = { screen -> currentScreen = screen }

        when (currentScreen) {
            is Screen.Home -> HomeScreen(onNavigate = navigate)
            is Screen.Search -> SearchScreen(onNavigate = navigate)
            is Screen.Study -> StudyScreen(onNavigate = navigate)
            is Screen.Vocabulary -> VocabularyScreen(onNavigate = navigate)
            is Screen.Review -> ReviewScreen(onNavigate = navigate)
        }
    }
}

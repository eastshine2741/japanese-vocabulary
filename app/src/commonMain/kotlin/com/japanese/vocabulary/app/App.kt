package com.japanese.vocabulary.app

import androidx.compose.runtime.*
import androidx.compose.material3.MaterialTheme
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.screen.*
import com.japanese.vocabulary.app.viewmodel.StudyViewModel

@Composable
fun App() {
    MaterialTheme {
        var currentScreen by remember { mutableStateOf<Screen>(Screen.Home) }
        val studyViewModel = remember { StudyViewModel() }

        val navigate: (Screen) -> Unit = { screen -> currentScreen = screen }

        when (currentScreen) {
            is Screen.Home -> HomeScreen(onNavigate = navigate)
            is Screen.Search -> SearchScreen(onNavigate = navigate, viewModel = studyViewModel)
            is Screen.Study -> StudyScreen(onNavigate = navigate, viewModel = studyViewModel)
            is Screen.Vocabulary -> VocabularyScreen(onNavigate = navigate)
            is Screen.Review -> ReviewScreen(onNavigate = navigate)
        }
    }
}

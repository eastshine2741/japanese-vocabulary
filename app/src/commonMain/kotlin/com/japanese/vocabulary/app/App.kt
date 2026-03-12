package com.japanese.vocabulary.app

import androidx.compose.runtime.*
import androidx.compose.material3.MaterialTheme
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.platform.TokenStorage
import com.japanese.vocabulary.app.screen.*
import com.japanese.vocabulary.app.viewmodel.AuthViewModel
import com.japanese.vocabulary.app.viewmodel.SearchViewModel
import com.japanese.vocabulary.app.viewmodel.StudyViewModel
import io.kamel.core.config.KamelConfig
import io.kamel.core.config.takeFrom
import io.kamel.image.config.LocalKamelConfig

@Composable
fun App() {
    MaterialTheme {
        val kamelConfig = remember {
            KamelConfig {
                takeFrom(KamelConfig.Default)
            }
        }

        CompositionLocalProvider(LocalKamelConfig provides kamelConfig) {
            val authViewModel = remember { AuthViewModel() }
            val studyViewModel = remember { StudyViewModel() }
            val searchViewModel = remember { SearchViewModel() }

            val initialScreen: Screen = if (TokenStorage.getToken() != null) Screen.Home else Screen.Login
            var currentScreen by remember { mutableStateOf<Screen>(initialScreen) }

            val navigate: (Screen) -> Unit = { screen -> currentScreen = screen }

            when (currentScreen) {
                is Screen.Login -> LoginScreen(onNavigate = navigate, viewModel = authViewModel)
                is Screen.Home -> HomeScreen(onNavigate = navigate)
                is Screen.Search -> SearchScreen(onNavigate = navigate, viewModel = searchViewModel)
                is Screen.Study -> StudyScreen(onNavigate = navigate, viewModel = studyViewModel)
                is Screen.Vocabulary -> VocabularyScreen(onNavigate = navigate)
                is Screen.Review -> ReviewScreen(onNavigate = navigate)
                is Screen.SongResult -> SongResultScreen(onNavigate = navigate, viewModel = searchViewModel)
            }
        }
    }
}

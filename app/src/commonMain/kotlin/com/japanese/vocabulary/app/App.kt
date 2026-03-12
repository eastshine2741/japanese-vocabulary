package com.japanese.vocabulary.app

import androidx.compose.runtime.*
import androidx.compose.material3.MaterialTheme
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.platform.TokenStorage
import com.japanese.vocabulary.app.screen.*
import com.japanese.vocabulary.app.viewmodel.AuthViewModel
import com.japanese.vocabulary.app.viewmodel.ReviewViewModel
import com.japanese.vocabulary.app.viewmodel.SearchViewModel
import com.japanese.vocabulary.app.viewmodel.SettingsViewModel
import com.japanese.vocabulary.app.viewmodel.StudyViewModel
import io.kamel.core.config.Core
import io.kamel.core.config.KamelConfig
import io.kamel.core.config.takeFrom
import io.kamel.image.config.LocalKamelConfig
import io.kamel.image.config.imageBitmapDecoder

@Composable
fun App() {
    val kamelConfig = remember {
        KamelConfig {
            takeFrom(KamelConfig.Core)
            imageBitmapDecoder()
        }
    }
    CompositionLocalProvider(LocalKamelConfig provides kamelConfig) {
    MaterialTheme {
        val authViewModel = remember { AuthViewModel() }
        val studyViewModel = remember { StudyViewModel() }
        val searchViewModel = remember { SearchViewModel() }
        val reviewViewModel = remember { ReviewViewModel() }
        val settingsViewModel = remember { SettingsViewModel() }

        val initialScreen: Screen = if (TokenStorage.getToken() != null) Screen.Home else Screen.Login
        var currentScreen by remember { mutableStateOf<Screen>(initialScreen) }

        val navigate: (Screen) -> Unit = { screen -> currentScreen = screen }

        when (currentScreen) {
            is Screen.Login -> LoginScreen(onNavigate = navigate, viewModel = authViewModel)
            is Screen.Home -> HomeScreen(onNavigate = navigate)
            is Screen.Search -> SearchScreen(onNavigate = navigate, viewModel = searchViewModel)
            is Screen.Study -> StudyScreen(onNavigate = navigate, viewModel = studyViewModel)
            is Screen.Vocabulary -> VocabularyScreen(onNavigate = navigate)
            is Screen.Review -> ReviewScreen(viewModel = reviewViewModel, onNavigateHome = { navigate(Screen.Home) })
            is Screen.Settings -> SettingsScreen(viewModel = settingsViewModel, onNavigateBack = { navigate(Screen.Home) })
            is Screen.SongResult -> SongResultScreen(onNavigate = navigate, viewModel = searchViewModel)
        }
    }
    }
}

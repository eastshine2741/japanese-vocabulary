package com.japanese.vocabulary.app

import androidx.compose.runtime.*
import androidx.compose.material3.MaterialTheme
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.platform.TokenStorage
import com.japanese.vocabulary.app.auth.ui.LoginScreen
import com.japanese.vocabulary.app.home.ui.HomeScreen
import com.japanese.vocabulary.app.song.ui.SearchScreen
import com.japanese.vocabulary.app.song.ui.StudyScreen
import com.japanese.vocabulary.app.song.ui.PlayerScreen
import com.japanese.vocabulary.app.word.ui.VocabularyScreen
import com.japanese.vocabulary.app.flashcard.ui.ReviewScreen
import com.japanese.vocabulary.app.flashcard.ui.SettingsScreen
import com.japanese.vocabulary.app.auth.viewmodel.AuthViewModel
import com.japanese.vocabulary.app.home.viewmodel.HomeViewModel
import com.japanese.vocabulary.app.flashcard.viewmodel.ReviewViewModel
import com.japanese.vocabulary.app.song.viewmodel.SearchViewModel
import com.japanese.vocabulary.app.flashcard.viewmodel.SettingsViewModel
import com.japanese.vocabulary.app.song.viewmodel.StudyViewModel
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
        val homeViewModel = remember { HomeViewModel() }
        val reviewViewModel = remember { ReviewViewModel() }
        val settingsViewModel = remember { SettingsViewModel() }

        val initialScreen: Screen = if (TokenStorage.getToken() != null) Screen.Home else Screen.Login
        var currentScreen by remember { mutableStateOf<Screen>(initialScreen) }

        val navigate: (Screen) -> Unit = { screen -> currentScreen = screen }

        when (currentScreen) {
            is Screen.Login -> LoginScreen(onNavigate = navigate, viewModel = authViewModel)
            is Screen.Home -> HomeScreen(onNavigate = navigate, homeViewModel = homeViewModel, searchViewModel = searchViewModel)
            is Screen.Search -> SearchScreen(onNavigate = navigate, viewModel = searchViewModel)
            is Screen.Study -> StudyScreen(onNavigate = navigate, viewModel = studyViewModel)
            is Screen.Vocabulary -> VocabularyScreen(onNavigate = navigate)
            is Screen.Review -> ReviewScreen(viewModel = reviewViewModel, onNavigateHome = { navigate(Screen.Home) })
            is Screen.Settings -> SettingsScreen(viewModel = settingsViewModel, onNavigateBack = { navigate(Screen.Home) })
            is Screen.Player -> PlayerScreen(onNavigate = navigate, viewModel = searchViewModel, screen = currentScreen as Screen.Player)
        }
    }
    }
}

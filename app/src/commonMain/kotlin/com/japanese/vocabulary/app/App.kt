package com.japanese.vocabulary.app

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.japanese.vocabulary.app.auth.ui.LoginScreen
import com.japanese.vocabulary.app.auth.viewmodel.AuthViewModel
import com.japanese.vocabulary.app.deck.ui.DeckDetailScreen
import com.japanese.vocabulary.app.deck.ui.DeckWordListScreen
import com.japanese.vocabulary.app.deck.viewmodel.DeckDetailViewModel
import com.japanese.vocabulary.app.deck.viewmodel.DeckListViewModel
import com.japanese.vocabulary.app.deck.viewmodel.DeckWordListViewModel
import com.japanese.vocabulary.app.flashcard.ui.ReviewScreen
import com.japanese.vocabulary.app.flashcard.viewmodel.ReviewViewModel
import com.japanese.vocabulary.app.flashcard.viewmodel.SettingsViewModel
import com.japanese.vocabulary.app.home.ui.HomeTab
import com.japanese.vocabulary.app.home.viewmodel.HomeViewModel
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.navigation.Tab
import com.japanese.vocabulary.app.platform.TokenStorage
import com.japanese.vocabulary.app.song.ui.PlayerScreen
import com.japanese.vocabulary.app.song.ui.SearchScreen
import com.japanese.vocabulary.app.song.viewmodel.SearchViewModel
import com.japanese.vocabulary.app.theme.AppTheme
import com.japanese.vocabulary.app.ui.components.BottomTabBar
import com.japanese.vocabulary.app.user.ui.MyPageTab
import com.japanese.vocabulary.app.word.ui.WordTab
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
        AppTheme {
            val authViewModel = remember { AuthViewModel() }
            val searchViewModel = remember { SearchViewModel() }
            val homeViewModel = remember { HomeViewModel() }
            val reviewViewModel = remember { ReviewViewModel() }
            val settingsViewModel = remember { SettingsViewModel() }
            val deckListViewModel = remember { DeckListViewModel() }
            val deckDetailViewModel = remember { DeckDetailViewModel() }
            val deckWordListViewModel = remember { DeckWordListViewModel() }

            val initialScreen: Screen = if (TokenStorage.getToken() != null) Screen.Main else Screen.Login
            var currentScreen by remember { mutableStateOf(initialScreen) }
            var selectedTab by remember { mutableStateOf(Tab.Home) }

            val navigate: (Screen) -> Unit = { screen -> currentScreen = screen }

            when (currentScreen) {
                is Screen.Login -> LoginScreen(
                    onNavigate = { navigate(Screen.Main) },
                    viewModel = authViewModel
                )
                is Screen.Main -> {
                    Scaffold(
                        bottomBar = {
                            BottomTabBar(
                                selectedTab = selectedTab,
                                onTabSelected = { selectedTab = it }
                            )
                        }
                    ) { innerPadding ->
                        Box(modifier = Modifier.padding(innerPadding)) {
                            when (selectedTab) {
                                Tab.Home -> HomeTab(
                                    onNavigate = navigate,
                                    homeViewModel = homeViewModel,
                                    searchViewModel = searchViewModel
                                )
                                Tab.Words -> WordTab(
                                    onNavigate = navigate,
                                    deckListViewModel = deckListViewModel
                                )
                                Tab.MyPage -> MyPageTab(
                                    onNavigate = navigate,
                                    settingsViewModel = settingsViewModel
                                )
                            }
                        }
                    }
                }
                is Screen.Search -> SearchScreen(
                    onNavigate = navigate,
                    viewModel = searchViewModel
                )
                is Screen.Player -> {
                    val screen = currentScreen as Screen.Player
                    PlayerScreen(
                        onNavigate = navigate,
                        viewModel = searchViewModel,
                        screen = screen
                    )
                }
                is Screen.Review -> {
                    val screen = currentScreen as Screen.Review
                    ReviewScreen(
                        viewModel = reviewViewModel,
                        songId = screen.songId,
                        onNavigateBack = {
                            if (screen.songId != null) navigate(Screen.DeckDetail(screen.songId))
                            else navigate(Screen.Main)
                        }
                    )
                }
                is Screen.DeckDetail -> {
                    val screen = currentScreen as Screen.DeckDetail
                    DeckDetailScreen(
                        songId = screen.songId,
                        viewModel = deckDetailViewModel,
                        onNavigateBack = { navigate(Screen.Main) },
                        onStartReview = { songId -> navigate(Screen.Review(songId)) },
                        onViewWords = { songId -> navigate(Screen.DeckWordList(songId)) }
                    )
                }
                is Screen.DeckWordList -> {
                    val screen = currentScreen as Screen.DeckWordList
                    DeckWordListScreen(
                        songId = screen.songId,
                        viewModel = deckWordListViewModel,
                        onNavigateBack = { navigate(Screen.DeckDetail(screen.songId)) }
                    )
                }
            }
        }
    }
}

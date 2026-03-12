package com.japanese.vocabulary.app.navigation

sealed class Screen {
    object Login : Screen()
    object Home : Screen()
    object Search : Screen()
    object Study : Screen()
    object Vocabulary : Screen()
    object Review : Screen()
    object Settings : Screen()
    object SongResult : Screen()
}

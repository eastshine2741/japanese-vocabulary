package com.japanese.vocabulary.app.navigation

sealed class Screen {
    object Login : Screen()
    object Home : Screen()
    object Search : Screen()
    object Study : Screen()
    object Vocabulary : Screen()
    data class Review(val songId: Long? = null) : Screen()
    object Settings : Screen()
    data class Player(val origin: Screen = Search) : Screen()
    object DeckList : Screen()
    data class DeckDetail(val songId: Long?) : Screen()
    data class DeckWordList(val songId: Long?) : Screen()
}

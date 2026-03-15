package com.japanese.vocabulary.app.navigation

enum class Tab { Home, Words, MyPage }

sealed class Screen {
    object Login : Screen()
    object Main : Screen()
    object Search : Screen()
    data class Player(val origin: Tab = Tab.Home) : Screen()
    data class Review(val songId: Long? = null) : Screen()
    data class DeckDetail(val songId: Long?) : Screen()
    data class DeckWordList(val songId: Long?) : Screen()
}

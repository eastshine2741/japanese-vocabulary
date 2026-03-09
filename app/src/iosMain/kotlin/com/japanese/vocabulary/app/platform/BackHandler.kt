package com.japanese.vocabulary.app.platform

import androidx.compose.runtime.Composable

@Composable
actual fun BackHandler(onBack: () -> Unit) {
    // iOS has no physical back button
}

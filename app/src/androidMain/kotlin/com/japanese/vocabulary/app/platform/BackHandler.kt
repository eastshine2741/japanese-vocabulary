package com.japanese.vocabulary.app.platform

import androidx.activity.compose.BackHandler as AndroidBackHandler
import androidx.compose.runtime.Composable

@Composable
actual fun BackHandler(onBack: () -> Unit) {
    AndroidBackHandler(onBack = onBack)
}

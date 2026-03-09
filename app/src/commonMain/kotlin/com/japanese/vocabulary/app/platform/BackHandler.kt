package com.japanese.vocabulary.app.platform

import androidx.compose.runtime.Composable

@Composable
expect fun BackHandler(onBack: () -> Unit)

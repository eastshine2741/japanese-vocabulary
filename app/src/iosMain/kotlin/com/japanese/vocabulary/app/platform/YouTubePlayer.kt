package com.japanese.vocabulary.app.platform

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

@Composable
actual fun YouTubePlayer(videoId: String, modifier: Modifier, onSecondChanged: (Float) -> Unit) {
    Box(modifier, contentAlignment = Alignment.Center) {
        Text("YouTube player — iOS not yet supported")
    }
}

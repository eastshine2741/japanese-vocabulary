package com.japanese.vocabulary.app.ui.components

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import io.kamel.image.KamelImage
import io.kamel.image.asyncPainterResource
import io.ktor.http.Url

@Composable
fun ArtworkImage(
    url: String?,
    size: Dp,
    cornerRadius: Dp = 8.dp,
    modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(cornerRadius)
    if (url != null) {
        KamelImage(
            resource = asyncPainterResource(Url(url)),
            contentDescription = null,
            modifier = modifier.size(size).clip(shape),
            onLoading = {
                Surface(
                    color = Color(0xFFE5E7EB),
                    modifier = Modifier.fillMaxSize(),
                    shape = shape
                ) {}
            },
            onFailure = {
                Surface(
                    color = Color(0xFFE5E7EB),
                    modifier = Modifier.fillMaxSize(),
                    shape = shape
                ) {}
            }
        )
    } else {
        Surface(
            color = Color(0xFFE5E7EB),
            modifier = modifier.size(size),
            shape = shape
        ) {}
    }
}

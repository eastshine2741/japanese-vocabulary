package com.japanese.vocabulary.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.theme.AppColors
import io.kamel.image.KamelImage
import io.kamel.image.asyncPainterResource
import io.ktor.http.Url

@Composable
fun SongCard(
    artworkUrl: String?,
    title: String,
    artist: String,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .clickable(onClick = onClick)
    ) {
        val shape = RoundedCornerShape(8.dp)
        if (artworkUrl != null) {
            KamelImage(
                resource = asyncPainterResource(Url(artworkUrl)),
                contentDescription = title,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .clip(shape),
                onLoading = {
                    Surface(
                        color = androidx.compose.ui.graphics.Color(0xFFE5E7EB),
                        modifier = Modifier.fillMaxSize(),
                        shape = shape
                    ) {}
                },
                onFailure = {
                    Surface(
                        color = androidx.compose.ui.graphics.Color(0xFFE5E7EB),
                        modifier = Modifier.fillMaxSize(),
                        shape = shape
                    ) {}
                }
            )
        } else {
            Surface(
                color = androidx.compose.ui.graphics.Color(0xFFE5E7EB),
                modifier = Modifier.fillMaxWidth().aspectRatio(1f),
                shape = shape
            ) {}
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
            color = AppColors.TextPrimary,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = artist,
            style = MaterialTheme.typography.labelSmall,
            color = AppColors.TextSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

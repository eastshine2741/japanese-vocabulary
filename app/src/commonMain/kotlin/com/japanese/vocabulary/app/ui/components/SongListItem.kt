package com.japanese.vocabulary.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppTheme
import org.jetbrains.compose.ui.tooling.preview.Preview

@Composable
fun SongListItem(
    artworkUrl: String?,
    title: String,
    subtitle: String,
    trailing: String? = null,
    isHighlighted: Boolean = false,
    onClick: () -> Unit
) {
    Surface(
        color = if (isHighlighted) AppColors.Primary.copy(alpha = 0.06f) else AppColors.Surface,
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ArtworkImage(url = artworkUrl, size = 56.dp, cornerRadius = 8.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontWeight = if (isHighlighted) FontWeight.Bold else FontWeight.Medium
                    ),
                    color = AppColors.TextPrimary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = AppColors.TextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            if (trailing != null) {
                Spacer(Modifier.width(8.dp))
                Text(
                    text = trailing,
                    style = MaterialTheme.typography.bodySmall,
                    color = AppColors.TextSecondary
                )
            }
        }
    }
}

@Preview
@Composable
private fun PreviewSongListItemDefault() {
    AppTheme {
        SongListItem(
            artworkUrl = null,
            title = "夜に駆ける",
            subtitle = "YOASOBI",
            onClick = {}
        )
    }
}

@Preview
@Composable
private fun PreviewSongListItemHighlighted() {
    AppTheme {
        SongListItem(
            artworkUrl = null,
            title = "廻廻奇譚",
            subtitle = "Eve",
            isHighlighted = true,
            onClick = {}
        )
    }
}

@Preview
@Composable
private fun PreviewSongListItemWithTrailing() {
    AppTheme {
        SongListItem(
            artworkUrl = null,
            title = "群青",
            subtitle = "YOASOBI",
            trailing = "3:42",
            onClick = {}
        )
    }
}

package com.japanese.vocabulary.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppTheme
import org.jetbrains.compose.ui.tooling.preview.Preview

@Composable
fun AppTopBar(
    title: String,
    onBack: (() -> Unit)? = null,
    onClose: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {}
) {
    Surface(color = AppColors.Surface) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(horizontal = 4.dp)
        ) {
            if (onBack != null) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier.align(Alignment.CenterStart)
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = AppColors.TextPrimary
                    )
                }
            } else if (onClose != null) {
                IconButton(
                    onClick = onClose,
                    modifier = Modifier.align(Alignment.CenterStart)
                ) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Close",
                        tint = AppColors.TextPrimary
                    )
                }
            }

            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                color = AppColors.TextPrimary,
                textAlign = TextAlign.Center,
                modifier = Modifier.align(Alignment.Center)
            )

            Row(
                modifier = Modifier.align(Alignment.CenterEnd),
                content = actions
            )
        }
    }
}

@Preview
@Composable
private fun PreviewAppTopBarTitleOnly() {
    AppTheme {
        AppTopBar(title = "My Words")
    }
}

@Preview
@Composable
private fun PreviewAppTopBarWithBack() {
    AppTheme {
        AppTopBar(title = "Song Details", onBack = {})
    }
}

@Preview
@Composable
private fun PreviewAppTopBarWithClose() {
    AppTheme {
        AppTopBar(title = "Search", onClose = {})
    }
}

package com.japanese.vocabulary.app.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

object AppColors {
    val Primary = Color(0xFF6161FA)
    val Background = Color(0xFFF5F5F8)
    val Surface = Color(0xFFFFFFFF)
    val TextPrimary = Color(0xFF1A1A2E)
    val TextSecondary = Color(0xFF6B7280)
    val TextTertiary = Color(0xFF9CA3AF)
    val CardBorder = Color(0xFFE2E8F0)

    val RatingAgain = Color(0xFFEF4444)
    val RatingHard = Color(0xFFF59E0B)
    val RatingGood = Color(0xFF6161FA)
    val RatingEasy = Color(0xFF10B981)

    val TabActive = Color(0xFF6161FA)
    val TabInactive = Color(0xFF94A3B8)
}

object AppDimens {
    val ScreenPadding = 16.dp
    val CardCornerRadius = 12.dp
    val SmallCornerRadius = 8.dp
    val ArtworkCornerRadius = 8.dp
    val BottomBarHeight = 64.dp
}

private val AppColorScheme = lightColorScheme(
    primary = AppColors.Primary,
    background = AppColors.Background,
    surface = AppColors.Surface,
    onSurface = AppColors.TextPrimary,
    onSurfaceVariant = AppColors.TextSecondary,
    onBackground = AppColors.TextPrimary,
    error = AppColors.RatingAgain
)

@Composable
fun AppTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AppColorScheme,
        content = content
    )
}

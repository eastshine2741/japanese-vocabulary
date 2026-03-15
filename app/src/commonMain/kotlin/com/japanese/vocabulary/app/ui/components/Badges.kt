package com.japanese.vocabulary.app.ui.components

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppTheme
import org.jetbrains.compose.ui.tooling.preview.Preview

@Composable
fun JlptBadge(level: String?) {
    if (level == null) return
    val bgColor = when (level) {
        "N1" -> Color(0xFFDC2626)
        "N2" -> Color(0xFFEA580C)
        "N3" -> Color(0xFFCA8A04)
        "N4" -> Color(0xFF2563EB)
        "N5" -> Color(0xFF16A34A)
        else -> AppColors.TextTertiary
    }
    Surface(
        color = bgColor.copy(alpha = 0.15f),
        shape = RoundedCornerShape(4.dp)
    ) {
        Text(
            text = level,
            style = MaterialTheme.typography.labelSmall,
            color = bgColor,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

@Composable
fun PosBadge(pos: String) {
    Surface(
        color = AppColors.Primary.copy(alpha = 0.1f),
        shape = RoundedCornerShape(4.dp)
    ) {
        Text(
            text = pos,
            style = MaterialTheme.typography.labelSmall,
            color = AppColors.Primary,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

@Preview
@Composable
private fun PreviewJlptBadges() {
    AppTheme {
        Column {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                JlptBadge("N1")
                JlptBadge("N2")
                JlptBadge("N3")
                JlptBadge("N4")
                JlptBadge("N5")
            }
            Spacer(Modifier.height(8.dp))
            PosBadge("Noun")
        }
    }
}

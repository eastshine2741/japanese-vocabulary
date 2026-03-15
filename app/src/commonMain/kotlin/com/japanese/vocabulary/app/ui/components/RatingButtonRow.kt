package com.japanese.vocabulary.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppTheme
import org.jetbrains.compose.ui.tooling.preview.Preview

@Composable
fun RatingButtonRow(
    intervals: Map<Int, String>?,
    onRate: (Int) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        val buttons = listOf(
            Triple(1, "Again", AppColors.RatingAgain),
            Triple(2, "Hard", AppColors.RatingHard),
            Triple(3, "Good", AppColors.RatingGood),
            Triple(4, "Easy", AppColors.RatingEasy)
        )
        buttons.forEach { (rating, label, color) ->
            Button(
                onClick = { onRate(rating) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = color),
                contentPadding = PaddingValues(vertical = 12.dp, horizontal = 4.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(label, fontSize = 12.sp, color = Color.White)
                    val interval = intervals?.get(rating)
                    if (interval != null) {
                        Text(interval, fontSize = 10.sp, color = Color.White.copy(alpha = 0.8f))
                    }
                }
            }
        }
    }
}

@Preview
@Composable
private fun PreviewRatingButtonRowWithIntervals() {
    AppTheme {
        RatingButtonRow(
            intervals = mapOf(1 to "1m", 2 to "6m", 3 to "1d", 4 to "4d"),
            onRate = {}
        )
    }
}

@Preview
@Composable
private fun PreviewRatingButtonRowWithoutIntervals() {
    AppTheme {
        RatingButtonRow(
            intervals = null,
            onRate = {}
        )
    }
}

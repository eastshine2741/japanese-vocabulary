package com.japanese.vocabulary.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppDimens
import com.japanese.vocabulary.app.theme.AppTheme
import org.jetbrains.compose.ui.tooling.preview.Preview

@Composable
fun StatsCard(
    wordCount: Int,
    dueToday: Int,
    onAction: () -> Unit,
    actionLabel: String
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(AppDimens.CardCornerRadius),
        colors = CardDefaults.cardColors(containerColor = AppColors.Surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        border = CardDefaults.outlinedCardBorder()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "$wordCount",
                        style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                        color = AppColors.TextPrimary
                    )
                    Text(
                        text = "total words",
                        style = MaterialTheme.typography.bodySmall,
                        color = AppColors.TextSecondary
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "$dueToday",
                        style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                        color = if (dueToday > 0) AppColors.Primary else AppColors.TextPrimary
                    )
                    Text(
                        text = "due today",
                        style = MaterialTheme.typography.bodySmall,
                        color = AppColors.TextSecondary
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = onAction,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(AppDimens.SmallCornerRadius),
                colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
            ) {
                Text(actionLabel)
            }
        }
    }
}

@Preview
@Composable
private fun PreviewStatsCardWithDue() {
    AppTheme {
        StatsCard(
            wordCount = 42,
            dueToday = 7,
            onAction = {},
            actionLabel = "Resume Learning"
        )
    }
}

@Preview
@Composable
private fun PreviewStatsCardNoDue() {
    AppTheme {
        StatsCard(
            wordCount = 128,
            dueToday = 0,
            onAction = {},
            actionLabel = "Start Review"
        )
    }
}

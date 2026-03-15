package com.japanese.vocabulary.app.user.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.flashcard.viewmodel.SettingsState
import com.japanese.vocabulary.app.flashcard.viewmodel.SettingsViewModel
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.platform.TokenStorage
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppDimens
import kotlin.math.roundToInt

@Composable
fun MyPageTab(
    onNavigate: (Screen) -> Unit,
    settingsViewModel: SettingsViewModel
) {
    val settingsState by settingsViewModel.state

    LaunchedEffect(Unit) {
        settingsViewModel.loadSettings()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = AppDimens.ScreenPadding)
    ) {
        Spacer(Modifier.height(16.dp))
        Text(
            "My Page",
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
            color = AppColors.TextPrimary
        )
        Spacer(Modifier.height(24.dp))

        when (val state = settingsState) {
            is SettingsState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxWidth().height(200.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = AppColors.Primary)
                }
            }
            is SettingsState.Error -> {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(AppDimens.CardCornerRadius),
                    colors = CardDefaults.cardColors(containerColor = AppColors.Surface)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(state.message, color = AppColors.RatingAgain)
                        Spacer(Modifier.height(16.dp))
                        Button(
                            onClick = { settingsViewModel.loadSettings() },
                            colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
                        ) {
                            Text("Retry")
                        }
                    }
                }
            }
            is SettingsState.Loaded -> {
                // Settings card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(AppDimens.CardCornerRadius),
                    colors = CardDefaults.cardColors(containerColor = AppColors.Surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                    border = CardDefaults.outlinedCardBorder()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "Study Settings",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                            color = AppColors.TextPrimary
                        )
                        Spacer(Modifier.height(20.dp))

                        Text(
                            "Target Retention Rate",
                            style = MaterialTheme.typography.bodyMedium,
                            color = AppColors.TextPrimary
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "${(state.requestRetention * 100).roundToInt()}%",
                            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                            color = AppColors.Primary
                        )
                        Slider(
                            value = state.requestRetention.toFloat(),
                            onValueChange = { settingsViewModel.updateRetention(it.toDouble()) },
                            valueRange = 0.7f..0.99f,
                            modifier = Modifier.fillMaxWidth(),
                            colors = SliderDefaults.colors(
                                thumbColor = AppColors.Primary,
                                activeTrackColor = AppColors.Primary
                            )
                        )
                        Text(
                            "Higher retention means more frequent reviews",
                            style = MaterialTheme.typography.bodySmall,
                            color = AppColors.TextTertiary
                        )

                        Spacer(Modifier.height(20.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                "Show next review intervals",
                                style = MaterialTheme.typography.bodyMedium,
                                color = AppColors.TextPrimary
                            )
                            Switch(
                                checked = state.showIntervals,
                                onCheckedChange = { settingsViewModel.updateShowIntervals(it) },
                                colors = SwitchDefaults.colors(checkedTrackColor = AppColors.Primary)
                            )
                        }
                        Text(
                            "Display interval previews on rating buttons",
                            style = MaterialTheme.typography.bodySmall,
                            color = AppColors.TextTertiary
                        )

                        Spacer(Modifier.height(20.dp))

                        Button(
                            onClick = { settingsViewModel.saveSettings() },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !state.isSaving,
                            shape = RoundedCornerShape(AppDimens.SmallCornerRadius),
                            colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
                        ) {
                            if (state.isSaving) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = Color.White
                                )
                                Spacer(Modifier.width(8.dp))
                            }
                            Text("Save")
                        }

                        if (state.saveSuccess) {
                            Spacer(Modifier.height(12.dp))
                            Text(
                                "Settings saved successfully",
                                color = AppColors.RatingEasy,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }

                Spacer(Modifier.height(24.dp))

                // Logout button
                OutlinedButton(
                    onClick = {
                        TokenStorage.clearToken()
                        onNavigate(Screen.Login)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(AppDimens.SmallCornerRadius),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = AppColors.RatingAgain)
                ) {
                    Text("Log Out")
                }

                Spacer(Modifier.height(32.dp))
            }
        }
    }
}

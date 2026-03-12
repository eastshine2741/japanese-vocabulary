package com.japanese.vocabulary.app.screen

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.viewmodel.SettingsState
import com.japanese.vocabulary.app.viewmodel.SettingsViewModel
import kotlin.math.roundToInt

@Composable
fun SettingsScreen(viewModel: SettingsViewModel, onNavigateBack: () -> Unit) {
    val settingsState by viewModel.state

    LaunchedEffect(Unit) {
        viewModel.loadSettings()
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onNavigateBack) {
                Text("\u2190 \ub4a4\ub85c")
            }
            Spacer(Modifier.weight(1f))
            Text("Settings", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(end = 16.dp))
        }

        when (val state = settingsState) {
            is SettingsState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is SettingsState.Error -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            state.message,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadSettings() }) {
                            Text("Retry")
                        }
                    }
                }
            }
            is SettingsState.Loaded -> {
                Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
                    Text("Review Settings", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(24.dp))

                    Text("Target Retention Rate", style = MaterialTheme.typography.bodyLarge)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "${(state.requestRetention * 100).roundToInt()}%",
                        style = MaterialTheme.typography.headlineMedium
                    )
                    Spacer(Modifier.height(8.dp))

                    Slider(
                        value = state.requestRetention.toFloat(),
                        onValueChange = { viewModel.updateRetention(it.toDouble()) },
                        valueRange = 0.7f..0.99f,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Text(
                        "Higher retention means more frequent reviews",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(Modifier.height(32.dp))

                    Button(
                        onClick = { viewModel.saveSettings() },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !state.isSaving
                    ) {
                        if (state.isSaving) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp
                            )
                            Spacer(Modifier.width(8.dp))
                        }
                        Text("Save")
                    }

                    if (state.saveSuccess) {
                        Spacer(Modifier.height(16.dp))
                        Text(
                            "Settings saved successfully",
                            color = MaterialTheme.colorScheme.primary,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        }
    }
}

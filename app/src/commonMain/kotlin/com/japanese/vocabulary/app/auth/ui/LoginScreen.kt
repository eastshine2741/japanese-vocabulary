package com.japanese.vocabulary.app.auth.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.japanese.vocabulary.app.navigation.Screen
import com.japanese.vocabulary.app.auth.viewmodel.AuthUiState
import com.japanese.vocabulary.app.auth.viewmodel.AuthViewModel

@Composable
fun LoginScreen(onNavigate: (Screen) -> Unit, viewModel: AuthViewModel) {
    val uiState by viewModel.uiState

    var name by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isSignupMode by remember { mutableStateOf(false) }

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.Success) {
            onNavigate(Screen.Main)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            if (isSignupMode) "회원가입" else "로그인",
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(Modifier.height(32.dp))

        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("이름") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("비밀번호") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(24.dp))

        if (uiState is AuthUiState.Error) {
            Text(
                text = (uiState as AuthUiState.Error).message,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(12.dp))
        }

        Button(
            onClick = {
                if (isSignupMode) viewModel.signup(name, password)
                else viewModel.login(name, password)
            },
            enabled = uiState !is AuthUiState.Loading && name.isNotBlank() && password.isNotBlank(),
            modifier = Modifier.fillMaxWidth()
        ) {
            if (uiState is AuthUiState.Loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            } else {
                Text(if (isSignupMode) "회원가입" else "로그인")
            }
        }
        Spacer(Modifier.height(12.dp))

        TextButton(onClick = { isSignupMode = !isSignupMode }) {
            Text(if (isSignupMode) "이미 계정이 있으신가요? 로그인" else "계정이 없으신가요? 회원가입")
        }
    }
}

// --- Previews ---

@org.jetbrains.compose.ui.tooling.preview.Preview
@Composable
private fun PreviewLoginScreen() {
    com.japanese.vocabulary.app.theme.AppTheme {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                "로그인",
                style = MaterialTheme.typography.headlineMedium
            )
            Spacer(Modifier.height(32.dp))

            OutlinedTextField(
                value = "",
                onValueChange = {},
                label = { Text("이름") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))

            OutlinedTextField(
                value = "",
                onValueChange = {},
                label = { Text("비밀번호") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(24.dp))

            Button(
                onClick = {},
                enabled = false,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("로그인")
            }
            Spacer(Modifier.height(12.dp))

            TextButton(onClick = {}) {
                Text("계정이 없으신가요? 회원가입")
            }
        }
    }
}

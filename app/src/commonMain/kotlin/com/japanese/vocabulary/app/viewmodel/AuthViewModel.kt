package com.japanese.vocabulary.app.viewmodel

import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import com.japanese.vocabulary.app.network.AuthRepository
import com.japanese.vocabulary.app.platform.TokenStorage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    object Success : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

class AuthViewModel(private val repository: AuthRepository = AuthRepository()) {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    val uiState: MutableState<AuthUiState> = mutableStateOf(AuthUiState.Idle)

    fun login(name: String, password: String) {
        uiState.value = AuthUiState.Loading
        scope.launch {
            try {
                val response = repository.login(name, password)
                TokenStorage.saveToken(response.token)
                uiState.value = AuthUiState.Success
            } catch (e: Exception) {
                uiState.value = AuthUiState.Error(e.message ?: "로그인 실패")
            }
        }
    }

    fun signup(name: String, password: String) {
        uiState.value = AuthUiState.Loading
        scope.launch {
            try {
                val response = repository.signup(name, password)
                TokenStorage.saveToken(response.token)
                uiState.value = AuthUiState.Success
            } catch (e: Exception) {
                uiState.value = AuthUiState.Error(e.message ?: "회원가입 실패")
            }
        }
    }

    fun isLoggedIn(): Boolean = TokenStorage.getToken() != null
}

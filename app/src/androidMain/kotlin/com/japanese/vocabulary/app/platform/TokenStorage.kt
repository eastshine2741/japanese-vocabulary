package com.japanese.vocabulary.app.platform

import com.japanese.vocabulary.app.MainActivity

actual object TokenStorage {
    private const val PREF_NAME = "app_prefs"
    private const val KEY_JWT = "jwt_token"

    actual fun saveToken(token: String) {
        val prefs = MainActivity.appContext.getSharedPreferences(PREF_NAME, android.content.Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_JWT, token).apply()
    }

    actual fun getToken(): String? {
        val prefs = MainActivity.appContext.getSharedPreferences(PREF_NAME, android.content.Context.MODE_PRIVATE)
        return prefs.getString(KEY_JWT, null)
    }

    actual fun clearToken() {
        val prefs = MainActivity.appContext.getSharedPreferences(PREF_NAME, android.content.Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_JWT).apply()
    }
}

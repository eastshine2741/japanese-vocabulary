package com.japanese.vocabulary.app.platform

import platform.Foundation.NSUserDefaults

actual object TokenStorage {
    private const val KEY_JWT = "jwt_token"

    actual fun saveToken(token: String) {
        NSUserDefaults.standardUserDefaults.setObject(token, KEY_JWT)
    }

    actual fun getToken(): String? {
        return NSUserDefaults.standardUserDefaults.stringForKey(KEY_JWT)
    }

    actual fun clearToken() {
        NSUserDefaults.standardUserDefaults.removeObjectForKey(KEY_JWT)
    }
}

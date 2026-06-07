package com.japanese.vocabulary.user.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode

object UsernamePolicy {
    val REGEX = Regex("^[a-z0-9_]{3,20}$")
    val RESERVED = setOf("admin", "root", "api", "system", "null", "undefined")

    fun normalize(raw: String): String = raw.trim().lowercase()

    fun validate(username: String) {
        if (!REGEX.matches(username)) throw BusinessException(ErrorCode.INVALID_USERNAME)
        if (username in RESERVED) throw BusinessException(ErrorCode.RESERVED_USERNAME)
    }
}

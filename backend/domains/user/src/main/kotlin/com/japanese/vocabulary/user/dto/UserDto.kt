package com.japanese.vocabulary.user.dto

import com.japanese.vocabulary.user.entity.UserEntity

/** Cross-module return type; managed [UserEntity] instances do not leave this module. */
data class UserDto(
    val id: Long,
    val provider: String,
    val providerSub: String,
    val username: String,
    val email: String?,
    val name: String?,
)

fun UserEntity.toDto(): UserDto = UserDto(
    id = id!!,
    provider = provider,
    providerSub = providerSub,
    username = username,
    email = email,
    name = name,
)

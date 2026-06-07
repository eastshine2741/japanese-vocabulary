package com.japanese.vocabulary.user.dto

import com.japanese.vocabulary.user.entity.UserEntity

/**
 * Entity-mirror data class for [UserEntity]. Use this as the cross-module return type
 * instead of the JPA entity so domain modules and bootstrap modules don't pass managed
 * entities across their boundaries.
 */
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

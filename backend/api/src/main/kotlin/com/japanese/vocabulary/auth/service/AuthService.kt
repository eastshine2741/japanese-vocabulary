package com.japanese.vocabulary.auth.service

import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.repository.UserRepository
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.stereotype.Service

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val jwtUtil: JwtUtil
) {
    private val passwordEncoder = BCryptPasswordEncoder()

    fun signup(name: String, password: String): String {
        if (userRepository.findByName(name) != null) {
            throw BusinessException(ErrorCode.DUPLICATE_NAME)
        }
        val hashed = passwordEncoder.encode(password)
        val user = userRepository.save(UserEntity(name = name, password = hashed))
        return jwtUtil.generateToken(user.id!!, user.name)
    }

    fun login(name: String, password: String): String {
        val user = userRepository.findByName(name)
            ?: throw BusinessException(ErrorCode.INVALID_CREDENTIALS)
        if (!passwordEncoder.matches(password, user.password)) {
            throw BusinessException(ErrorCode.INVALID_CREDENTIALS)
        }
        return jwtUtil.generateToken(user.id!!, user.name)
    }
}

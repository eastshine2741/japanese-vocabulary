package com.japanese.vocabulary.auth

import com.japanese.vocabulary.entity.UserEntity
import com.japanese.vocabulary.repository.UserRepository
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val jwtUtil: JwtUtil
) {
    private val passwordEncoder = BCryptPasswordEncoder()

    fun signup(name: String, password: String): String {
        if (userRepository.findByName(name) != null) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Name already taken")
        }
        val hashed = passwordEncoder.encode(password)
        val user = userRepository.save(UserEntity(name = name, password = hashed))
        return jwtUtil.generateToken(user.id!!, user.name)
    }

    fun login(name: String, password: String): String {
        val user = userRepository.findByName(name)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials")
        if (!passwordEncoder.matches(password, user.password)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials")
        }
        return jwtUtil.generateToken(user.id!!, user.name)
    }
}

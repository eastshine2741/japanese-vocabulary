package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminUserDetailResponse
import com.japanese.vocabulary.admin.dto.AdminUserResponse
import com.japanese.vocabulary.admin.dto.AdminUserWordResponse
import com.japanese.vocabulary.admin.service.AdminUserReadService
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/admin/api/users")
class AdminUserController(
    private val adminUserReadService: AdminUserReadService,
) {
    @GetMapping
    fun listUsers(
        @RequestParam(required = false) q: String?,
        pageable: Pageable,
    ): Page<AdminUserResponse> = adminUserReadService.listUsers(q, pageable)

    @GetMapping("/{userId}")
    fun getUser(@PathVariable userId: Long): AdminUserDetailResponse = adminUserReadService.getUser(userId)

    @GetMapping("/{userId}/words")
    fun listWords(
        @PathVariable userId: Long,
        @RequestParam(required = false) deckId: Long?,
        @RequestParam(required = false) q: String?,
        pageable: Pageable,
    ): Page<AdminUserWordResponse> = adminUserReadService.listWords(userId, deckId, q, pageable)
}

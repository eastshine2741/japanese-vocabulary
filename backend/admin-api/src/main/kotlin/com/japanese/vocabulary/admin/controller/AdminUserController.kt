package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminUserResponse
import com.japanese.vocabulary.admin.service.AdminReadService
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
    private val adminReadService: AdminReadService,
) {
    @GetMapping
    fun listUsers(
        @RequestParam(required = false) q: String?,
        pageable: Pageable,
    ): Page<AdminUserResponse> = adminReadService.listUsers(q, pageable)

    @GetMapping("/{userId}")
    fun getUser(@PathVariable userId: Long): AdminUserResponse = adminReadService.getUser(userId)
}

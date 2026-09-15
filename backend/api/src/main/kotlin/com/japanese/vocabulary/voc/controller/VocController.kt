package com.japanese.vocabulary.voc.controller

import com.japanese.vocabulary.voc.dto.CreateVocRequest
import com.japanese.vocabulary.voc.dto.CreateVocResponse
import com.japanese.vocabulary.voc.service.VocService
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/voc")
class VocController(private val vocService: VocService) {

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@RequestBody request: CreateVocRequest): CreateVocResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return vocService.submit(userId, request)
    }
}

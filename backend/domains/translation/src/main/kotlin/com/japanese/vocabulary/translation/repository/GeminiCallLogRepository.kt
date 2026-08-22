package com.japanese.vocabulary.translation.repository

import com.japanese.vocabulary.translation.entity.GeminiCallLogEntity
import org.springframework.data.jpa.repository.JpaRepository

interface GeminiCallLogRepository : JpaRepository<GeminiCallLogEntity, Long>

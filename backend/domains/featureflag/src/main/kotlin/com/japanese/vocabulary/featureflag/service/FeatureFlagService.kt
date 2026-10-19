package com.japanese.vocabulary.featureflag.service

import com.japanese.vocabulary.featureflag.dto.FeatureFlagDto
import com.japanese.vocabulary.featureflag.entity.FeatureFlagEntity
import com.japanese.vocabulary.featureflag.entity.FeatureFlagWindow
import com.japanese.vocabulary.featureflag.repository.FeatureFlagRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.time.Clock

@Service
class FeatureFlagService(
    private val repository: FeatureFlagRepository,
    private val featureFlags: FeatureFlags,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun list(): List<FeatureFlagDto> = repository.findAll().sortedBy { it.key }.map { it.toDto() }

    @Transactional
    fun upsert(key: String, window: FeatureFlagWindow, description: String): FeatureFlagDto {
        require(KEY_PATTERN.matches(key)) { "key must be lowercase kebab-case up to 100 chars." }
        require(description.length <= 500) { "description must be at most 500 chars." }
        val flag = repository.findById(key).orElseGet { FeatureFlagEntity(key = key) }
        flag.startAt = window.startAt
        flag.endAt = window.endAt
        flag.description = description
        val saved = repository.saveAndFlush(flag)
        invalidateAfterCommit()
        return saved.toDto()
    }

    @Transactional
    fun delete(key: String) {
        val flag = repository.findById(key).orElseThrow { NoSuchElementException("Feature flag not found: $key") }
        repository.delete(flag)
        invalidateAfterCommit()
    }

    // 커밋 전에 비우면 동시 조회가 옛 값을 다시 채워 한 주기 동안 남는다.
    private fun invalidateAfterCommit() {
        TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
            override fun afterCommit() = featureFlags.invalidate()
        })
    }

    private fun FeatureFlagEntity.toDto() = FeatureFlagDto(
        key = key,
        startAt = startAt,
        endAt = endAt,
        description = description,
        on = window().isOn(clock.instant()),
        updatedAt = updatedAt,
    )

    companion object {
        private val KEY_PATTERN = Regex("^(?=.{1,100}$)[a-z0-9]+(-[a-z0-9]+)*$")
    }
}

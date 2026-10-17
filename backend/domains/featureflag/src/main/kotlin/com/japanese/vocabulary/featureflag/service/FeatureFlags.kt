package com.japanese.vocabulary.featureflag.service

import com.github.benmanes.caffeine.cache.Caffeine
import com.github.benmanes.caffeine.cache.LoadingCache
import com.japanese.vocabulary.featureflag.entity.FeatureFlagWindow
import com.japanese.vocabulary.featureflag.repository.FeatureFlagRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Duration

/**
 * 켜짐 판정은 매 호출의 현재 시각으로 하므로 시작·종료 시각은 즉시 맞는다.
 * 캐시 주기는 관리자 수정이 다른 pod 에 보이기까지의 지연만 정한다.
 */
@Component
class FeatureFlags(
    private val repository: FeatureFlagRepository,
    private val clock: Clock,
) {
    // 다시 읽는 동안·실패 시에는 직전 값을 그대로 돌려준다.
    private val snapshot: LoadingCache<Unit, Map<String, FeatureFlagWindow>> = Caffeine.newBuilder()
        .refreshAfterWrite(REFRESH_INTERVAL)
        .build { repository.findAll().associate { it.key to it.window() } }

    fun isOn(key: String): Boolean {
        val windows = try {
            snapshot.get(Unit)
        } catch (e: Exception) {
            log.warn("Feature flag load failed; treating {} as off", key, e)
            return false
        }
        return windows[key]?.isOn(clock.instant()) ?: false
    }

    fun invalidate() = snapshot.invalidateAll()

    companion object {
        private val log = LoggerFactory.getLogger(FeatureFlags::class.java)
        val REFRESH_INTERVAL: Duration = Duration.ofSeconds(30)
    }
}

package com.japanese.vocabulary.user

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.user.repository.UserRepository
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.binder.MeterBinder
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.util.concurrent.atomic.AtomicLong

/** 탈퇴하지 않은 가입자 수. 30초마다 센다. api 파드가 여럿이면 모두 같은 값이라 대시보드는 max 로 읽는다. */
@Component
class RegisteredUserGauge(
    private val userRepository: UserRepository,
) : MeterBinder {
    private val logger = LoggerFactory.getLogger(RegisteredUserGauge::class.java)
    private val registered = AtomicLong()

    override fun bindTo(registry: MeterRegistry) {
        Gauge.builder(MetricNames.USERS_REGISTERED) { registered.get().toDouble() }.register(registry)
    }

    // 스크레이프 스레드에서 DB 를 치면 DB 가 느릴 때 /actuator/prometheus 전체가 늦어진다.
    @Scheduled(fixedDelay = REFRESH_INTERVAL_MS)
    fun refresh() {
        try {
            registered.set(userRepository.countByDeletedAtIsNullAndIdNot(OPERATOR_USER_ID))
        } catch (e: Exception) {
            logger.warn("Failed to refresh registered user gauge; keeping the last value", e)
        }
    }

    private companion object {
        // 운영자 계정이라 가입자로 세지 않는다.
        const val OPERATOR_USER_ID = 1L
        const val REFRESH_INTERVAL_MS = 30_000L
    }
}

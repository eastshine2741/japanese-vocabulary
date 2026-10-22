package com.japanese.vocabulary.user

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.user.repository.UserRepository
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.binder.MeterBinder
import org.springframework.stereotype.Component

/** 탈퇴하지 않은 가입자 수. 스크레이프마다 센다. api 파드가 여럿이면 모두 같은 값이라 대시보드는 max 로 읽는다. */
@Component
class RegisteredUserGauge(
    private val userRepository: UserRepository,
) : MeterBinder {
    override fun bindTo(registry: MeterRegistry) {
        Gauge.builder(MetricNames.USERS_REGISTERED) {
            userRepository.countByDeletedAtIsNullAndIdNot(OPERATOR_USER_ID).toDouble()
        }.register(registry)
    }

    private companion object {
        // 운영자 계정이라 가입자로 세지 않는다.
        const val OPERATOR_USER_ID = 1L
    }
}

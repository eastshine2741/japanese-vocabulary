package com.japanese.vocabulary.config

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import io.sentry.Hint
import io.sentry.SentryEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.web.bind.MissingServletRequestParameterException
import org.springframework.web.server.ResponseStatusException

class SentryConfigTest {

    private val beforeSend = SentryConfig().sentryOptionsCustomizer()

    @Test
    fun `beforeSend drops 4xx ResponseStatusException events`() {
        val event = SentryEvent(ResponseStatusException(HttpStatus.FORBIDDEN, "manual push secret invalid"))

        assertThat(beforeSend.execute(event, Hint())).isNull()
    }

    @Test
    fun `beforeSend drops 4xx ErrorResponse events`() {
        val event = SentryEvent(MissingServletRequestParameterException("userId", "Long"))

        assertThat(beforeSend.execute(event, Hint())).isNull()
    }

    @Test
    fun `beforeSend drops 4xx BusinessException events`() {
        val event = SentryEvent(BusinessException(ErrorCode.FORBIDDEN))

        assertThat(beforeSend.execute(event, Hint())).isNull()
    }

    @Test
    fun `beforeSend keeps non-4xx events`() {
        val event = SentryEvent(IllegalStateException("batch failed"))

        assertThat(beforeSend.execute(event, Hint())).isSameAs(event)
    }
}

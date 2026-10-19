package com.japanese.vocabulary.featureflag.entity

import java.time.Instant

/** [startAt] 이상 [endAt] 미만에서 켜진다. [startAt] 이 없으면 꺼져 있고, [endAt] 이 없으면 끝이 없다. */
data class FeatureFlagWindow(val startAt: Instant?, val endAt: Instant?) {
    init {
        require(startAt == null || endAt == null || startAt.isBefore(endAt)) { "startAt must be before endAt." }
    }

    fun isOn(now: Instant): Boolean =
        startAt != null && !now.isBefore(startAt) && (endAt == null || now.isBefore(endAt))
}

package com.japanese.vocabulary.translation.client.jev.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/**
 * Jev's answer to one question: the chosen criteria key and how sure it is, 0..1.
 * [confidence] is its own calibrated score, not the chosen option's probability.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class JevAnswer(
    val choice: String,
    val confidence: Double,
)

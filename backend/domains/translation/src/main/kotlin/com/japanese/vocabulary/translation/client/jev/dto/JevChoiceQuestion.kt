package com.japanese.vocabulary.translation.client.jev.dto

/**
 * One `choice` question in a Jev request: pick one key of [criteria] (option id -> description).
 * Jev evaluates every question in a request independently, and caps [criteria] at 255 options.
 */
data class JevChoiceQuestion(
    val instructions: String,
    val criteria: Map<String, String>,
) {
    @Suppress("unused") // serialized: Jev dispatches on it
    val type: String = "choice"
}

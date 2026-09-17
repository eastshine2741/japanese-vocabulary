package com.japanese.vocabulary.voc.dto

data class CreateVocRequest(
    val content: String,
    /** Contact email the user typed; falls back to the account email when blank. */
    val email: String? = null,
    val os: String? = null,
    val osVersion: String? = null,
    val device: String? = null,
    val nativeVersion: String? = null,
    val jsVersion: String? = null,
)

package com.japanese.vocabulary.voc.dto

data class CreateVocRequest(
    val content: String,
    val os: String? = null,
    val osVersion: String? = null,
    val device: String? = null,
    val nativeVersion: String? = null,
    val jsVersion: String? = null,
)

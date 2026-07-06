package com.japanese.vocabulary.translation.client.jisho.dto

enum class JishoLookupProvenance {
    EXACT,
    APPROVED_FALLBACK,
    REJECTED_FALLBACK,
    NOT_FOUND,
    FETCH_ERROR,
}

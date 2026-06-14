package com.japanese.vocabulary.translation.client.jisho.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/** Top-level jisho.org `/api/v1/search/words` response: `{ "data": [...] }`. */
@JsonIgnoreProperties(ignoreUnknown = true)
data class JishoSearchResponse(
    val data: List<JishoEntryRawDto> = emptyList(),
)

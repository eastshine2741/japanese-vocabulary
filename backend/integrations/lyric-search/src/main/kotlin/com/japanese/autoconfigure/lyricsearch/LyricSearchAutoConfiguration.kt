package com.japanese.autoconfigure.lyricsearch

import com.japanese.vocabulary.lyricsearch.lrclib.LrclibClient
import com.japanese.vocabulary.lyricsearch.vocadb.VocadbClient
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.context.annotation.Import

@AutoConfiguration
@Import(LrclibClient::class, VocadbClient::class)
class LyricSearchAutoConfiguration

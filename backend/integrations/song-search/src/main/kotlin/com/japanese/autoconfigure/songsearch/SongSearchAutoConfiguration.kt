package com.japanese.autoconfigure.songsearch

import com.japanese.vocabulary.songsearch.client.itunes.ItunesClient
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.context.annotation.Import

@AutoConfiguration
@Import(ItunesClient::class)
class SongSearchAutoConfiguration

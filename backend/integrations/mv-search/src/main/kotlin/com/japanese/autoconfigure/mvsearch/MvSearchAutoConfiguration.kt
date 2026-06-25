package com.japanese.autoconfigure.mvsearch

import com.japanese.vocabulary.mvsearch.client.youtube.YoutubeClient
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.context.annotation.Import

@AutoConfiguration
@Import(YoutubeClient::class)
class MvSearchAutoConfiguration

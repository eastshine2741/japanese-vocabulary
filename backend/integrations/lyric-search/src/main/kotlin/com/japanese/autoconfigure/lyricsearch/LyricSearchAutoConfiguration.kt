package com.japanese.autoconfigure.lyricsearch

import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.context.annotation.ComponentScan

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.lyricsearch"])
class LyricSearchAutoConfiguration

package com.japanese.autoconfigure.songsearch

import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.context.annotation.ComponentScan

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.songsearch"])
class SongSearchAutoConfiguration

package com.japanese.autoconfigure.karaokelisting

import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.context.annotation.ComponentScan

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.karaokelisting"])
class KaraokeListingAutoConfiguration

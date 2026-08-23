package com.japanese.autoconfigure.applemusicrss

import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.context.annotation.ComponentScan

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.applemusicrss"])
class AppleMusicRssAutoConfiguration

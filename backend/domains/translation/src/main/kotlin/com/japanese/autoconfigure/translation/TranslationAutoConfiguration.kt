package com.japanese.autoconfigure.translation

import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.context.annotation.ComponentScan

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.translation"])
class TranslationAutoConfiguration

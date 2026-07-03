package com.japanese.autoconfigure.mvsearch

import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.context.annotation.ComponentScan

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.mvsearch"])
class MvSearchAutoConfiguration

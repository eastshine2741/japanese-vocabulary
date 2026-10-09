package com.japanese.autoconfigure.objectstorage

import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.context.annotation.ComponentScan

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.objectstorage"])
class ObjectStorageAutoConfiguration

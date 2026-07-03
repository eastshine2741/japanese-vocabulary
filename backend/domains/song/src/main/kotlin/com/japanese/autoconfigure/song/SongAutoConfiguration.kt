package com.japanese.autoconfigure.song

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.song"])
@EntityScan(basePackageClasses = [SongEntity::class, LyricEntity::class])
@EnableJpaRepositories(basePackageClasses = [SongRepository::class, LyricRepository::class])
class SongAutoConfiguration

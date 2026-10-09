package com.japanese.autoconfigure.karaoke

import com.japanese.vocabulary.karaoke.entity.KaraokeSongEntity
import com.japanese.vocabulary.karaoke.repository.KaraokeSongRepository
import com.japanese.vocabulary.karaoke.service.KaraokeSongService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackageClasses = [KaraokeSongService::class])
@EntityScan(basePackageClasses = [KaraokeSongEntity::class])
@EnableJpaRepositories(basePackageClasses = [KaraokeSongRepository::class])
class KaraokeAutoConfiguration

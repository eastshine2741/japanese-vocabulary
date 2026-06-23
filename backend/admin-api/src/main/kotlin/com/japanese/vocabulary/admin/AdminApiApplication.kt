package com.japanese.vocabulary.admin

import com.japanese.vocabulary.admin.repository.AdminSongRepository
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.user.entity.UserEntity
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration
import org.springframework.boot.autoconfigure.data.redis.RedisReactiveAutoConfiguration
import org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.boot.runApplication
import org.springframework.data.jpa.repository.config.EnableJpaAuditing
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@SpringBootApplication(
    scanBasePackages = ["com.japanese.vocabulary.admin"],
    exclude = [
        RedisAutoConfiguration::class,
        RedisReactiveAutoConfiguration::class,
        RedisRepositoriesAutoConfiguration::class,
    ],
)
@EnableJpaAuditing
@EntityScan(basePackageClasses = [SongEntity::class, LyricEntity::class, SongAnalysisWorkEntity::class, UserEntity::class])
@EnableJpaRepositories(basePackageClasses = [AdminSongRepository::class])
class AdminApiApplication

fun main(args: Array<String>) {
    runApplication<AdminApiApplication>(*args)
}

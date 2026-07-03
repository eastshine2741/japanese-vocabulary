package com.japanese.vocabulary.admin.verification

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.io.path.name
import kotlin.io.path.readText
import kotlin.streams.asSequence

class AdminSongReanalysisContractTest {
    private val repoRoot: Path = findRepoRoot()

    @Test
    fun `migration adds active lyric pointer and work youtube url but not previous youtube url`() {
        val migration = migrationFiles().singleOrNull { it.name.startsWith("V27__song_reanalysis_active_result") }

        assertThat(migration)
            .describedAs("Expected V27 song reanalysis migration from PRD")
            .isNotNull

        val sql = migration!!.readText().lowercase()
        assertThat(sql).contains("active_lyric_id")
        assertThat(sql).contains("updated_at")
        assertThat(sql).contains("song_analysis_work")
        assertThat(sql).contains("youtube_url")
        assertThat(sql).contains("lyrics")
        assertThat(sql).contains("song_id")
        assertThat(sql).doesNotContain("previous" + "_youtube" + "_url")
    }

    @Test
    fun `entities and DTOs expose active lyric and newly produced work youtube url`() {
        val songEntity = source("backend/domains/song/src/main/kotlin/com/japanese/vocabulary/song/entity/SongEntity.kt")
        val lyricEntity = source("backend/domains/song/src/main/kotlin/com/japanese/vocabulary/song/entity/LyricEntity.kt")
        val workEntity = source("backend/domains/song-analysis/src/main/kotlin/com/japanese/vocabulary/songanalysis/entity/SongAnalysisWorkEntity.kt")
        val workDto = source("backend/domains/song-analysis/src/main/kotlin/com/japanese/vocabulary/songanalysis/dto/SongAnalysisWorkDto.kt")

        assertThat(songEntity).contains("activeLyricId")
        assertThat(songEntity).contains("var youtubeUrl")
        assertThat(songEntity).contains("updatedAt")
        assertThat(lyricEntity).doesNotContain("unique = true")
        assertThat(workEntity).contains("name = \"youtube_url\"")
        assertThat(workEntity).contains("youtubeUrl")
        assertThat(workDto).contains("youtubeUrl")
    }

    @Test
    fun `public and admin active reads do not use ambiguous lyric by song id lookup`() {
        val lyricRepository = source("backend/domains/song/src/main/kotlin/com/japanese/vocabulary/song/repository/LyricRepository.kt")
        val apiStudyService = source("backend/api/src/main/kotlin/com/japanese/vocabulary/song/service/SongStudyViewService.kt")
        val apiSongController = source("backend/api/src/main/kotlin/com/japanese/vocabulary/song/controller/SongController.kt")
        val adminReadService = source("backend/admin-api/src/main/kotlin/com/japanese/vocabulary/admin/service/AdminReadService.kt")

        assertThat(lyricRepository).contains("findActiveBySongId")
        assertThat(lyricRepository).contains("active_lyric_id")
        assertThat(apiStudyService).doesNotContain("findBySongId")
        assertThat(apiSongController).doesNotContain("findBySongId")
        assertThat(adminReadService).doesNotContain("findBySongId")
    }

    @Test
    fun `feature does not introduce previous youtube url persistence`() {
        val forbidden = "previous" + "_youtube" + "_url"
        val offenders = Files.walk(repoRoot).asSequence()
            .filter { Files.isRegularFile(it) }
            .filterNot { it.toString().contains("/build/") }
            .filterNot { it.toString().contains("/node_modules/") }
            .filterNot { it.toString().contains("/.git/") }
            .filterNot { it.toString().contains("AdminSongReanalysisContractTest.kt") }
            .filter { path ->
                val text = runCatching { path.readText() }.getOrDefault("")
                text.contains(forbidden, ignoreCase = true)
            }
            .map { repoRoot.relativize(it).toString() }
            .toList()

        assertThat(offenders).isEmpty()
    }

    private fun migrationFiles(): List<Path> = Files.list(repoRoot.resolve("backend/migration/src/main/resources/db/migration"))
        .asSequence()
        .filter { Files.isRegularFile(it) }
        .toList()

    private fun source(relativePath: String): String = repoRoot.resolve(relativePath).readText()

    private fun findRepoRoot(): Path {
        var current = Path.of("").toAbsolutePath()
        while (current.parent != null) {
            if (current.resolve("backend").exists() && current.resolve("admin-web").exists()) return current
            current = current.parent
        }
        error("Could not locate repository root from ${Path.of("").toAbsolutePath()}")
    }
}

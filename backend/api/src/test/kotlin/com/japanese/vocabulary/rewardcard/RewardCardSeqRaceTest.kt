package com.japanese.vocabulary.rewardcard

import com.japanese.vocabulary.rewardcard.dto.SongAchievementDto
import com.japanese.vocabulary.rewardcard.model.RewardCardKind
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.rewardcard.service.RewardCardService
import com.japanese.vocabulary.test.ApiAfterCommitListenerTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** 같은 곡·아티스트의 첫 달성이 동시에 몰려도 순번이 겹치거나 빠지지 않고, 데드락으로 rating 이 실패하지 않는다. */
class RewardCardSeqRaceTest : ApiAfterCommitListenerTest() {

    @Autowired private lateinit var rewardCardService: RewardCardService

    @Test
    fun `concurrent first achievements get distinct consecutive sequence numbers`() {
        val songId = 7L
        val artistId = 11L
        val users = (1L..8L).toList()
        val start = CountDownLatch(1)
        val pool = Executors.newFixedThreadPool(users.size)

        val futures = users.map { userId ->
            pool.submit<List<Int>> {
                start.await()
                inTx { rewardCardService.achieveSongs(userId, listOf(SongAchievementDto(songId, artistId, SongCardGrade.BASIC))) }
                    .map { it.acquiredSeq }
            }
        }
        start.countDown()
        val results = futures.map { it.get(30, TimeUnit.SECONDS) }
        pool.shutdown()

        val songSeqs = results.map { it[0] }
        val artistSeqs = results.map { it[1] }
        assertThat(songSeqs).containsExactlyInAnyOrderElementsOf(1..users.size)
        assertThat(artistSeqs).containsExactlyInAnyOrderElementsOf(1..users.size)
        assertThat(inTx { rewardCardService.pending(users.first()) }.map { it.kind })
            .containsExactly(RewardCardKind.SONG, RewardCardKind.ARTIST)
    }
}

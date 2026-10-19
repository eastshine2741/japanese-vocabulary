package com.japanese.vocabulary.rewardcard

import com.japanese.vocabulary.rewardcard.dto.RewardCardRevealDto
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

/** 같은 곡·아티스트의 여러 등급 달성이 동시에 몰려도 순번이 겹치거나 빠지지 않고, 데드락으로 rating 이 실패하지 않는다. */
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
            pool.submit<List<RewardCardRevealDto>> {
                start.await()
                inTx { rewardCardService.achieveSongs(userId, listOf(SongAchievementDto(songId, artistId, SongCardGrade.MASTER))) }
            }
        }
        start.countDown()
        val results = futures.map { it.get(30, TimeUnit.SECONDS) }
        pool.shutdown()

        // 곡 BASIC~MASTER 다섯 장과 마스터 곡 하나로 BRONZE 에서 시작하는 아티스트 카드 한 장, (종류, 등급)마다 1..8 이 한 번씩.
        val seqsByGrade = results.flatten().groupBy({ it.kind to it.grade }, { it.acquiredSeq })
        assertThat(seqsByGrade).hasSize(6)
        seqsByGrade.values.forEach { assertThat(it).containsExactlyInAnyOrderElementsOf(1..users.size) }
        assertThat(inTx { rewardCardService.pending(users.first()) }.map { it.kind to it.grade }).containsExactly(
            RewardCardKind.SONG to "BASIC",
            RewardCardKind.SONG to "BRONZE",
            RewardCardKind.SONG to "SILVER",
            RewardCardKind.SONG to "GOLD",
            RewardCardKind.SONG to "MASTER",
            RewardCardKind.ARTIST to "BRONZE",
        )
    }
}

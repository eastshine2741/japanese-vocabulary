package com.japanese.vocabulary.song

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.dao.ConcurrencyFailureException
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import java.util.Collections
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * "한 곡에 활성 작업 하나" 를 지키는 건 UNIQUE 제약이 아니라 `(raw_title, raw_artist)` 갭 락이다
 * (V33 에서 `active_dedup_key` 를 걷어냈다). 그 락이 실제로 막는지 보는 테스트.
 *
 * [SongControllerTest] 의 8스레드 테스트로는 이걸 볼 수 없다. 거기 latch 는 `createOrReuse` 진입을
 * 맞출 뿐이고, 경쟁이 일어나야 하는 창은 그 안쪽 — 락 읽기부터 insert 까지 — 이다. 먼저 들어간
 * 스레드가 그 구간을 수 ms 에 끝내고 커밋하면 나머지는 커밋된 행을 보고 재사용 경로로 빠진다.
 * 게다가 그 테스트는 경쟁이 일어났는지를 단정하지 않아서 전부 재사용 경로를 타도 통과한다.
 *
 * 그래서 여기서는 두 트랜잭션을 직접 운전해 `createOrReuse` 와 **같은 순서의 두 문장** 을 내고,
 * 그 사이에 양쪽을 세운다. 배리어가 락 읽기 뒤 insert 앞에 있으므로 어느 쪽도 상대가 읽기를
 * 마치기 전에 insert 할 수 없다 — 겹침이 확률이 아니라 보장이다. 양쪽이 갭 락을 쥔 채 insert 하면
 * InnoDB 가 교착을 감지해 한쪽을 죽인다.
 *
 * 락이 사라지면 조용히 통과하지 않고 깨진다: 갭 락이 없으면 양쪽 insert 가 모두 성공해서 행이 둘
 * 생기고, 아래 세 단정이 전부 어긋난다.
 *
 * 다루지 않는 것: `createOrReuse` 가 이 예외를 409 로 바꿔주는 부분. 두 스레드를 트랜잭션 **안** 에
 * 세워야 겹침이 보장되는데, 그 지점에 손을 넣으려면 리포지토리를 스파이해야 하고 MockK 는
 * Spring Data 프록시를 `spyk` 할 수 없다 (JPMS 가 `java.lang.reflect.Proxy` 필드 복사를 막는다).
 * 그래서 여기서는 기구를 쓰지 않고 메커니즘만 확인하고, 매핑은 `catch` 세 줄로 남겨 둔다.
 */
class SongAnalysisWorkRaceTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var workRepository: SongAnalysisWorkRepository

    @Autowired private lateinit var transactionManager: PlatformTransactionManager

    /**
     * 테스트 메서드가 [Propagation.NOT_SUPPORTED] 라서 각 스레드가 독립된 트랜잭션을 연다 —
     * 갭 락은 트랜잭션 경계에 달려 있으니 이게 없으면 경쟁이 성립하지 않는다. 대신 부모의 롤백도
     * 적용되지 않으므로 만든 행을 직접 지운다.
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    fun `two transactions holding the gap lock at once create one work and one conflict`() {
        deleteTestWorks()

        val bothHaveReadBeforeEitherInserts = CyclicBarrier(THREAD_COUNT)
        val createdWorkIds = Collections.synchronizedList(mutableListOf<Long>())
        val conflictCount = AtomicInteger(0)
        val unexpectedFailures = Collections.synchronizedList(mutableListOf<Throwable>())
        val executor = Executors.newFixedThreadPool(THREAD_COUNT)
        val transactionTemplate = TransactionTemplate(transactionManager)

        try {
            repeat(THREAD_COUNT) {
                executor.execute {
                    try {
                        transactionTemplate.execute {
                            // createOrReuse 의 첫 문장. 활성 행이 없으면 여기서 갭 락이 걸린다.
                            val active = workRepository.findActiveByRawSongForUpdate(TITLE, ARTIST)
                            check(active.isEmpty()) { "상대가 먼저 커밋했다면 겹침이 성립하지 않는다" }

                            // 양쪽이 갭 락을 쥔 상태를 만든다. 이 뒤의 insert 는 반드시 겹친다.
                            bothHaveReadBeforeEitherInserts.await(BARRIER_TIMEOUT_SECONDS, TimeUnit.SECONDS)

                            // createOrReuse 의 두 번째 문장.
                            createdWorkIds.add(workRepository.saveAndFlush(newPendingWork()).id!!)
                        }
                    } catch (_: ConcurrencyFailureException) {
                        // 교착으로 죽은 쪽. createOrReuse 는 이 자리에서 409 로 바꾼다.
                        conflictCount.incrementAndGet()
                    } catch (t: Throwable) {
                        unexpectedFailures.add(t)
                    }
                }
            }
            executor.shutdown()
            assertThat(executor.awaitTermination(AWAIT_TERMINATION_SECONDS, TimeUnit.SECONDS)).isTrue

            assertThat(unexpectedFailures).isEmpty()
            // 경쟁이 실제로 일어났다는 단정. 이게 없으면 둘 다 그냥 성공해도 통과해 버린다.
            assertThat(conflictCount.get()).isEqualTo(1)
            assertThat(createdWorkIds).hasSize(1)
            // 갭 락이 막지 못했다면 여기가 2가 된다.
            assertThat(activeTestWorks().map { it.id }).containsExactly(createdWorkIds.single())
        } finally {
            executor.shutdownNow()
            deleteTestWorks()
        }
    }

    private fun newPendingWork() = SongAnalysisWorkEntity(
        rawTitle = TITLE,
        rawArtist = ARTIST,
        triggerSource = SongAnalysisTriggerSource.USER_APP,
    )

    private fun activeTestWorks() = workRepository.findAll().filter {
        it.rawTitle == TITLE && it.status in setOf(
            SongAnalysisWorkStatus.PENDING,
            SongAnalysisWorkStatus.RUNNING,
        )
    }

    private fun deleteTestWorks() {
        workRepository.deleteAll(workRepository.findAll().filter { it.rawTitle == TITLE })
    }

    private companion object {
        const val TITLE = "ギャップロック競合"
        const val ARTIST = "競合歌手"
        const val THREAD_COUNT = 2
        const val BARRIER_TIMEOUT_SECONDS = 10L
        const val AWAIT_TERMINATION_SECONDS = 60L
    }
}

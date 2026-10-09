package com.japanese.vocabulary.karaoke.batch

import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.Message
import com.japanese.vocabulary.karaoke.entity.KaraokeSongEntity
import com.japanese.vocabulary.karaoke.entity.KaraokeVendor
import com.japanese.vocabulary.karaokelisting.KaraokeListing
import com.japanese.vocabulary.karaokelisting.KaraokeListingVendor
import com.japanese.vocabulary.karaokelisting.KyClient
import com.japanese.vocabulary.karaokelisting.TjClient
import com.japanese.vocabulary.messagequeue.SongAnalysisWorkQueuePublisher
import com.japanese.vocabulary.notification.entity.DeviceTokenEntity
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songsearch.client.applemusic.AppleMusicClient
import com.japanese.vocabulary.songsearch.dto.SongSearchItemDto
import com.japanese.vocabulary.songsearch.dto.SongSearchResponse
import com.japanese.vocabulary.studystats.util.KstClock
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.entity.UserSettingsEntity
import com.japanese.vocabulary.user.model.UserSettingsData
import com.ninjasquad.springmockk.MockkBean
import io.mockk.every
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.DefaultApplicationArguments
import org.springframework.test.context.TestPropertySource
import java.time.LocalDate
import java.util.concurrent.atomic.AtomicLong

@TestPropertySource(properties = ["push.firebase.enabled=true"])
class KaraokeCollectTaskTest : BatchBaseIntegrationTest() {

    @MockkBean private lateinit var firebaseApp: FirebaseApp
    @MockkBean private lateinit var tjClient: TjClient
    @MockkBean private lateinit var kyClient: KyClient
    @MockkBean private lateinit var appleMusicClient: AppleMusicClient
    @MockkBean(relaxed = true) private lateinit var queuePublisher: SongAnalysisWorkQueuePublisher

    @Autowired private lateinit var task: KaraokeCollectTask
    @Autowired private lateinit var kstClock: KstClock

    private lateinit var today: LocalDate
    private val sentMessages = mutableListOf<Message>()

    @BeforeEach
    fun stubVendors() {
        today = kstClock.nowKst().toLocalDate()
        sentMessages.clear()
        every { firebaseMessaging.send(capture(sentMessages)) } returns "fcm-message-id"
        every { appleMusicClient.search(any()) } returns SongSearchResponse(emptyList())
        every { appleMusicClient.search("唱 Ado") } returns SongSearchResponse(
            listOf(
                SongSearchItemDto("1", "唱 (Remix)", "https://art/remix.jpg", "Ado", 200),
                SongSearchItemDto("2", "唱", "https://art/sho.jpg", "Ado", 189),
            )
        )
        every { tjClient.newSongs(any()) } returns listOf(
            tj(90170, "唱", "Ado", today),
            tj(90171, "夜明けの歌(TVアニメ 'テスト' OP)", "Vaundy", today.minusDays(1)),
            tj(71200, "소주밤", "마이티마우스", today),
            tj(74144, "ALL THE LOVE", "Kanye West", today),
            tj(90100, "古い歌", "古い人", today.minusDays(10)),
        )
        every { tjClient.isJapanese(any()) } answers { firstArg<Int>() in setOf(90170, 90171, 90100) }
        every { kyClient.latestSongs() } returns listOf(
            KaraokeListing(KaraokeListingVendor.KY, 57740, "唱", "Ado", lyricLines = listOf("쇼", "しょう", "唱")),
            KaraokeListing(KaraokeListingVendor.KY, 51800, "Home", "연준", lyricLines = listOf("집", "home")),
        )
    }

    @Test
    fun `registers new Japanese songs, links analyzed ones, requests analysis for the rest, and notifies subscribers`() {
        val analyzed = analyzedSong("唱", "Ado")
        val subscriber = newUser(notifications = true)
        newUser(notifications = false)

        task.run(DefaultApplicationArguments())

        val rows = karaokeRows()
        assertThat(rows.map { it.vendor to it.number }).containsExactlyInAnyOrder(
            KaraokeVendor.TJ to 90170, KaraokeVendor.TJ to 90171, KaraokeVendor.KY to 57740,
        )
        val sho = rows.single { it.number == 90170 }
        assertThat(sho.songId).isEqualTo(analyzed.id)
        assertThat(sho.artworkUrl).isEqualTo("https://art/sho.jpg")
        val yoake = rows.single { it.number == 90171 }
        assertThat(yoake.title).isEqualTo("夜明けの歌")
        assertThat(yoake.songId).isNull()
        assertThat(yoake.listedOn).isEqualTo(today.minusDays(1))
        assertThat(rows.single { it.number == 57740 }.listedOn).isEqualTo(today)
        assertThat(rows).allSatisfy { assertThat(it.notifiedAt).isNotNull() }

        assertThat(karaokeWorks().map { it.rawTitle }).containsExactly("夜明けの歌")

        val mine = sentMessages.filter { it.fieldValue<String>("token") == tokenOf(subscriber) }
        assertThat(sentMessages).hasSize(1)
        val data = mine.single().fieldValue<Map<String, String>>("data")
        assertThat(data["type"]).isEqualTo("karaoke_new_songs")
        assertThat(data["title"]).isEqualTo("🎤 노래방 신곡이 업데이트되었어요!")
        assertThat(data["body"]).isEqualTo("唱, 夜明けの歌를 확인해보세요")
    }

    @Test
    fun `second run adds nothing and sends nothing`() {
        newUser(notifications = true)
        task.run(DefaultApplicationArguments())
        sentMessages.clear()

        task.run(DefaultApplicationArguments())

        assertThat(karaokeRows()).hasSize(3)
        assertThat(sentMessages).isEmpty()
    }

    @Test
    fun `backfill takes the whole TJ list and marks rows notified without sending`() {
        newUser(notifications = true)

        task.run(DefaultApplicationArguments("--backfill"))

        val rows = karaokeRows()
        assertThat(rows.map { it.number }).contains(90100)
        assertThat(rows).allSatisfy { assertThat(it.notifiedAt).isNotNull() }
        verify(exactly = 0) { firebaseMessaging.send(any<Message>()) }
    }

    @Test
    fun `a later completed analysis is linked by the next run`() {
        task.run(DefaultApplicationArguments())
        val song = analyzedSong("夜明けの歌", "Vaundy")

        task.run(DefaultApplicationArguments())

        assertThat(karaokeRows().single { it.number == 90171 }.songId).isEqualTo(song.id)
    }

    private fun tj(number: Int, title: String, artist: String, listedOn: LocalDate) =
        KaraokeListing(KaraokeListingVendor.TJ, number, title, artist, listedOn)

    private fun analyzedSong(title: String, artist: String): SongEntity {
        val song = SongEntity(title = title, artist = artist).also { entityManager.persist(it) }
        val lyric = LyricEntity(songId = song.id!!, lyricType = LyricType.PLAIN, rawContent = emptyList(), analyzedContent = emptyList())
        entityManager.persist(lyric)
        song.activeLyricId = lyric.id
        entityManager.flush()
        return song
    }

    private fun newUser(notifications: Boolean): UserEntity {
        val seq = USER_SEQUENCE.incrementAndGet()
        val user = UserEntity(provider = "google", providerSub = "karaoke-sub-$seq", username = "karaoke$seq")
            .also { entityManager.persist(it) }
        entityManager.persist(DeviceTokenEntity(userId = user.id!!, token = "karaoke-token-$seq", platform = "ANDROID"))
        entityManager.persist(UserSettingsEntity(userId = user.id!!, settings = UserSettingsData(karaokeNewSongNotifications = notifications)))
        entityManager.flush()
        return user
    }

    private fun tokenOf(user: UserEntity) = "karaoke-token-${user.username.removePrefix("karaoke")}"

    private fun karaokeRows(): List<KaraokeSongEntity> {
        entityManager.flush()
        entityManager.clear()
        return entityManager.createQuery("SELECT k FROM KaraokeSongEntity k", KaraokeSongEntity::class.java).resultList
    }

    private fun karaokeWorks(): List<SongAnalysisWorkEntity> =
        entityManager.createQuery("SELECT w FROM SongAnalysisWorkEntity w WHERE w.triggerSource = :source", SongAnalysisWorkEntity::class.java)
            .setParameter("source", SongAnalysisTriggerSource.KARAOKE)
            .resultList

    @Suppress("UNCHECKED_CAST")
    private fun <T> Any.fieldValue(name: String): T {
        val field = javaClass.getDeclaredField(name)
        field.isAccessible = true
        return field.get(this) as T
    }

    companion object {
        private val USER_SEQUENCE = AtomicLong(0)
    }
}

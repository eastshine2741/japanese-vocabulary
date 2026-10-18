package com.japanese.vocabulary.rewardcard

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.objectstorage.client.PresignedUpload
import com.japanese.vocabulary.objectstorage.client.StoredObject
import com.japanese.vocabulary.rewardcard.config.ShareProperties
import com.japanese.vocabulary.rewardcard.controller.RewardCardLandingController
import com.japanese.vocabulary.rewardcard.dto.RewardCardShareResponse
import com.japanese.vocabulary.rewardcard.dto.ShareImageUploadUrlResponse
import com.japanese.vocabulary.rewardcard.dto.ShareRewardCardRequest
import com.japanese.vocabulary.rewardcard.dto.SharedRewardCardResponse
import com.japanese.vocabulary.rewardcard.entity.ArtistCardEntity
import com.japanese.vocabulary.rewardcard.entity.SongCardEntity
import com.japanese.vocabulary.rewardcard.model.ArtistCardGrade
import com.japanese.vocabulary.rewardcard.model.RewardCardKind
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.rewardcard.service.RewardCardLanding
import com.japanese.vocabulary.rewardcard.service.RewardCardLandingPage
import com.japanese.vocabulary.rewardcard.service.RewardCardLandingService
import com.japanese.vocabulary.rewardcard.service.RewardCardShareTokens
import com.japanese.vocabulary.song.entity.ArtistEntity
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import io.mockk.every
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.ResultActionsDsl
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.time.Instant

@AutoConfigureMockMvc
class RewardCardShareControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil
    @Autowired private lateinit var shareTokens: RewardCardShareTokens
    @Autowired private lateinit var landingService: RewardCardLandingService

    private fun newUser(name: String = UserEntity.DEFAULT_NAME): UserEntity = TestUserBuilder(entityManager).withName(name).build()
    private fun bearer(user: UserEntity) = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"
    private inline fun <reified T> readBody(json: String): T = objectMapper.readValue(json)

    private fun songCard(user: UserEntity, song: SongEntity, issued: Boolean = true) {
        entityManager.persist(
            SongCardEntity(
                userId = user.id!!,
                songId = song.id!!,
                grade = SongCardGrade.BASIC,
                issuedAt = clock.instant().takeIf { issued },
                acquiredSeq = 1,
                createdAt = clock.instant(),
            )
        )
        entityManager.flush()
    }

    private fun artistCard(user: UserEntity, artist: ArtistEntity) {
        entityManager.persist(
            ArtistCardEntity(
                userId = user.id!!,
                artistId = artist.id!!,
                grade = ArtistCardGrade.BASIC,
                issuedAt = clock.instant(),
                createdAt = clock.instant(),
            )
        )
        entityManager.flush()
    }

    private fun songPath(song: SongEntity): String {
        val id = entityManager.createQuery("SELECT c.id FROM SongCardEntity c WHERE c.songId = :s", java.lang.Long::class.java)
            .setParameter("s", song.id).singleResult
        return "song-cards/$id"
    }

    private fun artistPath(artist: ArtistEntity): String {
        val id = entityManager.createQuery("SELECT c.id FROM ArtistCardEntity c WHERE c.artistId = :a", java.lang.Long::class.java)
            .setParameter("a", artist.id).singleResult
        return "artist-cards/$id"
    }

    private fun share(user: UserEntity, path: String, imageUploaded: Boolean = false): ResultActionsDsl =
        mockMvc.put("/api/reward-cards/$path/share") {
            header("Authorization", bearer(user))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(ShareRewardCardRequest(imageUploaded = imageUploaded))
        }

    private fun shareToken(user: UserEntity, path: String, imageUploaded: Boolean = false): String =
        readBody<RewardCardShareResponse>(
            share(user, path, imageUploaded).andExpect { status { isOk() } }.andReturn().response.contentAsString
        ).token

    private fun sharedCard(viewer: UserEntity, token: String): ResultActionsDsl =
        mockMvc.get("/api/reward-card-shares/$token") { header("Authorization", bearer(viewer)) }

    @Test
    fun `sharing a card twice returns the same link`() {
        val me = newUser()
        val song = TestSongBuilder(entityManager).build()
        songCard(me, song)

        val first = readBody<RewardCardShareResponse>(
            share(me, songPath(song)).andExpect { status { isOk() } }.andReturn().response.contentAsString
        )
        val second = shareToken(me, songPath(song))

        assertThat(first.url).isEqualTo("https://kotonoha.test/c/${first.token}")
        assertThat(second).isEqualTo(first.token)
        assertThat(shareTokens.parse(first.token)!!.kind).isEqualTo(RewardCardKind.SONG)
    }

    @Test
    fun `cards that are not issued or not mine cannot be shared`() {
        val me = newUser()
        val other = newUser()
        val unsigned = TestSongBuilder(entityManager).build()
        val othersSong = TestSongBuilder(entityManager).build()
        songCard(me, unsigned, issued = false)
        songCard(other, othersSong)

        share(me, songPath(unsigned)).andExpect { status { isNotFound() } }
        share(me, songPath(othersSong)).andExpect { status { isNotFound() } }
        share(me, "artist-cards/999999").andExpect { status { isNotFound() } }
    }

    @Test
    fun `upload-url signs a png put to the key derived from the link`() {
        val me = newUser()
        val song = TestSongBuilder(entityManager).build()
        songCard(me, song)
        every { objectStorageClient.enabled } returns true
        every { objectStorageClient.presignPut(any(), "image/png", any(), any()) } answers {
            PresignedUpload(
                url = "https://r2.test/${firstArg<String>()}?sig",
                headers = mapOf("content-type" to "image/png", "cache-control" to arg<String>(3)),
                expiresAt = Instant.parse("2026-10-11T00:05:00Z"),
            )
        }

        val body = mockMvc.post("/api/reward-cards/${songPath(song)}/share/image-upload-url") {
            header("Authorization", bearer(me))
        }.andExpect { status { isOk() } }.andReturn().response.contentAsString

        val token = shareToken(me, songPath(song))
        val resp = readBody<ShareImageUploadUrlResponse>(body)
        assertThat(resp.uploadUrl).isEqualTo("https://r2.test/${shareTokens.imageKey(token)}?sig")
        assertThat(shareTokens.imageKey(token)).doesNotContain(song.id.toString()).endsWith(".png")
        assertThat(resp.headers).containsEntry("cache-control", "public, max-age=300")
    }

    @Test
    fun `uploaded image becomes the link preview image`() {
        val me = newUser()
        val song = TestSongBuilder(entityManager).withArtworkUrl("https://art.test/a.jpg").build()
        songCard(me, song)
        val token = shareToken(me, songPath(song))
        val key = shareTokens.imageKey(token)
        every { objectStorageClient.enabled } returns true
        every { objectStorageClient.head(key) } returns StoredObject(contentType = "image/png", contentLength = 200_000)
        every { objectStorageClient.publicUrl(any()) } answers { "https://img.test/${firstArg<String>()}" }

        assertThat(shareToken(me, songPath(song), imageUploaded = true)).isEqualTo(token)
        val html = mockMvc.get("/c/$token").andExpect { status { isOk() } }.andReturn().response.getContentAsString(Charsets.UTF_8)
        assertThat(html).contains("""<meta property="og:image" content="https://img.test/$key">""")
    }

    @Test
    fun `oversized upload is deleted and rejected`() {
        val me = newUser()
        val song = TestSongBuilder(entityManager).build()
        songCard(me, song)
        val key = shareTokens.imageKey(shareToken(me, songPath(song)))
        every { objectStorageClient.enabled } returns true
        every { objectStorageClient.head(key) } returns StoredObject(contentType = "image/png", contentLength = 6L * 1024 * 1024)

        share(me, songPath(song), imageUploaded = true).andExpect { status { isBadRequest() } }
        verify { objectStorageClient.delete(key) }
    }

    @Test
    fun `shared card shows the owner's card and only their name and photo`() {
        val owner = newUser(name = "하루")
        val viewer = newUser()
        val song = TestSongBuilder(entityManager).withTitle("夜に駆ける").build()
        val artist = ArtistEntity(appleMusicId = "am-${System.nanoTime()}", name = "YOASOBI").also { entityManager.persist(it) }
        songCard(owner, song)
        artistCard(owner, artist)
        val songToken = shareToken(owner, songPath(song))
        val artistToken = shareToken(owner, artistPath(artist))

        val songShared = readBody<SharedRewardCardResponse>(
            sharedCard(viewer, songToken).andExpect { status { isOk() } }.andReturn().response.contentAsString
        )
        val artistShared = readBody<SharedRewardCardResponse>(
            sharedCard(viewer, artistToken).andExpect { status { isOk() } }.andReturn().response.contentAsString
        )

        assertThat(songShared.kind).isEqualTo(RewardCardKind.SONG)
        assertThat(songShared.songCard!!.title).isEqualTo("夜に駆ける")
        assertThat(songShared.artistCard).isNull()
        assertThat(songShared.owner.name).isEqualTo("하루")
        assertThat(songShared.songGradeRule.tierNames).containsExactly("후렴 정복", "따라 부르기", "완곡")
        assertThat(artistShared.artistCard!!.name).isEqualTo("YOASOBI")
        assertThat(artistShared.songCard).isNull()
    }

    @Test
    fun `tampered or forged tokens are not found`() {
        val me = newUser()
        val song = TestSongBuilder(entityManager).build()
        songCard(me, song)
        val token = shareToken(me, songPath(song))
        val forged = token.substringBeforeLast('.') + ".AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

        sharedCard(me, forged).andExpect { status { isNotFound() } }
        sharedCard(me, "not-a-token").andExpect { status { isNotFound() } }
        mockMvc.get("/c/$forged").andExpect { status { isNotFound() } }
    }

    @Test
    fun `tokens signed with a retired key still open while it is kept`() {
        val props = { keys: String -> shareProps(tokenKeys = keys) }
        val old = RewardCardShareTokens(props("k1:old-share-token-secret-at-least-32-bytes-long"))
        val rotated = RewardCardShareTokens(
            props("k2:new-share-token-secret-at-least-32-bytes-long,k1:old-share-token-secret-at-least-32-bytes-long")
        )
        val dropped = RewardCardShareTokens(props("k2:new-share-token-secret-at-least-32-bytes-long"))
        val token = old.issue(RewardCardKind.ARTIST, 42)

        assertThat(rotated.parse(token)).isEqualTo(old.parse(token))
        assertThat(rotated.issue(RewardCardKind.ARTIST, 42)).isNotEqualTo(token)
        assertThat(dropped.parse(token)).isNull()
    }

    @Test
    fun `web template gets the card meta and data without breaking out of the script tag`() {
        val template = """<!DOCTYPE html><html lang="en"><head><title>코토노하</title></head><body><div id="root"></div></body></html>"""
        val landing = RewardCardLanding(
            token = "t", kind = RewardCardKind.SONG, title = "Song", artist = "Artist", ownerName = "하루", imageUrl = null,
        )

        val html = RewardCardLandingPage.inject(template, landing, shareProps(), """{"title":"</script><b>"}""")

        assertThat(html).startsWith("""<!DOCTYPE html><html lang="ko">""")
        assertThat(html).doesNotContain("<title>코토노하</title>")
        assertThat(html).contains("<title>Song - Artist</title>")
        assertThat(html).contains("""<meta property="og:description" content="하루의 Kotonoha 곡 카드">""")
        assertThat(html).contains("""<script id="kotonoha-share" type="application/json">{"title":"\u003c/script>\u003cb>"}</script>""")
        assertThat(html).contains("""<div id="root"></div>""")
    }

    @Test
    fun `landing page escapes the title and carries link preview tags`() {
        val me = newUser()
        val song = TestSongBuilder(entityManager)
            .withTitle("""<script>alert("x")</script>&'""")
            .withArtist("A\"rtist")
            .withArtworkUrl("https://art.test/a.jpg")
            .build()
        songCard(me, song)
        val token = shareToken(me, songPath(song))
        every { objectStorageClient.enabled } returns false

        val response = mockMvc.get("/c/$token")
            .andExpect {
                status { isOk() }
                content { contentTypeCompatibleWith(MediaType.TEXT_HTML) }
                header { string("Cache-Control", "max-age=300, public") }
            }.andReturn().response
        val html = response.getContentAsString(Charsets.UTF_8)

        assertThat(html).doesNotContain("<script>alert")
        assertThat(html).contains("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;")
        assertThat(html).contains("""<meta property="og:title" content="&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39; - A&quot;rtist">""")
        assertThat(html).contains("""<meta property="og:image" content="https://art.test/a.jpg">""")
        assertThat(html).contains("""<meta property="og:url" content="https://kotonoha.test/c/$token">""")
        assertThat(html).contains("""<meta property="og:type" content="website">""")
        assertThat(html).contains("""<meta name="twitter:card" content="summary_large_image">""")
        assertThat(html).contains("""href="kotonoha://c/$token"""")
        assertThat(html).contains("https://apps.apple.com/app/id6806729387")
        assertThat(html).contains("https://play.google.com/store/apps/details?id=dev.eastshine.kotonoha")
    }

    @Test
    fun `unknown token renders a 404 page with store buttons`() {
        val html = mockMvc.get("/c/nope")
            .andExpect {
                status { isNotFound() }
                content { contentTypeCompatibleWith(MediaType.TEXT_HTML) }
            }.andReturn().response.getContentAsString(Charsets.UTF_8)

        assertThat(html).contains("https://apps.apple.com/app/id6806729387")
        assertThat(html).doesNotContain("og:title")
    }

    @Test
    fun `app link verification files are 404 until configured`() {
        mockMvc.get("/.well-known/apple-app-site-association").andExpect { status { isNotFound() } }
        mockMvc.get("/.well-known/assetlinks.json").andExpect { status { isNotFound() } }
    }

    @Test
    fun `configured app link verification files are served as json`() {
        val props = shareProps(appleAppId = "TEAM123.dev.eastshine.kotonoha", androidSha256Fingerprints = "AA:BB, CC:DD")
        val standalone = MockMvcBuilders.standaloneSetup(RewardCardLandingController(landingService, props)).build()

        standalone.get("/.well-known/apple-app-site-association").andExpect {
            status { isOk() }
            content { contentType(MediaType.APPLICATION_JSON) }
            jsonPath("$.applinks.details[0].appIDs[0]") { value("TEAM123.dev.eastshine.kotonoha") }
            jsonPath("$.applinks.details[0].components[0]['/']") { value("/c/*") }
        }
        val assetLinks = standalone.get("/.well-known/assetlinks.json").andExpect {
            status { isOk() }
            content { contentType(MediaType.APPLICATION_JSON) }
        }.andReturn().response.contentAsString
        assertThat(assetLinks).contains("\"package_name\":\"dev.eastshine.kotonoha\"")
        assertThat(assetLinks).contains("\"sha256_cert_fingerprints\":[\"AA:BB\",\"CC:DD\"]")
    }

    private fun shareProps(
        appleAppId: String = "",
        androidSha256Fingerprints: String = "",
        tokenKeys: String = "test:test-share-token-secret-at-least-32-bytes-long",
    ) = ShareProperties(
        publicBaseUrl = "https://kotonoha.test",
        appScheme = "kotonoha",
        iosAppStoreUrl = "https://apps.apple.com/app/id6806729387",
        androidPlayUrl = "https://play.google.com/store/apps/details?id=dev.eastshine.kotonoha",
        appleAppId = appleAppId,
        androidPackage = "dev.eastshine.kotonoha",
        androidSha256Fingerprints = androidSha256Fingerprints,
        tokenKeys = tokenKeys,
        webIndexUrl = "",
    )
}

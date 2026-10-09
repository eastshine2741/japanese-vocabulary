package com.japanese.vocabulary.objectstorage.client

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration

class ObjectStorageClientTest {

    private fun client(accessKey: String = "ak") = ObjectStorageClient(
        endpoint = "https://account.r2.cloudflarestorage.com",
        accessKey = accessKey,
        secretKey = "sk",
        bucket = "kotonoha-dev",
        publicBaseUrl = "https://img.example.com/",
    )

    @Test
    fun `presigned PUT is path-style, signs the content type and carries no checksum header`() {
        val upload = client().presignPut("avatars/1/a.jpg", "image/jpeg", Duration.ofMinutes(5))

        assertThat(upload.url).startsWith("https://account.r2.cloudflarestorage.com/kotonoha-dev/avatars/1/a.jpg?")
        assertThat(upload.url).contains("X-Amz-Expires=300")
        assertThat(upload.headers).containsEntry("content-type", "image/jpeg")
        assertThat(upload.headers.keys).noneMatch { it.contains("checksum", ignoreCase = true) }
        assertThat(upload.headers.keys).noneMatch { it.equals("host", ignoreCase = true) }
    }

    @Test
    fun `public url joins base and key without a double slash`() {
        assertThat(client().publicUrl("avatars/1/a.jpg")).isEqualTo("https://img.example.com/avatars/1/a.jpg")
    }

    @Test
    fun `any blank setting disables the client`() {
        assertThat(client(accessKey = "").enabled).isFalse()
        assertThat(client().enabled).isTrue()
    }
}

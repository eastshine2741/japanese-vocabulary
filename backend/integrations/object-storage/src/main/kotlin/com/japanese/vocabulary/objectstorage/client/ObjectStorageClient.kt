package com.japanese.vocabulary.objectstorage.client

import org.springframework.beans.factory.DisposableBean
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3Configuration
import software.amazon.awssdk.services.s3.model.NoSuchKeyException
import software.amazon.awssdk.services.s3.model.S3Exception
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import java.net.URI
import java.time.Duration
import java.time.Instant

data class PresignedUpload(
    val url: String,
    val headers: Map<String, String>,
    val expiresAt: Instant,
)

data class StoredObject(
    val contentType: String?,
    val contentLength: Long,
)

/**
 * S3-compatible bucket (Cloudflare R2). Blank credentials leave [enabled] false so local runs
 * boot without a bucket; callers check it and fail softly.
 */
@Component
class ObjectStorageClient(
    @Value("\${object-storage.endpoint:}") endpoint: String,
    @Value("\${object-storage.access-key:}") accessKey: String,
    @Value("\${object-storage.secret-key:}") secretKey: String,
    @Value("\${object-storage.bucket:}") private val bucket: String,
    @Value("\${object-storage.public-base-url:}") publicBaseUrl: String,
) : DisposableBean {
    val enabled: Boolean = listOf(endpoint, accessKey, secretKey, bucket, publicBaseUrl).all { it.isNotBlank() }

    private val publicBaseUrl = publicBaseUrl.trimEnd('/')

    // R2 rejects virtual-host style on its account endpoint and the SDK's default flexible checksums
    // would add signed headers the uploading app does not send.
    private val s3Configuration = S3Configuration.builder().pathStyleAccessEnabled(true).build()
    private val credentials by lazy { StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)) }

    private val s3: S3Client? = if (!enabled) null else S3Client.builder()
        .endpointOverride(URI.create(endpoint))
        .region(Region.of("auto"))
        .credentialsProvider(credentials)
        .serviceConfiguration(s3Configuration)
        .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
        .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
        .httpClient(UrlConnectionHttpClient.create())
        .build()

    private val presigner: S3Presigner? = if (!enabled) null else S3Presigner.builder()
        .endpointOverride(URI.create(endpoint))
        .region(Region.of("auto"))
        .credentialsProvider(credentials)
        .serviceConfiguration(s3Configuration)
        .build()

    fun presignPut(key: String, contentType: String, ttl: Duration): PresignedUpload {
        val presigner = checkNotNull(presigner) { "object-storage is not configured" }
        val presigned = presigner.presignPutObject { req ->
            req.signatureDuration(ttl)
                .putObjectRequest { it.bucket(bucket).key(key).contentType(contentType) }
        }
        return PresignedUpload(
            url = presigned.url().toString(),
            headers = presigned.signedHeaders()
                .filterKeys { !it.equals("host", ignoreCase = true) }
                .mapValues { it.value.joinToString(",") },
            expiresAt = presigned.expiration(),
        )
    }

    fun head(key: String): StoredObject? {
        val s3 = checkNotNull(s3) { "object-storage is not configured" }
        return try {
            val res = s3.headObject { it.bucket(bucket).key(key) }
            StoredObject(contentType = res.contentType(), contentLength = res.contentLength())
        } catch (e: NoSuchKeyException) {
            null
        } catch (e: S3Exception) {
            // HEAD has no body, so a missing key surfaces as a bare 404 rather than NoSuchKey.
            if (e.statusCode() == 404) null else throw e
        }
    }

    fun delete(key: String) {
        val s3 = checkNotNull(s3) { "object-storage is not configured" }
        s3.deleteObject { it.bucket(bucket).key(key) }
    }

    fun publicUrl(key: String): String = "$publicBaseUrl/$key"

    override fun destroy() {
        s3?.close()
        presigner?.close()
    }
}

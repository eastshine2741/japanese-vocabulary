package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.objectstorage.client.ObjectStorageClient
import com.japanese.vocabulary.rewardcard.dto.ShareImageUploadUrlResponse
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.time.Duration

/**
 * 링크 미리보기 이미지(og:image). 키는 공유 토큰에서 나와 카드마다 하나이고, 다시 공유하면 덮어쓴다.
 * 공개 도메인 캐시에 옛 그림이 오래 남지 않게 짧은 Cache-Control 을 객체에 붙인다.
 */
@Service
class RewardCardShareImageService(
    private val objectStorageClient: ObjectStorageClient,
    private val shareTokens: RewardCardShareTokens,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun issueUploadUrl(token: String): ShareImageUploadUrlResponse {
        requireEnabled()
        val upload = objectStorageClient.presignPut(shareTokens.imageKey(token), CONTENT_TYPE, UPLOAD_URL_TTL, CACHE_CONTROL)
        return ShareImageUploadUrlResponse(uploadUrl = upload.url, headers = upload.headers, expiresAt = upload.expiresAt)
    }

    /** presigned PUT 은 크기를 막지 못해 올린 뒤에 확인하고, 어긋나면 지워 미리보기에 쓰이지 않게 한다. */
    fun validateUploaded(token: String) {
        requireEnabled()
        val key = shareTokens.imageKey(token)
        val stored = objectStorageClient.head(key) ?: throw BusinessException(ErrorCode.SHARE_IMAGE_NOT_UPLOADED)
        if (stored.contentLength > MAX_BYTES) {
            deleteQuietly(key)
            throw BusinessException(ErrorCode.SHARE_IMAGE_TOO_LARGE)
        }
        if (stored.contentType != CONTENT_TYPE) {
            deleteQuietly(key)
            throw BusinessException(ErrorCode.INVALID_SHARE_IMAGE_TYPE)
        }
    }

    /** 올라간 미리보기의 공개 주소. 아직 없거나, 확인을 거치지 않은 규격 밖 객체거나, 저장소가 꺼져 있으면 null. */
    fun uploadedUrl(token: String): String? {
        if (!objectStorageClient.enabled) return null
        val key = shareTokens.imageKey(token)
        val stored = try {
            objectStorageClient.head(key)
        } catch (e: Exception) {
            log.warn("Failed to check share image key={}", key, e)
            null
        }
        if (stored == null || stored.contentLength > MAX_BYTES || stored.contentType != CONTENT_TYPE) return null
        return objectStorageClient.publicUrl(key)
    }

    private fun requireEnabled() {
        if (!objectStorageClient.enabled) throw BusinessException(ErrorCode.SHARE_IMAGE_UNAVAILABLE)
    }

    private fun deleteQuietly(key: String) {
        try {
            objectStorageClient.delete(key)
        } catch (e: Exception) {
            log.warn("Failed to delete share image object key={}", key, e)
        }
    }

    companion object {
        private val UPLOAD_URL_TTL: Duration = Duration.ofMinutes(5)
        private const val MAX_BYTES = 5L * 1024 * 1024
        private const val CONTENT_TYPE = "image/png"
        private const val CACHE_CONTROL = "public, max-age=300"
    }
}

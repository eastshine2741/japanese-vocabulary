package com.japanese.vocabulary.user.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.objectstorage.client.ObjectStorageClient
import com.japanese.vocabulary.user.dto.ProfileImageUploadUrlResponse
import com.japanese.vocabulary.user.dto.UserDto
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.time.Duration
import java.util.UUID

/**
 * The app PUTs straight to the bucket with a presigned URL, then confirms the key here.
 * Keys are scoped under the user's id so nobody can claim (and later delete) another user's object.
 */
@Service
class ProfileImageService(
    private val userProfileService: UserProfileService,
    private val objectStorageClient: ObjectStorageClient,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun issueUploadUrl(userId: Long, contentType: String): ProfileImageUploadUrlResponse {
        requireEnabled()
        val extension = EXTENSIONS[contentType] ?: throw BusinessException(ErrorCode.INVALID_PROFILE_IMAGE_TYPE)
        userProfileService.getProfile(userId)
        val key = "${keyPrefix(userId)}${UUID.randomUUID()}.$extension"
        val upload = objectStorageClient.presignPut(key, contentType, UPLOAD_URL_TTL)
        return ProfileImageUploadUrlResponse(
            key = key,
            uploadUrl = upload.url,
            headers = upload.headers,
            expiresAt = upload.expiresAt,
        )
    }

    fun confirm(userId: Long, key: String): UserDto {
        requireEnabled()
        if (!key.startsWith(keyPrefix(userId)) || key.contains("..")) {
            throw BusinessException(ErrorCode.INVALID_PROFILE_IMAGE_KEY)
        }
        val stored = objectStorageClient.head(key) ?: throw BusinessException(ErrorCode.PROFILE_IMAGE_NOT_UPLOADED)
        if (stored.contentLength > MAX_BYTES) {
            deleteQuietly(key)
            throw BusinessException(ErrorCode.PROFILE_IMAGE_TOO_LARGE)
        }
        if (stored.contentType !in EXTENSIONS) {
            deleteQuietly(key)
            throw BusinessException(ErrorCode.INVALID_PROFILE_IMAGE_TYPE)
        }
        val previous = userProfileService.replaceProfileImageKey(userId, key)
        if (previous != null && previous != key) deleteQuietly(previous)
        return userProfileService.getProfile(userId)
    }

    fun remove(userId: Long): UserDto {
        val previous = userProfileService.replaceProfileImageKey(userId, null)
        previous?.let(::deleteQuietly)
        return userProfileService.getProfile(userId)
    }

    fun deleteAccount(userId: Long) {
        userProfileService.deleteSelf(userId)?.let(::deleteQuietly)
    }

    fun publicUrl(key: String?): String? =
        if (key == null || !objectStorageClient.enabled) null else objectStorageClient.publicUrl(key)

    private fun requireEnabled() {
        if (!objectStorageClient.enabled) throw BusinessException(ErrorCode.PROFILE_IMAGE_UNAVAILABLE)
    }

    // An orphaned object only costs storage; failing the user's request over it would not.
    private fun deleteQuietly(key: String) {
        if (!objectStorageClient.enabled) return
        try {
            objectStorageClient.delete(key)
        } catch (e: Exception) {
            log.warn("Failed to delete profile image object key={}", key, e)
        }
    }

    private fun keyPrefix(userId: Long) = "avatars/$userId/"

    companion object {
        private val UPLOAD_URL_TTL: Duration = Duration.ofMinutes(5)
        private const val MAX_BYTES = 5L * 1024 * 1024
        private val EXTENSIONS = mapOf(
            "image/jpeg" to "jpg",
            "image/png" to "png",
            "image/webp" to "webp",
        )
    }
}

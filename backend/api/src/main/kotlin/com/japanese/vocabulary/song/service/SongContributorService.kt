package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.dto.report.SongContributorDto
import com.japanese.vocabulary.song.dto.report.SongContributorsDto
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.user.repository.UserRepository
import com.japanese.vocabulary.user.service.ProfileImageService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SongContributorService(
    private val songRepository: SongRepository,
    private val songReportService: SongReportService,
    private val userRepository: UserRepository,
    private val profileImageService: ProfileImageService,
) {
    @Transactional(readOnly = true)
    fun contributors(songId: Long): SongContributorsDto {
        if (!songRepository.existsById(songId)) throw BusinessException(ErrorCode.SONG_NOT_FOUND)
        val userIds = songReportService.contributorUserIds(songId)
        val usersById = userRepository.findAllById(userIds).filter { it.deletedAt == null }.associateBy { it.id }
        val contributors = userIds.mapNotNull { id ->
            usersById[id]?.let {
                SongContributorDto(
                    userId = id,
                    username = it.username,
                    name = it.name,
                    profileImageUrl = profileImageService.publicUrl(it.profileImageKey),
                )
            }
        }
        return SongContributorsDto(count = contributors.size, contributors = contributors)
    }
}

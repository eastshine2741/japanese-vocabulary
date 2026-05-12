package com.japanese.vocabulary.song.client.musicbrainz.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

@JsonIgnoreProperties(ignoreUnknown = true)
data class MusicbrainzRecordingSearchResponse(
    val recordings: List<MusicbrainzRecording>?
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class MusicbrainzRecording(
    val id: String?,
    val score: Int?,
    val title: String?,
    val length: Long?,
    @JsonProperty("artist-credit") val artistCredit: List<MusicbrainzArtistCredit>?,
    val releases: List<MusicbrainzRelease>?
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class MusicbrainzArtistCredit(
    val name: String?,
    val artist: MusicbrainzArtist?
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class MusicbrainzArtist(
    val name: String?
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class MusicbrainzRelease(
    val id: String?
)

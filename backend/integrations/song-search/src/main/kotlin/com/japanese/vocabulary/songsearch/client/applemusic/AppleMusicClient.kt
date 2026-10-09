package com.japanese.vocabulary.songsearch.client.applemusic

import com.japanese.vocabulary.songsearch.client.applemusic.dto.AppleMusicArtistsResponse
import com.japanese.vocabulary.songsearch.client.applemusic.dto.AppleMusicSearchResponse
import com.japanese.vocabulary.songsearch.dto.CatalogArtistDto
import com.japanese.vocabulary.songsearch.dto.SongSearchItemDto
import com.japanese.vocabulary.songsearch.dto.SongSearchResponse
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

/** Apple Music catalog, JP storefront. Song ids and title/artist spellings match the old iTunes Search API. */
@Component
class AppleMusicClient(
    restClientBuilder: RestClient.Builder,
    private val tokenProvider: AppleMusicTokenProvider,
) {
    private val restClient = restClientBuilder
        .baseUrl("https://api.music.apple.com")
        .build()

    fun search(query: String): SongSearchResponse {
        val response = restClient.get()
            .uri { builder ->
                builder.path("/v1/catalog/{storefront}/search")
                    .queryParam("term", query)
                    .queryParam("types", "songs")
                    .queryParam("limit", SEARCH_LIMIT)
                    .build(STOREFRONT)
            }
            .header("Authorization", "Bearer ${tokenProvider.token()}")
            .retrieve()
            .body(AppleMusicSearchResponse::class.java)
            ?: return SongSearchResponse(emptyList())

        return SongSearchResponse(response.results.songs?.data.orEmpty().mapNotNull { it.toItem() })
    }

    /**
     * The artist of the catalog song whose title and artist spell exactly like ours — our songs carry
     * catalog spellings, so anything looser risks a same-titled stranger. Search does not honor
     * `include=artists`, hence the second call. A collaboration resolves to its first artist.
     */
    fun findSongArtist(title: String, artist: String): CatalogArtistDto? {
        val song = search("$title $artist").items.firstOrNull { it.title == title && it.artistName == artist } ?: return null
        val response = restClient.get()
            .uri("/v1/catalog/{storefront}/songs/{id}/artists", STOREFRONT, song.id)
            .header("Authorization", "Bearer ${tokenProvider.token()}")
            .retrieve()
            .body(AppleMusicArtistsResponse::class.java)
            ?: return null
        val found = response.data.firstOrNull() ?: return null
        val attributes = found.attributes ?: return null
        return CatalogArtistDto(
            id = found.id,
            name = attributes.name ?: return null,
            artworkUrl = attributes.artwork?.url?.let { artworkUrl(it, ARTIST_ARTWORK_SIZE) },
            url = attributes.url,
        )
    }

    fun topSongs(artistId: String): List<SongSearchItemDto> {
        val response = restClient.get()
            .uri { builder ->
                builder.path("/v1/catalog/{storefront}/artists/{id}/view/top-songs")
                    .queryParam("limit", TOP_SONGS_LIMIT)
                    .build(STOREFRONT, artistId)
            }
            .header("Authorization", "Bearer ${tokenProvider.token()}")
            .retrieve()
            .body(AppleMusicSearchResponse.SongPage::class.java)
            ?: return emptyList()
        return response.data.mapNotNull { it.toItem() }
    }

    private fun AppleMusicSearchResponse.Song.toItem(): SongSearchItemDto? {
        val attributes = attributes ?: return null
        return SongSearchItemDto(
            id = id,
            title = attributes.name ?: return null,
            thumbnail = attributes.artwork?.url?.let { artworkUrl(it, SONG_ARTWORK_SIZE) } ?: return null,
            artistName = attributes.artistName ?: return null,
            durationSeconds = (attributes.durationInMillis ?: 0) / 1000
        )
    }

    private fun artworkUrl(template: String, size: String): String =
        template.replace("{w}", size).replace("{h}", size)

    companion object {
        private const val STOREFRONT = "jp"
        // The catalog search caps a page at 25.
        private const val SEARCH_LIMIT = 25
        private const val TOP_SONGS_LIMIT = 10
        // The artwork template's {w}x{h} must be filled. 600px keeps deck covers sharp at 3x density;
        // the artist photo spans the screen width.
        private const val SONG_ARTWORK_SIZE = "600"
        private const val ARTIST_ARTWORK_SIZE = "1200"
    }
}

package com.japanese.vocabulary.word.entity

import jakarta.persistence.*

@Entity
@Table(
    name = "song_words",
    uniqueConstraints = [UniqueConstraint(columnNames = ["word_id", "song_id", "lyric_line"])]
)
class SongWordEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "word_id", nullable = false)
    val wordId: Long,

    @Column(name = "song_id", nullable = false)
    val songId: Long,

    @Column(name = "lyric_line", length = 500)
    val lyricLine: String? = null,

    @Column(name = "korean_lyric_line", length = 500)
    val koreanLyricLine: String? = null
)

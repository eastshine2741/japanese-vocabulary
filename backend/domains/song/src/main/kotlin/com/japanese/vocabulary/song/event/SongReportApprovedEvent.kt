package com.japanese.vocabulary.song.event

data class SongReportApprovedEvent(val reportId: Long, val userId: Long, val songId: Long)

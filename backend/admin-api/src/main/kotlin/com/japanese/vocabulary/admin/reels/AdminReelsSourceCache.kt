package com.japanese.vocabulary.admin.reels

import java.io.InputStream
import java.nio.file.Path

/**
 * 어드민이 올린 source mp4 캐시. 본 렌더는 원본을 그대로 쓰고, 에디터 미리보기는 브라우저 seek 에 안전하게
 * 재인코딩한 사본을 스트리밍한다.
 */
interface AdminReelsSourceCache {
    /** 올린 파일을 곡의 source 로 넣고 미리보기 사본까지 만든 뒤 경로를 돌려준다. 이미 있으면 바꿔친다. */
    fun store(songId: Long, content: InputStream): AdminReelsCachedSource

    /** 원본과 미리보기가 둘 다 캐시에 있을 때만 돌려준다. */
    fun cached(songId: Long): AdminReelsCachedSource?
}

data class AdminReelsCachedSource(
    /** 어드민이 올린 그대로. 본 렌더 입력. */
    val source: Path,
    /** closed-GOP H.264 로 재인코딩한 미리보기. `/mv` 스트리밍 전용. */
    val preview: Path,
)

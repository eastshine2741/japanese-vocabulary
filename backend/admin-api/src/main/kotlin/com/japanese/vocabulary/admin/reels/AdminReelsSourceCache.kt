package com.japanese.vocabulary.admin.reels

import java.io.InputStream
import java.nio.file.Path

/**
 * 어드민이 올린 source mp4 캐시. 미리보기가 스트리밍하는 파일을 본 렌더가 그대로 쓴다.
 */
interface AdminReelsSourceCache {
    /** 올린 파일을 곡의 source 로 넣고 경로를 돌려준다. 이미 있으면 바꿔친다. */
    fun store(songId: Long, content: InputStream): Path

    /** 캐시에 있을 때만 경로를 돌려준다. */
    fun cached(songId: Long): Path?
}

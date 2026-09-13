package com.japanese.vocabulary.admin.reels

import java.nio.file.Path

/**
 * YouTube source mp4 캐시. 미리보기가 받아 둔 파일을 본 렌더가 그대로 쓴다.
 */
interface AdminReelsSourceCache {
    /** 캐시에 없으면 받아서 넣고 경로를 돌려준다. 같은 URL 은 한 번에 하나만 받는다. */
    fun fetch(youtubeUrl: String): Path

    /** 캐시에 있을 때만 경로를 돌려준다. 다운로드는 하지 않는다. */
    fun cached(youtubeUrl: String): Path?
}

package com.japanese.vocabulary.admin.reels

import java.nio.file.Path

/** 올린 mp4 에서 에디터 미리보기용 사본을 만든다. */
interface AdminReelsPreviewTranscoder {
    /** [source] 를 읽어 [target] 에 미리보기 mp4 를 쓴다. 실패하면 예외를 던지고 [target] 은 남기지 않는다. */
    fun transcode(source: Path, target: Path)
}

package com.japanese.vocabulary.songanalysis.repository

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStageEntity
import org.springframework.data.jpa.repository.JpaRepository

/** 단계 행은 항상 작업 행 잠금 아래에서 바뀐다. 여기에는 잠금 조회가 없다. */
interface SongAnalysisWorkStageRepository : JpaRepository<SongAnalysisWorkStageEntity, Long> {
    fun findByWorkIdAndStage(workId: Long, stage: SongAnalysisWorkStage): SongAnalysisWorkStageEntity?

    fun findByWorkIdOrderByIdAsc(workId: Long): List<SongAnalysisWorkStageEntity>
}

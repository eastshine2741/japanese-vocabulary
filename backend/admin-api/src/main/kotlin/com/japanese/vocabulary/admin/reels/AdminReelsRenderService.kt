package com.japanese.vocabulary.admin.reels

import com.japanese.vocabulary.admin.reels.model.AdminReelsRenderInput
import java.nio.file.Path

interface AdminReelsRenderService {
    fun render(input: AdminReelsRenderInput): Path
}

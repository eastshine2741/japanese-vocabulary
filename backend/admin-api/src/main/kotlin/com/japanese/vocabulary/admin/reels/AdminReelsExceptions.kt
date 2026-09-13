package com.japanese.vocabulary.admin.reels

open class AdminReelsException(
    message: String,
) : RuntimeException(message)

class AdminReelsRenderBusyException : AdminReelsException("A reel render is already running")

class AdminReelsRenderFailedException(
    message: String,
) : AdminReelsException(message)

class AdminReelsRenderTimeoutException : AdminReelsException("Reel render timed out")

class AdminReelsMediaTokenException : AdminReelsException("Invalid or expired media token")

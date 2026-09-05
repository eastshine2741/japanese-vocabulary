package com.japanese.vocabulary.common.exception

import org.springframework.http.HttpStatus

enum class ErrorCode(val status: HttpStatus, val message: String) {

    // Auth
    DUPLICATE_NAME(HttpStatus.CONFLICT, "Name already taken"),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Invalid credentials"),
    INVALID_USERNAME(HttpStatus.BAD_REQUEST, "Username must match ^[a-z0-9_]{3,20}$"),
    RESERVED_USERNAME(HttpStatus.BAD_REQUEST, "Username is reserved"),
    USERNAME_TAKEN(HttpStatus.CONFLICT, "Username already taken"),

    // Song / Lyrics
    LYRICS_NOT_FOUND(HttpStatus.NOT_FOUND, "Could not find lyrics for this song"),
    LYRIC_NOT_FOUND(HttpStatus.NOT_FOUND, "Lyric not found"),
    SONG_NOT_FOUND(HttpStatus.NOT_FOUND, "Song not found"),
    SONG_ANALYSIS_WORK_NOT_FOUND(HttpStatus.NOT_FOUND, "Song analysis work not found"),
    SONG_ANALYSIS_WORK_ALREADY_EXISTS(HttpStatus.CONFLICT, "Song analysis work already exists"),
    SONG_ANALYSIS_WORK_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "Song analysis failed"),
    SONG_ANALYSIS_WORK_TIMEOUT(HttpStatus.INTERNAL_SERVER_ERROR, "Song analysis timed out"),
    SONG_ANALYSIS_NOT_PENDING(HttpStatus.CONFLICT, "No pending analysis for this song"),
    ANALYSIS_NOTIFICATION_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Analysis notification subscription is unavailable"),
    INVALID_NOTIFICATION_REQUEST(HttpStatus.BAD_REQUEST, "enabled must be a boolean"),

    // Word
    WORD_NOT_FOUND(HttpStatus.NOT_FOUND, "Word not found"),
    MEANING_REQUIRED(HttpStatus.BAD_REQUEST, "At least one meaning required"),
    NO_ELIGIBLE_WORDS(HttpStatus.CONFLICT, "No eligible words to bootstrap"),

    // Flashcard
    FLASHCARD_NOT_FOUND(HttpStatus.NOT_FOUND, "Flashcard not found"),
    INVALID_LIMIT(HttpStatus.BAD_REQUEST, "limit must be between 1 and 100"),

    // Deck
    DECK_NOT_FOUND(HttpStatus.NOT_FOUND, "Deck not found"),
    DECK_TITLE_REQUIRED(HttpStatus.BAD_REQUEST, "Deck title required"),
    DEFAULT_DECK_NOT_DELETABLE(HttpStatus.BAD_REQUEST, "Default deck cannot be deleted"),

    INVALID_RATING(HttpStatus.BAD_REQUEST, "Rating must be 1-4"),

    // Dictionary
    DEFINITION_NOT_FOUND(HttpStatus.NOT_FOUND, "No definition found"),

    // Common
    FORBIDDEN(HttpStatus.FORBIDDEN, "Access denied"),
}

package com.japanese.vocabulary.common.exception

import org.springframework.http.HttpStatus

enum class ErrorCode(val status: HttpStatus, val message: String) {

    // Auth
    DUPLICATE_NAME(HttpStatus.CONFLICT, "Name already taken"),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Invalid credentials"),

    // Song / Lyrics
    LYRICS_NOT_FOUND(HttpStatus.NOT_FOUND, "Could not find lyrics for this song"),
    SONG_NOT_FOUND(HttpStatus.NOT_FOUND, "Song not found"),

    // Word
    WORD_NOT_FOUND(HttpStatus.NOT_FOUND, "Word not found"),
    MEANING_REQUIRED(HttpStatus.BAD_REQUEST, "At least one meaning required"),
    INVALID_EXAMPLES(HttpStatus.BAD_REQUEST, "Some examples do not belong to this word"),

    // Flashcard
    FLASHCARD_NOT_FOUND(HttpStatus.NOT_FOUND, "Flashcard not found"),
    INVALID_RATING(HttpStatus.BAD_REQUEST, "Rating must be 1-4"),

    // Dictionary
    DEFINITION_NOT_FOUND(HttpStatus.NOT_FOUND, "No definition found"),

    // Common
    FORBIDDEN(HttpStatus.FORBIDDEN, "Access denied"),
}

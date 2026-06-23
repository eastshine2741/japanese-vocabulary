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

    // Word
    WORD_NOT_FOUND(HttpStatus.NOT_FOUND, "Word not found"),
    MEANING_REQUIRED(HttpStatus.BAD_REQUEST, "At least one meaning required"),
    INVALID_EXAMPLES(HttpStatus.BAD_REQUEST, "Some examples do not belong to this word"),

    // FlashcardDto
    FLASHCARD_NOT_FOUND(HttpStatus.NOT_FOUND, "Flashcard not found"),

    // DeckDto
    DECK_NOT_FOUND(HttpStatus.NOT_FOUND, "Deck not found"),

    INVALID_RATING(HttpStatus.BAD_REQUEST, "Rating must be 1-4"),

    // Dictionary
    DEFINITION_NOT_FOUND(HttpStatus.NOT_FOUND, "No definition found"),

    // Common
    FORBIDDEN(HttpStatus.FORBIDDEN, "Access denied"),
}

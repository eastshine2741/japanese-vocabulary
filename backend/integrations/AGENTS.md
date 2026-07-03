# Integration Module Instructions

## Scope

Applies to all modules under `backend/integrations/`.

## Rules

- Group external provider clients by function, not by consuming application.
- Use direct client classes; do not introduce a hexagonal port layer unless explicitly decided.
- Prefer `RestClient` where behavior can stay equivalent.
- Keep package names outside domain package trees: `songsearch`, `lyricsearch`, `mvsearch`.
- Do not add `com.japanese.vocabulary.song.client.*` packages.
- Each Spring bean-providing integration module must own AutoConfiguration and component-scan only its package.
- Application-specific timeout, retry, or API key differences should be handled by application properties, not duplicated client classes.

## Current Modules

- `song-search`: iTunes song search.
- `lyric-search`: LRCLIB and VocaDB lyric/provider search.
- `mv-search`: YouTube MV search.

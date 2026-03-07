# CLAUDE.md

## Project
Japanese learning app based on songs.

Users study through songs they already like.  
The MVP should turn a song into study material, let users collect vocabulary with low friction, and drive repeated review through spaced repetition.

## Product Goal
Ship one complete loop:

song
→ lyric-based study
→ vocabulary capture
→ flashcard review
→ better understanding of the song

## MVP Scope
In scope:
- song search and selection
- lyric ingestion and analysis
- synced lyric playback view
- word tap interaction
- automatic vocabulary saving
- per-song vocabulary view
- global vocabulary view
- flashcard review
- spaced repetition scheduling
- song-level progress signal

Out of scope:
- grammar learning
- recommendation system
- social features
- shadowing
- sentence quizzes
- word-level karaoke timing
- advanced visual polish

## Tech Stack
- Backend: Kotlin + Spring Boot
- App: Kotlin + Kotlin Multiplatform + Compose Multiplatform
- Database: MySQL
- Infra: AWS

## Product Principles
- Preserve the listening experience
- Minimize interaction friction
- Separate discovery from retention
- Keep the MVP simple
- Make progress visible

## Screen Roles
- Home: retention entry point
- Search: song discovery
- Song Player: immersion and word discovery
- Vocabulary: collected learning material
- Review: retention engine

## Working Model
This project uses Claude Code agent teams.

Role split:
- Lead Agent: coordination and synthesis
- Backend Agent: server-side logic and interfaces
- App Client Agent: user-facing flow and interaction
- QA Agent: validation and failure detection

Agent prompts define roles only.  
Current work is defined by the sprint request.  
This file provides shared project context.

## Execution Rules
- Treat the sprint request as the source of truth for current priorities
- Do not expand scope unless explicitly requested
- Prefer simple end-to-end value over partial systems
- Prefer clear contracts over clever abstractions
- Surface missing decisions early
- Keep outputs aligned with the MVP loop

## Success Condition
The MVP is successful if a user can:
1. choose a song
2. enter a lyric-based study flow
3. save unfamiliar words
4. complete a later review session
5. feel improved understanding of the song

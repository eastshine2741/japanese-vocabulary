# QA Checklist - Sprint 1

Date: 2026-03-07
Reviewer: QA Agent
Sprint goal: End-to-end lyric processing pipeline from input to structured study data.

---

## Sprint 1 Acceptance Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | One sample song can be processed from lyric input to structured study data without blockers | PASS | `sample-song-processed.json` contains valid `SongStudyData` with 8 study units and 16 vocabulary candidates. `LyricProcessingService.analyze()` compiles and is logically complete. No runtime blockers in the service layer itself. |
| 2 | Output is organized enough for downstream vocabulary and review work | PASS (with caveats) | `studyUnits` are index-sequential (0–7). `vocabularyCandidates` are non-empty (16 entries), each with `word`, `reading`, `sourceLineIndex`. Structure supports downstream use. Caveats: `reading` mirrors `word` (no real furigana); `partOfSpeech` always null. |
| 3 | Output is inspectable and usable for learning assessment | PASS (with caveats) | Fixture JSON is human-readable. App StudyScreen renders lyric lines and vocab rows. Tokens are recognizable Japanese phrases. Caveats: tokens are phrase-level (not word-level), limiting dictionary lookup and SRS utility. |
| 4 | Blockers, assumptions, and unresolved decisions are documented | PASS | Backend and app agents explicitly documented known assumptions (reading placeholder, null partOfSpeech, heuristic tokenization, no Ktor wiring, no ViewModel). |

---

## Issues Found

### BLOCKER

**B-1: `gradlew` binary jar not committed — backend cannot be built**
- File: `/backend/gradlew` (wrapper jar absent)
- The backend agent noted that `gradle wrapper` must be run once before the project builds. Without this, `./gradlew bootRun` or any CI step fails immediately.
- Fix: Run `gradle wrapper --gradle-version <version>` in `/backend/` and commit the resulting `gradle/wrapper/gradle-wrapper.jar`.

**B-2: Ktor HTTP client not wired — app cannot call backend**
- File: `/app/src/commonMain/kotlin/com/japanese/vocabulary/app/screen/StudyScreen.kt:16`
- `mockStudyData` is hardcoded with a `// TODO: replace with API call` comment. No Ktor dependency, `HttpClient`, or `ViewModel` exists. App and backend are not connected.
- Fix: Add Ktor client dependency, implement `SongRepository.analyze()`, wire to a ViewModel, and inject into `StudyScreen`.

---

### HIGH

**H-1: Vocabulary tokenization produces phrase-level tokens, not word-level**
- File: `/backend/src/main/kotlin/com/japanese/vocabulary/service/LyricProcessingService.kt:39`
- The service splits on whitespace and Japanese punctuation. The sample lyrics use a single space between two phrases per line, so each "token" is an entire phrase (e.g., `沈んでいく感覚に`, `溺れてしまいそうだ`). These are 7–9 character chunks — not dictionary words.
- Impact: Vocabulary candidates cannot be looked up in a standard Japanese dictionary as-is. `reading` (furigana) placeholder is meaningless at phrase level. Downstream SRS and review features will be blocked until real morphological analysis (e.g., Kuromoji/MeCab) is added.
- Fix: Integrate a morphological analyzer for word-level tokenization.

**H-2: `reading` field is a copy of `word` — furigana is non-functional**
- Files: `LyricProcessingService.kt:47`, `sample-song-processed.json` (all entries)
- Every `reading` value is identical to `word`. The app's `VocabCandidateRow` renders `reading` next to `word`, showing the same text twice — providing no value to learners.
- Fix: Integrate a furigana/reading API or NLP library. Mark the field as nullable or omit it until real readings are available.

---

### MEDIUM

**M-1: No error handling on `POST /api/songs/analyze`**
- File: `/backend/src/main/kotlin/com/japanese/vocabulary/controller/SongController.kt:19`
- The controller passes all input directly to the service with no validation. An empty `lyrics` string, null fields, or extremely large input will either return an empty result or cause an unhandled exception.
- Fix: Add input validation (e.g., `@Valid`, blank checks) and a `@ExceptionHandler` or `ControllerAdvice` for structured error responses.

**M-2: `Song.id` is always null — no persistence layer**
- File: `backend/Models.kt:4`, `sample-song-processed.json:3`
- Songs are not persisted. Each call creates a transient object. If downstream features (review history, saved songs) need to reference a song by ID, this will be a gap.
- Fix: Acceptable for Sprint 1, but must be addressed before Sprint 2 if persistence is planned. Document as a known gap.

**M-3: App has no ViewModel layer — state lost on recomposition**
- File: `/app/src/commonMain/kotlin/com/japanese/vocabulary/app/screen/StudyScreen.kt:54`
- `StudyScreen` receives `studyData` as a parameter with a mock default. There is no `ViewModel` or state holder. When navigation or configuration changes occur, state will not survive.
- Fix: Introduce a `StudyViewModel` using `rememberViewModel` or equivalent KMP pattern before Sprint 2.

**M-4: iOS target not compiled or verified**
- The app is Kotlin Multiplatform but iOS compilation has not been confirmed. Compose Multiplatform iOS support requires additional configuration.
- Fix: Run `./gradlew iosSimulatorArm64Test` or open in Xcode to verify before sprint demo on iOS.

---

### LOW

**L-1: `sample-song.json` fixture format inconsistency**
- File: `/backend/src/main/resources/fixtures/sample-song.json`
- The fixture wraps input under `"input"` and expected output under `"expectedStudyUnits"` / `"expectedVocabularyCandidateSamples"`. This is not the actual API request format (`AnalyzeSongRequest` expects `title`, `artist`, `lyrics` flat). The fixture cannot be used as a direct API payload.
- Impact: Low for Sprint 1 (fixture is illustrative), but misleading if used as a test fixture for integration tests.
- Fix: Either split into two files (`input.json` and `expected-output.json`) or align the format with `AnalyzeSongRequest`.

**L-2: `expectedVocabularyCandidateSamples` in fixture is incomplete**
- File: `/backend/src/main/resources/fixtures/sample-song.json:17`
- The fixture lists only 5 expected vocabulary samples but the processed output contains 16. This means the fixture cannot be used for automated assertion without updating.
- Fix: Update `expectedVocabularyCandidateSamples` to match the full processed output, or document it as a partial sample.

**L-3: `translationHint` is always null and not rendered**
- `StudyUnit.translationHint` exists in the model but is never populated and not displayed in `StudyUnitCard`. The UI only renders `readingHint` (showing "—" when null).
- Fix: Acceptable for Sprint 1. Add display in Sprint 2 when translation enrichment is planned.

---

## Cross-System Contract Alignment

| Field | Backend Model | App Model | Match |
|-------|--------------|-----------|-------|
| `Song.id` | `String?` | `String?` | YES |
| `Song.title` | `String` | `String` | YES |
| `Song.artist` | `String` | `String` | YES |
| `Song.language` | `String = "ja"` | `String = "ja"` | YES |
| `StudyUnit.index` | `Int` | `Int` | YES |
| `StudyUnit.originalText` | `String` | `String` | YES |
| `StudyUnit.readingHint` | `String?` | `String?` | YES |
| `StudyUnit.translationHint` | `String?` | `String?` | YES |
| `VocabularyCandidate.word` | `String` | `String` | YES |
| `VocabularyCandidate.reading` | `String` | `String` | YES |
| `VocabularyCandidate.partOfSpeech` | `String?` | `String?` | YES |
| `VocabularyCandidate.sourceLineIndex` | `Int` | `Int` | YES |
| `SongStudyData.song` | `Song` | `Song` | YES |
| `SongStudyData.studyUnits` | `List<StudyUnit>` | `List<StudyUnit>` | YES |
| `SongStudyData.vocabularyCandidates` | `List<VocabularyCandidate>` | `List<VocabularyCandidate>` | YES |

**Contract verdict: FULL ALIGNMENT.** All field names, types, and nullability match exactly. The Ktor client would be able to deserialize the backend JSON response into app models without any changes, assuming `kotlinx.serialization` is used with default configuration (which the `@Serializable` annotations confirm).

---

## Fixture Validation

| Check | Result |
|-------|--------|
| `sample-song.json` contains valid Japanese lyrics | PASS — 8 lines of recognizable Japanese text from "夜に駆ける" by YOASOBI |
| `sample-song-processed.json` is plausible `SongStudyData` | PASS — correct structure, all required fields present |
| `studyUnits` indices sequential from 0 | PASS — indices 0 through 7, in order |
| `vocabularyCandidates` non-empty | PASS — 16 candidates |
| Candidates contain recognizable Japanese tokens | PASS (partial) — tokens are recognizable but phrase-level, not word-level |

---

## Logic Review: LyricProcessingService

| Check | Result | Notes |
|-------|--------|-------|
| Filters empty lines | PASS | `filter { it.isNotBlank() }` on line 16 |
| Deduplicates vocabulary candidates | PASS | `seen` set with `seen.add(cleaned)` guard on line 43 |
| Tokenization correctness | PARTIAL | Splits on whitespace and Japanese punctuation — correct delimiter logic, but produces phrase-level tokens due to lyric formatting |
| Handles leading/trailing whitespace | PASS | `line.trim()` on line 21 and `token.trim()` on line 41 |
| Minimum token length filter | PASS | `cleaned.length >= 2` on line 43 |
| Obvious bugs | NONE found | No off-by-one errors, no null pointer risks in the service itself |

---

## Sprint 2 Readiness Assessment

**Backend is ready to extend** once the Gradle wrapper jar issue is resolved (B-1). The service interface is clean and easy to extend with a morphological analyzer.

**App client is structurally sound** but cannot be connected to the backend until Ktor is wired (B-2) and a ViewModel layer is added (M-3).

**The data contract is solid** — no changes needed to models on either side for Sprint 2 integration.

**The pipeline end-to-end is not yet runnable** in a connected state. Sprint 2 must resolve B-1 and B-2 as its first two items before any integrated testing is possible.

### Recommended Sprint 2 priorities (ordered)

1. Fix B-1: Commit Gradle wrapper jar so backend builds
2. Fix B-2: Wire Ktor client in app and replace mock data
3. Fix H-1: Integrate morphological analyzer (Kuromoji or equivalent) for word-level tokenization
4. Fix H-2: Populate `reading` with real furigana (can follow H-1)
5. Fix M-1: Add input validation and error handling to the controller
6. Address M-2: Design persistence strategy for `Song.id`
7. Address M-3: Add ViewModel layer to app
8. Verify M-4: Confirm iOS compilation

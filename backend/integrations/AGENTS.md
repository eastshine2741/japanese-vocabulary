# Integration Module Instructions

## Scope

Applies to all modules under `backend/integrations/`.

## Rules

- Group external provider clients by function, not by consuming application. Infra adapters (message queue) also live here when several bootstraps share them.
- Use direct client classes; do not introduce a hexagonal port layer unless explicitly decided.
- Prefer `RestClient` where behavior can stay equivalent.
- Keep package names outside domain package trees: `songsearch`, `lyricsearch`, `mvsearch`, `messagequeue`.
- Do not add `com.japanese.vocabulary.song.client.*` packages.
- Each Spring bean-providing integration module must own AutoConfiguration and component-scan only its package.
- Application-specific timeout, retry, or API key differences should be handled by application properties, not duplicated client classes.

## Current Modules

- `song-search`: iTunes song search.
- `lyric-search`: LRCLIB and VocaDB lyric/provider search.
- `mv-search`: YouTube MV search.
- `apple-music-rss`: Apple Music RSS charts.
- `github`: GitHub issue creation (`GithubIssueClient`), used by `api` for VOC. Token blank -> `enabled=false`.
- `message-queue`: song analysis work queue names plus the publisher that turns
  `SongAnalysisWorkQueuedEvent` into a message on `AFTER_COMMIT`. Producers are `api`/`admin-api`;
  the consumer lives in `worker`. Broker topology is owned by the Topology Operator CRs in
  `k8s/{dev,prod}/rabbitmq/topology.yaml`, not by this module — renaming an exchange or queue means
  changing both the constants here and those CRs. `SongAnalysisQueueIntegrationTest` (Testcontainers)
  guards the round trip with a test-local topology.

rootProject.name = "japanese-vocabulary-backend"

include("common", "api", "admin-api", "batch", "migration")
include(
    "integrations:song-search",
    "integrations:lyric-search",
    "integrations:mv-search",
    "integrations:apple-music-rss",
)
include(
    "domains:song",
    "domains:song-analysis",
    "domains:recommendation",
    "domains:translation",
    "domains:auth",
    "domains:user",
    "domains:userinventory",
    "domains:flashcard",
    "domains:deck",
    "domains:studystats",
    "domains:notification",
)

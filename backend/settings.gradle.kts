rootProject.name = "japanese-vocabulary-backend"

include("common", "api", "admin-api", "batch", "worker", "migration")
include(
    "integrations:song-search",
    "integrations:lyric-search",
    "integrations:mv-search",
    "integrations:github",
    "integrations:message-queue",
    "integrations:karaoke-listing",
    "integrations:object-storage",
)
include(
    "domains:song",
    "domains:song-analysis",
    "domains:recommendation",
    "domains:karaoke",
    "domains:translation",
    "domains:auth",
    "domains:user",
    "domains:userinventory",
    "domains:word",
    "domains:studystats",
    "domains:notification",
)

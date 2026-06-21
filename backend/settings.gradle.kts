rootProject.name = "japanese-vocabulary-backend"

include("common", "api", "admin-api", "batch", "migration")
include(
    "domains:song",
    "domains:translation",
    "domains:auth",
    "domains:user",
    "domains:userinventory",
    "domains:flashcard",
    "domains:deck",
    "domains:studystats",
    "domains:notification",
)

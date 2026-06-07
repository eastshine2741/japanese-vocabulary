rootProject.name = "japanese-vocabulary-backend"

include("common", "api", "batch", "migration")
include(
    "domains:song",
    "domains:auth",
    "domains:user",
    "domains:userinventory",
    "domains:flashcard",
    "domains:deck",
    "domains:studystats",
    "domains:notification",
)

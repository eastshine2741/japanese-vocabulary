dependencies {
    implementation(project(":domains:song"))
    implementation(project(":domains:song-analysis"))

    // Domain-only module. Vendor scraping lives in integrations:karaoke, collection and push in batch.
}

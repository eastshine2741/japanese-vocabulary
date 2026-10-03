dependencies {
    // TransientHttpErrors: a provider outage must surface, not read as "no lyrics".
    implementation(project(":common"))
    // ItunesArtistAliasVerifier resolves a provider's artist spelling through the iTunes catalog.
    implementation(project(":integrations:song-search"))
}

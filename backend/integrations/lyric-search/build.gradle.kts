dependencies {
    // TransientHttpErrors: a provider outage must surface, not read as "no lyrics".
    implementation(project(":common"))
    // AppleMusicArtistAliasVerifier resolves a provider's artist spelling through the Apple Music catalog.
    implementation(project(":integrations:song-search"))
    // LyricProviderRetry waits with coroutine delay, never Thread.sleep.
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")
}

dependencies {
    implementation(project(":domains:song"))
    implementation(project(":domains:song-analysis"))

    // Domain-only module. It owns recommendation state and invariant-preserving workflow helpers.
    // External RSS clients, schedulers, and REST controllers live in bootstrap/integration modules.
}

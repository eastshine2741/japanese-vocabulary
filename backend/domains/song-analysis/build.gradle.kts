dependencies {
    // Song analysis module doesn't depend on song module,
    // to trigger analyzation without depending on song module
    // and not to make song module have unnecessary classes about analyzation, client, etc.
    // Actual analyzation depends on song or lyrics by its nature, so it's done by batch application module.
}

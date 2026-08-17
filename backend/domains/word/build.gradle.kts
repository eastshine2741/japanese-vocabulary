dependencies {
    implementation(project(":domains:song"))
    implementation(project(":domains:user"))

    // FSRS - Spaced Repetition Scheduler
    implementation("io.github.open-spaced-repetition:fsrs:1.0.0")

    // Test fixtures (TestWordBuilder/TestFlashcardBuilder) need user's TestUserBuilder.
    testFixturesImplementation(testFixtures(project(":domains:user")))
}

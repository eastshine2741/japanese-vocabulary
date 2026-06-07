dependencies {
    implementation(project(":domains:flashcard"))
    implementation(project(":domains:song"))

    testImplementation(testFixtures(project(":domains:user")))
    testImplementation(testFixtures(project(":domains:song")))
    testImplementation(testFixtures(project(":domains:flashcard")))
}

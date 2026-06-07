dependencies {
    implementation(project(":domains:flashcard"))
    implementation(project(":domains:user"))
    implementation(project(":domains:userinventory"))

    // Spring Batch job (FreezeConsume) lives here; bootstrap modules pull the runtime starter.
    implementation("org.springframework.boot:spring-boot-starter-batch")

    testImplementation(testFixtures(project(":domains:user")))
}

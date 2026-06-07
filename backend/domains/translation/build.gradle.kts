dependencies {
    implementation(project(":domains:song"))

    implementation("org.springframework.boot:spring-boot-starter-webflux")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")

    // Kuromoji dictionaries load fully into heap when a Tokenizer is constructed.
    // This module is depended on by :batch only — keep it off the api classpath.
    implementation("com.atilika.kuromoji:kuromoji-ipadic:0.9.0")
    implementation("com.atilika.kuromoji:kuromoji-unidic:0.9.0")
}

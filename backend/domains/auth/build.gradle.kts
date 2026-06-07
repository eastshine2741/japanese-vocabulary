dependencies {
    implementation(project(":domains:user"))

    // JWT
    implementation("io.jsonwebtoken:jjwt-api:0.12.3")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.3")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.3")

    // Google OIDC (ID token JWKS verify)
    implementation("com.google.api-client:google-api-client:2.7.0")
}

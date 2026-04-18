plugins {
    id("org.flywaydb.flyway") version "10.12.0"
}

repositories {
    mavenCentral()
}

buildscript {
    dependencies {
        classpath("com.mysql:mysql-connector-j:8.3.0")
        classpath("org.flywaydb:flyway-mysql:10.12.0")
    }
}

flyway {
    val dbHost = System.getenv("MYSQL_HOST") ?: "localhost"
    val dbDatabase = System.getenv("MYSQL_DATABASE") ?: "japanese_vocabulary"
    url = "jdbc:mysql://$dbHost:3306/$dbDatabase"
    user = System.getenv("MYSQL_USER") ?: "root"
    password = System.getenv("MYSQL_PASSWORD") ?: ""
    locations = arrayOf("filesystem:src/main/resources/db/migration")
    baselineOnMigrate = true
}

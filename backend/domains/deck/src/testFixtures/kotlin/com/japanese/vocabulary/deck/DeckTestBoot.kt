package com.japanese.vocabulary.deck

import org.springframework.boot.autoconfigure.SpringBootApplication

/**
 * Minimal @SpringBootApplication for deck's integration tests. Spring's @SpringBootTest
 * walk-up resolution finds this when a test under com.japanese.vocabulary.deck is loaded,
 * so we don't need to depend on api's ApiApplication.
 */
@SpringBootApplication(scanBasePackages = ["com.japanese.vocabulary"])
class DeckTestBoot

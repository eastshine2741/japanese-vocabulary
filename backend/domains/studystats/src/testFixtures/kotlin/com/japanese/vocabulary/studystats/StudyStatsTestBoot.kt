package com.japanese.vocabulary.studystats

import org.springframework.boot.autoconfigure.SpringBootApplication

/**
 * Minimal @SpringBootApplication for studystats' integration tests. See [DeckTestBoot] for
 * why each domain owns its own test boot instead of pulling in api.
 */
@SpringBootApplication(scanBasePackages = ["com.japanese.vocabulary"])
class StudyStatsTestBoot

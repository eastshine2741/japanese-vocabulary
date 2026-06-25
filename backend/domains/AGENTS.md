# Domain Module Instructions

## Scope

Applies to all modules under `backend/domains/`.

## Allowed Responsibilities

- Entity/model/enum definitions.
- Domain services and invariant-preserving state transitions.
- JPA repositories needed by the domain core.
- Domain DTOs used for module-to-module communication.
- Module-owned AutoConfiguration for Spring bean surface.

## Forbidden Responsibilities

- REST controllers and HTTP-specific DTOs.
- Schedulers, Spring Batch jobs/steps, and batch workflow workers.
- App-specific page/search/projection/read-model workflows.
- External music provider clients such as iTunes, YouTube, LRCLIB, or VocaDB.
- Test `@SpringBootApplication` classes.

## Spring Wiring

- If the module provides beans, add `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`.
- The AutoConfiguration should component-scan only the module-owned `com.japanese.vocabulary.<module>` package.
- Register entities and repositories explicitly with `@EntityScan` and `@EnableJpaRepositories`.
- Repository interfaces remain externally visible for this pass; do not make them `internal` without a separate test migration plan.

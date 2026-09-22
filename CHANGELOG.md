# Changelog

All notable changes to DSUI are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and releases use semantic versioning while allowing documented pre-1.0 adapter API changes.

## [Unreleased]

## [0.1.0-alpha.2] - 2026-09-22

### Fixed

- Bundle built-in adapters and DuckDB's native runtime dependencies in Docker images.
- Preserve writable ownership of the persistent `/data` directory for the non-root image user.
- Generate release-note author links from GitHub commit metadata.

## [0.1.0-alpha.1] - 2026-09-22

This is the first public Developer Preview. Breaking changes, incomplete
adapter coverage, and bugs are expected.

### Added

- Initial Bun and Turborepo workspace.
- React application, Astro landing page, and Fumadocs documentation.
- Adapter SDK and built-in Trino, Kafka, and S3/MinIO adapters.
- Declarative and UI-managed connections.
- Community adapter template and immutable source validation.
- Automated Docker image releases to GitHub Container Registry with generated GitHub Release notes.

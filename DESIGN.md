# dsui design

This document is the product and visual source of truth for dsui, Data Stack UI.

## Product contract

**Tagline:** One lightweight UI for your data stack.

dsui is a local-first, developer-first interface for working with Trino, Kafka, S3, MinIO, PostgreSQL, Flink, and other services through adapters. It replaces the extra interfaces developers otherwise add to a Docker Compose stack.

Lightweight is a product characteristic, not an implementation detail. A significant dependency or feature is accepted only when its usefulness clearly exceeds its resource, security, maintenance, and bundle cost. dsui must not require PostgreSQL, Redis, or another infrastructure service to run.

dsui is not a data platform, orchestrator, observability suite, data catalog, SaaS control plane, lineage product, or universal replacement for advanced vendor interfaces.

## v0.1 workflows

- Connected-service health dashboard
- Add, test, edit, and remove UI-managed services
- Read-only declarative services from `dsui.yaml`
- Trino queries and catalog/schema/table browsing
- Kafka topics, bounded messages, offsets, and consumer groups
- S3/MinIO buckets, objects, previews, and downloads
- Local and enterprise authentication modes
- Community adapter loading from immutable, validated sources
- Docker, Compose demo, tiny CLI, documentation, CI, and benchmark infrastructure

Accounts, cloud sync, multi-tenancy, marketplaces, Kubernetes operators, AI features, observability, lineage, orchestration, billing, and customizable RBAC are outside v0.1.

## Runtime principles

The browser communicates only with dsui. Infrastructure credentials remain server-side. SQLite stores required local state. The core application does not contain service-specific behavior. Adapters provide metadata, connection validation, health, capabilities, and server operations.

Adapters customize pages through a constrained declarative schema rendered by dsui-owned components. They do not ship React applications, HTML, CSS, or browser JavaScript. Community adapters are administrator-approved server code and are never described as safely sandboxed.

## Application direction

The product interface is a dense, practical developer tool: compact rows, clear status, keyboard navigation, readable data tables, and very little decoration.

### Color

| Token | Value |
| --- | --- |
| Canvas | `#0A0C0F` |
| Background | `#0D1014` |
| Surface | `#11151A` |
| Raised | `#151A20` |
| Hover | `#191F26` |
| Border | `#222932` |
| Strong border | `#303945` |
| Primary text | `#F4F6F8` |
| Secondary text | `#A1A9B4` |
| Muted text | `#68727F` |
| Accent | `#6B8AFF` |
| Healthy | `#5CC98A` |
| Warning | `#E2AE5B` |
| Unavailable | `#E46D72` |
| Unknown | `#747E8A` |

Use Inter for general UI and JetBrains Mono only for code, hosts, ports, IDs, offsets, versions, timestamps, and object paths. Radii range from 4px to 8px, with dialogs capped around 10px. Avoid pure black, oversized cards, bubble styling, decorative charts, and unnecessary shadows.

The dashboard answers one question: which services are connected, and are they healthy? It uses compact service rows and real health detail rather than invented metrics.

## Public site direction

The public site is more editorial than the application. Its visual language uses strong columns, thin construction lines, large negative space, restrained typography, and original graphite engraving artwork. The supplied reference in `assets/references` informs style only; its mountains, brand, and layout must not be copied.

Major custom artwork depicts data infrastructure: racks, modules, pipelines, cable routes, service structures, and a single shared interface. Avoid stock servers, database cylinders, generic connected dots, glossy 3D, neon cyberpunk, purple gradients, colorful blobs, and cartoon imagery.

The landing page explains the product in under ten seconds, establishes lightweight as an engineering principle, shows real product UI and Compose code, and directs visitors to GitHub and documentation. It contains no pricing, sales funnel, or enterprise contact form.

Northgrain attribution is visible but secondary: “dsui by Northgrain Data” and “Open source by Northgrain Data.”

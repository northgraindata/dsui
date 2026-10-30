# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Data and platform engineers lead.
They set up DSUI, connect services, and write adapters and plugins for their own infrastructure.
The wider data team (analysts and others) uses the resulting workspace day to day.

## Product Purpose

DSUI is an open-source, extensible, self-hosted platform for a team's data stack.
It connects the tools a team already runs, lets them install plugins, and lets them build custom capabilities (pages, actions, workflows) on top.
Success is one workspace where a team sees and works with its whole stack, shaped to how that team operates.

## Positioning

Extensibility is the mechanism.
Service adapters and plugins are built with public TypeScript SDKs (Adapter SDK, Plugin SDK), so teams add internal tools and custom pages themselves instead of waiting on a vendor.
It is self-hosted with no separate database or control plane; local state lives in a data directory or a single container volume.

## Operating Context

- Configured declaratively in `dsui.yaml` (adapters, services, connections).
- Runs locally via `npx @northgraindata/dsui` or as a Docker image (`ghcr.io/northgraindata/dsui`) on port 4192.
- Connections added through the UI are encrypted with a master key.
- Adapters can be pulled from git and built on startup.

## Capabilities and Constraints

- Built-in adapters: Apache Airflow, dbt, PostgreSQL, ClickHouse, S3-compatible storage (e.g. MinIO), DuckDB, Trino.
- First-party plugins in the repo: health, monitoring, AI agent, code repository.
- Monorepo surfaces: `apps/web` (the product workspace UI), `apps/site` (marketing site), `apps/docs` (documentation).
- Developed by Northgrain Data; licensed Apache-2.0.
- Not yet decided: pricing, hosted offering, and any commercial tier. Do not invent them.

## Brand Commitments

Product name is "DSUI".
Tagline in use: "The extensible platform for your data stack."
Maintained by Northgrain Data.

## Evidence on Hand

- README and screenshots/banner in `assets/readme/`.
- Adapter logos in `apps/site/public/assets/logos/`.
- Public docs at dsui.northgraindata.com/docs; live demo at /demo.
- No testimonials, customer names, or benchmarks exist in the repo. Do not fabricate them.

## Product Principles

1. Extensible by design: anything first-party should be buildable by a user through the same SDKs.
2. Meet the stack where it is: integrate the tools teams already run rather than replace them.
3. Self-hosted and low-ceremony: no required control plane, minimal setup, state the operator owns.
4. Serve engineers first without shutting out the wider data team.

# Product direction

This document records the intended shape of the dsui product family. It is a
directional product boundary, not a release schedule or a promise that an
unlisted feature belongs to a particular edition.

## One product, three editions

### dsui OSS

The current repository is dsui OSS, licensed under Apache License 2.0. It is the
open-source, local-first product: one lightweight UI, one server-side adapter
model, and useful day-to-day workflows for data infrastructure without an
external control plane or dsui account.

OSS must remain a real product rather than a crippled trial. Its adapter SDK,
core renderers, local operation, configuration, and community contribution path
are the foundation on which the other editions build.

### dsui Pro

dsui Pro will be separately licensed and available as self-hosted software or a
hosted cloud service. A cloud dashboard and its supporting control plane may be
introduced as the hosted product matures.

Pro should extend the shared dsui contracts instead of forking the adapter model
or rebuilding the UI as a second product. Exact commercial feature boundaries
remain a product decision and must not be inferred ad hoc during implementation.

### dsui Enterprise

dsui Enterprise will be separately licensed and deployable self-hosted, on
premises, or in the dsui cloud. It is the edition for organizations whose
deployment, governance, integration, and support requirements go beyond Pro.

Enterprise work should preserve the same adapter and capability contracts unless
a demonstrated requirement forces an additive extension. On-premises support is
a first-class deployment constraint, not an afterthought to a cloud-only design.

## Shared principles

- Keep a shared architectural core; avoid edition-specific forks.
- Keep infrastructure credentials server-side in every deployment model.
- Do not make the OSS runtime depend on a commercial service or account.
- Prefer additive contracts so OSS adapters remain portable across editions.
- Keep commercial packaging and licensing boundaries explicit.
- Do not announce dates, pricing, or feature gates unless they have been decided.

## Roadmap order

1. Make the OSS foundation excellent: stable core renderers, strong official
   adapters, a credible community SDK, secure local operation, documentation,
   and lightweight distribution.
2. Build Pro on the same contracts, first supporting a clean licensed
   self-hosted experience and then the hosted cloud/dashboard where it adds real
   operational value.
3. Add Enterprise deployment and governance capabilities without weakening
   on-premises operation or fragmenting the adapter ecosystem.

For the current implementation scope, consult `PLAN.md`. For architectural and
visual invariants, consult `ARCHITECTURE.md` and `DESIGN.md`.

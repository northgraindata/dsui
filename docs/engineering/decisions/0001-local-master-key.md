# 0001: Generate a local master key automatically

## Context

UI-managed service connections are encrypted with AES-256-GCM. Before this
decision, a fresh npx runtime started without a master key, so the first
attempt to save a service from the UI failed with `DSUI_MASTER_KEY is required`.
That made the local onboarding path inconsistent with the product's local-first
workflow.

## Decision

When `DSUI_MASTER_KEY` is not provided, DSUI generates a random 32-byte key on
first start and stores its base64 representation in `.master-key` inside the
runtime data directory. The file is created atomically with mode `0600`, and the
existing key is reused on subsequent starts. An explicit `DSUI_MASTER_KEY` (or
the equivalent runtime option) always takes precedence and is never overwritten.

## Alternatives considered

- Require users to generate and export a key: secure but unsuitable for the
  beginner-first local runtime.
- Store the key in SQLite: convenient, but it would not protect the database
  and would couple key recovery to the encrypted data it protects.
- Derive the key from a machine identity: less portable and difficult to make
  predictable across environments.

## Compatibility and migration

Existing deployments that already set `DSUI_MASTER_KEY` continue to use it.
Deployments with encrypted UI-managed connections must keep their current key;
removing it or replacing it with a different key makes those connections
unreadable. The generated local key is stored beside the existing DSUI data and
is included by the same backup boundary.

## Verification

Covered by `packages/server/src/db/crypto.test.ts`. Installation and
configuration documentation describe the generated local key and the explicit
environment override.

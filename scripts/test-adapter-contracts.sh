#!/usr/bin/env bash
set -euo pipefail

# Keep adapter conformance separate from the general test gate: an adapter that
# compiles but fails the SDK contract should be immediately visible in CI.
bun test scripts/adapter-contracts.test.ts
for test_file in packages/adapter-*/test/*.test.ts; do
  [ -e "$test_file" ] || continue
  bun test "$test_file"
done

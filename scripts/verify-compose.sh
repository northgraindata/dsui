#!/usr/bin/env bash
set -euo pipefail

compose_file="examples/data-stack/compose.yaml"
docker compose -f "$compose_file" config -q

# Example images are intentionally pinned, so a demo remains reproducible.
if rg -n '^\s+image: .+:(latest|edge)$' "$compose_file"; then
  echo "Compose example must use immutable image tags." >&2
  exit 1
fi

for service in dsui trino kafka minio minio-init; do
  if ! docker compose -f "$compose_file" config --services | grep -Fxq "$service"; then
    echo "Compose example is missing required service: $service" >&2
    exit 1
  fi
done

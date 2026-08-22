#!/usr/bin/env bash
set -euo pipefail

site_index="apps/site/dist/index.html"
docs_index="apps/docs/dist/index.html"

for artifact in "$site_index" "$docs_index"; do
  if [ ! -s "$artifact" ]; then
    echo "Missing or empty static artifact: $artifact" >&2
    exit 1
  fi
done

echo "Static site and docs artifacts are ready for Coolify."

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

# Dockerfile.site is the Coolify deployment artifact. It must copy the two
# independently-built sites to the routes documented for the hosted service.
grep -Fq 'cp -R apps/docs/dist/. /out/docs/' Dockerfile.site
grep -Fq 'COPY --from=build /out /usr/share/nginx/html' Dockerfile.site
grep -Fq 'try_files $uri $uri/ $uri.html =404;' deploy/site-nginx.conf

echo "Static site and docs artifacts are ready for Coolify."

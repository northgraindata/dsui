#!/usr/bin/env bash
set -euo pipefail

image="${1:?usage: verify-site-container.sh IMAGE}"
container_id="$(docker run -d -p 127.0.0.1::8080 "$image")"
cleanup() { docker rm -f "$container_id" >/dev/null 2>&1 || true; }
trap cleanup EXIT

port="$(docker port "$container_id" 8080/tcp | sed 's/.*://')"
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error "http://127.0.0.1:${port}/" >/tmp/dsui-site.html; then
    break
  fi
  sleep 1
done

grep -qi 'dsui' /tmp/dsui-site.html
curl --fail --silent --show-error "http://127.0.0.1:${port}/docs/" >/tmp/dsui-docs.html
grep -qi 'dsui' /tmp/dsui-docs.html

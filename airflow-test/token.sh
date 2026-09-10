#!/usr/bin/env bash
# Prints a JWT for the Airflow API. Tokens last 24h; rerun when one expires.
set -euo pipefail

BASE_URL="${AIRFLOW_BASE_URL:-http://localhost:8080}"
USERNAME="${AIRFLOW_USERNAME:-admin}"
PASSWORD="${AIRFLOW_PASSWORD:-admin}"

response=$(curl -sS -X POST "${BASE_URL}/auth/token" \
  -H 'Content-Type: application/json' \
  -d "{\"username\": \"${USERNAME}\", \"password\": \"${PASSWORD}\"}")

token=$(printf '%s' "${response}" | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

if [ -z "${token}" ]; then
  echo "Could not read an access token from: ${response}" >&2
  exit 1
fi

printf '%s\n' "${token}"

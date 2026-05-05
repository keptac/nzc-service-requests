#!/bin/sh
set -eu

require_env() {
  name="$1"
  value="$(eval "printf '%s' \"\${$name:-}\"")"

  if [ -z "$value" ]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi

  case "$value" in
    *replace-with*|*example.org*)
      echo "Replace placeholder value for environment variable: $name" >&2
      exit 1
      ;;
  esac
}

require_env DATABASE_URL
require_env AUTH_SECRET
require_env APP_URL
require_env WHATSAPP_WEBHOOK_TOKEN

echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Running production bootstrap..."
node prisma/bootstrap.js

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "Seeding database..."
  ./node_modules/.bin/prisma db seed
fi

echo "Starting SDA Service Request Tracker..."
exec ./node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"

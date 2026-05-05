#!/bin/sh
set -eu

echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "Seeding database..."
  ./node_modules/.bin/prisma db seed
fi

echo "Starting SDA Service Request Tracker..."
exec ./node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"

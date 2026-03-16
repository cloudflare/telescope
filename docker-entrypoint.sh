#!/bin/bash
set -e

# Fix ownership of mounted volumes
sudo chown -R telescope:telescope /app/results /app/tmp /app/recordings 2>/dev/null || true

# Run the app
exec node dist/src/cli.js "$@"

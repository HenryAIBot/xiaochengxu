#!/usr/bin/env bash
set -euo pipefail

docker compose up -d
pnpm install
echo "Redis and Mailpit are ready. Start API, jobs, and mini program in separate terminals."

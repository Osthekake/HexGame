#!/bin/sh
set -e

# Start the Node.js backend in background
cd /app/server
DB_PATH=/app/data/hexgame.db node dist/server/src/index.js &

# Start nginx in foreground
nginx -g 'daemon off;'

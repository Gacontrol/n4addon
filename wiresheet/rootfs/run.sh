#!/usr/bin/env bashio

echo "Starte Wiresheet Flow Editor..."

CONFIG_PATH=/data/options.json

echo "Konfiguration geladen"

cd /app

echo "Starte Node.js Server..."
node server/index.js &

echo "Starte Nginx..."
exec nginx -g "daemon off;"

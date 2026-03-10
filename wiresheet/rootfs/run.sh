#!/bin/sh
set -e

echo "Starte Wiresheet Flow Editor..."

CONFIG_PATH=/data/options.json

echo "Konfiguration geladen"
echo "SUPERVISOR_TOKEN vorhanden: $(if [ -n "$SUPERVISOR_TOKEN" ]; then echo 'ja'; else echo 'nein'; fi)"

cd /app

echo "Starte Node.js Server..."
node server/index.js &
NODE_PID=$!

sleep 2

if ! kill -0 $NODE_PID 2>/dev/null; then
    echo "FEHLER: Node.js Server konnte nicht gestartet werden"
    exit 1
fi

echo "Node.js Server laeuft (PID: $NODE_PID)"

echo "Starte Nginx..."
exec nginx -g "daemon off;"

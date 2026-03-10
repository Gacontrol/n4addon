#!/usr/bin/with-contenv bashio

bashio::log.info "Starte Wiresheet Flow Editor..."

CONFIG_PATH=/data/options.json
LOG_LEVEL=$(bashio::config 'log_level')

bashio::log.info "Log Level: ${LOG_LEVEL}"

cd /app

bashio::log.info "Starte Node.js Server..."
node server/index.js &

bashio::log.info "Starte Nginx..."
exec nginx -g "daemon off;"

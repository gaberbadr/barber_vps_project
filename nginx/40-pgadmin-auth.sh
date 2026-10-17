#!/bin/sh
set -e

HTPASSWD_FILE="/etc/nginx/.htpasswd"

# Only generate if .htpasswd does not already exist (e.g. from a custom volume mount)
if [ ! -f "$HTPASSWD_FILE" ]; then
    AUTH_USER="${PGADMIN_BASIC_AUTH_USER:-${PGADMIN_DEFAULT_EMAIL:-admin}}"
    AUTH_PASS="${PGADMIN_BASIC_AUTH_PASSWORD:-${PGADMIN_DEFAULT_PASSWORD}}"

    if [ -n "$AUTH_USER" ] && [ -n "$AUTH_PASS" ]; then
        echo "[pgadmin-auth] Configuring Nginx HTTP Basic Auth for pgAdmin (User: $AUTH_USER)..."
        printf '%s\n' "$AUTH_PASS" | htpasswd -ic "$HTPASSWD_FILE" "$AUTH_USER"
        chmod 644 "$HTPASSWD_FILE"
    else
        echo "[pgadmin-auth] No basic auth credentials configured; generating secure fallback..."
        RANDOM_PASS=$(openssl rand -hex 16)
        printf '%s\n' "$RANDOM_PASS" | htpasswd -ic "$HTPASSWD_FILE" "admin"
        chmod 644 "$HTPASSWD_FILE"
        echo "[pgadmin-auth] Generated pgAdmin basic auth fallback -> user: admin, password: $RANDOM_PASS"
    fi
fi

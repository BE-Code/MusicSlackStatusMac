#!/bin/bash

# Exit on any error
set -e

# Get app directory and name
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME=$(node -p "require('$APP_DIR/package.json').name" 2>/dev/null || echo "musicslackstatus")

PLIST_NAME="com.${APP_NAME}.startup"
PLIST_FILE="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

echo "Removing ${APP_NAME} from startup..."

# Unload the LaunchAgent if it's loaded
if launchctl list | grep -q "$PLIST_NAME"; then
    launchctl unload "$PLIST_FILE"
    echo "✅ LaunchAgent unloaded"
fi

# Remove the plist file
if [ -f "$PLIST_FILE" ]; then
    rm "$PLIST_FILE"
    echo "✅ Plist file removed"
fi

echo "✅ ${APP_NAME} has been removed from startup"

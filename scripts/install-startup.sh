#!/bin/bash

# Exit on any error
set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Read app name and main file from package.json
APP_NAME=$(node -p "require('$APP_DIR/package.json').name" 2>/dev/null || echo "musicslackstatus")
MAIN_FILE=$(node -p "require('$APP_DIR/package.json').main" 2>/dev/null || echo "compiled/backend/index.js")

PLIST_NAME="com.${APP_NAME}.startup"
PLIST_FILE="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

echo "Setting up ${APP_NAME} to run on startup..."

# Get the actual paths to yarn and node
# Get the real yarn path, handling NVM and other cases
if [[ -n "$NVM_BIN" ]]; then
    YARN_PATH="$NVM_BIN/yarn"
elif [[ -d "$HOME/.nvm" ]]; then
    # Find the current NVM node version
    NODE_VERSION=$(node --version)
    YARN_PATH="$HOME/.nvm/versions/node/$NODE_VERSION/bin/yarn"
else
    YARN_PATH=$(which yarn)
fi

# Get the real node path, handling NVM and other cases
if [[ -n "$NVM_BIN" ]]; then
    NODE_PATH="$NVM_BIN/node"
elif [[ -d "$HOME/.nvm" ]]; then
    # Find the current NVM node version
    NODE_VERSION=$(node --version)
    NODE_PATH="$HOME/.nvm/versions/node/$NODE_VERSION/bin/node"
else
    NODE_PATH=$(which node)
fi

# Verify the paths exist
if [[ ! -f "$YARN_PATH" ]]; then
    echo "Error: Yarn executable not found at $YARN_PATH"
    echo "Please ensure Yarn is properly installed"
    exit 1
fi

if [[ ! -f "$NODE_PATH" ]]; then
    echo "Error: Node.js executable not found at $NODE_PATH"
    echo "Please ensure Node.js is properly installed"
    exit 1
fi

# Detect Homebrew path
HOMEBREW_PATH=""
if command -v brew &> /dev/null; then
    HOMEBREW_PATH=$(brew --prefix)/bin
fi

# Create the LaunchAgent plist file
cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${YARN_PATH}</string>
        <string>node</string>
        <string>${MAIN_FILE}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${APP_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${APP_DIR}/logs/startup.log</string>
    <key>StandardErrorPath</key>
    <string>${APP_DIR}/logs/startup.error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$(dirname "${NODE_PATH}"):${HOMEBREW_PATH}:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
EOF

# Create logs directory if it doesn't exist
mkdir -p "$APP_DIR/logs"

# Load the LaunchAgent
launchctl load "$PLIST_FILE"

echo "✅ ${APP_NAME} has been configured to run on startup"
echo "📍 Plist file created at: $PLIST_FILE"
echo "📝 Logs will be written to: $APP_DIR/logs/"
echo ""
echo "To disable startup, run: yarn uninstall-startup"
echo "To check status, run: launchctl list | grep $PLIST_NAME"

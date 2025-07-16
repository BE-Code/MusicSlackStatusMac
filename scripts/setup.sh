#!/bin/bash

# Exit on any error
set -e

# Check for Homebrew and install if we don't have it
if ! command -v brew &> /dev/null; then
  echo "Homebrew not found."
  read -p "Do you want to install Homebrew? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add Homebrew to PATH for the rest of the script.
    # This works for Apple Silicon and Intel Macs.
    if [[ "$(uname -m)" == "arm64" ]]; then
      export PATH="/opt/homebrew/bin:$PATH"
    else
      export PATH="/usr/local/bin:$PATH"
    fi
  else
    echo "Homebrew is required to continue. Aborting."
    exit 1
  fi
else
  echo "Homebrew is already installed."
fi

# Check for media-control and install if we don't have it
if ! brew list media-control &> /dev/null; then
  echo "media-control not found. Installing..."
  brew tap ungive/media-control
  brew install media-control
else
  echo "media-control is already installed."
fi

echo "Setup complete. All required dependencies are installed."

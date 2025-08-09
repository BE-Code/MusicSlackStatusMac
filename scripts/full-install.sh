#!/bin/bash

# Exit on any error
set -e

echo "Running full installation setup..."

# Run the setup script to install system dependencies
echo "Installing system dependencies..."
./scripts/setup.sh

# Run yarn setup to handle the rest
echo "Running yarn setup..."
yarn full-install

echo "Full installation complete!"

#!/bin/bash
# Quick installation script for TiddlyWiki Cloudflare Saver Plugin

set -e

echo "==================================="
echo "TiddlyWiki Cloudflare Saver Installer"
echo "==================================="
echo ""

# Check if a target directory was provided
if [ -z "$1" ]; then
  echo "Usage: ./scripts/install-plugin.sh <tiddlywiki-directory>"
  echo ""
  echo "Example: ./scripts/install-plugin.sh ~/my-wiki"
  exit 1
fi

TARGET_DIR="$1"

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
  echo "Error: Directory '$TARGET_DIR' does not exist"
  exit 1
fi

# Check if dist files exist
if [ ! -f "dist/cloudflare-saver-plugin.json" ]; then
  echo "Building plugin..."
  npm run build
fi

# Create plugins directory if it doesn't exist
PLUGINS_DIR="$TARGET_DIR/plugins"
if [ ! -d "$PLUGINS_DIR" ]; then
  echo "Creating plugins directory..."
  mkdir -p "$PLUGINS_DIR"
fi

# Copy plugin file
echo "Installing plugin to $PLUGINS_DIR..."
cp dist/cloudflare-saver-plugin.json "$PLUGINS_DIR/"

echo ""
echo "✅ Plugin installed successfully!"
echo ""
echo "Next steps:"
echo "1. Restart your TiddlyWiki server"
echo "2. Configure the plugin in Control Panel → Saving → CloudFlare Saver"
echo "3. See README.md for complete setup instructions"
echo ""

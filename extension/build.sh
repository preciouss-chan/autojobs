#!/bin/bash
# Build script for Auto Apply AI extension
# Creates separate packages for Chrome and Firefox

set -e

EXTENSION_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$EXTENSION_DIR/build"

echo "🔨 Building Auto Apply AI extension..."

# Clean build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/chrome" "$BUILD_DIR/firefox"

# Files to include in both builds
COMMON_FILES=(
  "popup"
  "options"
  "content"
  "chatbot"
  "shared"
  "script"
  "utils"
  "data"
)

# Copy common files to Chrome build
echo "📦 Building Chrome extension..."
for dir in "${COMMON_FILES[@]}"; do
  if [ -d "$EXTENSION_DIR/$dir" ]; then
    cp -r "$EXTENSION_DIR/$dir" "$BUILD_DIR/chrome/"
  fi
done
cp "$EXTENSION_DIR/background/background.js" "$BUILD_DIR/chrome/"
mkdir -p "$BUILD_DIR/chrome/background"
cp "$EXTENSION_DIR/background/background.js" "$BUILD_DIR/chrome/background/"
cp "$EXTENSION_DIR/manifest.json" "$BUILD_DIR/chrome/"

# Copy common files to Firefox build
echo "📦 Building Firefox extension..."
for dir in "${COMMON_FILES[@]}"; do
  if [ -d "$EXTENSION_DIR/$dir" ]; then
    cp -r "$EXTENSION_DIR/$dir" "$BUILD_DIR/firefox/"
  fi
done
mkdir -p "$BUILD_DIR/firefox/background"
cp "$EXTENSION_DIR/background/background-firefox.js" "$BUILD_DIR/firefox/background/"
cp "$EXTENSION_DIR/manifest.firefox.json" "$BUILD_DIR/firefox/manifest.json"

# Create zip files
echo "📦 Creating zip packages..."
cd "$BUILD_DIR/chrome" && zip -r "../autoapply-chrome.zip" . -x "*.DS_Store"
cd "$BUILD_DIR/firefox" && zip -r "../autoapply-firefox.zip" . -x "*.DS_Store"

echo ""
echo "✅ Build complete!"
echo "   Chrome: $BUILD_DIR/autoapply-chrome.zip"
echo "   Firefox: $BUILD_DIR/autoapply-firefox.zip"
echo ""
echo "📝 Installation:"
echo "   Chrome: Go to chrome://extensions, enable Developer mode, drag & drop the zip"
echo "   Firefox: Go to about:debugging, click 'Load Temporary Add-on', select manifest.json from unzipped folder"

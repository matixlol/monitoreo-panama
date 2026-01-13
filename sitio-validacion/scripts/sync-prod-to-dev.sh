#!/bin/bash
# Sync extractions and validatedData from production to development
# Skips documents and _storage since they're already synced

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEMP_DIR="$PROJECT_DIR/.sync-temp"

echo "📦 Exporting from production..."
mkdir -p "$TEMP_DIR"
npx convex export --prod --path "$TEMP_DIR/backup.zip"

echo "📂 Extracting and filtering tables..."
cd "$TEMP_DIR"
unzip -o backup.zip

# Remove tables we don't want to sync
rm -rf authVerifiers authRateLimits authVerificationCodes users authSessions authAccounts authRefreshTokens
# Remove documents and storage (already synced)
rm -rf documents _storage

# Repackage
zip -r filtered.zip .

echo "📥 Importing to development..."
cd "$PROJECT_DIR"
npx convex import --replace-all --yes "$TEMP_DIR/filtered.zip"

echo "🧹 Cleaning up..."
rm -rf "$TEMP_DIR"

echo "✅ Sync complete!"

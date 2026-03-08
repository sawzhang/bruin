#!/bin/bash
set -euo pipefail

# ============================================================
# Bruin — Mac App Store Build & Submission Script
# ============================================================
#
# Prerequisites:
#   1. Apple Developer Program membership
#   2. Certificates installed in Keychain:
#      - "3rd Party Mac Developer Application: <Team Name>"
#      - "3rd Party Mac Developer Installer: <Team Name>"
#   3. Provisioning profile downloaded from developer.apple.com
#      and placed at: src-tauri/embedded.provisionprofile
#   4. iCloud container (iCloud.com.bruin.app) registered in
#      Apple Developer portal under Identifiers > iCloud Containers
#   5. App ID (com.bruin.notes) registered with iCloud capability
#
# Usage:
#   ./scripts/build-appstore.sh                    # Build only
#   ./scripts/build-appstore.sh --submit           # Build + upload to App Store Connect
#   ./scripts/build-appstore.sh --validate         # Build + validate only (no upload)
#   ./scripts/build-appstore.sh --validate --no-build  # Validate existing build (skip Tauri build)
#
# Environment variables (override auto-detection):
#   SIGNING_IDENTITY   - "3rd Party Mac Developer Application: ..."
#   INSTALLER_IDENTITY - "3rd Party Mac Developer Installer: ..."
#   TEAM_ID            - Apple Developer Team ID (10-char alphanumeric)
#   PROVISIONING_PROFILE - Path to .provisionprofile file
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_DIR="$PROJECT_ROOT/src-tauri"
TARGET_DIR="$TAURI_DIR/target/release"

ACTION="${1:-build}"
NO_BUILD="${2:-}"

echo "==> Bruin Mac App Store Build"
echo "    Project: $PROJECT_ROOT"

# --- Detect signing identities ---
if [ -z "${SIGNING_IDENTITY:-}" ]; then
    SIGNING_IDENTITY=$(security find-identity -v -p codesigning | grep "3rd Party Mac Developer Application" | head -1 | sed 's/.*"\(.*\)"/\1/')
    if [ -z "$SIGNING_IDENTITY" ]; then
        echo "ERROR: No '3rd Party Mac Developer Application' certificate found in Keychain."
        echo "       Install it from developer.apple.com > Certificates."
        exit 1
    fi
fi
echo "    App Signing: $SIGNING_IDENTITY"

if [ -z "${INSTALLER_IDENTITY:-}" ]; then
    INSTALLER_IDENTITY=$(security find-identity -v | grep "3rd Party Mac Developer Installer" | head -1 | sed 's/.*"\(.*\)"/\1/')
    if [ -z "$INSTALLER_IDENTITY" ]; then
        echo "ERROR: No '3rd Party Mac Developer Installer' certificate found in Keychain."
        exit 1
    fi
fi
echo "    Pkg Signing:  $INSTALLER_IDENTITY"

# --- Check provisioning profile ---
PROFILE="${PROVISIONING_PROFILE:-$TAURI_DIR/embedded.provisionprofile}"
if [ ! -f "$PROFILE" ]; then
    echo "ERROR: Provisioning profile not found at: $PROFILE"
    echo "       Download from developer.apple.com > Profiles."
    echo "       Create a Mac App Store profile for bundle ID 'com.bruin.notes'."
    exit 1
fi
echo "    Profile:      $PROFILE"

# --- Get version from tauri.conf.json ---
VERSION=$(python3 -c "import json; print(json.load(open('$TAURI_DIR/tauri.conf.json'))['version'])")
echo "    Version:      $VERSION"
echo ""

# --- Step 1: Build the app ---
APP_BUNDLE="$TARGET_DIR/bundle/macos/Bruin.app"

if [ "$NO_BUILD" = "--no-build" ] && [ -d "$APP_BUNDLE" ]; then
    echo "==> Step 1/5: Skipping build (--no-build, using existing app)"
else
    echo "==> Step 1/5: Building Bruin (release)..."
    cd "$PROJECT_ROOT"
    npm run tauri build -- --target universal-apple-darwin 2>&1 | tail -5

    if [ ! -d "$APP_BUNDLE" ]; then
        # Fallback: try architecture-specific path
        APP_BUNDLE=$(find "$TARGET_DIR" -name "Bruin.app" -type d | head -1)
        if [ -z "$APP_BUNDLE" ]; then
            echo "ERROR: Bruin.app not found after build."
            exit 1
        fi
    fi
fi
echo "    App: $APP_BUNDLE"

# --- Step 2: Embed provisioning profile ---
echo "==> Step 2/5: Embedding provisioning profile..."
cp "$PROFILE" "$APP_BUNDLE/Contents/embedded.provisionprofile"

# --- Step 3: Merge Info.plist overrides ---
echo "==> Step 3/5: Applying Info.plist overrides..."
APP_PLIST="$APP_BUNDLE/Contents/Info.plist"
OVERRIDE_PLIST="$TAURI_DIR/Info.plist"

if [ -f "$OVERRIDE_PLIST" ]; then
    /usr/libexec/PlistBuddy -c "Merge $OVERRIDE_PLIST" "$APP_PLIST" 2>/dev/null || true
    echo "    Merged Info.plist overrides"
fi

# --- Step 4: Code sign with entitlements ---
echo "==> Step 4/5: Code signing for App Store..."

ENTITLEMENTS="$TAURI_DIR/Entitlements.plist"
CHILD_ENTITLEMENTS="$TAURI_DIR/Entitlements.child.plist"

# Sign embedded frameworks and helpers first (child entitlements)
find "$APP_BUNDLE/Contents/Frameworks" -name "*.dylib" -o -name "*.framework" 2>/dev/null | while read -r framework; do
    codesign --force --options runtime --sign "$SIGNING_IDENTITY" \
        --entitlements "$CHILD_ENTITLEMENTS" "$framework"
done

# Sign helper apps
find "$APP_BUNDLE" -name "*.app" -path "*/Helpers/*" 2>/dev/null | while read -r helper; do
    codesign --force --options runtime --sign "$SIGNING_IDENTITY" \
        --entitlements "$CHILD_ENTITLEMENTS" "$helper"
done

# Sign the main app bundle
codesign --force --options runtime --sign "$SIGNING_IDENTITY" \
    --entitlements "$ENTITLEMENTS" "$APP_BUNDLE"

echo "    Signed: $APP_BUNDLE"

# Verify signature
codesign --verify --deep --strict "$APP_BUNDLE"
echo "    Signature verified"

# --- Step 5: Create installer .pkg ---
echo "==> Step 5/5: Creating installer package..."
PKG_PATH="$TARGET_DIR/Bruin-${VERSION}-appstore.pkg"

productbuild \
    --component "$APP_BUNDLE" /Applications \
    --sign "$INSTALLER_IDENTITY" \
    "$PKG_PATH"

echo "    Package: $PKG_PATH"
echo ""

# --- Optional: Validate / Submit ---
if [ "$ACTION" = "--validate" ] || [ "$ACTION" = "--submit" ]; then
    echo "==> Validating package with App Store Connect..."
    xcrun altool --validate-app \
        --file "$PKG_PATH" \
        --type macos \
        --apiKey "${APP_STORE_API_KEY:-}" \
        --apiIssuer "${APP_STORE_API_ISSUER:-}" \
        2>&1 || {
            echo ""
            echo "Validation failed. If you haven't set up App Store Connect API keys:"
            echo "  1. Go to App Store Connect > Users and Access > Integrations > App Store Connect API"
            echo "  2. Generate a key and download the .p8 file"
            echo "  3. Set: export APP_STORE_API_KEY=<KeyID>"
            echo "  4. Set: export APP_STORE_API_ISSUER=<IssuerID>"
            echo "  5. Place .p8 at: ~/.private_keys/AuthKey_<KeyID>.p8"
            exit 1
        }
    echo "    Validation passed"
fi

if [ "$ACTION" = "--submit" ]; then
    echo "==> Uploading to App Store Connect..."
    xcrun altool --upload-app \
        --file "$PKG_PATH" \
        --type macos \
        --apiKey "${APP_STORE_API_KEY:-}" \
        --apiIssuer "${APP_STORE_API_ISSUER:-}"
    echo "    Upload complete! Check App Store Connect for review status."
fi

echo ""
echo "==> Done!"
echo ""
echo "Next steps:"
echo "  1. If first time: Register App ID, iCloud Container, and"
echo "     Provisioning Profile at developer.apple.com"
echo "  2. Create the app in App Store Connect (appstoreconnect.apple.com)"
echo "  3. Run:  ./scripts/build-appstore.sh --validate"
echo "  4. Run:  ./scripts/build-appstore.sh --submit"
echo "  5. Fill in App Store metadata (screenshots, description, etc.)"
echo "  6. Submit for App Review"

#!/usr/bin/env bash
# scripts/release.sh — bump version, commit, tag, push → GitHub Actions builds the .dmg
#
# Usage:
#   ./scripts/release.sh 1.2.0
#   ./scripts/release.sh patch   # auto-bump patch: 1.1.0 → 1.1.1
#   ./scripts/release.sh minor   # auto-bump minor: 1.1.0 → 1.2.0
#   ./scripts/release.sh major   # auto-bump major: 1.1.0 → 2.0.0

set -euo pipefail

# ── helpers ──────────────────────────────────────────────────────────────────

current_version() {
  node -p "require('./package.json').version"
}

bump() {
  local version="$1" part="$2"
  IFS='.' read -r major minor patch <<< "$version"
  case "$part" in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "${major}.$((minor + 1)).0" ;;
    patch) echo "${major}.${minor}.$((patch + 1))" ;;
  esac
}

# ── resolve new version ───────────────────────────────────────────────────────

ARG="${1:-}"
if [ -z "$ARG" ]; then
  echo "Usage: $0 <version|patch|minor|major>"
  exit 1
fi

CURRENT=$(current_version)

if [[ "$ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW="$ARG"
elif [[ "$ARG" =~ ^(patch|minor|major)$ ]]; then
  NEW=$(bump "$CURRENT" "$ARG")
else
  echo "Error: argument must be a semver (e.g. 1.2.0) or patch/minor/major"
  exit 1
fi

echo "→ Releasing v${NEW}  (was v${CURRENT})"

# ── guard: ensure working tree is clean ──────────────────────────────────────

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes. Commit or stash first."
  exit 1
fi

# ── bump version in all three files ──────────────────────────────────────────

sed -i '' "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW}\"/" package.json
sed -i '' "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW}\"/" src-tauri/tauri.conf.json
sed -i '' "s/^version = \"${CURRENT}\"/version = \"${NEW}\"/" src-tauri/Cargo.toml

# Regenerate Cargo.lock version entry
(cd src-tauri && cargo generate-lockfile 2>/dev/null || true)

# ── prepend changelog entry ───────────────────────────────────────────────────

DATE=$(date +%Y-%m-%d)

# Insert new entry before the first ## section (macOS-safe, no awk multiline)
python3 - <<PYEOF
import re, sys

entry = "## [${NEW}] - ${DATE}\n\n### Changed\n- Version bump to ${NEW}\n\n"

with open("CHANGELOG.md", "r") as f:
    content = f.read()

# Insert before the first '## [' heading
content = re.sub(r'(^## \[)', entry + r'\1', content, count=1, flags=re.MULTILINE)

with open("CHANGELOG.md", "w") as f:
    f.write(content)
PYEOF

echo "→ Updated CHANGELOG.md, package.json, Cargo.toml, tauri.conf.json"

# ── commit, tag, push ─────────────────────────────────────────────────────────

git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock CHANGELOG.md

git commit -m "chore: release v${NEW}"

git tag "v${NEW}"

git push origin master --tags

echo ""
echo "✓ Tagged v${NEW} and pushed — GitHub Actions is now building the .dmg"
echo "  https://github.com/sawzhang/bruin/actions"

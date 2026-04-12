---
name: appstore-publish
version: 1.0.0
description: |
  Build, sign, and submit Bruin to the Mac App Store via the Shanghai Mac CI/CD machine.
  Use when asked to "publish to app store", "submit to app store", "发布到 App Store",
  "上架", "appstore build", or "appstore submit".
allowed-tools:
  - Bash
  - Read
  - Grep
  - AskUserQuestion
---

# App Store Publish Skill

## Overview

Bruin is published to the Mac App Store from the Shanghai Mac (`shanghai` via Tailscale).
This skill automates the full flow: pull code → build → sign → validate → submit.

## Prerequisites

The Shanghai Mac must have:
- Tailscale connected (hostname: `shanghai`)
- Apple Developer certificates in Keychain:
  - `3rd Party Mac Developer Application: Sawyer Zhang (38X4ERLVVR)`
  - `3rd Party Mac Developer Installer: Sawyer Zhang (38X4ERLVVR)`
- Provisioning profile at `~/code/bruin/src-tauri/embedded.provisionprofile`
- App Store Connect API key at `~/.private_keys/AuthKey_HTZJAKTQ4F.p8`

## Execution Steps

### Step 1: Verify Shanghai Mac is reachable

```bash
tailscale status | grep shanghai
```

If offline, ask the user to power on the Shanghai Mac.

### Step 2: Pull latest code

```bash
ssh shanghai "cd ~/code/bruin && git pull origin master 2>&1"
```

If there are local changes, stash first:
```bash
ssh shanghai "cd ~/code/bruin && git stash && git pull origin master 2>&1"
```

### Step 3: Install frontend dependencies

```bash
ssh shanghai "cd ~/code/bruin && npm ci 2>&1 | tail -3"
```

### Step 4: Unlock Keychain (required for code signing over SSH)

Ask the user for the macOS login password, then:
```bash
ssh shanghai "security unlock-keychain -p '<password>' ~/Library/Keychains/login.keychain-db"
```

### Step 5: Build, sign, validate, and submit

Full build + submit (takes ~5-10 minutes):
```bash
ssh shanghai "cd ~/code/bruin && export APP_STORE_API_KEY=HTZJAKTQ4F && export APP_STORE_API_ISSUER=ca8ef690-5c6a-4a90-b0f4-d64ba2ac7991 && bash scripts/build-appstore.sh --submit 2>&1"
```

If the app was already built and you just need to re-sign and submit:
```bash
ssh shanghai "cd ~/code/bruin && export APP_STORE_API_KEY=HTZJAKTQ4F && export APP_STORE_API_ISSUER=ca8ef690-5c6a-4a90-b0f4-d64ba2ac7991 && bash scripts/build-appstore.sh --submit --no-build 2>&1"
```

### Step 6: Verify upload

Check the output for `UPLOAD SUCCEEDED`. The build will appear in App Store Connect within a few minutes.

### Step 7: Report to user

Tell the user:
- Upload status (success/fail)
- Version and build number
- Next steps: go to App Store Connect to add release notes and submit for review

## Troubleshooting

| Error | Fix |
|-------|-----|
| `errSecInternalComponent` | Keychain not unlocked. Run Step 4. |
| `failed to run bundle_dmg.sh` | DMG creation fails over SSH (no GUI). The .app is still built. Use `--no-build` to skip and continue with signing. |
| `Duplicate Entry Was Skipped` | Normal — Info.plist merge warnings, safe to ignore. |
| `git pull` conflicts | Run `git stash && git pull origin master` |
| SSH timeout | Check Tailscale: `tailscale status | grep shanghai` |

## Environment Reference

- **SSH host**: `shanghai` (Tailscale)
- **Code path**: `~/code/bruin`
- **Cargo target**: `/Volumes/HIKSEMI/code/bruin/src-tauri/target/`
- **Build script**: `scripts/build-appstore.sh`
- **Team ID**: `38X4ERLVVR`
- **Bundle ID**: `com.bruin.notes`

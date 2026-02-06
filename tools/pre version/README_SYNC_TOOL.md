# Kenpo Flashcards Web Server → Packaged Sync Tool

Safely syncs updates from `KenpoFlashcardsWebServer` to `KenpoFlashcardsWebServer_Packaged` with **automatic documentation updates**.

## Setup

Place this tool in a `tools` folder alongside your project folders:

```
📁 Your Projects Folder
├── 📁 KenpoFlashcardsWebServer          ← Source
├── 📁 KenpoFlashcardsWebServer_Packaged ← Base destination (Packaging truth)
├── 📁 KenpoFlashcardsWebServer_Packaged_Synced ← Output (DEFAULT)
├── 📁 tools                              ← This tool goes here
│   ├── sync_webserver.bat
│   ├── sync_webserver_to_packaged.py
│   ├── README_SYNC_TOOL.md
│   └── 📁 sync_backups                   ← Backups stored here
```

## Features

- **Smart Defaults**: Automatically finds sibling project folders
- **Version Bump Prompt**: Choose patch (1), minor (2), or major (3) upgrade
- **Docs Update**: Automatically updates `README.md` and `CHANGELOG.md`
- **Safe Backups**: Creates timestamped backups in `tools/sync_backups/`
- **Dry-Run Mode**: Preview all changes without applying them
- **Post-Sync Auto-Patch**: Forces AppData-safe DATA_DIR/LOG_DIR for installed EXE
- **Hard-Fail Regression Scanner**: Stops if any known-bad pathing is detected
- **Synced Output Folder**: Writes to `KenpoFlashcardsWebServer_Packaged_Synced` by default

## Usage

### Just Double-Click (Uses Defaults)

```batch
sync_webserver.bat
```

This automatically syncs from `..\KenpoFlashcardsWebServer` into `..\KenpoFlashcardsWebServer_Packaged_Synced` (leaving `KenpoFlashcardsWebServer_Packaged` untouched)

### Preview Changes First

```batch
sync_webserver.bat --dry-run
```

### Custom Paths

```batch
sync_webserver.bat C:\Projects\WebServer C:\Projects\Packaged
```

### Python Direct

```bash
python sync_webserver_to_packaged.py ..\KenpoFlashcardsWebServer ..\KenpoFlashcardsWebServer_Packaged
```

## Output Modes

- **Default (recommended):** `--output synced` → writes to `KenpoFlashcardsWebServer_Packaged_Synced`
- **In-place:** `--output inplace` → modifies the destination Packaged folder directly

Examples:

```batch
sync_webserver.bat --synced
sync_webserver.bat --inplace
```

## Upgrade Levels

When you run the tool, it will prompt you to select an upgrade level:

| Level | Type | Description | Example |
|-------|------|-------------|---------|
| **1** | Patch | Bug fixes, minor tweaks | v1.3.0 → v1.3.1 |
| **2** | Minor | New features, improvements | v1.3.0 → v1.4.0 |
| **3** | Major | Breaking changes, major features | v1.3.0 → v2.0.0 |

The build number always increments by 1.

## What Gets Synced

### ✅ Synced (Updated from Web Server)

| Item | Description |
|------|-------------|
| `app.py` | Core Flask application |
| `static/` | All UI files (HTML, CSS, JS) |
| `data/` | JSON data files (merged, not replaced) |
| `requirements.txt` | Python dependencies |
| `LICENSE` | License file |
| `BRANDING_NOTE.md` | Branding notes |
| `ic_launcher.png` | App icon |

### 📝 AI-Updated (Generated Based on Changes)

| File | What Gets Updated |
|------|-------------------|
| `README.md` | Version numbers + new "What's new" section |
| `CHANGELOG.md` | New version entry with features from web server |
| `version.json` | All version fields and sync timestamp |
| `Version-WebServerPackaged-*.txt` | Renamed to new version |

### ⏭️ Protected (Never Touched)

| Item | Reason |
|------|--------|
| `packaging/` | PyInstaller specs, Inno Setup, batch files |
| `windows_service/` | Windows service files |
| `windows_tray/` | Tray launcher files |
| `tools/` | This sync tool itself |
| `KenpoFlashcardsTrayLauncher.py` | Tray launcher script |
| `server_config.json` | User configuration |
| `INSTALL_WINDOWS.md` | Packaged-specific docs |
| `*.lnk` | Windows shortcuts |


## Example Session

```
============================================================
  KenpoFlashcards Web Server → Packaged Sync Tool
  (with AI Documentation Update)
============================================================

[12:30:15] ℹ️ Web Server: v7.0.1 (build 34)
[12:30:15] ℹ️ Packaged: v1.3.0 (build 8) [bundled WS v6.1.0]

============================================================
  SELECT UPGRADE LEVEL
============================================================

  1 = Low (Patch)    - Bug fixes, minor tweaks       → x.y.Z+1
  2 = Medium (Minor) - New features, improvements    → x.Y+1.0
  3 = High (Major)   - Breaking changes, major features → X+1.0.0

  Enter upgrade level (1/2/3): 2

  Selected: Minor upgrade

[12:30:18] ℹ️ New packaged version: v1.4.0 (build 9)
[12:30:18] ℹ️ Found 2 web server version(s) to include

[12:30:18] ℹ️ Creating backup...
[12:30:18] ✅ Created backup at: .sync_backups/20260123_123018

[12:30:18] ℹ️ Syncing files...
[12:30:18] ✅ Synced: app.py
[12:30:18] ✅ Synced: requirements.txt
...

[12:30:19] ℹ️ Updating documentation (AI-assisted)...
[12:30:19] ✅ Updated CHANGELOG.md
[12:30:19] ✅ Updated README.md
[12:30:19] ✅ Updated version.json
[12:30:19] ✅ Created Version-WebServerPackaged-v1.4.0 v9.txt

============================================================
  SYNC COMPLETE
============================================================

  ✅ Sync complete!
  📦 New version: v1.4.0 (build 9)
  🌐 Bundled web server: v7.0.1 (build 34)
  📁 Backup: .sync_backups/20260123_123018

  Next steps:
    1. Review README.md and CHANGELOG.md
    2. Test the packaged project
    3. Run packaging/build_exe.bat
    4. Run packaging/build_installer_inno.bat
```

## How the AI Updates Work

### CHANGELOG.md

The tool:
1. Reads the web server's `CHANGELOG.md`
2. Extracts all version entries newer than your last sync
3. Generates a new packaged version entry summarizing the web server changes
4. Inserts it at the top of your `CHANGELOG.md`

### README.md

The tool:
1. Updates the version numbers at the top
2. Generates a new "What's new in vX.Y.Z" section
3. Inserts it before the existing "What's new" sections
4. Preserves all other content

### version.json

All fields are updated:
- `version`: New packaged version
- `build`: Incremented build number
- `webserver_version`: Bundled web server version
- `webserver_build`: Bundled web server build
- `last_sync`: Timestamp of this sync

## Troubleshooting

### "Python not found"
Install Python 3.8+ and ensure it's in your PATH.

### Sync fails with errors
1. Check the backup folder for your original files
2. Manually restore from backup if needed
3. Review the error message for specific issues

### Documentation looks wrong
The tool generates documentation based on patterns in the web server's CHANGELOG. You may need to manually edit:
- `README.md` - Tweak the "What's new" section wording
- `CHANGELOG.md` - Add or remove bullet points

Always review the generated docs before committing!


## Safety rules (what will NOT be touched)

- `KenpoFlashcardsWebServer_Packaged/packaging/`, `windows_tray/`, `windows_service/`, `service/` are never overwritten.
- `static/res/webappservericons/**` is preserved (Windows EXE/tray/installer icons).
- `static/res/decklogos/user/**` is preserved (user-uploaded deck logos).
- `Version-WebServerPackaged-*.txt` is **renamed only** when bumping version; contents are preserved.


## Output modes

By default the tool syncs **in place** into your Packaged folder.

- `--output inplace` (default)
- `--output synced` to create a sibling folder named `<Packaged>-synced` and write results there

Short flags:
- `--synced`
- `--inplace`

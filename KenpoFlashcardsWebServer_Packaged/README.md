# 🧰 Advanced Flashcards WebApp Server (Packaged)

> This is the **Windows packaged/installer** project for the Advanced Flashcards WebApp Server inside the `sidscri-apps` monorepo.  
> Repo root: `../README.md`

This project produces a **Program Files-installed** server + tray launcher while keeping all writable runtime data in **LOCALAPPDATA**.

**Current Version:** v5.0.1 (build 16)  
**Bundled Web Server:** v8.2.0 (build 50)  
**Changelog:** [CHANGELOG.md](CHANGELOG.md)

---

## 🎯 What It Does

- **Windows packaged distribution** of the Advanced Flashcards WebApp Web Server (installer + EXE build pipeline).
- **Tray launcher** for starting/stopping the server and managing startup behavior.
- **Service / wrapper support** (where configured) for “run at boot” server hosting.
- **Per-user AppData runtime** for anything that must be writable:
  - `data/` (user decks, runtime state, seeded defaults)
  - `logs/` (server + tray logs)
  - `launcher_settings.json`, `server_config.json` (when present)
- **Safe sync pipeline** (WebServer → Packaged) designed to prevent regressions:
  - outputs to `KenpoFlashcardsWebServer_Packaged_Synced`
  - regression scanner + auto-patch to enforce AppData-safe paths
- **One-click build scripts** to generate the EXE/installer with predictable outputs.
- **Upgrade Tool** to migrate/update packaged installs while preserving user data (where applicable).

---

## 📋 Version History

| Version | Build | Key Changes |
|---------|-------|-------------|
| **5.0.1** | 16 | Packaging build reliability on Python 3.8 by pinning build tooling to compatible versions:, pip==24.0, startup issues (indent error) and ensured runtime is bundled/available for tray + service installs |
| **5.0.0** | 15 | Synced Packaged with the latest WebServer feature set to produce the first “hybrid truth” release for EXE distribution., Updated bundled Web Server to v8.2.0 (build 50). |
| **4.1.2** | 14 | Runtime path module (runtime/app_paths.py) to centralize writable DATA_DIR / LOG_DIR behavior., Hard-fail regression scanner after sync/build to prevent _internal\logs / Program Files write regressions. |
| **4.1.0.1** | 14 | Enforced single-instance startup for the tray/server to prevent multiple AdvancedFlashcardsWebAppServer.exe processes (double-click, autostart/service + tray, etc.)., Updated bundled Web Server to v8.1.0 (build 48) (from v8.0.2 build 47), including: |
| **4.0.0** | 12 | Updated bundled Web Server to v8.0.2 (build 47) (from v7.2.0 build 42), including:, Admin per-user sharing controls |
| **3.1.0** | 11 | Rebranded the packaged app and installer to Advanced Flashcards WebApp Server (no more “Kenpo Flashcards”)., Runtime data moved out of Program Files; the app now uses: |
| **3.0.0** | 10 | Updated bundled Web Server to v7.2.0 (build 42) (from v7.0.2 build 35), including:, Custom Set Management Modal |
| **2.0.0** | 9 | Updated bundled Web Server to v7.0.2 (build 35) (from v6.1.0 build 32), including:, 🎲 Pick Random N |
| **1.3.0** | 8 | Upgrade Tool (tools/ folder) — Python script and batch file to safely sync web server updates to the packaged project:, Syncs app.py, static/, requirements.txt, CHANGELOG.md from web server |
| **1.2.0** | 7 | Updated bundled Web Server to v6.0.0 (build 31) (from v5.5.2 build 29), including:, Custom Set (⭐ Starred Cards) — star/unstar cards and study a personalized set (All/Unsure/Learned filters) |
| **1.1.1** | 6 | Configurable host/port binding via server_config.json:, host: Set to "0.0.0.0" (all IPv4 interfaces), "::" (all interfaces including IPv6), "127.0.0.1" (localhost only), or a specific IP like "192.168.0.129" for Tailscale/LAN access |
| **1.1.0** | 5 | Bundled data not loading — Added initial data seeding that copies profiles, progress, API keys, breakdowns, and helper data from the bundled _internal\data folder to %LOCALAPPDATA%\Advanced Flashcards WebApp Server\data\ on first run. This ensures user accounts and progress from the dev build are available in the installed app. |
| **1.0.1** | 4 | pre_build.bat — New script that copies data from dev location before building:, Copies from C:\Users\Sidscri\Documents\GitHub\sidscri-apps\StudyFlashcardsWebServer\data |
| **1.0.0** | 3 | Updated bundled web server to v5.5.2 (build 29), bringing in:, AI Access UI for API key management and model selection. |
| **beta** | 2 | Packaging script fixes and documentation updates. |
| **beta** | 1 | Initial packaged beta release (PyInstaller + Inno Setup build scripts)., Installer Scheduled Task option now uses /RL HIGHEST and a 30-second start delay to improve reliability. |

---

## 🚀 Quick Start

## Install (recommended)

1. On the target PC, run the installer:
   - `AdvancedFlashcardsWebAppServer-<AppVersion>.exe`
2. If Windows SmartScreen prompts:
   - Click **More info** → **Run anyway** (expected for unsigned installers).
3. After install, use:
   - **Start Menu → Advanced Flashcards WebApp Server** → **Advanced Flashcards WebApp Server** (Tray Launcher)

---

## 📁 Data, Logs, and Config Locations

## Where your data is stored

The web server stores user data (accounts, progress, breakdowns) in:

```
%LOCALAPPDATA%\Advanced Flashcards WebApp Server\data\
```

This is typically `C:\Users\<YourName>\AppData\Local\Advanced Flashcards WebApp Server\data\`.

The bundled data in `Program Files` serves as the initial/default data on first run.

> **Important:** When installed under `C:\Program Files`, the packaged app must **not** write inside the install directory.  
> All writes must go to `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\...` to avoid permission errors.

---

## 🧩 Configuration

## Configuration

On first run, a config file is created at:

```
%LOCALAPPDATA%\Advanced Flashcards WebApp Server\server_config.json
```

   Build logs: `packaging\logs\build_exe_YYYYMMDD_HHMMSS.log`

Edit this file to configure your server (or right-click the tray icon → "Edit Settings"):

```json
{
  "host": "0.0.0.0",
  "port": 8009,
  "open_browser": true,
  "browser_url": "http://localhost:8009"
}
```

### Configuration options

| Setting | Description | Examples |
|---------|-------------|----------|
| `host` | IP address to bind to | `"0.0.0.0"` (all IPv4), `"::"` (all incl. IPv6), `"127.0.0.1"` (localhost only), `"192.168.0.129"` (specific IP) |
| `port` | Port number | `8009` (default) |
| `open_browser` | Auto-open browser on startup | `true` / `false` |
| `browser_url` | URL to open in browser | `"http://localhost:8009"`, `"http://192.168.0.129:8009"` |

### Common configurations

**Localhost only (default before v1.1.1):**
```json
{ "host": "127.0.0.1", "port": 8009, "browser_url": "http://localhost:8009" }
```

**LAN access (current default):**
```json
{ "host": "0.0.0.0", "port": 8009, "browser_url": "http://localhost:8009" }
```

**Tailscale access:**
```json
{ "host": "0.0.0.0", "port": 8009, "browser_url": "http://YOUR-TAILSCALE-IP:8009" }
```

After editing, restart the tray app for changes to take effect.

---

## 🧰 Upgrade Tool

## Upgrade Tool

The packaged project now includes an upgrade tool in the `tools/` folder that safely syncs updates from the main StudyFlashcardsWebServer project.

### Usage

```batch
cd tools
upgrade_webserver.bat ..\path\to\StudyFlashcardsWebServer-v6_2_0.zip
```

Or with Python directly:

```bash
python tools/upgrade_webserver_to_packaged.py webserver.zip ./
```

### What it does

| Category | Items | Action |
|----------|-------|--------|
| **✅ Synced** | `app.py`, `static/`, `requirements.txt`, `CHANGELOG.md` | Updated from web server |
| **🔀 Merged** | `data/` folder | User data preserved, structure updated |
| **⏭️ Protected** | `packaging/`, `windows_service/`, `windows_tray/`, `server_config.json`, icons, shortcuts | Never touched |

The tool creates automatic backups in `.sync_backups/` before making changes.

---

## ▶️ Run / Use

## Run / Use

1. Start the Tray Launcher.
2. In the tray icon menu, click **Open Web App** (or open your browser and go to the local address shown by the tray app).

---

## 🛡 Antivirus / Defender notes

## Antivirus / Defender notes (PyInstaller false positives)

PyInstaller-built executables are sometimes flagged as "PUA" or suspicious, especially when unsigned.

If Defender quarantines files:

- Prefer building/installing from a non-system drive (e.g., `M:`) if your environment behaves better there.
- For production distribution, code-signing the installer/EXE reduces false positives.

---

## 🛠 Build the installer yourself (from source)

## Build the installer yourself (from source)

From the project root:

1. **Run pre-build data sync** (copies data from dev location if available):
   ```
   packaging\1. pre_build.bat
   ```

2. **Build the PyInstaller EXE (shows live progress; closes on success, pauses on failure):**
   ```
   packaging\2. build_exe.bat
   ```

3. **Build the installer:**
   ```
   packaging\3. build_installer_inno.bat
   ```

### Data sources (1. pre_build.bat)

The pre-build script stages data in this order:

1. **LOCALAPPDATA user data (preferred):**
   `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\data\`
   - If present, it is staged into `packaging\build_data\` (and flagged as sourced from LOCALAPPDATA)
2. **Fallback (fresh install behavior):**
   Uses the project’s existing `root\data\` folder when LOCALAPPDATA data does not exist.

When `packaging\build_data\` is present and flagged, the build process uses it as the data source; otherwise it defaults to `root\data\`.

### Build output

- Installer: `packaging\output\AdvancedFlashcardsWebAppServer-<AppVersion>.exe`
- EXE folder: `dist\AdvancedFlashcardsWebAppServer\`

### Build tooling pins (Python 3.8)

Packaged builds currently run under **Python 3.8**, so the one-click build must pin build tooling to avoid pulling Python ≥3.9-only releases:

- `pip==24.0`
- `setuptools==70.3.0`
- `wheel==0.44.0`

The pip install step should also include:
- `--progress-bar on`
- `--default-timeout 120`
- `--retries 10`

---

## 🗑 Uninstall

## Uninstall

Use:

- **Windows Settings → Apps → Installed apps → Advanced Flashcards WebApp Server → Uninstall**

(If you want to preserve your progress, back up the `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\data\` folder before uninstalling.)

---

## 🔁 Startup

## Startup

**Tip:** Choose the startup option that matches your package variant (Service/WinSW vs Task Scheduler).

---

## 📜 Detailed Release Notes

The section below mirrors `CHANGELOG.md` so the README includes the full history (including beta).

# Changelog — Advanced Flashcards WebApp Server (Packaged)

All notable changes to the Windows packaged/installer distribution are documented here.

## v5.0.1 (build 16) — 2026-01-30

### Fixed
- **Packaging build reliability on Python 3.8** by pinning build tooling to compatible versions:
  - `pip==24.0`
  - `setuptools==70.3.0`
  - `wheel==0.44.0`

### Changed
- One-click EXE build now installs packaging requirements with clearer progress + resiliency:
  - `--progress-bar on`
  - `--default-timeout 120`
  - `--retries 10`
- Documentation corrected to reflect **v5.0.1** (previous internal references to “v5.1.0” were the same release and should be treated as **v5.0.1**).


## v5.0.0 (build 15) — 2026-01-30

### Changed
- Synced **Packaged** with the latest WebServer feature set to produce the first “hybrid truth” release for EXE distribution.
- Updated bundled Web Server to **v8.2.0 (build 50)**.

### Fixed
- Ensured packaged runtime remains **AppData-write-safe** (no writes under `Program Files`).


## v4.1.2 (build 14) — 2026-01-30

This release hardens the packaging/sync pipeline so future WebServer syncs cannot reintroduce `Program Files` write paths.

### Added
- **Runtime path module** (`runtime/app_paths.py`) to centralize writable `DATA_DIR` / `LOG_DIR` behavior.
- **Hard-fail regression scanner** after sync/build to prevent `_internal\logs` / `Program Files` write regressions.
- **Post-sync auto-patch step** to enforce AppData-safe paths in the synced output even if upstream files change.
- **Synced output folder**: `KenpoFlashcardsWebServer_Packaged_Synced` to keep Packaging truth clean.

### Fixed
- Permission errors when installed under `C:\Program Files\Advanced Flashcards WebApp Server` by routing all writes to:
  - `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\data`
  - `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\logs`

## v4.1.0.1 (build 14) — 2026-01-29

### Fixes
- Enforced **single-instance** startup for the tray/server to prevent multiple `AdvancedFlashcardsWebAppServer.exe` processes (double-click, autostart/service + tray, etc.).

### Changed
- **Updated bundled Web Server to v8.1.0 (build 48)** (from v8.0.2 build 47), including:
  - **Added GEN8 Token Admin Namespace for Android
-**
  - **Invite code redemption**
  - **Docs updates**
  - **Admin per-user sharing controls**

## v4.0.0 (build 12) — 2026-01-28

### Changed
- **Updated bundled Web Server to v8.0.2 (build 47)** (from v7.2.0 build 42), including:
  - **Admin per-user sharing controls**
  - **Deck icons in “Switch Study Subject”**
  - **Major rebrand**
  - **WebApp icons**
  - **Deck logos (optional)**
  - Updated user-facing text from “Kenpo Flashcards” → “Advanced Flashcards WebApp” across the Web UI (while keeping the main Study page header line `Study Flashcards • {Deck} • Cards loaded: {#}` unchanged).
  - **Deck Access Management System**
  - **Admin Dashboard - Decks Tab**
  - **Deck Access Types Displayed**
  - **Clear Default Deck**
  - **Invite Code Redemption**
  - `_load_decks()` now respects user access permissions
  - Deck list shows access type badges
  - Admin stats use `include_all=True` to see all decks
  - Fixed modal size (700px width, 500px min-height) - no more resizing between tabs
  - Split-pane Manage Cards tab: "In Custom Set" on left, "Available Cards" on right

## v3.1.0 (build 11) — 2026-01-25

This release was completed in steps. Documentation stays on **v3.1.0 (build 11)** while the step work is in progress.

### Step 1 — Rebrand + move runtime data (v3.1.0.1 + v3.1.0.2)

#### Changed
- Rebranded the packaged app and installer to **Advanced Flashcards WebApp Server** (no more “Kenpo Flashcards”).
- Runtime data moved out of Program Files; the app now uses:  
  `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\data`

#### Added
- Tray executable naming updated to match branding: `AdvancedFlashcardsWebAppServer.exe`
- Installer output naming updated to include version: `AdvancedFlashcardsWebAppServer-<AppVersion>.exe`

#### Fixed
- Ensured the packaged build consistently points at the per-user LOCALAPPDATA data location (seeded from bundled data on first run).

### Step 2 — Builder stages LOCALAPPDATA data (v3.1.0.3)

#### Added
- `packaging\1. pre_build.bat`: if local user data exists at  
  `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\data`, stage it into `packaging\build_data` (otherwise treat as fresh install).
- Repo + local logs added for data staging and build decisions.

### Step 3 — Build-data flag + seed next package (v3.1.0.4)

#### Added
- Adds a flag in `packaging\build_data` to indicate it was sourced from LOCALAPPDATA.

#### Changed
- After a successful build, `root\data` is backed up then replaced from flagged `packaging\build_data` so the next package includes the newest data for new installs.
- Local log location moved to:  
  `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\log\Advanced Flashcards WebApp Server logs\`

### Step 4 — Update behavior + backups + startup options (v3.1.0.5)

#### Changed
- Updates prefer **existing local data**; packaged data only seeds missing files (and only safe reference files may be overwritten if packaged is newer).

#### Added
- Backups:
  - Update backups: `...\DataBackups\Data_Updated_<Date>_<AppVersion>\data.zip`
  - Auto backups (on change + interval): `...\DataBackups\Data_Auto_<Date>_<AppVersion>\data.zip` (keep last 10)
  - On-demand backup (tray): `Backup Now`
- Startup options (tray + installer tasks):
  - Start service + tray with Windows (HKCU Run + sets service to Automatic when installed) **default ON**

#### Fixed
- `packaging\2. build_exe.bat`: shows **live pip + PyInstaller progress** and **pauses on failure** so you can read errors; on **success it closes automatically**.
  - Build logs are saved to `packaging\logs\build_exe_YYYYMMDD_HHMMSS.log`.
  - Also avoids the `ENSURE_VENV` missing-label failure by using a label-free flow.
- Reduced console-window flicker when starting/restarting by running service-control commands hidden.
- Tray restart is now a **true restart** (relaunches the tray app so the web server is restarted).
- Added restart choices: **Restart server**, **Restart Windows Service only** (if installed), or **Restart server + service**.


### Step 5 — Windows icon remap + kenpo_words mapping (v3.1.0.6)

#### Changed
- Created/used a dedicated icon folder: `static\res\webappservericons\`.
- Updated PyInstaller specs and Inno Setup installer to use the new **Advanced Flashcards WebApp Server** icon for:
  - EXE icon (Windows shell / Apps & Features icon comes from EXE)
  - Installer icon
  - Tray icon
- Replaced the tray runtime icon (`windows_tray\icon.png`) to match.

#### Removed
- Removed legacy Kenpo icon assets previously used by the EXE build (`Kenpo_Vocabulary_Study_Flashcards.ico`, `ic_launcher.png`).

#### Fixed
- `packaging\2. build_exe.bat`: no longer references the Android project assets path for `kenpo_words.json`. The build now requires `data\kenpo_words.json` to be present.


### Package variant
- WinSW Windows Service wrapper (advanced)

## v3.0.0 (build 10) — 2026-01-25

### Changed
- **Updated bundled Web Server to v7.2.0 (build 42)** (from v7.0.2 build 35), including:
  - **Custom Set Management Modal**
  - **Settings Tab**
  - **Manage Tab**
  - **Saved Sets Tab**
  - **Server Activity Logs**
  - **Settings Save Prompt**
  - Moved random cards picker from Custom toggle bar to Custom Set Settings modal
  - Settings inputs now track dirty state for save prompt
  - **Web Sync Endpoints**
  - **Breakdown Indicator**
  - **Breakdown IDs API**
  - **Enhanced User Stats**
  - **Deck Stats**
  - Tabbed interface: Overview, Users, System, Logs
  - Removed About/User Guide links (accessible from main app)
  - Android app can now sync decks and user cards with web server
  - Full cross-platform deck and card sharing
  - **Rebranded to "Advanced Flashcards WebApp Server"**
  - **Header shows active deck**
  - **Set Default Deck**
  - **API endpoint**
  - **🤖 AI Deck Generator**
  - **Keywords**
  - **Photo**
  - **Document**
  - **Edit Deck**
  - **Logout confirmation**
  - **AI Deck Generator**
  - **User cards in study deck**
  - Reshuffle button now works anytime (not just when random is enabled)

## v2.0.0 (build 9) — 2026-01-23

### Changed
- **Updated bundled Web Server to v7.0.2 (build 35)** (from v6.1.0 build 32), including:
  - **🎲 Pick Random N**
  - **User Management Modal**
  - **Admin User Editing**
  - **Password Reset**
  - **System Status Feed**
  - **Reshuffle button visible**
  - **Search clear X button**
  - **Randomize Custom Set setting**
  - **Speak pronunciation only toggle**
  - Reshuffle works regardless of random toggle state (instant shuffle on demand)
  - **Edit Decks page**
  - **Switch tab**
  - **Add Cards tab**
  - **Deleted tab**
  - **Deck management**
  - **User cards CRUD**
  - Settings page now has "Edit Decks" button at top for quick access

## v1.3.0 (build 8) — 2026-01-23

### Added
- **Upgrade Tool** (`tools/` folder) — Python script and batch file to safely sync web server updates to the packaged project:
  - Syncs `app.py`, `static/`, `requirements.txt`, `CHANGELOG.md` from web server
  - Merges `data/` folder (preserves user data, updates structure)
  - Protects packaging files (`packaging/`, `windows_service/`, `windows_tray/`, icons, shortcuts)
  - Creates automatic backups in `.sync_backups/` before making changes
  - Supports dry-run mode to preview changes
  - Updates `version.json` with web server version tracking

### Changed
- **Updated bundled Web Server to v6.1.0 (build 32)** (from v6.0.0 build 31), including:
  - **Sync Progress page** — new settings section matching Android app with Push/Pull buttons, login status banner, auto-sync info, and breakdown sync
  - **Settings tabbed navigation** — quick nav tabs (📚 Study, 🎨 Display, 🔊 Voice, 🔄 Sync, 🤖 AI) with highlighted active tab
  - **Star button on study cards** — toggle ☆/★ directly from study view to add/remove from Custom Set
  - **Sort by status dropdown** — All list can now be sorted by Unlearned first, Unsure first, Learned first, or Alphabetical
  - **Logout moved to user menu** — click User dropdown to see logout option with icon
  - **App-like button styling** — gradient backgrounds matching Android app (blue primary, green success, red danger)
  - **Settings redesign** — card-based layout with modern styling

## v1.2.0 (build 7) — 2026-01-22

### Changed
- **Updated bundled Web Server to v6.0.0 (build 31)** (from v5.5.2 build 29), including:
  - **Custom Set (⭐ Starred Cards)** — star/unstar cards and study a personalized set (All/Unsure/Learned filters)
  - **New study settings**: `show_breakdown_on_definition`, `auto_speak_on_card_change`, `speak_definition_on_flip`
  - **Admin Dashboard redesign** with richer statistics + AI status indicators
  - **New API endpoint**: `/api/admin/stats`
  - **Sync improvements**: per-card `updated_at` timestamps and newer-wins merge logic (better offline sync)

## v1.1.1 (build 6) — 2026-01-22

### Added
- **Configurable host/port binding** via `server_config.json`:
  - `host`: Set to `"0.0.0.0"` (all IPv4 interfaces), `"::"` (all interfaces including IPv6), `"127.0.0.1"` (localhost only), or a specific IP like `"192.168.0.129"` for Tailscale/LAN access
  - `port`: Default 8009, change if needed
  - `browser_url`: The URL opened in your browser (e.g., `"http://192.168.0.129:8009"` for remote access)
  - `open_browser`: Set to `false` to disable auto-opening browser on startup
- **System tray menu additions**:
  - "Server Info" - Shows current host, port, and config file location
  - "Edit Settings" - Opens `server_config.json` in your default editor
  - "Open Data Folder" - Opens the Advanced Flashcards WebApp Server data folder
- Config file is auto-created in `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\server_config.json` on first run

### Changed
- Default host binding changed from `127.0.0.1` to `0.0.0.0` for easier LAN/Tailscale access
- Tray icon tooltip now shows current host:port binding
- Updated tray icon image

## v1.1.0 (build 5) — 2026-01-22

### Fixed
- **Bundled data not loading** — Added initial data seeding that copies profiles, progress, API keys, breakdowns, and helper data from the bundled `_internal\data` folder to `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\data\` on first run. This ensures user accounts and progress from the dev build are available in the installed app.

## v1.0.1 (build 4) — 2026-01-22

### Added
- **`pre_build.bat`** — New script that copies data from dev location before building:
  - Copies from `C:\Users\Sidscri\Documents\GitHub\sidscri-apps\StudyFlashcardsWebServer\data`
  - Copies `kenpo_words.json` from Android project assets
  - Creates `build_data\` folder for build process to use
- **Spec file data priority** — Build now checks `build_data\` first, falls back to `data\`

### Fixed
- **`ModuleNotFoundError: No module named 'jaraco'`** — Added explicit jaraco dependencies to requirements and comprehensive hidden imports to spec file
- **`NameError: name 'APP_DIR' is not defined`** — Removed duplicate APP_DIR definition that was overwriting the PyInstaller-aware one
- **Version showing "unknown (build unknown)"** — Fixed VERSION_FILE path to use APP_DIR instead of app.root_path
- **Static files not loading** — Fixed Flask static_folder to use explicit APP_DIR path
- **kenpo_words.json not found** — Now properly bundled from build_data or data folder

### Changed
- `app.py` — Improved PyInstaller frozen state detection and path resolution
- `StudyFlashcardsTrayLauncher.py` — Better BASE_DIR detection, sets KENPO_WEBAPP_BASE_DIR before importing app
- `kenpo_tray.spec` — Added version.json bundling, improved hidden imports for jaraco ecosystem
- `requirements_packaging.txt` — Added explicit jaraco.* dependencies

## v1.0.0 (build 3) — 2026-01-20

First stable installer release (graduating from the vbeta line).

### Added
- Updated bundled web server to **v5.5.2 (build 29)**, bringing in:
  - AI Access UI for API key management and model selection.
  - Encrypted API key storage (`data/api_keys.enc`).
  - Shared Key Mode (optional one-key-for-all-authenticated-users).
  - Improved Sync merge logic using `updated_at`, better handling of queued/offline updates.
  - Admin pages (About/Admin/User Guide) and PDF generation.
- Inno Setup installer installs the complete PyInstaller folder build (includes `_internal\` and dependencies) into **Program Files** and adds Start Menu shortcuts.

### Changed
- The installer now copies the full PyInstaller output folder (`dist\StudyFlashcardsTray\*`) so the app runs without requiring "extra files" to be manually copied.

### Fixed
- Packaging reliability improvements from the beta line (build scripts, Inno Setup defaults).

### Known issues / notes
- **Windows Defender/AV false positives:** Unsigned PyInstaller EXEs can be quarantined. For distribution, consider code signing.

## vbeta (build 2) — 2026-01-19

### Fixed
- Packaging script fixes and documentation updates.

## vbeta (build 1) — 2026-01-19

### Added
- Initial packaged beta release (PyInstaller + Inno Setup build scripts).


### Startup / tray
- Installer Scheduled Task option now uses `/RL HIGHEST` and a 30-second start delay to improve reliability.
- Tray "Restart" now relaunches the app using `ShellExecuteW` (more reliable for frozen EXEs) so it actually restarts the server.

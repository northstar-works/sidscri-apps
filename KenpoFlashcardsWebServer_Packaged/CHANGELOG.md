# Changelog — Advanced Flashcards WebApp Server (Packaged)

All notable changes to the Windows packaged/installer distribution are documented here.

## v5.4.0 (build 24) — 2026-02-17

### Added
- **Remote Config Push** synced from web server v8.9.0 (build 63)
  - New Admin → 📱 Android tab: set `host`, `port`, and `server_type` (Standalone / Packaged / Raspberry Pi)
  - `GET /api/sync/remote-config` – public endpoint Android apps call on startup to auto-update server connection
  - `POST /api/admin/remote-config` – admin save (web session auth)
  - `POST /api/sync/admin/remote-config` – admin save (Android Bearer token auth)
  - `data/remote_config.json` – new persisted config file; defaults to `sidscri.tplinkdns.com:8009`

### Changed
- **Updated bundled Web Server to v8.9.0 (build 63)** (from v8.8.1 build 62)

---

## v5.3.1 (build 23) — 2026-02-07

### Changed
- **Updated bundled Web Server to v8.8.0 (build 61)** (from v8.8.0 build 61), including:

## v5.3.0 (build 22) — 2026-02-06

### Changed
- **Updated bundled Web Server to v8.8.0 (build 61)** (from v8.7.0 build 60), including:

## v5.2.1 (build 21) — 2026-02-06

### Changed
- **Updated bundled Web Server to v8.7.0 (build 60)** (from v8.7.0 build 60), including:

## v5.2.0 (build 20) — 2026-02-05

### Changed
- **Updated bundled Web Server to v8.7.0 (build 60)** (from v8.5.3 build 56), including:
  - Treat AI instructions as an explicit formatting/behavior override (client + server).
  - **Edit Deck modal tabs:**
  - **Edit Cards management:**
  - **Per‑card actions:**
  - **Restore flows:**
  - **Duplicate handling prompt:**
  - **Edited history:**
  - Removed the non-action “dot” indicator on the deck list (active highlighting and Active text remain).
  - Bulk/AI edits override any “short terms only” style toggles for the targeted field(s) during apply.
  - **Packaged support metadata:**
  - **Version API upgrade:**
  - **Packaged support version metadata:**
  - **Version API upgrade:**
  - **Admin/System version display:**
  - **User dropdown version display:**
  - Stand-alone mode hides the **Application** line entirely when `version.json` is missing `is_packaged` or it is `false`.
  - **Custom Set Settings full-page view:**
  - **Manage Cards collapsible panes:**
  - Faster initial load after login: settings + decks now load in parallel; counts + cards load in parallel during refresh (reduced sequential network calls from 6 to 4).

## v5.1.1 (build 19) — 2026-02-01

### Changed
- **Updated bundled Web Server to v8.5.3 (build 56)** (from v8.5.1 build 54), including:
  - **File-based logging system:**
  - **Log rotation on startup:**
  - **Log download endpoint:**
  - **Expandable admin stat tiles:**
  - **Deck Short Answers mode:**
  - **Deck settings API:**

## v5.1.0 (build 18) — 2026-01-31

### Changed
- **Updated bundled Web Server to v8.5.1 (build 54)** (from v8.2.0 build 50), including:
  - **Remember me functionality**
  - **Mobile responsive design**
  - **Admin edit built-in decks**
  - **Runtime paths module**
  - **Environment overrides**
  - **First-run data seeding**
  - Dev/source run: project-local `./data` and `./logs`
  - Packaged/frozen run: `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\{data,logs}` (or env overrides)

## v5.0.1 (build 17) — 2026-01-30

### Fixed
- Packaging build dependency resolution on Python 3.8 by pinning build-tool versions to Python 3.8-compatible releases (prevents “requires Python >= 3.9” failures).
- Ensured packaged runtime remains **AppData-write-safe** (no writes under `Program Files`).
- **Packaging build reliability on Python 3.8** by pinning build tooling to compatible versions:
  - `pip==24.0`
  - `setuptools==70.3.0`
  - `wheel==0.44.0`
- Documentation corrected to reflect **v5.0.1** (previous internal references to “v5.1.0” were the same release and should be treated as **v5.0.1**).
- Fixed IndentationError: unexpected indent in internal\app.py that prevented the server from starting.
- Fixed tray/service startup crash: ModuleNotFoundError: No module named 'runtime'

### Changed
- One-click EXE build: `pip install` now uses:
  - `--progress-bar on`
  - `--default-timeout 120`
  - `--retries 10`
  to avoid “looks stuck” installs and improve resilience on slow/finicky networks.
- Version labeling: corrected docs to **v5.0.1** (no changes to v5.0.0 release notes).
- Improved frozen/installed execution reliability by ensuring runtime imports resolve correctly when running from ...\_internal.
- Updated PyInstaller configuration to include the runtime\ package inside the installed _internal directory so imports work after installation

## v5.0.0 (build 16) — 2026-01-30 - Synced from v8.2.0 (build 50)

### Changed
- Synced **Packaged** with the latest WebServer feature set to produce the first “hybrid truth” release for EXE distribution.
- Updated bundled Web Server to **v8.2.0 (build 50)**.v8.2.0 build 50), including:
  - Create Deck (Keyword method): auto-search uses deck name + description; default max = 25.
  - Packaged-only display: Web Server Version appears in User menu, About, and Admin > System only when install_type is packaged.
  - **Added GEN8 Token Admin Namespace for Android
-**
  - **Invite code redemption**
  - **Docs updates**
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
  - **Rebranded to "Study Flashcards"**
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
  - **Sync Progress page**
  - **Settings tabbed navigation**
  - **Star button on study cards**
  - **Sort by status dropdown**
  - **Logout in user menu**
  - Settings page completely redesigned with app-like card layout and modern buttons
  - Buttons now use gradient backgrounds matching Android app style (primary blue, success green, danger red)
  - Removed standalone logout button from header controls
  - **Custom Set (Starred Cards)**
  - **Show breakdown on definition toggle**
  - **Auto-speak on card change**
  - **Speak definition on flip**
  - **Admin Dashboard redesign**
  - **API endpoint**
  - Admin page completely redesigned with modern UI, gradients, and animations
  - Settings now include `show_breakdown_on_definition`, `auto_speak_on_card_change`, `speak_definition_on_flip`
  - No functional server code changes in this patch release.
  - **GET /api/sync/apikeys**
  - API keys are now shared with all authenticated users on login
  - Admin access only required to modify/save API keys, not to use them
  - **AI Access Page**
  - **Model Selection**
  - **Startup Key Loading**
  - **Web API endpoints**
  - **Admin Users SoT**
  - **Admin Users Endpoint**
  - API keys now include model selection (chatGptModel, geminiModel)
  - Keys loaded from `api_keys.enc` override environment variables
  - Admin page now prominently links to AI Access Settings
  - **Encrypted API Key Storage**
  - **POST /api/admin/apikeys**
  - **GET /api/admin/apikeys**
  - **GET /api/admin/status**
  - Added dependency on `reportlab` for generating the User Guide PDF
  - Added `reportlab` dependency for PDF generation
  - Renamed "Definition first" to "Reverse the cards (Definition first)"
  - Tighter spacing for small screens

## v4.1.2 (build 15) — 2026-01-30

This release hardens the packaging/sync pipeline so future WebServer syncs cannot reintroduce `Program Files` write paths.

### Added
- **Runtime path module** (`runtime/app_paths.py`) to centralize writable `DATA_DIR` / `LOG_DIR` behavior.
- **Hard-fail regression scanner** after sync/build to prevent `_internal\logs` / `Program Files` write regressions.
- **Post-sync auto-patch step** to enforce AppData-safe paths in the synced output even if upstream files change.
- **Synced output folder**: `KenpoFlashcardsWebServer_Packaged_Synced` to keep Packaging truth clean.

### Fixed
- Prevented write-permission failures when installed under `C:\Program Files\...` by ensuring writable paths (data/logs/config) resolve to per-user AppData when running as a packaged install.
- Permission errors when installed under `C:\Program Files\Advanced Flashcards WebApp Server` by routing all writes to:
  - `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\data`
  - `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\logs`

### Changed
- Packaging/runtime ownership clarified: packaging files and runtime path rules are preserved during sync; webserver feature code can still be synced safely into the *_Synced* output.

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

## v4.1.0 (build 13) — 2026-01-28 Synced from v8.1.0 (build 48)

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
# 🌐 Advanced Flashcards WebApp Web Server (formerly KenpoFlashcardsWebServer)

> This is the **web server** project inside the `sidscri-apps` monorepo.  
> Repo root: `../README.md`

Flask-based web application providing sync API and web UI for Advanced Flashcards WebApp.


**Current Version:** v8.9.0 (build 63)  
**Changelog:** [CHANGELOG.md](CHANGELOG.md)


## ✅ Recent (v8.9.0 build 63)

### Added
- **Remote Config Push** – Admin → 📱 Android tab: set the `host`, `port`, and `server_type` (Standalone / Packaged / Raspberry Pi) that Android apps receive when they poll the server on startup
- `GET /api/sync/remote-config` – public endpoint (no auth); Android apps call this to auto-detect server connection changes. Defaults to `sidscri.tplinkdns.com:8009`
- `POST /api/admin/remote-config` / `POST /api/sync/admin/remote-config` – admin save endpoints (web session and Android Bearer token)
- `data/remote_config.json` – persists config; auto-created with defaults on first admin save

### Added
- **Decks UI improvements**
  - Settings menu: **Edit Decks** renamed to **Decks**
  - On Decks > Switch: **Create New Deck** and **Redeem Invite 
  - Edit Decks → Add Cards AI live example preview:** “Example output” now renders and updates as you type (same behavior as Create Deck AI).
Code** are collapsed by default and expand/collapse on tap
- **Decks > Add Cards**
  - New sub-tabs: **Add a New Card** and **Bulk Add with AI**
  - Bulk Add uses the same AI generation methods (Keywords / Photo / Document) to add multiple cards to an existing deck
- **Edit Deck modal**
  - New **Add Card** tab: Bulk Add with AI, locked to the deck you’re editing

### Changed
- **AI Generator** tab renamed to **Create Deck w/ AiGen**
- When exiting the Decks page, it resets back to the **Switch** tab by default (next open starts on Switch)
- After adding cards via AI Generator, the Decks window closes and returns you to Study
-  AI generator clears on exit:** Keywords/Instructions/preview/results reset when you close Edit Decks or leave the Add Cards AI generator.

### Fixed
- Decks: Add Cards / Create Deck / Deleted panes could appear blank because the tab sections were nested inside the Switch section; corrected the HTML structure so each tab renders independently.
- Fixed Edit Decks → Add Cards AI “Example output” staying blank due to missing preview refresh path.
- Fixed stale AI generator state carrying over between modal opens (inputs + preview now reset consistently).

---

### Previous (v8.7.0 build 60)

### Added
- **AI generator instructions override**: if you type specific instructions, they take priority over any “Short answers only” setting.
- **Deck AI setting (default OFF):** show compact helper buttons to quickly insert a Term/Definition formatting template into your instructions (per deck / per editing context).
- **Deck AI setting (default ON):** show a live “Example output” preview before generating when Keywords / Name / Description / Instructions are provided.

### Changed
- AI Template “Field(s) to change” is now a compact dropdown (Definition, Terms, Definition + Term, Pronunciation, Group).
- AI Deck Generator UI polish: Generate button spacing/size, plus Preview All + Cancel actions.
- “Instructions for the AI” is now treated as a hard override rule (both client-side and server-side) so you reliably get the formatting you asked for.

### Fixed
- **AI Deck Generator** live “Example output” preview now renders real preview output (matches AI Template).
- **AI Generator** instructions are cleared when exiting the generator; added a **Clear** button beside “Insert example format”.
- Inserted example format blocks no longer add excessive blank lines.
- **List mode rendering** for **Learned** and **All** tabs (cards were blank due to a JS runtime error).
- **Startup/load failure** caused by a malformed `async function` declaration in `app.js`.
- **Edit Decks** Back button now matches the smaller sizing used on **Custom Set Settings**.
## 🎯 What It Does

- **Authentication** - User login with token-based Android sync
- **Progress Sync** - Push/pull card progress between devices
- **Breakdown Sync** - Shared term breakdown database
- **Web UI** - Browser-based flashcard interface with responsive mobile/tablet/landscape layouts (v8.4.0+)
- **Custom Set** - Starred cards with full management modal (v7.2.0+)
- **Edit Decks** - Create, edit, and manage custom study decks (v7.0.0+)
- **AI Deck Generator** - Generate flashcards from keywords, photos, or documents (v7.0.5+)
- **User Cards** - Add custom cards with AI-assisted definitions/pronunciations
- **Helper Mapping** - Canonical card IDs for cross-device consistency
- **AI Integration** - ChatGPT and Gemini API for breakdown autofill & card generation
- **Encrypted API Keys** - Secure storage shared between Android and web
- **Shared API Keys** - All authenticated users can pull API keys (v5.5.2+)
- **Admin Management** - Centralized admin users Source of Truth with activity logs
- **Admin Dashboard** - User management, deck config, invite codes, system info, logs (v6.0.0+)
- **Auto-speak** - Voice settings for auto-speak on card change and flip (v6.0.0+)
- **Breakdown Indicator** - Visual puzzle icon when card has breakdown data (v7.1.0+)
- **Android Sync API** - Full deck and user card sync with Android app (v7.0.7+)
- **Persistent Sessions** - 30-day remember me with automatic refresh (v8.4.0+)

---

## 📁 Location & Workflows

- **Path:** `sidscri-apps/KenpoFlashcardsWebServer/`
- **CI Workflow:** `.github/workflows/kenpo-webserver-ci.yml`
- **Build Workflow:** `.github/workflows/kenpo-webserver-build-zip.yml`

---

## 🚀 Quick Start (Windows)

### Option 1: Batch File
Double-click `START_KenpoFlashcardsWebServer.bat`

### Option 2: Manual Setup
```powershell
cd KenpoFlashcardsWebServer
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open: `http://localhost:8009`

---

## 📌 API Endpoints

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/login` | POST | Android token authentication |
| `/api/login` | POST | Web session login |
| `/api/logout` | POST | Web session logout |

### Sync (Token Required)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/push` | POST | Push progress to server |
| `/api/sync/pull` | GET | Pull progress from server |
| `/api/sync/breakdowns` | GET | Get all breakdowns |
| `/api/sync/helper` | GET | Canonical ID mapping |
| `/api/sync/apikeys` | GET | **Get API keys (all users)** ✨ v5.5.2 |

### Decks & Cards (v7.0.0+)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/decks` | GET | List all decks |
| `/api/decks` | POST | Create new deck |
| `/api/decks/:id` | POST | **Update deck name/description** ✨ v7.0.5 |
| `/api/decks/:id` | DELETE | Delete a deck |
| `/api/user_cards` | GET | Get user-created cards |
| `/api/user_cards` | POST | Add new user card |
| `/api/user_cards/:id` | PUT | Update user card |
| `/api/user_cards/:id` | DELETE | Delete user card |

### AI Generation (v7.0.0+)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/generate_definition` | POST | Generate definition options |
| `/api/ai/generate_pronunciation` | POST | Generate pronunciation |
| `/api/ai/generate_group` | POST | Suggest group/category |
| `/api/ai/generate_deck` | POST | **Generate cards from keywords/photo/doc** ✨ v7.0.5 |
| `/api/ai/status` | GET | Check AI provider availability |

### Custom Set (v6.0.0+)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/custom_set` | GET | Get custom set cards |
| `/api/custom_set/add` | POST | Add card to custom set |
| `/api/custom_set/remove` | POST | Remove card from custom set |
| `/api/custom_set/toggle` | POST | Toggle card in/out of custom set |
| `/api/custom_set/set_status` | POST | Set internal status within custom set |
| `/api/custom_set/clear` | POST | Clear entire custom set |

### Breakdowns
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/breakdowns` | GET | Get breakdowns (web session) |
| `/api/breakdowns` | POST | Save breakdown (admin only) |

### Admin (Token Required)
| `/api/sync/admin/deck-config` | GET/POST | **GEN8** deck access global config (admin token) |
| `/api/sync/admin/deck-invite-code` | POST | **GEN8** generate invite codes (admin token) |
| `/api/sync/admin/deck-invite-code/<code>` | DELETE | **GEN8** revoke invite codes (admin token) |
| `/api/sync/redeem-invite-code` | POST | **GEN8** redeem invite code (user token) |

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/apikeys` | GET | Get encrypted API keys (admin) |
| `/api/admin/apikeys` | POST | Save encrypted API keys (admin) |
| `/api/admin/status` | GET | Check admin status |
| `/api/admin/users` | GET | Get admin usernames (SoT, no auth) |
| `/api/admin/stats` | GET | **Admin dashboard stats** ✨ v6.0.0 |

### Web Admin (Session Required)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/web/admin/apikeys` | GET | Get API keys for web UI |
| `/api/web/admin/apikeys` | POST | Save API keys from web UI |

### Info
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/version` | GET | Server version info |
| `/api/health` | GET | Server health check |
| `/about` | GET | About page |
| `/admin` | GET | Admin dashboard (redesigned v6.0.0) |
| `/ai-access.html` | GET | AI Access settings (admin) |
| `/user-guide` | GET | User guide page |

---

## 🖼️ Branding, Icons, and Deck Logos (v8.0.0+)

### WebApp browser icons (favicons)
Web UI / browser icons are stored here (so they stay separate from Windows EXE/tray icons):
- `static/res/webappicons/`

The favicon and tab icon are served from this folder and use the **Advanced Flashcards** logo.


## 📄 Web UI files
This project serves the web pages directly from `static/` (there is no `templates/` folder in the packaged layout).

Key files:
- `static/index.html` — main web app shell
- `static/admin.html` — Admin dashboard
- `static/app.js` — main UI logic (login + deck loading)
- `static/styles.css` — UI styling

If you edit these files, do a hard refresh (**Ctrl+F5**) to bypass cached assets.

*(Reserved for later: `static/res/webappservericons/` for Windows/EXE packaging assets — not used by the Web UI.)*

### Deck logos (optional)
Decks can optionally have a `logoPath` that points to an image under:
- `static/res/decklogos/`

Behavior:
- Each deck stores its **own** `logoPath` (per-deck / per-deck-id). Updating one deck’s logo will not affect other decks.
- Kenpo deck uses the Kenpo Vocabulary logo by default.
- Any deck without a logo falls back to `/res/decklogos/advanced_flashcards_logo.png`.
- The Study page header logo updates on deck switch the same way the header text does (deck name + card count).
- “Switch Study Subject” now shows a **small icon** next to each deck.
- After uploading/changing a logo and pressing Save, the UI uses cache-busting so the new image shows immediately.
- The deck marked ★ **Default** is used as the startup deck on refresh if no saved active deck is available; otherwise the last active deck is restored.


## 🔑 Data & Secrets

**Runtime data is NOT committed to Git (except SoT files):**
- `data/` - User accounts, progress, breakdowns
- `logs/` - Server logs (see **Logging** below)
- `.env` - Environment variables


### Logging
On startup the runner prints a clear **`[READY]`** line with the URLs.

Log files are written under the app root:
- `logs/server.log` — requests + info
- `logs/error.log` — exceptions + errors

Tip: if the browser UI looks blank, check `logs/error.log` for JavaScript or API errors first.

### Data Structure
```
data/
├── profiles.json        # User accounts (hashed passwords)
├── breakdowns.json      # Shared breakdowns
├── helper.json          # Auto-generated ID mapping
├── decks.json           # User-created decks ✨ v7.0.0
├── secret_key.txt       # Flask session key (DO NOT SHARE)
├── api_keys.enc         # Encrypted API keys (safe for git)
├── admin_users.json     # Admin usernames (Source of Truth)
├── users/
│   ├── {user_id}/
│   │   └── progress.json
│   └── ...
└── user_cards/          # User-created cards ✨ v7.0.0
    ├── {user_id}/
    │   └── cards.json
    └── ...
```

---

## 🤖 AI Deck Generator (v7.0.5+)

Generate flashcards automatically using AI from three sources:

### Keywords
Enter a topic like "Basic Spanish Words 3rd grade level" and AI generates vocabulary cards.

### Photo
Upload an image of:
- Study materials
- Textbook pages
- Existing flashcards
- Diagrams with labels

AI extracts text and creates flashcards.

### Document
Upload PDF, TXT, or MD files. AI reads the content and generates flashcards from key terms and concepts.

### How It Works
1. Go to **Edit Decks → 🤖 AI Generator**
2. Choose method (Keywords/Photo/Document)
3. Enter input or upload file
4. Click **🔍 Generate**
5. Review generated cards, select which to keep
6. Cards are added to your current deck

**Default Keywords**: If no keywords entered, uses the deck's name and description automatically.

---

## 🔧 Configuration

### Environment Variables (Optional)
| Variable | Description |
|----------|-------------|
| `KENPO_ROOT` | Root path for auto-discovering `kenpo_words.json` |
| `KENPO_JSON_PATH` | Direct path to card data JSON |

### Kenpo Vocabulary Data (`kenpo_words.json`)
- **Canonical location (server install):** `KenpoFlashcardsWebServer/data/kenpo_words.json`
- The server will load from `data/kenpo_words.json` by default.
- Optional overrides:
  - `KENPO_JSON_PATH` (direct file path)
  - `KENPO_ROOT` (auto-discovery root for development)

### Packaged Install Marker
- Packaged installs include `data/install_type.txt` containing `packaged`.
- When present, the UI shows **Web Server Version: v8.6.0 (build 57)** in the User menu, About, and Admin > System.

**Note:** API keys are now stored encrypted in `data/api_keys.enc`. You no longer need to set `OPENAI_API_KEY` in the batch file - keys are loaded from the encrypted file on startup.

### Auto-Path Discovery
The server automatically locates `kenpo_words.json` by scanning:
```
{KENPO_ROOT}/*/app/src/main/assets/kenpo_words.json
```

---

## 👤 Admin Management

Admin users are defined in `data/admin_users.json` (Source of Truth):
```json
{
  "description": "Source of Truth for admin users",
  "updated": "2026-01-13",
  "admin_usernames": ["sidscri"],
  "notes": "Usernames are case-insensitive"
}
```

**How it works:**
1. Server loads `admin_users.json` on startup → `ADMIN_USERNAMES` global
2. Android app fetches `GET /api/admin/users` on login
3. Both projects use the same Source of Truth
4. To add new admin: edit JSON file, restart server (or implement hot-reload)

**Fallback behavior:**
- If `admin_users.json` missing/corrupt: defaults to `{"sidscri"}`
- Android fallback if server unreachable: uses default `{"sidscri"}`

---

## 🔒 API Key Sharing (v5.5.2+)

API keys are now shared with ALL authenticated users:

| Endpoint | Who Can Access | Purpose |
|----------|----------------|---------|
| `GET /api/sync/apikeys` | All authenticated users | Pull keys on login |
| `GET /api/admin/apikeys` | Admin only | Admin settings page |
| `POST /api/admin/apikeys` | Admin only | Save/update keys |

**Workflow:**
1. Admin enters API keys in Admin Settings
2. Admin clicks "Push to Server" → keys encrypted and saved
3. Any user logs in → keys automatically pulled via `/api/sync/apikeys`
4. User can use AI breakdown features

---

## 🪟 Windows Deployment Options

### Service + Tray (Recommended)
Run in background like Sonarr/Radarr:
- See: `../KenpoFlashcardsWebServer_Service_Tray/README.md`

### Packaged Installers
Portable EXE, installer, or MSI:
- See: `../KenpoFlashcardsWebServer_Packaged_in_exe_msi/README.md`


**Writable folders (important for installers / Program Files):**
- Packaged installs should write *all* logs/data/config to **AppData**, not the install folder.
- Default locations:
  - Data: `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\data\`
  - Logs: `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\logs\`
  - Config: `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\` (e.g., `server_config.json`, `launcher_settings.json`)
- Optional overrides (advanced): `KENPO_APPDATA_BASE_DIR`, `KENPO_DATA_DIR`, `KENPO_LOG_DIR`.

## ✅ Verify It Works

### 1. Test Helper Endpoint
```
http://localhost:8009/api/sync/helper
```
Should return JSON with `version`, `term_to_id`, `cards`

### 2. Test Version Endpoint
```
http://localhost:8009/api/version
```
Should return `{"version": "8.6.0", "build": 57, ...}`

### 3. Test Admin Users Endpoint
```
http://localhost:8009/api/admin/users
```
Should return `{"admin_usernames": ["sidscri"]}`

### 4. Check Data Files
Confirm `data/helper.json` and `data/admin_users.json` exist on disk.

---

## 🛠️ Troubleshooting (v8.1.0+)

### Sync → Pull shows 500 Internal Server Error
Older progress data may contain non-numeric `updated_at` values (for example `"None"`, empty strings, or timestamps).  
In **v8.1.0 v48**, the server safely parses `updated_at` so **Pull will not crash**.

If you're running an older server version:
- Open `data/users/<user_id>/progress.json`
- Replace any bad `"updated_at"` values with `0`

### Admin → Users → Edit User → Deck Access shows “Not Found” then “Failed to load”
This happens when the Admin Dashboard front-end calls a route that the server doesn't have.  
v8.1.0 v48 includes the required endpoint:

- `GET /api/admin/user/deck_access?user_id=<id>` (load)
- `POST /api/admin/user/deck_access?user_id=<id>` (save)

If you still see this on v8.1.0+, open DevTools → Network and confirm the request is returning **200** (not 404).

---

## 📖 Documentation

### User Guide (`/user-guide`)
Comprehensive documentation covering all features:
- Getting Started & Quick Start
- Study Tabs (Unlearned, Unsure, Learned, All, Custom Set)
- Edit Decks & Switching Study Subjects
- AI Card Generator (Keywords, Photo, Document)
- Adding Cards Manually with AI Assistance
- Custom Set (Starred Cards)
- Word Breakdowns
- Settings & Voice Options
- Syncing Progress
- Keyboard Shortcuts
- Troubleshooting

### About Page (`/about`)
Interactive page with tabbed sections:
- **Overview**: Version info, description, quick start
- **Features**: Grid of all features with icons
- **Technology**: Tech stack, project structure, API integration
- **Changelog**: Recent version history
- **Contact**: Email, feature requests, bug reporting

---

## 🆕 Recent Updates (8.4.0 → 8.6.1)

### v8.6.1 (build 58)
- **Packaged support versioning:** stand-alone shows Web Server version only; packaged shows **App + Web** versions.
- **Version API:** `/api/version` includes `is_packaged` plus `app_*` and `web_*` fields.
- **Admin/System + user dropdown:** version display matches packaged vs stand-alone.

### v8.6.0 (build 57)
- **Custom Set overhaul:** Settings converted from modal to full-page scrollable view. Manage Cards panes collapsible in both portrait and landscape (landscape phones now correctly detected). Counts fix (was 0/0/0). Settings tab load fix. Study label shows "Studying: Unlearned/Unsure/Learned" instead of "Custom Set".
- **Custom Set deck-scoped:** Custom Sets and Saved Sets no longer leak across decks when switching.
- **Custom Set bug fixes:** starred cards now appear correctly, random count input no longer overflows, card lists taller, breakdown save closes modal, responsive layout on narrow screens.
- **Admin confirmations auto-clear:** messages disappear after a few seconds; error confirmations use ✖ instead of ✓.
- **Faster load:** settings + decks fetched in parallel; counts + cards in parallel during refresh.
- **Portrait study row stabilized:** Prev / Speak / Custom / Next forced onto one edge-to-edge row. Breakdown button moved to header. Tighter alignment with "Custom > Status" hint.
- **UI error log toggle:** Settings → Display option to show JS/UI errors on-screen.

### v8.5.3 (build 56)
- **Admin deck access cleanup:** Allow/Deny buttons no longer reset user/deck dropdowns, enabling bulk access changes. Removed Disable/Enable Built-In buttons (simplified). Status line now always shows "Access: Granted" or "Access: Not granted" clearly.
- **Deck Ownership blank fix:** "Current owner" line hidden when no deck is selected instead of showing stale data.
- **Non-admin editing off by default:** "Allow non-admins to edit built-in decks" checkbox defaults to off; removed "/unlocked" from label text.
- **Portrait card layout:** card height increased to 320px (280px on small phones), bigger text (26px), card face scrollable for long breakdowns. "All (flat) • Studying: X" status line now inline with "Card 1/10" counter.
- **Landscape controls compact:** group/All Cards/search controls reduced to 11px font with tighter padding. Card height 200px.
- **Breakdown overflow fix:** card faces now scroll when breakdown content exceeds card height.

### v8.5.2 (build 55)
- **File-based logging overhaul:** server.log, error.log, and user_activity.log now persist to disk; previous server/error logs are rotated on each restart (.prev); user activity is continuous unless manually cleared (saved before clearing); Admin > Logs reads from files; download disabled for empty logs.
- **Expandable admin stat tiles:** click any stat card (Users, Cards, Decks, etc.) to expand in-depth details per tile.
- **Custom Set tab fix:** Manage Cards and Saved Sets tabs were blank due to hidden-class conflict; now properly toggle visibility.
- **AI generation context fix:** AI no longer assumes foreign language when generating cards; matches content to keywords literally (e.g., "fast food chains" produces fast food items, not Spanish food words).
- **Deck Short Answers mode:** new per-deck toggle in AI Generator tab forces definitions to 1-4 words (ideal for capitals, translations, simple vocabulary).
- **Add Card pre-selects active deck:** Target Deck dropdown now defaults to the deck you're currently studying instead of always Kenpo.
- **Custom Set counts line:** Unlearned/Unsure/Learned counts now reflect Custom Set card statuses instead of main deck statuses when studying Custom Set.
- **Random card input fix:** number field narrowed to prevent overlapping "Pick random cards to add" text and the Add Random button.

### v8.5.1 (build 54)
- **Controls rearranged:** group dropdown + All Cards on the left, search 🔍 icon on the right; search expands as overlay.
- **Settings icon (⚙️) moved to title row:** now sits right of User:**** display.
- **Desktop search icon:** search bar replaced with 🔍 icon on all screen sizes.
- **Portrait controls:** group dropdown auto-width left, All Cards + search pushed right.
- **Landscape controls right-aligned:** controls row pushed to right side of screen.
- **Mobile logo inline:** deck logo displays inline instead of overlapping.
- **Admin: Edit User deck access fixed:** corrected API URL, field name mismatches, card counts now show.
- **Admin: Edit User modal wider:** 900px max-width, read-only Granted/Not granted text (no checkboxes).
- **Admin: Allow/Deny buttons:** replaced Unlock/Lock in User Deck Access; live status indicators.
- **Admin: Deck Ownership section:** transfer deck ownership between users.
- **Admin: Built-in status badge:** shows active/disabled state for selected user.
- **CSS cleanup:** fixed `.selectBtn` → `.select`; removed stale `.rightControls`.

### v8.5.0 (build 53)
- **Portrait/landscape responsive overhaul:** compact single-row study controls in both orientations.
- **Search bar → icon toggle:** search becomes a 🔍 icon that expands an overlay input on tap; auto-collapses when touching outside the search area.
- **Saved Breakdowns moved to More:** the 🧩 button relocated from main controls into the Settings/More page.
- **Got it button shortened:** "Got it ✓ (mark learned)" → "Got it ✓".
- **Breakdown button compact:** stays small and fixed next to Next in portrait.
- **Settings toggle:** settings button toggles open/close; close button (✕) added to settings header.
- **Admin users table (mobile):** "Currently Studying" moves under progress bar; "Last Sync" hidden on very small screens.
- **Deck list badges (mobile):** icon-only (📦🔓👥★) on narrow viewports.
- **Deck actions (portrait):** stack vertically with separator border.
- **Landscape card height:** reduced to 180px.

### v8.4.0 (build 52)
- **Remember me (30-day sessions):** sessions persist across browser restarts and refresh on each request; no re-login required.
- **Mobile responsive design (initial):** comprehensive CSS media queries for tablet (≤900px), mobile (≤600px), and small mobile (≤400px) viewports.
- **Admin edit built-in decks:** admins can now edit built-in decks (like Kenpo Vocabulary) and upload logos for them.
- **Deck logo/title cleanup:** logo reduced ~15% (98→83px), fixed jumping transform; title truncates with ellipsis on overflow.
- **Edit User modal:** widened to 700px with responsive breakpoints; deck access lists scroll and stack vertically on mobile.
## 📋 Version History

| Version | Build | Key Changes |
|---------|-------|-------------|
| **8.8.0** | 61 | Decks UI improvements, Decks > Add Cards, Edit Deck modal,AI Generator** tab renamed to **Create Deck w/ AiGen |
| **8.7.0** | 60 | AI: instructions override Short answers; optional format-helper dropdown; example preview; fixed Learned/All list blank + startup JS error; Edit Decks Back button sizing |
| **8.6.2** | 59 | Edit Decks: added **Edit Cards** tab (search/select, per-card edit/remove + duplicate prompt), bulk tools with preview, Deleted + Edited history; removed non-action deck list dot |
| **8.6.1** | 58 | Packaged support versioning (webappserver_version.json), enhanced `/api/version` (is_packaged + app/web fields), Admin/System + user dropdown single vs dual version display; plus 8.6.0 feature set |
| **8.6.0** | 57 | Custom Set overhaul (full-page settings, collapsible panes portrait+landscape, counts fix, settings tab fix, study label filter mode, deck-scoped, landscape accordion fix), parallel load optimization, portrait study row stabilized, breakdown relocated, admin confirmation auto-clear, UI error log toggle |
| **8.5.3** | 56 | Admin deck access cleanup (dropdowns persist, removed built-in toggles, clear status), ownership blank fix, non-admin editing off by default, portrait card taller/bigger, inline status+card counter, landscape compact controls, card face scrollable |
| **8.5.2** | 55 | File-based logging (server/error/user_activity persist, rotation on restart), expandable admin stat tiles, Custom Set tab switching fix, AI context-aware generation, deck Short Answers mode, add-card pre-selects active deck, custom set counts line, random input layout fix |
| **8.5.1** | 54 | Controls rearranged, search icon all screens, portrait/landscape layout fixes; Admin: fixed Edit User deck access API/card counts, Allow/Deny buttons, access status indicators, deck ownership transfer, wider modal |
| **8.5.0** | 53 | Portrait/landscape responsive overhaul, search bar → icon toggle, Saved Breakdowns moved to Settings/More, Got it button shortened, breakdown button compact, settings toggle, admin table mobile columns, deck badges icon-only, deck actions stacking, landscape card height 180px |
| **8.4.0** | 52 | Remember me 30-day sessions, initial mobile responsive design (tablet/mobile/small breakpoints), admin edit built-in decks, deck logo/title fixes, Edit User modal responsive widening |
| **8.3.0** | 51 | AppData-safe runtime paths for packaged installs (no writes to Program Files), env overrides for data/log dirs, first-run seeding of bundled defaults into AppData, server logging reliability in tray/service launches, fixed startup indention issue and ensured runtime is included/available in _internal for tray/service |
| **8.2.0** | 50 | Forced password reset flow (temp login → reset on login screen), Create Deck add-cards method selector + auto-jump, Admin dashboard no longer hangs on load, Packaged install marker (`data/install_type.txt`) for showing Web Server Version |
| **8.1.1** | 49 | Fix: `/api/health` crash caused by undefined Kenpo JSON path; Standardized Kenpo vocabulary JSON canonical path at `data/kenpo_words.json`; Health check now reports Kenpo JSON status cleanly |
| **8.1.0** | 48 | Fix: Sync Pull no longer crashes on bad `updated_at`; Fix: Admin Edit User deck access loads/saves via `/api/admin/user/deck_access`; UI: header/logo alignment stability |
| **8.0.2** | 47 | Minor upgrade: deck ownership (user decks private by default) + admin per-user deck sharing (read-only); Fix: admin password reset sets `123456789` reliably; Includes deck logo persistence/isolation + refresh fixes |
| **8.0.1** | 46 | Fixed deck logos: per-deck persistence/isolation, refresh correctness, deck list icons, header logo sizing, default deck refresh fix |
| **8.0.0** | 45 | Major rebrand to Advanced Flashcards WebApp; WebApp favicon/icons path; deck logo support |
| **7.3.0** | 44 | Deck access management system, invite codes, admin dashboard - decks tab, deck access types displayed, clear default deck |
| **7.2.1** | 43 | Custom Set modal fixed size, split-pane card management, saved sets switching |
| **7.2.0** | 42 | Custom Set management modal, server activity logs, settings save prompt |
| **7.1.0** | 41 | Admin dashboard redesign (tabbed), breakdown indicator on cards, web sync fix, enhanced user stats |
| **7.0.7** | 40 | Android sync API (/api/vocabulary, /api/sync/decks, /api/sync/user_cards) |
| **7.0.6** | 39 | Rebranded to "Advanced Flashcards WebApp", header shows deck name, Set Default deck, groups filter fix |
| **7.0.5** | 38 | AI Deck Generator, Edit Deck, deck switching fix, comprehensive User Guide, interactive About page |
| **7.0.4** | 37 | AI Deck Generator initial, user cards in study deck |
| **7.0.3** | 36 | Health check fix, AI key loading, random toggle persistence |
| **7.0.2** | 35 | Pick Random N, User Management, password reset |
| **7.0.1** | 34 | Reshuffle button, search clear, Custom Set randomize |
| **7.0.0** | 33 | Edit Decks page, deck management, user cards CRUD, AI generation |
| **6.1.0** | 32 | Settings tabbed navigation, Sync Progress page, star on study cards, sort All list |
| **6.0.0** | 31 | Custom Set, auto-speak settings, admin dashboard redesign |
| **5.5.3** | 30 | Progress timestamps, offline pending queue sync |
| **5.5.2** | 29 | `GET /api/sync/apikeys` for all users, API keys shared on login |
| **5.5.1** | 28 | `GET /api/sync/apikeys` for all users, API keys shared on login |
| **5.5.0** | 27 | AI Access page, model selection, startup key loading, admin_users.json SoT |
| **5.4.0** | 26 | Encrypted API key storage, Gemini API, admin endpoints |
| **5.3.1** | 25 | Fixed duplicate `/api/login` endpoint conflict |
| **5.3.0** | 24 | About/Admin/User Guide pages, user dropdown |
| **5.2.0** | 23 | End-to-end sync confirmed, helper mapping |
| **5.1.1** | 22 | version.json, favicon, security.txt |
| **5.0.0** | 20 | Stable ID mapping baseline |
| **4.2.0** | 18 | Settings reorg, Python 3.8 compat |

See [CHANGELOG.md](CHANGELOG.md) for full details.

---

## 🧩 Project Structure

```
KenpoFlashcardsWebServer/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── version.json           # Version info
├── START_KenpoFlashcardsWebServer.bat  # Windows launcher
├── static/
│   ├── index.html         # Web UI
│   ├── app.js             # Frontend JavaScript
│   ├── styles.css         # Styles
│   ├── admin.html         # Admin dashboard (redesigned v6.0.0)
│   ├── ai-access.html     # AI Access settings (admin)
│   ├── about.html         # About page
│   ├── user-guide.html    # User guide
│   ├── favicon.ico        # Browser icon
│   └── .well-known/
│       └── security.txt   # Security contact
├── data/                  # Runtime data (gitignored except SoT files)
│   ├── admin_users.json   # Admin usernames (Source of Truth) ✓ git
│   ├── api_keys.enc       # Encrypted API keys (safe for git) ✓ git
│   ├── decks.json         # User-created decks ✨ v7.0.0
│   └── user_cards/        # User-created cards ✨ v7.0.0
└── CHANGELOG.md           # Version history
```

---

## 📄 License

Personal/educational use for learning American Kenpo Karate vocabulary.

**Kenpo vocab source:** `data/kenpo_words.json` (server-side). Set `KENPO_JSON_PATH` env var only if you need a custom location.
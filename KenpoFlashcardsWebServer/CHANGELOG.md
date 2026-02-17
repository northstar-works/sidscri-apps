# Changelog — Advanced Flashcards WebAppServer (formerly KenpoFlashcardsWebServer)

All notable changes to this project will be documented in this file.

The format is simple and practical:
- **Added**: new user-facing features
- **Changed**: behavior changes, refactors
- **Fixed**: bug fixes
- **Security**: auth/permissions/security changes

---

## Unreleased

- (Add changes here as you work. Move them into a release when you publish.)

---

## 8.9.0 (build 63) — 2026-02-17

### Added
- **Remote Config Push** – new Admin → 📱 Android tab lets admins set the active server `host`, `port`, and `server_type` (Standalone / Packaged / Raspberry Pi) that Android apps will receive when they poll the server on startup
- `GET /api/sync/remote-config` – public endpoint (no auth) Android apps call on startup to discover the current server connection config; defaults to `sidscri.tplinkdns.com:8009`
- `GET /api/admin/remote-config` – admin-only endpoint to retrieve current saved config
- `POST /api/admin/remote-config` – admin-only endpoint to save updated server config (web session auth)
- `POST /api/sync/admin/remote-config` – Android admin endpoint to update config via Bearer token auth
- `data/remote_config.json` – new persisted config file; created automatically with defaults on first save

### Changed
- Admin panel now has a 5th tab: **📱 Android** (between System and Logs)

---

## 8.8.1 (build 62) — 2026-02-07

## Added
- Decks page: **Create New Deck** and **Redeem Invite Code** collapsed by default; expand/collapse on tap
- Decks > Add Cards: new sub-tabs (**Add a New Card**, **Bulk Add with AI**) with AI generation (Keywords / Photo / Document) to add cards to an existing deck
- Edit Deck modal: new **Add Card** tab with Bulk Add with AI locked to the deck being edited
- Edit Decks → Add Cards AI: live “Example output” preview that updates as you type (Create Deck AI parity).

## Changed
- Settings > Edit Decks renamed to **Decks**
- AI Generator tab renamed to **Create Deck w/ AiGen**
- Decks view resets back to **Switch** tab on exit (next open starts on Switch)
- After adding cards via AI Generator, the Decks window closes and returns to Study
- AI generator: clear Keywords/Instructions/preview/results on exit (close/cancel/leaving the Add Cards generator).

## Fixed
- Decks: Add Cards / Create Deck / Deleted panes could appear blank because the tab sections were nested inside the Switch section; corrected the HTML structure so each tab renders independently.
- Fixed Edit Decks → Add Cards AI “Example output” staying blank due to missing preview refresh path.
- Fixed stale AI generator state persisting between Edit Deck modal opens.

## 8.7.0 (build 60) — 2026-02-06

### Added
- **AI generator **Instructions** box that overrides “Short answers only” when provided.
- Deck AI setting (default OFF): show example format template buttons/dropdown for Term/Definition templates.
- Deck AI setting (default ON): show a live “Example output” preview before generating when inputs are provided.

### Changed
- AI Template “Field(s) to change” redesigned as a compact dropdown (Definition, Terms, Definition + Term, Pronunciation, Group).
- AI Deck Generator controls refined: Generate button spacing/size, plus Preview All + Cancel actions.
- Treat AI instructions as an explicit formatting/behavior override (client + server).

### Fixed
- AI Deck Generator live “Example output” preview now shows real preview output (matches the AI Template behavior).
- AI Generator instructions box no longer stays populated after leaving the AI Generator; Clear button is always visible and sits next to the Instructions field.
- Inserted example format blocks no longer add excessive blank lines.
- Instructions textarea auto-expands to fit multi-line template text.
- Leaving the AI Generator now clears Keywords and resets Max Cards to 25.
- Learned/All **List** tabs could render blank due to a JS runtime error.
- App could fail to load from a malformed `async function` declaration.
- Edit Decks Back button sizing now matches Custom Set Settings.

## 8.6.2 (build 59) — 2026-02-04

### Added
- **Edit Deck modal tabs:** the deck edit button now opens a tabbed view: **Edit Deck** (existing) + **Edit Cards** (new).
- **Edit Cards management:** search / group filter / select cards for the active deck, with **Select all**, **Clear selection**, and **# Selected** counter.
- **Per‑card actions:** inline **Edit** (term / definition / pron / group) and **Remove** (soft delete → `deleted`).
- **Restore flows:** restore deleted cards from **Edit Decks → Deleted**, and also via **Restore** on cards shown when **Show deleted** is enabled in the Edit Cards list.
- **Duplicate handling prompt:** when an edit would duplicate another card term, prompt with **Add duplicate**, **Replace duplicate**, or **Cancel**.
- **Edited history:** edited cards are tracked under Deleted → **Edited**, with a **Clear edited history** action.
- **AI template bulk editor (with preview):** replaced the non-working “State‑only” tool with an **AI template** flow:
  - choose one or more fields to change (Term / Definition / Pron / Group),
  - type an instruction (example: “Make definitions state only; ‘Capital of Texas’ → ‘Texas’”),
  - see an **auto one‑example preview** immediately on the form,
  - use **Preview All** to view the full change list, then **Apply**.

### Changed
- Removed the non-action “dot” indicator on the deck list (active highlighting and Active text remain).
- Bulk/AI edits override any “short terms only” style toggles for the targeted field(s) during apply.

### Fixed
- **Edit Cards inline editor layout:** reformatted to match the “In Custom Set” list style (no accordion feel), with checkbox top-left, fields aligned, and Save/Cancel contained properly across mobile/desktop orientations.
- **Modal scrolling:** Edit Deck overlay now captures scroll correctly and locks background scrolling.
- **State cleanup:** search text + selections clear when the Edit Deck modal is closed/exited; search also has an **X** clear control.
- **AI Template UI:** modal now opens reliably above the Edit Deck overlay (z-index), with alerts rendered inside the Edit Cards view and auto-hiding.
- **Runtime stability:** fixed JS `await` usage inside non-async functions and corrected server-start errors introduced by endpoint indentation.

## 8.6.1 (build 58) — 2026-02-03

### Added
- **Packaged support metadata:** add `webappserver_version.json` (web server core version file).
- **Version API upgrade:** `/api/version` returns `is_packaged` plus `app_*` and `web_*` fields (packaged shows both; stand-alone shows web only).
- **Packaged support version metadata:** add `webappserver_version.json` (web server core version file).
- **Version API upgrade:** `/api/version` now returns `is_packaged` plus `app_*` and `web_*` fields (packaged shows both; stand-alone shows web only).
- **Admin/System version display:** App Information shows a single **Web Server** version line for stand-alone and dual **App + Web** versions when `is_packaged: true`.
- **User dropdown version display:** mirrors stand-alone vs packaged behavior (single vs dual version lines).

### Changed
- **Stand-alone version display:** when `is_packaged` is missing/false, Admin/System “App Information” hides the Application line and shows only Web Server version.
- **Version file lookup:** prefer `webappserver_version.json` and fall back to legacy version files when present.
- Stand-alone mode hides the **Application** line entirely when `version.json` is missing `is_packaged` or it is `false`.
- Version file lookup prefers `webappserver_version.json` and falls back to legacy filenames where present.

### Fixed
- **Startup + logging stability:** restore missing helpers used by logging (`_now`) and make log rotation resilient on Windows when log files are locked (fallback copy+truncate).
- **API reliability:** fix internal 500 errors caused by missing helpers/globals (`_load_json_file`, `_stable_id`, `HTTPException`, `_cards_cache` / `_cards_cache_mtime`) affecting `/api/health`, `/api/sync/helper`, and related endpoints.
- **Custom Set ⭐ toggle stability:** remove refresh race that caused full-deck counts to flash/stick when entering Custom Set; stabilize active-card custom-star indicator to reduce UI flicker.
- **Status line in Custom Set:** ensure the “Studying: …” line updates in Custom Set mode (not stuck on “All (flat) …”).
- **User dropdown version text:** show **Webserver Version: …** only for stand-alone (no app branding text).
- Restored helpers/globals required by Kenpo card caching and health endpoints after the packaged-support refactor (prevents 500s on `/api/health`, `/api/sync/helper`, and `/api/groups?deck_id=kenpo`).
- Logging startup is more resilient on Windows when log files are locked (rotation no longer prevents launch).

#### Layout / UX (from “Webserver Layout Fixes” work)
- **Mobile layout improvements:** adjust responsive layout/spacing so pages render better on mobile (portrait/landscape).
- **Custom Set Settings UX:** improve Manage Cards area behavior and layout consistency across desktop vs mobile.

---

## 8.6.0 (build 57) — 2026-02-02

### Added
- Settings → Display: **Show UI error log** toggle (default OFF). When enabled, JS/UI errors appear in an on-screen log panel.
- **Custom Set Settings full-page view:** Custom Set Settings converted from a modal overlay to a scrollable full-page view (same pattern as Edit Decks), eliminating mobile overflow/clipping issues.
- **Manage Cards collapsible panes:** In Custom Set → Manage Cards, both "In Custom Set" and "Available Cards" panes are collapsible (collapsed by default) on mobile in portrait **and** landscape. Accordion detection uses dual media queries to correctly detect landscape phones (where screen width exceeds 720px but height is under 500px).

### Changed
- Faster initial load after login: settings + decks now load in parallel; counts + cards load in parallel during refresh (reduced sequential network calls from 6 to 4).
- **Portrait Study action row stabilized:** Prev / Speak / Custom / Next are forced onto a single edge-to-edge row in portrait, with Next staying aligned to the right of Custom (no wrapping).
- **Breakdown button relocated (portrait):** breakdown action moved to the header next to the search icon to reduce control crowding on mobile.
- **Portrait alignment tweaks:** reduced card-area side padding to the left edge in portrait and aligned the status hint line to the left edge. Replaced the "Only Admin (...)" hint line with a compact **"Custom > Status"** hint in portrait.
- **Confirmation visuals standardized:** **✓** for success, **✖** for error. Admin confirmations auto-clear after a few seconds.
- **Custom Set study label shows filter mode:** status bar now shows "Studying: Unlearned/Unsure/Learned" instead of "Studying: Custom Set" when studying a Custom Set.

### Fixed
- Custom Sets and Saved Sets are now **deck-scoped** (no cross-deck leakage when switching decks).
- Custom Set Study view uses only the active deck's Custom Set (star tab no longer affects other deck lists).
- **Custom-marked cards now appear in Custom Set:** starred/custom cards are correctly aggregated and shown inside Custom Set, including across decks the user can access.
- **Custom Set random count input overlap fixed:** `.csRandomInput` now overrides the global `input{min-width:280px}` rule using `min-width: auto !important;` so it stays at 52px.
- **Manage Cards lists taller:** increased `.csCardList` height to show more cards (desktop and portrait).
- **Manage Cards action buttons relocated:** "Select All", "Set Learned", "Set Unsure", "Clear All", and "Remove" now live inside each expanded accordion pane (instead of a global bottom action bar).
- **Buttons compact + responsive:** removed the "Mark In-" prefix, reduced button sizing/text to match the tab typography, and made the layout adapt per screen size (portrait uses a 2-row wrap; landscape keeps actions on one row with Remove pinned right).
- **Checkbox position standardized:** selection checkboxes are placed to the **left of the term** across all orientations/devices; status badges (e.g., **U**) remain on the far right.
- **Safe text wrapping:** long terms/definitions wrap before controls and rows expand in height as needed (no overlap with checkbox/badge).
- **Landscape list viewport increased:** expanded list height so ~5 cards are visible at a time while scrolling.
- **Landscape pane width refined:** accordion pane width reduced (approx. 85% of available width) for a cleaner, less edge-to-edge look.
- **Custom Set Settings Back button resized:** reduced to ~50% size on mobile to better match the page scale.
- **Breakdown save closes modal:** saving a breakdown now closes the breakdown window/modal instead of leaving it open.
- **Custom Set → Manage Cards responsive layout:** prevented overflow/misalignment on smaller screens by overriding global input min-width and stacking the two panes on narrow widths.
- **Admin confirmations auto-clear:** "Access granted/denied" and "Deck transferred" messages now disappear after a few seconds and do not persist when changing the selected user/deck.
- **Correct icons for errors:** "Access denied" (and other error confirmations) now use **✖** instead of **✓**.
- **Custom Set counts showing 0/0/0:** backend API now returns `counts` object with `active/unsure/learned/total` breakdown so the counts line displays real numbers.
- **Settings tab empty on first open:** Custom Set Settings tab was blank when opening because `hidden` class was not removed (only `active` was added). Now properly removes both.
- **Custom Set modal overflow on mobile:** converted from modal overlay (which used `display:grid; place-items:center` causing clipping) to a full-page scrollable view inside `<main>`, eliminating horizontal/vertical overflow.
- **Landscape accordion not triggering:** `max-width: 720px` media query missed landscape phones (where width is the long edge, ~800px+). Now uses `(max-width: 720px) OR (orientation: landscape AND max-height: 500px)`. Added matching CSS landscape rules for pane stacking and card list height capping.

---

## 8.5.3 (build 56) — 2026-02-01

### Changed
- **Admin User Deck Access simplified:** removed Disable/Enable Built-In for User buttons and built-in status badge. The Allow/Deny buttons now handle all access control. Status line shows clear "Access: Granted" or "Access: Not granted" for all deck types including built-in decks.
- **Allow/Deny preserves dropdowns:** clicking Allow or Deny no longer triggers a full config reload that resets the user and deck dropdowns, enabling bulk access changes without reselecting.
- **Non-admin built-in editing off by default:** `allowNonAdminDeckEdits` now defaults to `false` in both backend config and admin UI checkbox. Label text changed from "Allow non-admins to edit built-in/unlocked decks" to "Allow non-admins to edit built-in decks".
- **Deck Ownership blank state:** "Current owner" line is now hidden when no deck is selected, and shows "No owner assigned" when a deck has no owner ID instead of displaying raw IDs.
- **Portrait card layout overhaul:** card height increased from 260px to 320px (280px on ≤400px screens). Card text enlarged to 26px (22px small screens). Card face now scrollable for long breakdown content that overflows.
- **Status line inline with Card counter:** "All (flat) • Studying: X" text now appears on the same line as "Card 1 / 10" in portrait and landscape, replacing the separate header status line on mobile.
- **Landscape controls compact:** group dropdown, All Cards, and search icon reduced to 11px font with 4px padding for minimal space usage.

### Fixed
- **Breakdown text overflow in portrait:** card faces now have `overflow-y: auto`, so long term breakdowns scroll instead of clipping or overlapping control buttons.
- **Built-in status showing incorrectly:** previously showed "✓ Built-in active" even when the deck wasn't built-in or was disabled for the user. Removed entirely in favor of the simplified access status.

---

## 8.5.2 (build 55) — 2026-02-01

### Added
- **File-based logging system:** server.log, error.log, and user_activity.log now write to disk in the logs directory, persisting across server restarts.
- **Log rotation on startup:** server.log and error.log are automatically rotated on each server start (previous saved as .prev); user_activity.log is continuous unless manually cleared (saved to .prev before clearing).
- **Log download endpoint:** `/api/admin/logs/download` serves log files for download; returns 204 if file is empty (download button disabled for empty logs).
- **Expandable admin stat tiles:** clicking any stat card (Users, Cards, Decks, Breakdowns, Learned, Unsure, Unlearned) expands a detail panel showing per-user and per-item breakdowns. Collapse by clicking again.
- **Deck Short Answers mode:** new per-deck toggle (`⚙️ Deck AI Settings` section in AI Generator tab) that forces AI-generated definitions to 1-4 words. Ideal for capitals, translations, simple vocabulary. Setting persists via `/api/decks/<id>/settings`.
- **Deck settings API:** `GET/POST /api/decks/<deck_id>/settings` for per-deck configuration (currently: shortAnswers).

### Changed
- **AI generation context-aware:** AI no longer assumes foreign language vocabulary when generating cards. Determines subject from keywords literally — "fast food chains types of food" produces menu items, not Spanish food words. Complex topics (science, etc.) get full definitions; simple ones get concise answers.
- **Add Card pre-selects active deck:** Target Deck dropdown in "Add Cards" tab now defaults to the deck you're currently studying instead of always defaulting to Kenpo Vocabulary.
- **Custom Set counts reflect custom status:** when studying a Custom Set, the Unlearned/Unsure/Learned counts line now shows the custom set's own card statuses instead of main deck statuses.
- **Random card input narrower:** "Pick random cards to add" number field reduced to prevent overlapping the label text and Add Random button; max value increased to 9999.

### Fixed
- **Custom Set Manage Cards / Saved Sets tabs blank:** tabs appeared empty because the `.hidden` class (with `!important`) was never removed during tab switching, overriding `.csTabContent.active`. Now properly toggles both classes.
- **Admin logs empty on fresh start:** logs were purely in-memory and lost on restart. Now backed by files that persist.

---

## 8.5.1 (build 54) — 2026-01-31

### Changed
- **Controls row rearranged:** group dropdown + All Cards on the left, search icon on the right (was reversed). Search overlay now expands from the right edge.
- **Settings icon moved to title row:** ⚙️ button now sits directly right of User:**** display in the header title row.
- **Study/Group label hidden:** "Study / Group" label text removed on mobile (≤600px) and landscape to save vertical space.
- **Landscape group sizing:** "Select group..." dropdown matches "All Cards" button sizing (both 6px 10px padding, 12px font).
- **Desktop search icon:** search bar replaced with 🔍 icon on all screen sizes; expands as overlay on click.
- **Portrait controls layout:** group dropdown auto-width on left, All Cards + 🔍 pushed right via space-between.
- **Landscape controls right-aligned:** controls row pushed to right side of screen.
- **Mobile logo inline:** deck logo displays inline between Cards loaded and User line instead of overlapping.
- **CSS selector fix:** corrected `.selectBtn` → `.select` to match actual HTML class on group dropdown button.
- **Removed stale `.rightControls`:** cleaned up all references to the removed rightControls div from CSS.

### Fixed (Admin Dashboard)
- **Edit User deck access API:** fixed URL mismatch (`/api/admin/user/deck_access?user_id=` → `/api/admin/user/<id>/deck-access`). Edit User modal now loads deck access correctly.
- **Edit User field name mismatch:** JS used `userDecks`/`grantedAdminDeckIds` but backend returns `ownedDecks`/`grantedAdminDecks`.
- **Owned decks show 0 cards:** backend now includes `cardCount` in deck-access endpoint response.
- **Edit User modal wider:** max-width increased from 700px to 900px; deck columns min-width 300px.
- **Edit User deck access read-only:** removed checkboxes; shows Granted/Not granted text synced with Admin > Decks status. Manage link directs to Admin > Decks > User Deck Access.
- **renderBuiltInDecks syntax:** fixed nested function causing potential JS errors.

### Added (Admin Dashboard)
- **Allow/Deny buttons:** replaced Unlock/Lock buttons with Allow/Deny + static "Access" label in User Deck Access section.
- **Live access status indicators:** selecting user + deck shows current access state (Granted/Not granted, Built-in Active/Disabled, Owned).
- **Built-in status badge:** shows ⛔ or ✓ next to Disable/Enable Built-In buttons.
- **Deck Ownership section:** new Admin > Decks > Deck Ownership panel to transfer deck ownership between users with confirmation.
- **`/api/admin/deck-ownership` endpoint:** transfers deck cards and metadata to new owner.
- **`/api/admin/user-deck-status` endpoint:** returns access status for user+deck combination.

---

## 8.5.0 (build 53) — 2026-01-31

### Changed
- **Portrait responsive controls:** study controls (group dropdown, All Cards, search, settings) display in a compact single row on portrait screens (≤600px).
- **Landscape responsive controls:** all controls fit in one row without wrapping on landscape screens (≤500px height).
- **Settings toggle behavior:** settings button toggles open/close. Close button (✕) added to settings header.
- **Search bar → icon toggle:** search is now a 🔍 icon that expands an overlay input when tapped; auto-collapses when tapping outside.
- **Saved Breakdowns moved to More:** 🧩 Saved Breakdowns relocated from main controls into Settings/More page.
- **Got it button shortened:** "Got it ✓ (mark learned)" → "Got it ✓".
- **Breakdown card button compact:** stays small and fixed next to Next in portrait.
- **Admin users table (mobile):** "Currently Studying" column hidden on ≤768px; moves under progress bar. "Last Sync" hidden on ≤480px.
- **Deck list badges (mobile):** icon-only (📦🔓👥★) on portrait.
- **Deck list actions (portrait):** stack vertically with top border separator.
- **Deck list items (portrait):** flex-wrap layout with smaller logo (28px).
- **Landscape card height:** reduced to 180px.

---

## 8.4.0 (build 52) — 2026-01-30

### Added
- **Remember me functionality**: Sessions now persist for 30 days and refresh on each request. Users stay logged in across browser restarts without needing to re-authenticate.
- **Mobile responsive design**: Comprehensive CSS media queries for tablet (≤900px), mobile (≤600px), and small mobile (≤400px) viewports.
- **Admin edit built-in decks**: Administrators can now edit built-in decks (like Kenpo Vocabulary) and upload logos for them.

### Changed
- **Deck logo**: Reduced size by ~15% (98px → 83px) and removed transform that caused jumping. Logo now stays in a fixed position.
- **Deck title**: Now truncates with ellipsis (...) when too long, preventing layout overflow on mobile.
- **Edit User modal**: Increased width from 500px to 700px for better visibility of deck access controls. Added responsive breakpoints for smaller screens.
- **Admin page**: Added mobile responsive styles for tabs, stats grid, AI grid, and modals.

### Fixed
- **Duplicate `updateHeaderDeckLogo()` call** in postLoginInit that could cause unnecessary re-renders.
- **Mobile layout issues**: Controls, tabs, cards, and modals now properly stack and resize on smaller screens.
- **Edit User modal overflow**: Deck access lists now properly scroll and columns stack vertically on mobile.

---

## 8.3.0 (build 51) — 2026-01-30

### Added
- **Runtime paths module** (`runtime/app_paths.py`) to centrally control writable locations for **data** and **logs** in both dev and packaged (frozen) runs.
- **Environment overrides** for advanced/portable setups:
  - `KENPO_APPDATA_BASE_DIR` (override base AppData folder)
  - `KENPO_DATA_DIR` / `KENPO_LOG_DIR` (explicit overrides)
- **First-run data seeding** for packaged installs: if the user’s AppData `data\` is missing required defaults, they are copied from the bundled read-only defaults (non-destructive; does not overwrite existing user data).
- **Runtime import-path resiliency for frozen builds (tray/service) to reduce install-specific startup failures.

### Changed
- **DATA_DIR / LOG_DIR resolution now uses the runtime module**:
  - Dev/source run: project-local `./data` and `./logs`
  - Packaged/frozen run: `%LOCALAPPDATA%\Advanced Flashcards WebApp Server\{data,logs}` (or env overrides)
- **Removed/neutralized legacy duplicated `LOG_DIR`/`DATA_DIR` definitions in `app.py` to prevent conflicting path behavior.

### Fixed
- **Permission errors when installed under `C:\Program Files\...`** by ensuring all write operations (logs, data, generated files) use AppData in packaged mode.
- **Server logging reliability**: `server.log` consistently initializes in the writable AppData logs folder for tray/service launches.
- **Corrected indentation issue in internal\app.py that could prevent startup in packaged installs.
- **Resolved missing module error (runtime) by ensuring runtime\ is included in the built _internal output.

### Update
- **Updated kenpo_tray.spec and kenpo_server.spec to bundle the runtime package into the EXE distribution.

---

## 8.2.0 (build 50) — 2026-01-29

### Added
- Packaged install marker: include `data/install_type.txt` (set to `packaged`) so the UI can show **Web Server Version** only in packaged installs.
- Admin > Decks: add built-in decks back via dropdown + **Add Built-In** action.
- Admin > User Deck Access: show access status for the selected user + deck and enable only valid actions (Unlock/Lock, Enable/Disable Built-In).
- Login UI: show version/build on the login panel; add password-reset fields for users required to change password.
- Create Deck: choose an add-cards method (Keyword/Photo/Document) directly under Description and auto-jump after create.
- Startup runner: print a clear `[READY]` line indicating the local + LAN URLs once the app is running.
- Logging: write persistent logs to `logs/server.log` and `logs/error.log` under the app root.

### Changed
- Create Deck (Keyword method): auto-search uses deck name + description; default max = 25.
- Packaged-only display: Web Server Version appears in User menu, About, and Admin > System only when install_type is packaged.

### Fixed

- Custom Set Randomization layout: shorter number field and renamed button to **Add Random Cards**.
- Forced password reset: login flow communicates password-change-required and guides users into resetting before entering the app.
- Admin dashboard: fix JavaScript parse errors and show a friendly message when `login_required` or `admin_required` is returned (no more infinite “Loading…”).
- Web UI boot: ensure the app initializes on page load so login/deck loading runs and `/api/...` calls fire as expected.
- Web UI: fix `app.js` syntax issues that could prevent the entire UI from running (stray closing braces / double-`async`).
- Documentation and version metadata updated for 8.2.0 (build 50).

---

## 8.1.1 (build 49) - 2026-01-29
- Fix: Admin deck dropdowns now populate correctly (stats includes full deck list + user ids).
- Fix: Deck ownership/access logic (owned vs shared) and Edit/Delete button visibility.
- Fix: Forced password reset now blocks access until changed; Web UI prompts immediately after login.
- Add: Create Deck flow can jump directly into adding cards (Keywords auto-generate up to 25, Photo/Document opens upload).
- Fix: AI generator resets keywords + max cards (25) after adding cards.
- Improve: Admin Overview tiles are clickable with detail modals; System page server-info fields are more robust.
- Improve: Server/App/User logging feeds Admin > Logs more reliably.

- (Add changes here as you work. Move them into a release when you publish.)

### Docs
- Kenpo vocab now loads from `data/kenpo_words.json` by default (docs + config updated)

---

## 8.1.0 (build 48) — 2026-01-28

### Added
- **Added GEN8 Token Admin Namespace for Android
- **Token admin endpoints** for deck access management under `/api/sync/admin/...` (admin token required).
- **Invite code redemption** endpoint for Android: `POST /api/sync/redeem-invite-code` (user token required).
- **Docs updates**: README now explicitly documents the token admin namespace and invite flow for Android parity.
- **Admin per-user sharing controls**: in **Admin → Users → Edit User**, admins can now grant/revoke access to *their own* decks for that specific user (shows “Their decks” and “Your decks”).

### Fixes
- **Fixed Sync → Pull returning 500 Internal Server Error when user progress data contained non-numeric updated_at values (e.g., "None", empty strings, timestamps). Pull now safely parses/normalizes updated_at and will not crash.
- **Fixed Admin → Users → Edit User → Deck Access failing to load (brief “Not Found” then “Failed to load”) by adding the missing API route:
- **GET /api/admin/user/deck_access?user_id=<id>
- **POST /api/admin/user/deck_access?user_id=<id>
This restores loading and saving deck grant/revoke access lists.

### Changed
- **Improved header layout stability by preventing the deck logo/user area from shifting when title text or “Cards loaded” changes.
- **Optional: adjusted deck logo vertical alignment to better line up with the “User:” badge.

---

## 8.0.2 (build 47) — 2026-01-28

### Changed
- **Deck ownership is enforced**: user-created study decks are now unique to the creating user and are no longer visible/editable by other users unless explicitly shared by an admin.

### Fixed
- **Admin “Reset Password” now works**: reset uses a login-compatible password hash, so the forced default `123456789` login is accepted.
- **Deck card storage for shared decks**: cards for user-created decks are stored per-deck (not per-user) so shared decks show consistent content for everyone with access.
- **Safety + permissions**: only the deck owner/admin can edit/delete a user-created deck or modify cards in that deck.

### Notes
- This release carries forward the **v8.0.2 (build 47)** deck ownership enforcement + admin sharing fixes.

---

## 8.0.1 (build 46) — 2026-01-27

### Added
- **Deck icons in “Switch Study Subject”**: each deck now displays a small logo icon (deck-specific or the default logo).

### Changed
- **Study page header logo** is ~25% larger and spacing/placement was adjusted to better align with the header text.

### Fixed
- **Default deck honored on refresh**: fixed `/api/settings` GET route registration so saved `activeDeckId` loads correctly; if missing/invalid, server falls back to the deck marked ★ default and persists it.
- **Deck header logos** now render correctly on the Study page (missing header `<img>` elements prevented any logo from showing).
- **Per-deck logo isolation**: changing a deck’s logo (uploading an image or choosing the default) no longer changes other decks’ logos (Kenpo remains Kenpo only).
- **Refresh + deck switch correctness**: the active deck and its logo now load consistently on page refresh and when switching decks (no more showing Kenpo’s logo on other decks).
- Logo refresh now runs on initial load and when switching/loading decks.
- Decks with no assigned logo now fall back to `/res/decklogos/advanced_flashcards_logo.png` (instead of any Kenpo-specific default).
- **Immediate logo updates**: added cache-busting on deck logo URLs so newly-uploaded images show right after Save.

---

## 8.0.0 (build 45) — 2026-01-27

### Added
- **Major rebrand**: internal project name is now **Advanced Flashcards WebAppServer**; browser UI branding is **Advanced Flashcards WebApp** (no user-visible “Server”).
- **WebApp icons**: new dedicated path `static/res/webappicons/` with updated favicon / browser tab icon using the Advanced Flashcards logo.
- **Deck logos (optional)**: support for per-deck logos with default fallback to the Advanced Flashcards logo; Kenpo deck uses its own logo.

### Changed
- Updated user-facing text from “Kenpo Flashcards” → “Advanced Flashcards WebApp” across the Web UI (while keeping the main Study page header line `Study Flashcards • {Deck} • Cards loaded: {#}` unchanged).

---


## 7.3.0 (build 44) — 2026-01-25

### Added
- **Deck Access Management System**:
  - Built-in decks can be disabled/enabled per user
  - Invite codes to unlock specific decks for users
  - Admin can manually unlock/lock decks for specific users
  - New users can be set to start with blank app (no decks)
  - Settings to control whether non-admins can edit built-in/unlocked decks

- **Admin Dashboard - Decks Tab**:
  - Global deck settings (new users get built-in, allow non-admin edits)
  - Built-in deck management with remove option
  - Invite code generation and management
  - User-specific deck access controls

- **Deck Access Types Displayed**:
  - 📦 Built-in (comes with app)
  - 🔓 Unlocked (via invite code or admin)
  - Owned (user-created)

- **Clear Default Deck**: Can now remove default status from a deck (star button when deck is default)

- **Invite Code Redemption**: Users can enter codes in Edit Decks > Switch tab

### Changed
- `_load_decks()` now respects user access permissions
- Deck list shows access type badges
- Admin stats use `include_all=True` to see all decks

### Technical
- New files: `data/deck_config.json`, `data/deck_access.json`
- New API endpoints:
  - `GET/POST /api/admin/deck-config`
  - `POST /api/admin/deck-invite-code`
  - `DELETE /api/admin/deck-invite-code/<code>`
  - `POST /api/admin/user-deck-access`
  - `POST /api/redeem-invite-code`
  - `POST /api/decks/<id>/clear_default`

---

## 7.2.1 (build 43) — 2026-01-25

### Changed
- **Custom Set Modal Redesign**:
  - Fixed modal size (700px width, 500px min-height) - no more resizing between tabs
  - Split-pane Manage Cards tab: "In Custom Set" on left, "Available Cards" on right
  - Search filtering for both card lists
  - Click cards to toggle selection, or use checkboxes
  - Add/Remove buttons between panes for easy bulk management
  - Saved Sets now show "Active" status with switch functionality
  - Each saved set stores its own cards, statuses, and settings
  - Current set name displayed in modal header

### Fixed
- **Random pick input**: Shortened to 3-digit width, aligned with other settings
- **Saved Sets**: Now properly switch between sets (not just load/replace)

---

## 7.2.0 (build 42) — 2026-01-25

### Added
- **Custom Set Management Modal**: New ⚙️ button in Custom Set toggle opens modal with:
  - **Settings Tab**: Random order toggle, pick random N cards to add
  - **Manage Tab**: Bulk select/edit cards, mark selected learned/unsure, remove selected
  - **Saved Sets Tab**: Save current Custom Set with name, load/delete saved sets
- **Server Activity Logs**: Admin dashboard Logs tab now shows real activity:
  - Login/logout events tracked
  - Filterable by type (Server, Error, User Activity)
  - Download logs as text file
  - Clear logs functionality
- **Settings Save Prompt**: When closing settings with unsaved changes, prompts user to confirm

### Changed
- Moved random cards picker from Custom toggle bar to Custom Set Settings modal
- Settings inputs now track dirty state for save prompt

### Technical
- Added `ACTIVITY_LOG` in-memory log storage (max 500 entries)
- Added `log_activity()` function for server-side logging
- Added `GET /api/admin/logs` and `POST /api/admin/logs/clear` endpoints
- Added `settingsDirty` flag and `markSettingsDirty()` function
- Saved Custom Sets stored in localStorage under `kenpo_saved_custom_sets`

---

## 7.1.0 (build 41) — 2026-01-24

### Added
- **Web Sync Endpoints**: `/api/web/sync/push` and `/api/web/sync/pull` for session-based auth (fixes "login_required" error)
- **Breakdown Indicator**: Puzzle icon (🧩) turns blue when card has breakdown data
- **Breakdown IDs API**: `GET /api/breakdowns/ids` - lightweight endpoint returning only IDs of cards with breakdown content
- **Enhanced User Stats**: Admin stats now include per-user progress %, current deck, last sync time
- **Deck Stats**: Admin dashboard shows total decks and user-created count

### Changed
- **Admin Dashboard Redesigned**: 
  - Tabbed interface: Overview, Users, System, Logs
  - Removed About/User Guide links (accessible from main app)
  - Users table shows progress bars, active deck, last sync
  - Admin badge (👑) next to admin usernames
- **Admin Stats API**: Returns detailed per-user info (learned, unsure, active counts, progress %, deck info)

### Fixed
- **Web Sync**: Push/Pull now works with session authentication (was using Android token auth)
- **Breakdown IDs**: Cards with breakdown data now properly indicated

---

## 7.0.7 (build 40) — 2026-01-24

### Added — Android Sync API
- **`GET /api/vocabulary`**: Returns kenpo_words.json (canonical source for built-in vocabulary)
- **`GET /api/sync/decks`**: Pull all decks for Android sync (requires auth)
- **`POST /api/sync/decks`**: Push deck changes from Android (requires auth)
- **`GET /api/sync/user_cards`**: Pull user-created cards (requires auth, optional deck_id filter)
- **`POST /api/sync/user_cards`**: Push user cards from Android (requires auth)
- **`DELETE /api/sync/user_cards/<card_id>`**: Delete a user card (requires auth)

### Changed
- **kenpo_words.json** now stored in `data/` folder as canonical source
- Android app can now sync decks and user cards with web server
- Full cross-platform deck and card sharing

---

## 7.0.6 (build 39) — 2026-01-24

### Added
- **Rebranded to "Study Flashcards"**: Generic app name that works for any subject
- **Header shows active deck**: App title now shows "Study Flashcards • [Deck Name]"
- **Set Default Deck**: ★ button to set a deck as the default startup deck
- **API endpoint**: `POST /api/decks/:id/set_default` - Sets a deck as default

### Changed
- **Groups filter respects active deck**: Group dropdown now shows groups from the active deck, not just Kenpo
- **Page title**: Changed from "Kenpo Flashcards (Web)" to "Study Flashcards"

### Fixed
- **Deck resets on page refresh**: Now properly loads saved `activeDeckId` before initializing app
- **Groups showing Kenpo for custom decks**: Groups API now accepts `deck_id` parameter
- **Deck switching not fully reloading**: Now reloads groups, counts, cards, and header on switch

---

## 7.0.5 (build 38) — 2026-01-24

### Added
- **🤖 AI Deck Generator**: New tab in Edit Decks to generate flashcards using AI
  - **Keywords**: Enter topic/keywords to generate cards (e.g., "Basic Spanish Words 3rd grade level")
  - **Photo**: Upload image of study material, AI extracts vocabulary
  - **Document**: Upload PDF/TXT/MD files, AI creates flashcards from content
  - Selection UI: Review generated cards, select which to add
  - Max cards configurable 1-200
  - Default keywords: Uses deck name + description if no keywords entered
- **Edit Deck**: ✏️ button to edit deck name and description
- **Logout confirmation**: "Are you sure?" prompt before logging out
- **📖 Comprehensive User Guide**: Complete rewrite with all features documented
  - Table of contents with jump links
  - Step-by-step instructions for all features
  - Tip boxes, warning boxes, and keyboard shortcuts table
  - Sections: Getting Started, Study Tabs, Edit Decks, AI Generator, Custom Set, Breakdowns, Settings, Sync, Troubleshooting
- **📱 Interactive About Page**: New tabbed interface
  - Overview with version card and quick start
  - Features grid with icons
  - Technology stack badges
  - Changelog summary
  - Contact section with email button
- **API endpoints**:
  - `POST /api/ai/generate_deck` - Generate cards from keywords, photo, or document
  - `POST /api/decks/:id` - Update deck name/description

### Changed
- **Logout moved to bottom** of user menu with red styling
- **AI definitions context-aware**: Uses deck name/description instead of always "Korean martial arts"
- **AI pronunciation**: Now generic, works for any language
- **AI group suggestions**: Now generic, not Kenpo-specific
- **Generate button**: Smaller "🔍 Generate" instead of full text
- **Max cards**: Increased from 50 to 200
- **Header card count**: Now shows count for active deck (not always 88)

### Fixed
- **Deck switching not working**: Now passes `deck_id` explicitly in all API calls
- **Active deck not loading on startup**: Loads saved `activeDeckId` from settings before loading cards
- **Cards not appearing after adding**: Added proper refresh of counts and study deck
- **AI generation errors**: Added detailed server-side logging for debugging
- **Duplicate cards in AI results**: Filters out terms that already exist in deck

---

## 7.0.4 (build 37) — 2026-01-24

### Added
- **AI Deck Generator** (initial implementation): Generate flashcards from keywords, photos, or documents
- **User cards in study deck**: User-created cards now merge with built-in cards

### Fixed
- **PDF download**: Replaced with "Print User Guide" button (avoids reportlab compatibility issues)

---

## 7.0.3 (build 36) — 2026-01-24

### Fixed
- **Health check**: Now correctly reports Kenpo JSON file status (was always showing Missing)
- **AI card generation**: API keys now loaded from encrypted storage at startup (was only reading from environment variables)
- **Custom Set random toggle**: Now properly persists when toggled (was not saving to settings)
- **Reshuffle button**: Always visible and properly sized (smaller, inline with toggle)

### Changed
- Reshuffle button now works anytime (not just when random is enabled)

---

## 7.0.2 (build 35) — 2026-01-23

### Added
- **🎲 Pick Random N**: Click dice button in Custom Set to study random subset of starred cards
- **User Management Modal**: Click "Total Users" in admin to view/edit all users
- **Admin User Editing**: Grant/revoke admin status, reset passwords
- **Password Reset**: Admins can reset user passwords to default (123456789) with required change on next login
- **System Status Feed**: Activity-style status display in admin dashboard

### Fixed
- **Edit Decks Page**: Now opens correctly (added missing hideAllViews function)
- **PDF Download**: Fixed Internal Server Error (added send_file import)
- **Admin Quick Actions**: Highlight now follows active tab (Health/Sync/AI)

### Changed
- **User Guide**: Complete redesign with better layout, feature cards, keyboard shortcuts table
- **Admin Dashboard**: Removed Card Groups section, replaced with System Status feed
- **Admin UI**: Cleaner quick action buttons, clickable user stats card

---

## 7.0.1 (build 34) — 2026-01-23

### Added
- **Reshuffle button visible**: ⟳ button now always visible on study cards (works even without random mode)
- **Search clear X button**: Clear search with one click
- **Randomize Custom Set setting**: Control random order separately for Custom Set
- **Speak pronunciation only toggle**: Option to speak only pronunciation instead of term

### Changed
- Reshuffle works regardless of random toggle state (instant shuffle on demand)

---

## 7.0.0 (build 33) — 2026-01-23

### Added
- **Edit Decks page**: New page accessible from Settings with three tabs:
  - **Switch tab**: View and switch between study decks, create new decks
  - **Add Cards tab**: Manually add cards with term, definition, pronunciation, group
  - **Deleted tab**: View and restore deleted cards
- **Deck management**: Create and delete custom study decks
- **User cards CRUD**: Add, edit, and delete user-created cards
- **AI generation buttons**:
  - Generate Definition (3 AI options to choose from)
  - Generate Pronunciation
  - Generate Group suggestions (considers existing groups)
- **API endpoints**:
  - `GET/POST /api/decks` - List and create decks
  - `DELETE /api/decks/:id` - Delete a deck
  - `GET/POST/PUT/DELETE /api/user_cards` - User cards CRUD
  - `POST /api/ai/generate_definition` - AI definition generation
  - `POST /api/ai/generate_pronunciation` - AI pronunciation generation
  - `POST /api/ai/generate_group` - AI group suggestions

### Changed
- Settings page now has "Edit Decks" button at top for quick access

---

## 6.1.0 (build 32) — 2026-01-23

### Added
- **Sync Progress page**: New settings section matching Android app with Push/Pull buttons, login status banner, auto-sync info, and breakdown sync
- **Settings tabbed navigation**: Quick nav tabs for Study, Display, Voice, Sync, and AI sections with highlighted active tab
- **Star button on study cards**: Toggle Custom Set membership directly from study view
- **Sort by status dropdown**: All list can now be sorted by Unlearned, Unsure, Learned, or Alphabetical
- **Logout in user menu**: Moved logout option to user dropdown menu with icon

### Changed
- Settings page completely redesigned with app-like card layout and modern buttons
- Buttons now use gradient backgrounds matching Android app style (primary blue, success green, danger red)
- Removed standalone logout button from header controls
- More button renamed from "Show settings" to "⚙️ More"

---

## 6.0.0 (build 31) — 2026-01-22

### Added
- **Custom Set (Starred Cards)**: New ⭐ tab for studying a personalized set of starred cards
  - ☆/★ toggle buttons in All list to add/remove cards
  - Internal status tracking (Active/Unsure/Learned) within custom set
  - Filter views: All, Unsure, Learned within custom set
  - API endpoints: `/api/custom_set`, `/api/custom_set/add`, `/api/custom_set/remove`, `/api/custom_set/toggle`, `/api/custom_set/set_status`, `/api/custom_set/clear`
- **Show breakdown on definition toggle**: New setting to show/hide breakdown on card back
- **Auto-speak on card change**: Automatically speaks term when navigating prev/next
- **Speak definition on flip**: Automatically speaks definition when card flips to back
- **Admin Dashboard redesign**: Modern dashboard with stat cards, progress bars, AI status indicators
  - Visual stats for Users, Cards, Breakdowns, Learning Progress
  - AI Configuration panel with ChatGPT/Gemini status
  - Quick Actions section for health checks
  - Card groups display and admin users list
- **API endpoint**: `/api/admin/stats` for comprehensive admin statistics
- Cards API now includes `in_custom_set` field

### Changed
- Admin page completely redesigned with modern UI, gradients, and animations
- Settings now include `show_breakdown_on_definition`, `auto_speak_on_card_change`, `speak_definition_on_flip`

---

## 5.5.3 (build 30) — 2026-01-18

- Sync: progress entries now include per-card `updated_at` timestamps
- Sync: push/pull merge uses `updated_at` (newer wins); supports offline pending queue on Android
- API: /api/sync/push and /api/sync/pull accept/return object-form progress entries

## 5.5.2 (build 29) — 2026-01-14
### Added
- **Version/docs sync with Android App 4.4.2 (v22)

### Changed
- No functional server code changes in this patch release.

---


## v5.5.1 (build 28) — 2026-01-13
### Added
- **GET /api/sync/apikeys**: New endpoint for all authenticated users to pull API keys
  - Any logged-in user can retrieve API keys (read-only)
  - Allows non-admin users to use AI breakdown features
  - Admin-only `/api/admin/apikeys` POST still required for saving keys

### Changed
- API keys are now shared with all authenticated users on login
- Admin access only required to modify/save API keys, not to use them

---

## v5.5.0 (build 27) — 2026-01-13
### Added
- **AI Access Page**: New `/ai-access.html` web page for managing API keys
- **Model Selection**: Choose ChatGPT and Gemini models from web UI
- **Startup Key Loading**: Server loads encrypted API keys from file on startup
- **Web API endpoints**: `/api/web/admin/apikeys` GET/POST for session-based admin access
- **Admin Users SoT**: `data/admin_users.json` - Source of Truth for admin usernames
- **Admin Users Endpoint**: `GET /api/admin/users` - returns admin usernames list

### Changed
- API keys now include model selection (chatGptModel, geminiModel)
- Keys loaded from `api_keys.enc` override environment variables
- Admin page now prominently links to AI Access Settings
- `_load_admin_usernames()` loads from JSON file with fallback

### Security
- Environment variable API keys no longer needed (can be removed from START_KenpoFlashcardsWebServer.bat)

---

## v5.4.0 (build 26) — 2026-01-12
### Added
- **Encrypted API Key Storage**: Admin can store ChatGPT and Gemini API keys encrypted on server
- **POST /api/admin/apikeys**: Push encrypted API keys to server (admin only)
- **GET /api/admin/apikeys**: Pull decrypted API keys from server (admin only)
- **GET /api/admin/status**: Check if current user is admin
- Admin users defined in `ADMIN_USERNAMES` set (default: sidscri)

### Security
- API keys encrypted using XOR with HMAC integrity check
- Keys derived from server's secret_key.txt using SHA-256
- Encrypted file (`api_keys.enc`) safe for git commits

---

## v5.3.1 (build 25) — 2026-01-12
### Fixed
- **Critical:** Fixed duplicate `/api/login` endpoint conflict — Flask was routing Android login requests to web session endpoint (line 781) instead of token-based endpoint (line 1272)
- Changed Android login endpoint from `/api/login` to `/api/sync/login` to avoid route collision
- Auth tokens now correctly returned to Android app

### Security
- Added `.gitignore` entries for API keys and secrets (`gpt api.txt`, `START_KenpoFlashcardsWebServer.bat`)
- Excluded `data/` directory from version control (contains user passwords and progress)

---

## v5.3.0 (build 24) — 2026-01-11
### Added
- `version.json` + `GET /api/version` endpoint
- User dropdown menu (click "User: …" to open)
- `/about` page with creator/contact info
- `/admin` diagnostics page (health/version/helper/AI status)
- `/user-guide` page (print-friendly) + `/user-guide.pdf` download

### Changed
- Added dependency on `reportlab` for generating the User Guide PDF

### Fixed
- Sync regression from v5.2 — push not applying server-side changes

---

## v5.2.0 (build 23) — 2026-01-11
### Fixed
- End-to-end sync confirmed working
- Server-side helper mapping for stable card IDs across Android and Web

---

## v5.1.1 (build 22) — 2026-01-12
### Added
- `version.json` for release tracking
- Generic favicon (trademark-safe branding)
- `static/.well-known/security.txt`
- `robots.txt`, `sitemap.xml` to reduce 404 noise

---

## v5.1.0 (build 21) — 2026-01-11
### Added
- About/Admin/User Guide pages
- User dropdown menu with version display
- Admin link visible only for user 'sidscri'

### Changed
- Added `reportlab` dependency for PDF generation

---

## v5.0.0 (build 20) — 2026-01-10
### Added
- Stable card ID mapping (helper.json) for cross-device sync
- Last known working sync baseline

---

## v4.2.0 (build 18) — 2026-01-08
### Added
- Settings reorganization with Apply-to-all logic
- Admin-only breakdown overwrite protection
- Definition-side breakdown display option
- Breakdown modal with OpenAI auto-fill

### Fixed
- Python 3.8 compatibility (replaced PEP 604 unions with `typing.Optional`)
- Dark theme dropdown styling
- Random order toggle positioning
- `updateRandomStudyUI` JS error

### Changed
- Renamed "Definition first" to "Reverse the cards (Definition first)"
- Tighter spacing for small screens

---

## v4.0.0 — 2026-01-07
### Fixed
- Python SyntaxError in `app.py` (invalid string escaping)
- Server boot and UI loading confirmed

---

# How to Update This Changelog

## Manual Updates
1. When you make changes, add them under `## Unreleased`
2. When releasing, rename `## Unreleased` to `## vX.Y.Z (build N) — YYYY-MM-DD`
3. Create a new empty `## Unreleased` section at the top

## Suggested Workflow
```bash
# Before committing significant changes:
1. Edit CHANGELOG.md
2. Add entry under "Unreleased"
3. Commit with message referencing the change

# When releasing:
1. Change "Unreleased" to version number + date
2. Add new "Unreleased" section
3. Tag the release: git tag v5.3.1
4. Push: git push && git push --tags
```
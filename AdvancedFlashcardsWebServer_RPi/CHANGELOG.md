# Changelog — AdvancedFlashcardsWebServer_RPi

All notable changes to the Raspberry Pi deployment package.

Format: **Added** / **Changed** / **Fixed** / **Removed**

---

## Unreleased

- (Add changes here as you work. Move them into a release when you publish.)

---

## 1.1.0 (build 3) — 2026-02-17

Based on: KenpoFlashcardsWebServer v8.9.0 (build 63)

### Added
- **Remote Config Push** (from webserver v8.9.0):
  - `GET /api/sync/remote-config` – public endpoint Android apps poll on startup to get active server connection info (host, port, server_type). No auth required. Defaults to `sidscri.tplinkdns.com:8009`.
  - `POST /api/admin/remote-config` – admin endpoint (web session) to save config
  - `POST /api/sync/admin/remote-config` – admin endpoint (Android Bearer token) to save config
  - Admin → 📱 Android tab: new UI panel to set server type (`standalone` / `packaged` / `rpi`), host URL, and port
  - `data/remote_config.json` persists config; auto-created with defaults on first admin save

### Changed
- Updated bundled webserver from v8.8.0 (build 61) → v8.9.0 (build 63)
- `version.json`: bumped to 1.1.0 (build 3), updated `based_on_webserver` fields

---

## 1.0.1 (build 2) — 2026-02-09

Based on: KenpoFlashcardsWebServer v8.8.0 (build 61)

### Added
- **One-shot RPi installer** (`setup_rpi.sh`): clones `sidscri/sidscri-apps` from GitHub, installs Python venv, creates `advanced-flashcards` systemd service with security hardening, seeds default data files, opens firewall port.
- **GitHub sync tool** (`af-rpi-sync.sh`): pull latest code from GitHub with `--status`, `--dry-run`, `--backup`, `--force`, `--code-only` options. Auto-updates Python deps and seeds new data files.
- **Full update tool** (`af-rpi-update.sh`): single `sudo af-rpi-update` command handles git pull + pip deps + systemd reload + restart.
- **Bidirectional data sync** (`af-rpi-datasync.sh`): push/pull user data (accounts, progress, decks, breakdowns) between Windows dev machine and RPi via SSH/rsync. Includes `status` and `backup` commands.
- **Windows data push helper** (`af-rpi-datasync-to-rpi.bat`): push data from Windows to RPi using scp (no SSH server needed on Windows).
- **Manual start script** (`START_AdvancedFlashcardsWebServer_RPi.sh`): run server without systemd for dev/testing.
- **Uninstall script** (`uninstall_rpi.sh`): clean removal of service, files, logs, and CLI tools with confirmation prompt.
- **Version sync tool** (`af-rpi-version-from-webserver.sh`): update RPi `version.json` with current webserver version info, with `--bump-build` and `--set-version` options.
- **version.json**: tracks RPi package version, build number, and based-on webserver version.
- **CHANGELOG.md**: this file.
- **INSTALL_GUIDE.md**: step-by-step RPi 5 installation from local repo.
- **GitHub Actions workflow**: CI validation for the RPi project (shellcheck, version.json parse, zip artifact).

### Technical
- systemd service: `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=true`, `PrivateTmp=true`
- Data directory preserved across updates (rsync excludes `data/`, `logs/`, `.env.rpi`)
- New data files from repo auto-seeded (never overwrites existing)
- Rolling backups (keeps last 5) before destructive operations
- RPi tools self-update from repo on `af-rpi-sync` and `af-rpi-update`
- Environment vars: uses `KENPO_*` env vars (compatible with webserver app.py)
- Install path: `/opt/advanced-flashcards/`
- Log path: `/var/log/advanced-flashcards/`
- CLI tools symlinked to `/usr/local/bin/af-rpi-*`

---

# How to Update This Changelog

1. Add changes under `## Unreleased` as you work
2. When releasing, rename to `## X.Y.Z (build N) — YYYY-MM-DD`
3. Run `af-rpi-version-from-webserver.sh --bump-build` to increment build
4. Add a new empty `## Unreleased` section at the top
5. Commit and push

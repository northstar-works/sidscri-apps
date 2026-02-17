# 🥋 Advanced Flashcards WebServer — Raspberry Pi 5+ Deployment

Deploy the Advanced Flashcards WebApp Server on a Raspberry Pi 5 (or newer) as an always-on home server. Clones from GitHub, runs as a systemd service, and includes tools to sync data between your Windows dev machine and the Pi.

**RPi Package Version:** 1.1.0 (build 3)
**Based on WebServer:** v8.9.0 (build 63)
**Changelog:** [CHANGELOG.md](CHANGELOG.md)
**Install Guide:** [INSTALL_GUIDE.md](INSTALL_GUIDE.md)

---

## 📦 What's Included

| File | Purpose |
|------|---------|
| `setup_rpi.sh` | **One-shot installer** — clones repo, installs deps, creates systemd service |
| `af-rpi-sync.sh` | **GitHub sync tool** — pull latest code, restart server |
| `af-rpi-update.sh` | **Full update** — pull + deps + restart (runs as sudo) |
| `af-rpi-datasync.sh` | **Data sync** — push/pull user data between Windows ↔ RPi |
| `af-rpi-datasync-to-rpi.bat` | **Windows helper** — push data from Windows to RPi via scp |
| `af-rpi-version-from-webserver.sh` | **Version tool** — update RPi version from webserver version |
| `START_AdvancedFlashcardsWebServer_RPi.sh` | **Manual start** — run without systemd (dev/testing) |
| `uninstall_rpi.sh` | **Clean removal** — stop service, remove all files |

---

## 🚀 Quick Start

```bash
# SSH into your Pi, then:
git clone --depth 1 https://github.com/sidscri/sidscri-apps.git /tmp/sidscri-apps
cd /tmp/sidscri-apps/AdvancedFlashcardsWebServer_RPi
chmod +x *.sh
sudo ./setup_rpi.sh
```

Access: `http://<pi-ip>:8009`

See [INSTALL_GUIDE.md](INSTALL_GUIDE.md) for detailed instructions.

---

## 🔄 Keeping It Updated

```bash
af-rpi-sync                  # Pull latest + restart
af-rpi-sync --status         # Check current version
af-rpi-sync --dry-run        # Preview changes
sudo af-rpi-update           # Full update (code + deps + restart)
```

---

## 🔁 Data Sync: Windows ↔ RPi

```bash
# From RPi:
af-rpi-datasync pull 192.168.1.100    # Pull FROM Windows
af-rpi-datasync push 192.168.1.100    # Push TO Windows
af-rpi-datasync status                 # Show data info
af-rpi-datasync backup                 # Local backup
```

```batch
REM From Windows:
af-rpi-datasync-to-rpi.bat 192.168.1.50
```

---

## 🛠 Service Management

```bash
sudo systemctl start   advanced-flashcards
sudo systemctl stop    advanced-flashcards
sudo systemctl restart advanced-flashcards
sudo systemctl status  advanced-flashcards
sudo journalctl -u advanced-flashcards -f       # Live logs
```

---

## ⚙️ Configuration

Edit `/opt/advanced-flashcards/.env.rpi`:

```bash
KENPO_WEB_PORT=8009
KENPO_DATA_DIR=/opt/advanced-flashcards/data
KENPO_LOG_DIR=/var/log/advanced-flashcards
KENPO_ROOT=/opt/advanced-flashcards/repo
```

Then: `sudo systemctl restart advanced-flashcards`

> **Note:** `KENPO_*` env var names are used for compatibility with the webserver's `app.py`.

---

## 📁 Repo Structure

```
sidscri-apps/
├── AdvancedFlashcardsWebServer_RPi/    ← This project (RPi deployment)
│   ├── setup_rpi.sh
│   ├── af-rpi-sync.sh
│   ├── af-rpi-update.sh
│   ├── af-rpi-datasync.sh
│   ├── af-rpi-datasync-to-rpi.bat
│   ├── af-rpi-version-from-webserver.sh
│   ├── START_AdvancedFlashcardsWebServer_RPi.sh
│   ├── uninstall_rpi.sh
│   ├── version.json
│   ├── CHANGELOG.md
│   ├── INSTALL_GUIDE.md
│   └── README.md
├── KenpoFlashcardsWebServer/          ← WebServer source (deployed to RPi)
├── KenpoFlashcardsProject-v2/         ← Android app
└── tools/
    └── SyncTool-WebServerToAndroid/
```

---

## 📋 Version History

See [CHANGELOG.md](CHANGELOG.md) for full history.

### RPi Package v1.0.0 (2026-02-09)
- Initial release: installer, systemd service, GitHub sync, data sync, Windows helper
- Based on Advanced Flashcards WebServer v8.8.0 (build 61)

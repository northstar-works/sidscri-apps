# SyncTool: WebServer → RPi

Push Advanced Flashcards WebServer code and/or data from your Windows dev machine to a Raspberry Pi.

## Quick Start

```batch
REM Push code (default)
SyncTool-WebServerToRPi.bat 192.168.1.50

REM Push code + data
SyncTool-WebServerToRPi.bat 192.168.1.50 --all

REM Push data only
SyncTool-WebServerToRPi.bat 192.168.1.50 --data

REM Check RPi status
SyncTool-WebServerToRPi.bat 192.168.1.50 --status

REM Compare versions
SyncTool-WebServerToRPi.bat 192.168.1.50 --version
```

## Modes

| Mode | What It Does |
|------|-------------|
| `--code` | Push WebServer code (default). Excludes data/, logs/, .venv/ |
| `--data` | Push data/ only. Creates RPi backup first. Asks for confirmation |
| `--all` | Push code + data. Creates RPi backup first. Asks for confirmation |
| `--status` | Show RPi service status, version, data size |
| `--restart` | Just restart the RPi service |
| `--version` | Compare local WebServer version vs RPi version |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--dry-run` | — | Preview what would be synced, no changes |
| `--user <u>` | `pi` | RPi SSH username |
| `--port <p>` | `22` | RPi SSH port |

## Prerequisites

- RPi has been set up with `setup_rpi.sh` (Advanced Flashcards service running)
- SSH enabled on the RPi
- Windows 10+ (scp built in)

## Folder Structure

```
sidscri-apps\
├── tools\
│   └── SyncTool-WebServerToRPi\    ← This tool
│       ├── SyncTool-WebServerToRPi.bat
│       ├── version.json
│       └── README.md
├── KenpoFlashcardsWebServer\       ← Source (auto-detected)
└── AdvancedFlashcardsWebServer_RPi\ ← RPi deployment project
```

## What Gets Synced

### Code mode (`--code`)
Everything in `KenpoFlashcardsWebServer\` **except**:
- `data/` (user accounts, progress, decks)
- `logs/`
- `.venv/`
- `__pycache__/`
- `.git`
- `*.bat`, `*.pyc`, `.env.rpi`

### Data mode (`--data`)
Everything in `KenpoFlashcardsWebServer\data\`:
- `profiles.json`, `breakdowns.json`, `decks.json`
- `users/`, `user_cards/`, `deck_cards/`
- `api_keys.enc`, `secret_key.txt`
- `kenpo_words.json`, `helper.json`

## Safety

- **Data pushes always ask for confirmation**
- **RPi backup created automatically** before data overwrites
- **Service stopped** during sync, restarted after
- **Code pushes never touch data/** on the RPi

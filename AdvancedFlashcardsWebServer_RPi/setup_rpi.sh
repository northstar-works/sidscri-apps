#!/usr/bin/env bash
# ============================================================
# Advanced Flashcards WebServer — Raspberry Pi 5+ Setup Script
# Version: 1.0.0  |  Project: AdvancedFlashcardsWebServer_RPi
# Tested on: Raspberry Pi OS (Bookworm 64-bit), Ubuntu 24.04
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="advanced-flashcards"
INSTALL_DIR="/opt/advanced-flashcards"
APP_DIR="${INSTALL_DIR}"
REPO_DIR="${INSTALL_DIR}/repo"
APP_USER="${SUDO_USER:-$(whoami)}"
APP_GROUP="$(id -gn "${APP_USER}")"
DATA_DIR="/opt/advanced-flashcards/data"
LOG_DIR="/var/log/advanced-flashcards"
VENV_DIR="/opt/advanced-flashcards/.venv"
SERVICE_FILE="/etc/systemd/system/advanced-flashcards.service"
GITHUB_REPO="https://github.com/sidscri/sidscri-apps.git"
WEBSERVER_SUBDIR="KenpoFlashcardsWebServer"
RPI_PROJECT_SUBDIR="AdvancedFlashcardsWebServer_RPi"
KENPO_WEB_PORT="${KENPO_WEB_PORT:-8009}"
RUN_USER="${SUDO_USER:-pi}"

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
header(){ echo -e "\n${CYAN}══════════════════════════════════════════════════${NC}"; echo -e "${CYAN}  $*${NC}"; echo -e "${CYAN}══════════════════════════════════════════════════${NC}"; }

# ── Root check ───────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    error "This script must be run with sudo."
    echo "  Usage: sudo ./setup_rpi.sh"
    exit 1
fi

# ── Detect Pi model ──────────────────────────────────────────
header "Detecting Raspberry Pi Hardware"
PI_MODEL="unknown"
if [[ -f /proc/device-tree/model ]]; then
    PI_MODEL=$(tr -d '\0' < /proc/device-tree/model)
fi
info "Detected: ${PI_MODEL}"

if echo "$PI_MODEL" | grep -qiE "raspberry pi [5-9]|raspberry pi model [5-9]"; then
    info "✓ Raspberry Pi 5+ confirmed"
elif echo "$PI_MODEL" | grep -qi "raspberry pi 4"; then
    warn "Raspberry Pi 4 detected — should work but RPi 5+ is recommended"
else
    warn "Could not confirm RPi 5+. Continuing anyway..."
fi

# ── System packages ──────────────────────────────────────────
header "Installing System Dependencies"
apt-get update -qq
apt-get install -y -qq \
    python3 python3-venv python3-pip \
    git curl jq rsync \
    > /dev/null 2>&1

PYTHON_VER=$(python3 --version 2>&1)
info "Python: ${PYTHON_VER}"

GIT_VER=$(git --version 2>&1)
info "Git: ${GIT_VER}"

# ── Clone or update repo ────────────────────────────────────
header "Setting Up Application"
REPO_DIR="/opt/advanced-flashcards/repo"

if [[ -d "${REPO_DIR}/.git" ]]; then
    info "Existing repo found — pulling latest..."
    cd "$REPO_DIR"
    sudo -u "$RUN_USER" git pull --ff-only || {
        warn "git pull failed — doing hard reset to origin/main"
        sudo -u "$RUN_USER" git fetch origin
        sudo -u "$RUN_USER" git reset --hard origin/main
    }
else
    info "Cloning ${GITHUB_REPO}..."
    mkdir -p "$(dirname "$REPO_DIR")"
    chown "$RUN_USER":"$RUN_USER" "$(dirname "$REPO_DIR")"
    sudo -u "$RUN_USER" git clone --depth 1 "$GITHUB_REPO" "$REPO_DIR"
fi

# ── Verify webserver subdir exists ───────────────────────────
WEBSERVER_SRC="${REPO_DIR}/${WEBSERVER_SUBDIR}"
if [[ ! -f "${WEBSERVER_SRC}/app.py" ]]; then
    error "app.py not found at ${WEBSERVER_SRC}/app.py"
    error "Check that the repo structure is correct."
    exit 1
fi
info "✓ Found app.py at ${WEBSERVER_SRC}"

# ── Create install directories ───────────────────────────────
header "Creating Directory Structure"
mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$LOG_DIR"

# Sync webserver code (excluding data/ and logs/ to preserve user data)
info "Syncing application code to ${APP_DIR}..."
rsync -a --delete \
    --exclude 'data/' \
    --exclude 'logs/' \
    --exclude '.venv/' \
    --exclude 'repo/' \
    --exclude 'backups/' \
    --exclude '.env.rpi' \
    --exclude 'af-rpi-*.sh' \
    --exclude '__pycache__/' \
    --exclude '*.pyc' \
    --exclude '.git' \
    --exclude '.gitignore' \
    --exclude 'START_KenpoFlashcardsWebServer.bat' \
    "${WEBSERVER_SRC}/" "${APP_DIR}/"

# Seed data directory (copy defaults if data files don't exist yet)
if [[ -d "${WEBSERVER_SRC}/data" ]]; then
    info "Seeding data defaults (won't overwrite existing)..."
    find "${WEBSERVER_SRC}/data" -type f | while read -r src_file; do
        rel="${src_file#${WEBSERVER_SRC}/data/}"
        dst="${DATA_DIR}/${rel}"
        if [[ ! -f "$dst" ]]; then
            mkdir -p "$(dirname "$dst")"
            cp "$src_file" "$dst"
            info "  Seeded: data/${rel}"
        fi
    done
fi

# Copy RPi-specific tools from repo if present
RPI_SRC="${REPO_DIR}/${RPI_PROJECT_SUBDIR}"
if [[ -d "$RPI_SRC" ]]; then
    info "Copying RPi tools from repo..."
    for tool in af-rpi-sync.sh af-rpi-update.sh af-rpi-datasync.sh; do
        if [[ -f "${RPI_SRC}/${tool}" ]]; then
            cp "${RPI_SRC}/${tool}" "${INSTALL_DIR}/${tool}"
            chmod +x "${INSTALL_DIR}/${tool}"
        fi
    done
fi

# Fix ownership
chown -R "$RUN_USER":"$RUN_USER" "$INSTALL_DIR" "$DATA_DIR" "$LOG_DIR"
info "✓ Directories ready"

# ── Python virtual environment ───────────────────────────────
header "Setting Up Python Environment"
if [[ ! -f "${VENV_DIR}/bin/python" ]]; then
    info "Creating virtual environment..."
    sudo -u "$RUN_USER" python3 -m venv "$VENV_DIR"
fi

info "Installing/upgrading Python packages..."
sudo -u "$RUN_USER" "${VENV_DIR}/bin/pip" install --upgrade pip -q
sudo -u "$RUN_USER" "${VENV_DIR}/bin/pip" install -r "${INSTALL_DIR}/requirements.txt" -q
info "✓ Python dependencies installed"

# ── Environment config file ──────────────────────────────────
header "Creating Configuration"
ENV_FILE="${INSTALL_DIR}/.env.rpi"
if [[ ! -f "$ENV_FILE" ]]; then
    cat > "$ENV_FILE" << ENVEOF
# Advanced Flashcards WebServer — RPi Configuration
# Edit this file to change settings, then restart:
#   sudo systemctl restart advanced-flashcards

# Network port (default: 8009)
KENPO_WEB_PORT=${KENPO_WEB_PORT}

# Data directory (where user accounts, progress, decks are stored)
KENPO_DATA_DIR=${DATA_DIR}

# Log directory
KENPO_LOG_DIR=${LOG_DIR}

# kenpo_words.json auto-discovery root
KENPO_ROOT=${APP_DIR}
ENVEOF
    chown "$RUN_USER":"$RUN_USER" "$ENV_FILE"
    info "✓ Config created at ${ENV_FILE}"
else
    info "✓ Config already exists at ${ENV_FILE} (preserved)"
fi

# ── systemd service ──────────────────────────────────────────
header "Installing systemd Service"
cat > "$SERVICE_FILE" << SVCEOF
[Unit]
Description=Advanced Flashcards WebServer (RPi)
Documentation=https://github.com/sidscri/sidscri-apps
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
Group=${RUN_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${INSTALL_DIR}/.env.rpi
ExecStart=${VENV_DIR}/bin/python ${INSTALL_DIR}/app.py
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR} ${LOG_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable advanced-flashcards.service
info "✓ Service installed and enabled"

# ── Install CLI tools ────────────────────────────────────────
header "Installing CLI Tools"

# Copy tools from script dir (initial install) or from repo
for tool_src in af-rpi-sync.sh af-rpi-update.sh af-rpi-datasync.sh; do
    tool_name="${tool_src%.sh}"
    if [[ -f "${SCRIPT_DIR}/${tool_src}" ]]; then
        cp "${SCRIPT_DIR}/${tool_src}" "${INSTALL_DIR}/${tool_src}"
    fi
    if [[ -f "${INSTALL_DIR}/${tool_src}" ]]; then
        chmod +x "${INSTALL_DIR}/${tool_src}"
        chown "$RUN_USER":"$RUN_USER" "${INSTALL_DIR}/${tool_src}"
        ln -sf "${INSTALL_DIR}/${tool_src}" "/usr/local/bin/${tool_name}"
        info "✓ ${tool_name} → /usr/local/bin/${tool_name}"
    fi
done

# ── Firewall (if ufw is active) ──────────────────────────────
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
    info "Opening port ${KENPO_WEB_PORT} in UFW..."
    ufw allow "${KENPO_WEB_PORT}/tcp" comment "Advanced Flashcards" > /dev/null 2>&1
fi

# ── Start the service ────────────────────────────────────────
header "Starting Advanced Flashcards WebServer"
systemctl start advanced-flashcards.service
sleep 2

if systemctl is-active --quiet advanced-flashcards.service; then
    info "✓ Service is running!"
else
    error "Service failed to start. Check logs with:"
    echo "  sudo journalctl -u advanced-flashcards -n 50 --no-pager"
    exit 1
fi

# ── Get LAN IP ───────────────────────────────────────────────
LAN_IP=$(hostname -I | awk '{print $1}')

# ── Done ─────────────────────────────────────────────────────
header "Setup Complete! 🥋"
echo ""
echo -e "  ${GREEN}Local:${NC}   http://localhost:${KENPO_WEB_PORT}"
echo -e "  ${GREEN}LAN:${NC}     http://${LAN_IP}:${KENPO_WEB_PORT}"
echo ""
echo -e "  ${CYAN}Manage the service:${NC}"
echo "    sudo systemctl start   advanced-flashcards"
echo "    sudo systemctl stop    advanced-flashcards"
echo "    sudo systemctl restart advanced-flashcards"
echo "    sudo systemctl status  advanced-flashcards"
echo ""
echo -e "  ${CYAN}View logs:${NC}"
echo "    sudo journalctl -u advanced-flashcards -f"
echo ""
echo -e "  ${CYAN}Sync from GitHub:${NC}"
echo "    af-rpi-sync              # pull + restart"
echo "    af-rpi-sync --status     # show current version"
echo "    af-rpi-sync --dry-run    # preview changes"
echo ""
echo -e "  ${CYAN}Update everything:${NC}"
echo "    sudo af-rpi-update       # pull repo + update deps + restart"
echo ""
echo -e "  ${CYAN}Configuration:${NC}"
echo "    ${ENV_FILE}"
echo ""

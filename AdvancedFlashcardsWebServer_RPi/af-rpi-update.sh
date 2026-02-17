#!/usr/bin/env bash
# ============================================================
# af-rpi-update — Full update: pull repo, update deps, restart
# Project: AdvancedFlashcardsWebServer_RPi
# Must be run with sudo.
# ============================================================
set -euo pipefail

INSTALL_DIR="/opt/advanced-flashcards"
APP_DIR="${INSTALL_DIR}"
REPO_DIR="${INSTALL_DIR}/repo"
APP_USER="${SUDO_USER:-$(whoami)}"
APP_GROUP="$(id -gn "${APP_USER}")"
REPO_DIR="/opt/advanced-flashcards/repo"
VENV_DIR="/opt/advanced-flashcards/.venv"
SERVICE_NAME="advanced-flashcards"
WEBSERVER_SUBDIR="KenpoFlashcardsWebServer"
RPI_PROJECT_SUBDIR="AdvancedFlashcardsWebServer_RPi"
DATA_DIR="/opt/advanced-flashcards/data"
RUN_USER="${SUDO_USER:-pi}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[UPDATE]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}   $*"; }
error() { echo -e "${RED}[ERROR]${NC}  $*"; }

if [[ $EUID -ne 0 ]]; then
    error "Must be run with sudo: sudo af-rpi-update"
    exit 1
fi

echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Advanced Flashcards WebServer — Full Update${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo ""

# Step 1: System packages
info "Checking system packages..."
apt-get update -qq > /dev/null 2>&1
apt-get install -y -qq python3 python3-venv python3-pip git rsync > /dev/null 2>&1

# Step 2: Pull from GitHub
cd "$REPO_DIR"
OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "none")

info "Pulling latest from GitHub..."
sudo -u "$RUN_USER" git fetch origin
sudo -u "$RUN_USER" git pull --ff-only || {
    warn "Fast-forward failed — hard resetting to origin/main"
    sudo -u "$RUN_USER" git reset --hard origin/main
}

NEW_COMMIT=$(git rev-parse --short HEAD)
if [[ "$OLD_COMMIT" == "$NEW_COMMIT" ]]; then
    info "Already up to date (${OLD_COMMIT})"
else
    info "Updated: ${OLD_COMMIT} → ${NEW_COMMIT}"
    echo ""
    git log --oneline "${OLD_COMMIT}..HEAD" -- "${WEBSERVER_SUBDIR}/" 2>/dev/null || true
    echo ""
fi

# Step 3: Sync webserver code
WEBSERVER_SRC="${REPO_DIR}/${WEBSERVER_SUBDIR}"
info "Syncing application code..."

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
    --exclude '.env.rpi' \
    "${WEBSERVER_SRC}/" "${APP_DIR}/"

# Step 4: Update RPi tools from repo
RPI_SRC="${REPO_DIR}/${RPI_PROJECT_SUBDIR}"
if [[ -d "$RPI_SRC" ]]; then
    for tool in af-rpi-sync.sh af-rpi-update.sh af-rpi-datasync.sh; do
        if [[ -f "${RPI_SRC}/${tool}" ]]; then
            cp "${RPI_SRC}/${tool}" "${INSTALL_DIR}/${tool}"
            chmod +x "${INSTALL_DIR}/${tool}"
            tool_name="${tool%.sh}"
            ln -sf "${INSTALL_DIR}/${tool}" "/usr/local/bin/${tool_name}"
        fi
    done
    info "✓ RPi tools updated"
fi

# Step 5: Seed new data files
if [[ -d "${WEBSERVER_SRC}/data" ]]; then
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

# Step 6: Update Python deps
info "Updating Python dependencies..."
sudo -u "$RUN_USER" "${VENV_DIR}/bin/pip" install --upgrade pip -q 2>/dev/null
sudo -u "$RUN_USER" "${VENV_DIR}/bin/pip" install -r "${INSTALL_DIR}/requirements.txt" -q 2>/dev/null
info "✓ Dependencies updated"

# Step 7: Fix permissions
chown -R "$RUN_USER":"$RUN_USER" "$INSTALL_DIR"

# Step 8: Restart
systemctl daemon-reload
info "Restarting service..."
systemctl restart "$SERVICE_NAME"
sleep 2

if systemctl is-active --quiet "$SERVICE_NAME"; then
    info "✓ Service restarted"
else
    error "Service failed!"
    echo "  Logs: sudo journalctl -u ${SERVICE_NAME} -n 30 --no-pager"
    exit 1
fi

if [[ -f "${INSTALL_DIR}/version.json" ]]; then
    VER=$(python3 -c "import json; v=json.load(open('${INSTALL_DIR}/version.json')); print(f\"v{v['version']} (build {v['build']})\")" 2>/dev/null || echo "unknown")
    info "Running: ${VER}"
fi

PORT=$(grep -oP 'KENPO_WEB_PORT=\K\d+' "${INSTALL_DIR}/.env.rpi" 2>/dev/null || echo "8009")
LAN_IP=$(hostname -I | awk '{print $1}')
echo ""
info "✓ Update complete → http://${LAN_IP}:${PORT}"

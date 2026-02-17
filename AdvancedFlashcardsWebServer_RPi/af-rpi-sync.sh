#!/usr/bin/env bash
# ============================================================
# af-rpi-sync — Pull from GitHub & sync to Raspberry Pi
# Project: AdvancedFlashcardsWebServer_RPi
# ============================================================
# Usage:
#   af-rpi-sync              Pull latest, sync code, restart service
#   af-rpi-sync --status     Show version and service status
#   af-rpi-sync --dry-run    Preview changes (no restart)
#   af-rpi-sync --code-only  Sync code without restarting
#   af-rpi-sync --force      Force reset to origin/main
#   af-rpi-sync --backup     Backup data before syncing
# ============================================================
set -euo pipefail

INSTALL_DIR="/opt/advanced-flashcards"
APP_DIR="${INSTALL_DIR}"
REPO_DIR="${INSTALL_DIR}/repo"
APP_USER="${SUDO_USER:-$(whoami)}"
APP_GROUP="$(id -gn "${APP_USER}")"
REPO_DIR="/opt/advanced-flashcards/repo"
DATA_DIR="/opt/advanced-flashcards/data"
LOG_DIR="/var/log/advanced-flashcards"
WEBSERVER_SUBDIR="KenpoFlashcardsWebServer"
RPI_PROJECT_SUBDIR="AdvancedFlashcardsWebServer_RPi"
SERVICE_NAME="advanced-flashcards"
BACKUP_DIR="/opt/advanced-flashcards/backups"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "${GREEN}[SYNC]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Parse arguments ──────────────────────────────────────────
DRY_RUN=false; CODE_ONLY=false; FORCE=false; DO_BACKUP=false; SHOW_STATUS=false

for arg in "$@"; do
    case "$arg" in
        --dry-run)    DRY_RUN=true ;;
        --code-only)  CODE_ONLY=true ;;
        --force)      FORCE=true ;;
        --backup)     DO_BACKUP=true ;;
        --status)     SHOW_STATUS=true ;;
        --help|-h)
            echo "Usage: af-rpi-sync [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --status     Show current version and service status"
            echo "  --dry-run    Preview changes without applying"
            echo "  --code-only  Sync code, don't restart service"
            echo "  --force      Hard reset to origin/main"
            echo "  --backup     Backup data/ before syncing"
            echo "  -h, --help   Show this help"
            exit 0
            ;;
        *) error "Unknown option: $arg"; exit 1 ;;
    esac
done

# ── Status command ───────────────────────────────────────────
if $SHOW_STATUS; then
    echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  Advanced Flashcards WebServer — RPi Status         ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""

    # WebServer version
    if [[ -f "${INSTALL_DIR}/version.json" ]]; then
        VER=$(python3 -c "import json; v=json.load(open('${INSTALL_DIR}/version.json')); print(f\"v{v['version']} (build {v['build']})\")" 2>/dev/null || echo "unknown")
        echo -e "  ${BOLD}WebServer:${NC}  ${VER}"
    fi
    # RPi package version
    RPI_VER_FILE="${REPO_DIR}/${RPI_PROJECT_SUBDIR}/version.json"
    if [[ -f "$RPI_VER_FILE" ]]; then
        RPIVER=$(python3 -c "import json; v=json.load(open('${RPI_VER_FILE}')); print(f\"v{v['version']} (build {v['build']})\")" 2>/dev/null || echo "unknown")
        echo -e "  ${BOLD}RPi Package:${NC} ${RPIVER}"
    fi

    # Git status
    if [[ -d "${REPO_DIR}/.git" ]]; then
        cd "$REPO_DIR"
        BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
        COMMIT=$(git log -1 --format='%h %s' 2>/dev/null || echo "unknown")
        echo -e "  ${BOLD}Branch:${NC}     ${BRANCH}"
        echo -e "  ${BOLD}Commit:${NC}     ${COMMIT}"
        BEHIND=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "?")
        if [[ "$BEHIND" != "0" && "$BEHIND" != "?" ]]; then
            echo -e "  ${BOLD}Behind:${NC}     ${YELLOW}${BEHIND} commits behind origin/main${NC}"
        fi
    fi

    echo ""
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo -e "  ${BOLD}Service:${NC}    ${GREEN}● running${NC}"
    else
        echo -e "  ${BOLD}Service:${NC}    ${RED}● stopped${NC}"
    fi

    UPTIME=$(systemctl show "$SERVICE_NAME" --property=ActiveEnterTimestamp --value 2>/dev/null || echo "")
    [[ -n "$UPTIME" ]] && echo -e "  ${BOLD}Since:${NC}      ${UPTIME}"

    PORT=$(grep -oP 'KENPO_WEB_PORT=\K\d+' "${INSTALL_DIR}/.env.rpi" 2>/dev/null || echo "8009")
    LAN_IP=$(hostname -I | awk '{print $1}')
    echo -e "  ${BOLD}URL:${NC}        http://${LAN_IP}:${PORT}"

    echo ""
    DATA_SIZE=$(du -sh "$DATA_DIR" 2>/dev/null | awk '{print $1}' || echo "?")
    LOG_SIZE=$(du -sh "$LOG_DIR" 2>/dev/null | awk '{print $1}' || echo "?")
    echo -e "  ${BOLD}Data:${NC}       ${DATA_SIZE} (${DATA_DIR})"
    echo -e "  ${BOLD}Logs:${NC}       ${LOG_SIZE} (${LOG_DIR})"
    echo ""
    exit 0
fi

# ── Pre-flight ───────────────────────────────────────────────
if [[ ! -d "${REPO_DIR}/.git" ]]; then
    error "Repository not found at ${REPO_DIR}"
    echo "  Run 'sudo ./setup_rpi.sh' first."
    exit 1
fi

# ── Backup (optional) ───────────────────────────────────────
if $DO_BACKUP; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="${BACKUP_DIR}/data_backup_${TIMESTAMP}.tar.gz"
    mkdir -p "$BACKUP_DIR"
    info "Creating backup → ${BACKUP_FILE}"
    tar -czf "$BACKUP_FILE" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
    info "✓ Backup complete ($(du -sh "$BACKUP_FILE" | awk '{print $1}'))"
    ls -1t "${BACKUP_DIR}"/data_backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
fi

# ── Git pull ─────────────────────────────────────────────────
cd "$REPO_DIR"
OLD_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "none")

info "Fetching from origin..."
git fetch origin 2>/dev/null

NEW_COMMIT=$(git rev-parse origin/main 2>/dev/null || echo "none")
if [[ "$OLD_COMMIT" == "$NEW_COMMIT" ]]; then
    info "Already up to date (${OLD_COMMIT:0:7})"
    $DRY_RUN || exit 0
fi

if $DRY_RUN; then
    echo ""
    echo -e "${CYAN}── Changes available ──${NC}"
    git log --oneline "${OLD_COMMIT}..origin/main" 2>/dev/null || true
    echo ""
    echo -e "${CYAN}── WebServer files changed ──${NC}"
    git diff --stat "${OLD_COMMIT}..origin/main" -- "${WEBSERVER_SUBDIR}/" 2>/dev/null || true
    echo ""
    echo -e "${CYAN}── RPi project files changed ──${NC}"
    git diff --stat "${OLD_COMMIT}..origin/main" -- "${RPI_PROJECT_SUBDIR}/" 2>/dev/null || true
    echo ""
    info "Dry run complete. Use 'af-rpi-sync' to apply."
    exit 0
fi

info "Pulling latest changes..."
if $FORCE; then
    warn "Force mode: resetting to origin/main"
    git reset --hard origin/main
else
    git pull --ff-only || { error "Fast-forward failed. Use --force to hard reset."; exit 1; }
fi

PULLED_COMMIT=$(git rev-parse --short HEAD)
info "✓ Updated to ${PULLED_COMMIT}"

CHANGES=$(git diff --stat "${OLD_COMMIT}..HEAD" -- "${WEBSERVER_SUBDIR}/" 2>/dev/null || true)
if [[ -n "$CHANGES" ]]; then
    echo -e "\n${CYAN}── WebServer changes ──${NC}\n${CHANGES}\n"
fi

# ── Rsync code to install dir ────────────────────────────────
WEBSERVER_SRC="${REPO_DIR}/${WEBSERVER_SUBDIR}"
info "Syncing code to ${INSTALL_DIR}..."

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

info "✓ Code synced"

# ── Update RPi tools from repo if changed ────────────────────
RPI_SRC="${REPO_DIR}/${RPI_PROJECT_SUBDIR}"
if [[ -d "$RPI_SRC" ]]; then
    for tool in af-rpi-sync.sh af-rpi-update.sh af-rpi-datasync.sh; do
        if [[ -f "${RPI_SRC}/${tool}" ]]; then
            cp "${RPI_SRC}/${tool}" "${INSTALL_DIR}/${tool}"
            chmod +x "${INSTALL_DIR}/${tool}"
        fi
    done
fi

# ── Check Python deps ────────────────────────────────────────
VENV_DIR="${INSTALL_DIR}/.venv"
if [[ -f "${INSTALL_DIR}/requirements.txt" ]]; then
    info "Checking Python dependencies..."
    "${VENV_DIR}/bin/pip" install -r "${INSTALL_DIR}/requirements.txt" -q 2>/dev/null
fi

# ── Seed new data files ─────────────────────────────────────
if [[ -d "${WEBSERVER_SRC}/data" ]]; then
    find "${WEBSERVER_SRC}/data" -type f | while read -r src_file; do
        rel="${src_file#${WEBSERVER_SRC}/data/}"
        dst="${DATA_DIR}/${rel}"
        if [[ ! -f "$dst" ]]; then
            mkdir -p "$(dirname "$dst")"
            cp "$src_file" "$dst"
            info "  Seeded new data: ${rel}"
        fi
    done
fi

# ── Restart service ──────────────────────────────────────────
if $CODE_ONLY; then
    info "Code-only mode — skipping restart"
else
    info "Restarting service..."
    sudo systemctl restart "$SERVICE_NAME"
    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        info "✓ Service restarted"
    else
        error "Service failed after sync!"
        echo "  Check: sudo journalctl -u ${SERVICE_NAME} -n 30 --no-pager"
        exit 1
    fi
fi

# ── Version info ─────────────────────────────────────────────
if [[ -f "${INSTALL_DIR}/version.json" ]]; then
    VER=$(python3 -c "import json; v=json.load(open('${INSTALL_DIR}/version.json')); print(f\"v{v['version']} (build {v['build']})\")" 2>/dev/null || echo "unknown")
    info "Now running: ${VER}"
fi

PORT=$(grep -oP 'KENPO_WEB_PORT=\K\d+' "${INSTALL_DIR}/.env.rpi" 2>/dev/null || echo "8009")
LAN_IP=$(hostname -I | awk '{print $1}')
info "Available at: http://${LAN_IP}:${PORT}"

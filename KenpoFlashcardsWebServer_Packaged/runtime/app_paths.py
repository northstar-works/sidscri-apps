"""Runtime path + seeding helpers (single source of truth).

RUNTIME_APP_PATHS_MODULE_V1

Goals:
- Installed EXE (Program Files / PyInstaller): ALL writes go to per-user AppData
- Dev mode (run from source): keep project-local ./data and ./logs
- Optional overrides via env:
    KENPO_APPDATA_BASE_DIR  -> base folder containing data/, logs/, etc
    KENPO_DATA_DIR          -> explicit data folder
    KENPO_LOG_DIR           -> explicit logs folder
"""

from __future__ import annotations

import os
import sys
import shutil
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

APP_NAME_DEFAULT = "Advanced Flashcards WebApp Server"

@dataclass(frozen=True)
class AppPaths:
    app_name: str
    project_root: Path          # read-only-ish bundle root when frozen
    appdata_root: Path          # per-user writable root
    data_dir: Path
    logs_dir: Path

def _is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False)) or hasattr(sys, "_MEIPASS")

def _project_root_from_here() -> Path:
    # runtime/app_paths.py -> runtime -> project root
    return Path(__file__).resolve().parent.parent

def _get_appdata_root(app_name: str) -> Path:
    override = (os.environ.get("KENPO_APPDATA_BASE_DIR") or "").strip()
    if override:
        return Path(override).expanduser()

    # If KENPO_DATA_DIR points to ...\data, normalize to parent base folder
    kd = (os.environ.get("KENPO_DATA_DIR") or "").strip()
    if kd:
        p = Path(kd).expanduser()
        if p.name.lower() == "data":
            return p.parent
        return p

    la = (os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or str(Path.home())).strip()
    return (Path(la) / app_name)

def get_app_paths(app_name: str = APP_NAME_DEFAULT) -> AppPaths:
    frozen = _is_frozen()

    # Bundle/project root (OK for reading static/ and bundled defaults)
    if frozen:
        if hasattr(sys, "_MEIPASS") and getattr(sys, "_MEIPASS"):
            project_root = Path(getattr(sys, "_MEIPASS"))
        else:
            project_root = Path(sys.executable).resolve().parent
    else:
        project_root = _project_root_from_here()

    appdata_root = _get_appdata_root(app_name).resolve()

    use_appdata = bool(
        frozen
        or os.environ.get("KENPO_DATA_DIR")
        or os.environ.get("KENPO_LOG_DIR")
        or os.environ.get("KENPO_APPDATA_BASE_DIR")
    )

    if use_appdata:
        data_dir = Path(os.environ.get("KENPO_DATA_DIR") or (appdata_root / "data")).expanduser().resolve()
        logs_dir = Path(os.environ.get("KENPO_LOG_DIR") or (appdata_root / "logs")).expanduser().resolve()
    else:
        data_dir = (project_root / "data").resolve()
        logs_dir = (project_root / "logs").resolve()

    # Ensure writable dirs exist (best-effort; do not crash)
    for p in (appdata_root, data_dir, logs_dir):
        try:
            p.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass

    return AppPaths(
        app_name=app_name,
        project_root=project_root,
        appdata_root=appdata_root,
        data_dir=data_dir,
        logs_dir=logs_dir,
    )

def _bundle_data_dir(paths: AppPaths) -> Optional[Path]:
    # Prefer adjacent bundle data/
    p = paths.project_root / "data"
    if p.exists():
        return p
    # PyInstaller temp extraction fallback
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        p2 = Path(meipass) / "data"
        if p2.exists():
            return p2
    return None

def ensure_seeded_data(paths: AppPaths) -> None:
    """Copy missing bundled default files/dirs into writable AppData/data.

    Never overwrites existing user data.
    Safe no-op in dev mode (when data_dir is project-local).
    """
    try:
        if paths.data_dir == (paths.project_root / "data").resolve():
            return  # dev mode
        src_root = _bundle_data_dir(paths)
        if not src_root:
            return
        for src in src_root.rglob("*"):
            rel = src.relative_to(src_root)
            dst = paths.data_dir / rel
            if src.is_dir():
                dst.mkdir(parents=True, exist_ok=True)
                continue
            if not dst.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                try:
                    shutil.copy2(src, dst)
                except Exception:
                    pass
    except Exception:
        pass

def configure_logging(paths: AppPaths, logger_name: str = "advanced_flashcards") -> logging.Logger:
    """Configure file + stream logging to AppData-safe logs_dir.

    Returns the configured logger (named logger_name).
    """
    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.INFO)

    try:
        paths.logs_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

    fmt = logging.Formatter('%(asctime)s | %(levelname)s | %(name)s | %(message)s')

    def _ensure_filehandler(filename: str, level: int):
        target = str(paths.logs_dir / filename)
        for h in logger.handlers:
            if isinstance(h, logging.FileHandler) and getattr(h, "baseFilename", "") == target:
                return
        try:
            fh = logging.FileHandler(target, encoding="utf-8")
            fh.setLevel(level)
            fh.setFormatter(fmt)
            logger.addHandler(fh)
        except Exception:
            pass

    _ensure_filehandler("server.log", logging.INFO)
    _ensure_filehandler("error.log", logging.ERROR)

    # Stream handler (console)
    if not any(isinstance(h, logging.StreamHandler) and not isinstance(h, logging.FileHandler) for h in logger.handlers):
        sh = logging.StreamHandler()
        sh.setLevel(logging.INFO)
        sh.setFormatter(fmt)
        logger.addHandler(sh)

    # Mirror handlers to werkzeug
    werk = logging.getLogger("werkzeug")
    werk.setLevel(logging.INFO)
    for h in list(logger.handlers):
        if h not in werk.handlers:
            werk.addHandler(h)

    return logger

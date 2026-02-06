#!/usr/bin/env python3
"""
WebServer → Android Feature Sync Tool
======================================

Syncs version metadata from KenpoFlashcardsWebServer to the Android app
(KenpoFlashcardsProject-v2). Does NOT modify Kotlin source — only bumps
versions, updates docs, and generates a feature-parity report.

WHAT IT DOES:
  - Bumps build.gradle versionCode + versionName
  - Creates / updates Android version.json
  - Generates CHANGELOG.md entry (placeholder for developer to fill)
  - Updates README.md (Current Version + Version History table)
  - Creates Version-AndroidApp-v{X} v{Y}.txt breadcrumb
  - Creates Fixes v{X} v{Y}.txt with correct header
  - Generates a feature-parity report (WebServer vs Android)

WHAT IT DOES NOT DO:
  - Modify .kt source files
  - Push to GitHub
  - Modify WebServer files (read-only)

Usage:
  python sync_webserver_to_android.py <webserver_folder> <android_folder>
  python sync_webserver_to_android.py --dry-run
"""

import os
import sys
import json
import re
import shutil
from pathlib import Path
from datetime import datetime, date
from typing import Optional, Tuple, List, Dict

# ── Constants ──────────────────────────────────────────────────

TOOL_VERSION = "1.0.0"

# ── Utilities ──────────────────────────────────────────────────

def find_sidscri_apps_root(start: Path) -> Optional[Path]:
    """Walk up from start looking for a folder containing both project dirs."""
    p = start.resolve()
    for _ in range(6):
        ws = p / "KenpoFlashcardsWebServer"
        android = p / "KenpoFlashcardsProject-v2"
        android2 = p / "kenpoflashcardsproject-v2"
        if ws.is_dir() and (android.is_dir() or android2.is_dir()):
            return p
        p = p.parent
    return None




def _find_first_version_json(start_dir: Path) -> Optional[Path]:
    # If version.json isn't at start_dir/version.json, search shallowly for it.
    # Skips common noisy folders (.venv, .git, build, dist, packaging, node_modules).
    start_dir = start_dir.resolve()
    direct = start_dir / "version.json"
    if direct.exists():
        return direct

    skip = {".venv", ".git", "build", "dist", "packaging", "node_modules", "__pycache__"}
    candidates: List[Path] = []

    # Shallow scan (depth <= 3)
    for root, dirs, files in os.walk(start_dir):
        rel = Path(root).resolve().relative_to(start_dir)
        dirs[:] = [d for d in dirs if d not in skip and not d.startswith(".")]
        if len(rel.parts) > 3:
            dirs[:] = []
            continue
        if "version.json" in files:
            candidates.append(Path(root) / "version.json")

    if not candidates:
        return None

    candidates.sort(key=lambda p: (len(p.resolve().relative_to(start_dir).parts), str(p)))
    return candidates[0]


def _resolve_webserver_root(ws_dir: Path, logger=None) -> Path:
    # Ensure ws_dir points to the folder that contains version.json.
    ws_dir = ws_dir.resolve()
    if (ws_dir / "version.json").exists():
        return ws_dir

    found = _find_first_version_json(ws_dir)
    if found:
        root = found.parent
        if logger:
            logger(f"Auto-detected WebServer version.json at: {found}")
            logger(f"Using WebServer root: {root}")
        return root

    return ws_dir


def _resolve_android_gradle(android_dir: Path, logger=None) -> Tuple[Path, Path]:
    # Return (android_root, gradle_file_path). Supports build.gradle or build.gradle.kts.
    android_dir = android_dir.resolve()
    gradle = android_dir / "app" / "build.gradle"
    if gradle.exists():
        return android_dir, gradle

    gradle_kts = android_dir / "app" / "build.gradle.kts"
    if gradle_kts.exists():
        return android_dir, gradle_kts

    if logger:
        logger(f"Android Gradle file not found under: {android_dir / 'app'}")
    return android_dir, gradle
def parse_semver(v: str) -> Tuple[int, int, int]:
    parts = v.strip().split(".")
    return (int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)


def bump_semver(current: str, level: int) -> str:
    major, minor, patch = parse_semver(current)
    if level == 1:
        return f"{major}.{minor}.{patch + 1}"
    elif level == 2:
        return f"{major}.{minor + 1}.0"
    else:
        return f"{major + 1}.0.0"


def is_newer(v1: str, v2: str) -> bool:
    return parse_semver(v1) > parse_semver(v2)


# ── Changelog Parser ──────────────────────────────────────────

def extract_ws_changes_since(changelog_text: str, since_version: str) -> List[Dict]:
    """Extract version entries from WebServer CHANGELOG newer than since_version."""
    pattern = re.compile(
        r"^##\s+([\d.]+)\s*\(build\s+(\d+)\)\s*[-—]\s*(.*)$",
        re.MULTILINE
    )
    entries = []
    matches = list(pattern.finditer(changelog_text))

    for i, m in enumerate(matches):
        ver = m.group(1)
        build = int(m.group(2))
        title = m.group(3).strip()

        if not is_newer(ver, since_version):
            continue

        # Extract content until next heading or end
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(changelog_text)
        body = changelog_text[start:end].strip()

        # Pull out bullet points
        bullets = []
        for line in body.split("\n"):
            line = line.strip()
            if line.startswith("- ") or line.startswith("* "):
                bullets.append(line[2:].strip())
            elif line.startswith("### "):
                bullets.append(f"[{line[4:].strip()}]")

        entries.append({
            "version": ver,
            "build": build,
            "title": title,
            "bullets": bullets,
            "raw": body,
        })

    return entries


def extract_android_changes(changelog_text: str) -> List[Dict]:
    """Extract version entries from Android CHANGELOG."""
    pattern = re.compile(
        r"^##\s+([\d.]+)\s*\(build\s+(\d+)\)\s*[-—]\s*(.*)$",
        re.MULTILINE
    )
    entries = []
    matches = list(pattern.finditer(changelog_text))
    for m in matches:
        entries.append({
            "version": m.group(1),
            "build": int(m.group(2)),
            "title": m.group(3).strip(),
        })
    return entries


# ── Build.gradle Parser ──────────────────────────────────────

def read_build_gradle(gradle_path: Path) -> Tuple[int, str]:
    """Read versionCode and versionName from build.gradle."""
    text = gradle_path.read_text(encoding="utf-8")
    code_m = re.search(r"versionCode\s+(\d+)", text)
    name_m = re.search(r'versionName\s+"([^"]+)"', text)
    code = int(code_m.group(1)) if code_m else 0
    name = name_m.group(1) if name_m else "0.0.0"
    return code, name


def patch_build_gradle(gradle_path: Path, new_code: int, new_name: str, dry_run: bool = False) -> str:
    """Update versionCode and versionName in build.gradle."""
    text = gradle_path.read_text(encoding="utf-8")
    original = text

    text = re.sub(
        r"(versionCode\s+)\d+",
        f"\\g<1>{new_code}",
        text
    )
    text = re.sub(
        r'(versionName\s+")[^"]+"',
        f'\\g<1>{new_name}"',
        text
    )

    if not dry_run:
        gradle_path.write_text(text, encoding="utf-8")

    return text


# ── version.json ──────────────────────────────────────────────

def read_android_version_json(path: Path) -> Optional[Dict]:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def write_android_version_json(path: Path, data: Dict, dry_run: bool = False):
    if not dry_run:
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


# ── CHANGELOG.md ──────────────────────────────────────────────

def generate_changelog_entry(new_version: str, new_build: int,
                              ws_version: str, ws_build: int,
                              ws_changes: List[Dict]) -> str:
    """Generate a new CHANGELOG.md entry for the Android app."""
    today = date.today().strftime("%Y-%m-%d")
    lines = [f"\n## {new_version} (build {new_build}) — {today}\n"]

    if ws_changes:
        lines.append(f"\n### Synced — WebServer features through v{ws_version} (build {ws_build})\n")
        for ch in ws_changes:
            lines.append(f"\n#### From WebServer {ch['version']}: {ch['title']}")
            for b in ch["bullets"][:8]:
                # Mark as TODO so developer knows to implement
                lines.append(f"- **TODO**: {b}")
    else:
        lines.append("\n### Changes\n")
        lines.append("- (Add changes here)\n")

    lines.append(f"\n### Technical Notes")
    lines.append(f"- Synced metadata from WebServer v{ws_version} (build {ws_build})")
    lines.append(f"- Version bumped by sync_webserver_to_android.py v{TOOL_VERSION}")
    lines.append("")

    return "\n".join(lines)


def insert_changelog_entry(changelog_path: Path, entry: str, dry_run: bool = False):
    """Insert new entry after the first --- separator."""
    if not changelog_path.exists():
        if not dry_run:
            changelog_path.write_text(
                f"# Changelog — Advanced Flashcards (Android)\n\n---\n{entry}\n---\n",
                encoding="utf-8"
            )
        return

    text = changelog_path.read_text(encoding="utf-8")

    # Find first "---" after the header
    first_sep = text.find("\n---\n")
    if first_sep >= 0:
        insert_pos = first_sep + 5  # after the ---\n
        text = text[:insert_pos] + entry + "\n---\n" + text[insert_pos:]
    else:
        text += f"\n---\n{entry}\n"

    if not dry_run:
        changelog_path.write_text(text, encoding="utf-8")


# ── README.md ─────────────────────────────────────────────────

def update_readme_version(readme_path: Path, new_version: str, new_build: int,
                           old_version: str, old_build: int, dry_run: bool = False):
    """Update Current Version header and add row to version history table."""
    if not readme_path.exists():
        return

    text = readme_path.read_text(encoding="utf-8")

    # Update "Current Version" line
    text = re.sub(
        r"\*\*Current Version:\*\*\s*v[\d.]+\s*\(build\s*\d+\)",
        f"**Current Version:** v{new_version} (build {new_build})",
        text
    )

    # Add row to version history table
    # Find the table header row
    table_header = "| Version | Code | Key Changes |"
    sep_line = "|---------|------|-------------|"
    idx = text.find(sep_line)
    if idx >= 0:
        insert_at = idx + len(sep_line)
        new_row = f"\n| **{new_version}** | {new_build} | Synced metadata from WebServer (TODO: add feature summary) |"
        text = text[:insert_at] + new_row + text[insert_at:]

    if not dry_run:
        readme_path.write_text(text, encoding="utf-8")


# ── Version / Fixes Files ─────────────────────────────────────

def create_version_breadcrumb(android_dir: Path, new_version: str, new_build: int,
                               old_version: str, old_build: int, dry_run: bool = False):
    """Create Version-AndroidApp-v{new} v{build}.txt pointing to previous."""
    filename = f"Version-AndroidApp-v{new_version} v{new_build}.txt"
    filepath = android_dir / filename
    content = f"AndroidApp-v{old_version} v{old_build}\n"

    if not dry_run:
        filepath.write_text(content, encoding="utf-8")


def create_fixes_file(android_dir: Path, new_version: str, new_build: int,
                       old_version: str, old_build: int, dry_run: bool = False):
    """Create Fixes v{new} v{build}.txt with correct header."""
    filename = f"Fixes v{new_version} v{new_build}.txt"
    filepath = android_dir / filename
    now = datetime.now()
    ts = now.strftime("%a %m/%d/%Y %H:%M:%S.") + f"{now.microsecond // 10000:02d}"
    content = f"Fixes for v{old_version} (versionCode {old_build})\nCreated: {ts}\n\n"

    if not dry_run:
        filepath.write_text(content, encoding="utf-8")


# ── Feature Parity Report ─────────────────────────────────────

def generate_parity_report(ws_version: str, ws_build: int,
                            android_version: str, android_build: int,
                            ws_changes: List[Dict],
                            output_path: Path, dry_run: bool = False):
    """Generate a markdown feature parity report."""
    today = date.today().strftime("%Y-%m-%d")
    lines = [
        f"# Feature Parity Report — {today}",
        f"## WebServer v{ws_version} (build {ws_build}) vs Android v{android_version} (build {android_build})",
        "",
        "### WebServer Changes Since Last Android Parity Sync",
        "",
        "| WS Version | Feature | Android Status | Priority |",
        "|------------|---------|----------------|----------|",
    ]

    server_only_keywords = [
        "runtime", "log_dir", "data_dir", "appdata", "pyinstaller",
        "packaged", "install_type", "frozen", "program files",
        "windows service", "tray", "winsw", "nssm", "log file",
        "startup runner"
    ]

    for ch in ws_changes:
        for bullet in ch["bullets"]:
            bullet_lower = bullet.lower()
            if bullet.startswith("["):
                continue  # section headers

            is_server_only = any(kw in bullet_lower for kw in server_only_keywords)
            status = "N/A (server-only)" if is_server_only else "Not implemented"
            priority = "Skip" if is_server_only else "Review"

            # Truncate long bullets
            display = bullet[:80] + "..." if len(bullet) > 80 else bullet
            display = display.replace("|", "/")

            lines.append(f"| {ch['version']} | {display} | {status} | {priority} |")

    lines.extend([
        "",
        "### Notes",
        "- 'Not implemented' = needs developer review to determine if applicable to Android",
        "- 'N/A (server-only)' = Windows packaging/runtime feature, no Android action needed",
        "- 'Skip' = feature is specific to the server environment",
        f"- Generated by sync_webserver_to_android.py v{TOOL_VERSION}",
    ])

    content = "\n".join(lines) + "\n"
    if not dry_run:
        output_path.write_text(content, encoding="utf-8")

    return content


# ── Backup ─────────────────────────────────────────────────────

def create_backup(android_dir: Path, tools_dir: Path,
                   new_version: str, new_build: int, dry_run: bool = False) -> Optional[Path]:
    """Back up files that will be modified."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"android_v{new_version}_b{new_build}_{ts}"
    backup_dir = tools_dir / "sync_backups" / backup_name

    files_to_backup = [
        "app/build.gradle",
        "CHANGELOG.md",
        "README.md",
        "version.json",
    ]

    # Also back up any existing Version-*.txt and Fixes *.txt
    for f in android_dir.glob("Version-AndroidApp-*.txt"):
        files_to_backup.append(f.name)
    for f in android_dir.glob("Fixes v*.txt"):
        files_to_backup.append(f.name)

    if dry_run:
        return backup_dir

    backup_dir.mkdir(parents=True, exist_ok=True)
    for rel in files_to_backup:
        src = android_dir / rel
        if src.exists():
            dst = backup_dir / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

    return backup_dir


# ── Main Sync Engine ──────────────────────────────────────────

class AndroidSyncer:
    def __init__(self, ws_dir: Path, android_dir: Path, tools_dir: Path,
                 dry_run: bool = False, upgrade_level: Optional[int] = None,
                 output_mode: str = 'synced'):
        self.ws_dir = ws_dir
        self.android_dir = android_dir
        self.tools_dir = tools_dir
        self.dry_run = dry_run
        self.upgrade_level = upgrade_level
        self.output_mode = output_mode
        self.repo_root = find_sidscri_apps_root(tools_dir) or tools_dir.parent.parent
        self.sync_log_dir = self.repo_root / 'logs' / 'Sync' / 'WebServerToAndroid'
        self._log_lines = []
        self._log_file_path: Optional[Path] = None

    def log(self, msg: str, level: str = "INFO"):
        prefix = {"INFO": "ℹ️", "SUCCESS": "✅", "WARN": "⚠️", "ERROR": "❌", "SKIP": "⏭️"}.get(level, "  ")
        ts = datetime.now().strftime("%H:%M:%S")
        line = f"[{ts}] {prefix} {msg}"
        print(line)
        self._log_lines.append(line)

    def _init_log_file(self):
        """Initialize sync log file."""
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.sync_log_dir.mkdir(parents=True, exist_ok=True)
        self._log_file_path = self.sync_log_dir / f"Android_PENDING_{ts}.log"
        header = [
            "="*72,
            f"WebServerToAndroid Sync Log  (tool v{TOOL_VERSION})",
            f"Timestamp: {ts}",
            f"Tools Dir: {self.tools_dir}",
            f"WebServer : {self.ws_dir}",
            f"AndroidSrc: {self.android_dir}",
            f"OutputMode: {self.output_mode}",
            "="*72,
            ""
        ]
        self._log_lines.extend(header)

    def prompt_upgrade_level(self) -> int:
        print("\n" + "=" * 60)
        print("  SELECT UPGRADE LEVEL")
        print("=" * 60)
        print()
        print("  1 = Patch   - Bug fixes, minor tweaks       → x.y.Z+1")
        print("  2 = Minor   - New features, improvements    → x.Y+1.0")
        print("  3 = Major   - Breaking changes              → X+1.0.0")
        print()
        while True:
            try:
                choice = int(input("  Enter upgrade level (1/2/3): ").strip())
                if choice in (1, 2, 3):
                    return choice
            except (ValueError, EOFError):
                pass
            print("  Invalid choice. Enter 1, 2, or 3.")

    def run(self):
        print("\n" + "=" * 60)
        print("  WebServer → Android Sync Tool")
        print(f"  v{TOOL_VERSION}")
        print("=" * 60 + "\n")

        self._init_log_file()

        if self.dry_run:
            self.log("DRY RUN MODE — no files will be changed", "WARN")
            print()

        # ── Validate ──
        if not self.ws_dir.is_dir():
            self.log(f"WebServer folder not found: {self.ws_dir}", "ERROR")
            return False
        if not self.android_dir.is_dir():
            self.log(f"Android folder not found: {self.android_dir}", "ERROR")
            return False

        # ── Output mode ──
        if self.output_mode == "synced":
            src_android = self.android_dir
            synced_name = src_android.name + "_synced"
            target_android = self.repo_root / synced_name
            self.log(f"Preparing synced output: {target_android}")

            def _ignore(dirpath, names):
                ignore_names = {".gradle", ".idea", ".git", ".vs", ".vscode", "build"}
                out = []
                for n in names:
                    if n in ignore_names:
                        out.append(n)
                    if n.endswith(".iml") or n == "local.properties":
                        out.append(n)
                # also skip app/build
                if os.path.basename(dirpath) == "app" and "build" in names:
                    out.append("build")
                return out

            if target_android.exists() and not self.dry_run:
                shutil.rmtree(target_android)
            if not self.dry_run:
                shutil.copytree(src_android, target_android, ignore=_ignore)
            self.android_dir = target_android
            self.log(f"Android output folder: {self.android_dir}", "SUCCESS")
        else:
            self.log(f"Android output folder: {self.android_dir}", "INFO")

        # ── Read WebServer version ──
        self.ws_dir = _resolve_webserver_root(self.ws_dir, logger=lambda m: self.log(m, "INFO"))
        ws_ver_path = self.ws_dir / "version.json"
        if not ws_ver_path.exists():
            self.log("WebServer version.json not found (expected at WebServer root).", "ERROR")
            self.log(f"Looked in: {self.ws_dir}", "ERROR")
            return False
        ws_ver = json.loads(ws_ver_path.read_text(encoding="utf-8"))
        ws_version = ws_ver.get("version", "0.0.0")
        ws_build = ws_ver.get("build", 0)
        self.log(f"WebServer: v{ws_version} (build {ws_build})")

        # ── Read Android version ──
        gradle_path = self.android_dir / "app" / "build.gradle"
        if not gradle_path.exists():
            self.log("Android app/build.gradle not found", "ERROR")
            return False

        old_code, old_name = read_build_gradle(gradle_path)
        self.log(f"Android:   v{old_name} (build {old_code})")

        # Read existing version.json if present
        android_ver_json = read_android_version_json(self.android_dir / "version.json")
        last_parity = "0.0.0"
        if android_ver_json:
            last_parity = android_ver_json.get("webserver_feature_parity", "0.0.0")
            self.log(f"Last WS parity: v{last_parity}")
        else:
            self.log("No Android version.json found (will create)", "WARN")

        print()

        # ── Read WebServer CHANGELOG ──
        ws_changelog_path = self.ws_dir / "CHANGELOG.md"
        ws_changes = []
        if ws_changelog_path.exists():
            ws_cl = ws_changelog_path.read_text(encoding="utf-8")
            ws_changes = extract_ws_changes_since(ws_cl, last_parity)
            self.log(f"Found {len(ws_changes)} WebServer version(s) since v{last_parity}")
        else:
            self.log("WebServer CHANGELOG.md not found", "WARN")

        # ── Prompt upgrade level ──
        level = self.upgrade_level if self.upgrade_level in (1, 2, 3) else self.prompt_upgrade_level()
        level_names = {1: "Patch", 2: "Minor", 3: "Major"}
        self.log(f"Upgrade: {level_names[level]}")

        new_name = bump_semver(old_name, level)
        new_code = old_code + 1
        self.log(f"New version: v{new_name} (build {new_code})")
        print()

        # ── Backup ──
        self.log("Creating backup...")
        backup_dir = create_backup(self.android_dir, self.tools_dir, new_name, new_code, self.dry_run)
        if backup_dir:
            self.log(f"Backup at: {backup_dir}", "SUCCESS")
        print()

        # ── Bump build.gradle ──
        self.log("Bumping build.gradle...")
        patch_build_gradle(gradle_path, new_code, new_name, self.dry_run)
        self.log(f"build.gradle → versionCode={new_code}, versionName=\"{new_name}\"", "SUCCESS")

        # ── Create/update version.json ──
        self.log("Updating version.json...")
        new_ver_data = {
            "app_name": "AdvancedFlashcards_Android",
            "version": new_name,
            "build": new_code,
            "release_date": date.today().isoformat(),
            "notes": f"Synced from WebServer v{ws_version}",
            "webserver_feature_parity": ws_version,
            "webserver_feature_parity_build": ws_build,
            "last_sync": datetime.now().isoformat()
        }
        write_android_version_json(self.android_dir / "version.json", new_ver_data, self.dry_run)
        self.log("version.json updated", "SUCCESS")

        # ── CHANGELOG.md ──
        self.log("Updating CHANGELOG.md...")
        entry = generate_changelog_entry(new_name, new_code, ws_version, ws_build, ws_changes)
        insert_changelog_entry(self.android_dir / "CHANGELOG.md", entry, self.dry_run)
        self.log("CHANGELOG.md updated", "SUCCESS")

        # ── README.md ──
        self.log("Updating README.md...")
        update_readme_version(
            self.android_dir / "README.md",
            new_name, new_code, old_name, old_code, self.dry_run
        )
        self.log("README.md updated", "SUCCESS")

        # ── Version breadcrumb ──
        self.log("Creating Version-AndroidApp-*.txt...")
        create_version_breadcrumb(self.android_dir, new_name, new_code, old_name, old_code, self.dry_run)
        self.log(f"Created Version-AndroidApp-v{new_name} v{new_code}.txt", "SUCCESS")

        # ── Fixes file ──
        self.log("Creating Fixes *.txt...")
        create_fixes_file(self.android_dir, new_name, new_code, old_name, old_code, self.dry_run)
        self.log(f"Created Fixes v{new_name} v{new_code}.txt", "SUCCESS")

        print()

        # ── Feature parity report ──
        self.log("Generating feature parity report...")
        report_name = f"parity_report_{date.today().isoformat()}.md"
        report_path = self.tools_dir / report_name
        generate_parity_report(
            ws_version, ws_build,
            new_name, new_code,
            ws_changes, report_path, self.dry_run
        )
        self.log(f"Parity report: {report_path}", "SUCCESS")

        # ── Summary ──
        print("\n" + "=" * 60)
        print("  SYNC COMPLETE")
        print("=" * 60)
        print()
        drp = " (DRY RUN)" if self.dry_run else ""
        print(f"  ✅ Sync complete!{drp}")
        print(f"  📱 New Android version: v{new_name} (build {new_code})")
        print(f"  🌐 WebServer parity:    v{ws_version} (build {ws_build})")
        print(f"  📁 Backup: {backup_dir}")
        print(f"  📋 Parity report: {report_path}")
        print()
        print("  Next steps:")
        print("    1. Review CHANGELOG.md — fill in actual feature descriptions")
        print("    2. Review README.md — update version table row description")
        print("    3. Read parity report — decide which WS features to implement")
        print("    4. Implement features in Kotlin")
        print("    5. Test on device")
        print("    6. git add / commit / push")
        print()

        # ── Finalize log file ──
        try:
            if self._log_file_path:
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                final_name = f"Android_v{new_name}_b{new_code}_{ts}.log"
                final_path = self._log_file_path.with_name(final_name)
                # Write log contents
                final_path.write_text("\n".join(self._log_lines) + "\n", encoding="utf-8")
                # Remove the pending file if it exists
                if self._log_file_path.exists() and self._log_file_path != final_path:
                    try:
                        self._log_file_path.unlink()
                    except Exception:
                        pass
                self.log(f"Sync log: {final_path}", "SUCCESS")
        except Exception as e:
            self.log(f"Failed to write sync log: {e}", "WARN")

        return True



# ── CLI Entry Point ───────────────────────────────────────────

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Sync WebServer version metadata to Android app"
    )
    parser.add_argument("webserver", nargs="?", help="Path to WebServer project")
    parser.add_argument("android", nargs="?", help="Path to Android project")
    parser.add_argument("--dry-run", "-n", action="store_true", help="Preview without changes")
    parser.add_argument("--level", "-l", type=int, choices=[1, 2, 3],
                        help="Upgrade level: 1=patch, 2=minor, 3=major")
    parser.add_argument("--output", choices=["synced","inplace"], default="synced",
                        help="Where to write changes: synced writes to *_synced folder; inplace modifies the source Android folder")

    args = parser.parse_args()

    # Resolve paths
    tools_dir = Path(__file__).resolve().parent

    if args.webserver:
        ws_dir = Path(args.webserver).resolve()
    else:
        root = find_sidscri_apps_root(tools_dir)
        if root:
            ws_dir = root / "KenpoFlashcardsWebServer"
        else:
            ws_dir = tools_dir.parent / "KenpoFlashcardsWebServer"

    if args.android:
        android_dir = Path(args.android).resolve()
    else:
        root = find_sidscri_apps_root(tools_dir)
        if root:
            android_dir = (root / "kenpoflashcardsproject-v2") if (root / "kenpoflashcardsproject-v2").is_dir() else (root / "KenpoFlashcardsProject-v2")
        else:
            android_dir = tools_dir.parent / "KenpoFlashcardsProject-v2"

    syncer = AndroidSyncer(
        ws_dir=ws_dir,
        android_dir=android_dir,
        tools_dir=tools_dir,
        dry_run=args.dry_run,
        upgrade_level=args.level,
        output_mode=args.output,
    )
    success = syncer.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

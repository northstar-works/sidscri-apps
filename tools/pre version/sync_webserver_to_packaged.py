#!/usr/bin/env python3
"""
KenpoFlashcards Web Server → Packaged Sync Tool (with AI Documentation Update)
===============================================================================

Safely syncs updates from the main KenpoFlashcardsWebServer project folder
to the KenpoFlashcardsWebServer_Packaged project folder.

FEATURES:
- Works directly with project folders (no zip files)
- Automatically increments packaged version based on upgrade level
- AI-assisted README.md and CHANGELOG.md updates
- Dry-run mode for previewing changes

UPGRADE LEVELS:
  1 (Low/Patch)   - Bug fixes, minor tweaks           → v1.3.0 → v1.3.1
  2 (Medium/Minor) - New features, improvements        → v1.3.0 → v1.4.0
  3 (High/Major)   - Breaking changes, major features  → v1.3.0 → v2.0.0

PROTECTED FILES (never overwritten):
- packaging/ folder
- windows_service/ folder  
- windows_tray/ folder
- tools/ folder
- KenpoFlashcardsTrayLauncher.py
- server_config.json
- INSTALL_WINDOWS.md, RUN_AS_WINDOWS_SERVICE.md, PATCH_README.txt
- *.lnk shortcut files
- Version-WebServerPackaged-*.txt

SYNCED FILES:
- app.py, static/ (mirrored with safe excludes), requirements.txt, LICENSE, BRANDING_NOTE.md
- data/ folder (merged, not replaced)

AI-UPDATED FILES:
- README.md (What's new section updated)
- CHANGELOG.md (New version entry added)
- version.json (Version numbers updated)

Usage:
    python sync_webserver_to_packaged.py <webserver_folder> <packaged_folder>
    
Example:
    python sync_webserver_to_packaged.py C:\\Projects\\KenpoFlashcardsWebServer C:\\Projects\\KenpoFlashcardsWebServer_Packaged
"""

import os
import sys
import json
import shutil
import argparse
import re
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple, List, Dict



def _find_sidscri_apps_root(start: Path) -> Path:
    """Walk up from start to find a folder named 'sidscri-apps'. If not found, fallback to start.parent."""
    for p in [start] + list(start.parents):
        if p.name.lower() == 'sidscri-apps':
            return p
    # Common layout: <repo_root>/tools/<this_script>
    return start.parent

def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)

def _files_equal(a: Path, b: Path) -> bool:
    """Fast-ish binary compare."""
    try:
        if not a.exists() or not b.exists():
            return False
        if a.stat().st_size != b.stat().st_size:
            return False
        with a.open('rb') as fa, b.open('rb') as fb:
            while True:
                ca = fa.read(1024 * 1024)
                cb = fb.read(1024 * 1024)
                if ca != cb:
                    return False
                if not ca:
                    return True
    except Exception:
        return False


class VersionBumper:
    """Handles semantic versioning bumps."""
    
    @staticmethod
    def parse_version(version_str: str) -> Tuple[int, int, int]:
        """Parse a version string like '1.3.0' into (major, minor, patch)."""
        match = re.match(r'v?(\d+)\.(\d+)\.(\d+)', version_str)
        if match:
            return int(match.group(1)), int(match.group(2)), int(match.group(3))
        return 0, 0, 0
    
    @staticmethod
    def bump_version(current: str, level: int) -> str:
        """
        Bump version based on level:
        1 = patch (x.y.Z)
        2 = minor (x.Y.0)
        3 = major (X.0.0)
        """
        major, minor, patch = VersionBumper.parse_version(current)
        
        if level == 1:  # Patch
            patch += 1
        elif level == 2:  # Minor
            minor += 1
            patch = 0
        elif level == 3:  # Major
            major += 1
            minor = 0
            patch = 0
            
        return f"{major}.{minor}.{patch}"


class ChangelogAnalyzer:
    """Analyzes web server changelog to extract changes since last sync."""
    
    @staticmethod
    def extract_changes_since_version(changelog_content: str, since_version: str) -> List[Dict]:
        """
        Extract all changelog entries newer than the specified version.
        Returns list of dicts with version info and changes.
        """
        changes = []
        
        # Parse version sections from changelog
        # Pattern matches: ## 7.0.1 (build 34) — 2026-01-23 or ## v7.0.1 (build 34)
        version_pattern = r'##\s+v?(\d+\.\d+\.\d+)\s+\(build\s+(\d+)\)[^\n]*'
        
        sections = re.split(version_pattern, changelog_content)
        
        # sections will be: [intro, version1, build1, content1, version2, build2, content2, ...]
        i = 1
        while i < len(sections) - 2:
            version = sections[i]
            build = sections[i + 1]
            content = sections[i + 2] if i + 2 < len(sections) else ""
            
            # Check if this version is newer than our last sync
            if ChangelogAnalyzer._is_newer_version(version, since_version):
                changes.append({
                    'version': version,
                    'build': int(build),
                    'content': content.strip()
                })
            
            i += 3
            
        return changes
    
    @staticmethod
    def _is_newer_version(v1: str, v2: str) -> bool:
        """Check if v1 is newer than v2."""
        def parse(v):
            match = re.match(r'v?(\d+)\.(\d+)\.(\d+)', v)
            if match:
                return tuple(int(x) for x in match.groups())
            return (0, 0, 0)
        return parse(v1) > parse(v2)
    
    @staticmethod
    def summarize_changes(changes: List[Dict]) -> str:
        """Create a human-readable summary of changes."""
        if not changes:
            return "No new changes detected."
        
        summary_lines = []
        for change in changes:
            summary_lines.append(f"### Web Server v{change['version']} (build {change['build']})")
            summary_lines.append(change['content'])
            summary_lines.append("")
        
        return "\n".join(summary_lines)


class DocumentationUpdater:
    """Handles AI-assisted documentation updates."""
    
    def __init__(self, packaged_dir: Path, dry_run: bool = False):
        self.packaged_dir = packaged_dir
        self.dry_run = dry_run
        
    def generate_changelog_entry(self, 
                                  new_version: str, 
                                  new_build: int,
                                  ws_version: str,
                                  ws_build: int,
                                  old_ws_version: str,
                                  old_ws_build: int,
                                  ws_changes: List[Dict],
                                  upgrade_level: int) -> str:
        """Generate a new CHANGELOG.md entry for the packaged version."""
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Build the changelog entry
        entry_lines = [
            f"## v{new_version} (build {new_build}) — {today}",
            "",
            "### Changed",
            f"- **Updated bundled Web Server to v{ws_version} (build {ws_build})** (from v{old_ws_version} build {old_ws_build}), including:"
        ]
        
        # Extract key features from web server changes
        for change in ws_changes:
            content = change['content']
            
            # Extract Added items
            added_match = re.search(r'### Added\n(.*?)(?=###|\Z)', content, re.DOTALL)
            if added_match:
                items = re.findall(r'- \*\*([^*]+)\*\*', added_match.group(1))
                for item in items[:6]:  # Limit to 6 items per version
                    entry_lines.append(f"  - **{item.strip()}**")
            
            # Extract Changed items  
            changed_match = re.search(r'### Changed\n(.*?)(?=###|\Z)', content, re.DOTALL)
            if changed_match:
                items = re.findall(r'- ([^\n]+)', changed_match.group(1))
                for item in items[:3]:  # Limit to 3 items
                    if not item.startswith('**'):
                        entry_lines.append(f"  - {item.strip()}")
        
        entry_lines.append("")
        
        return "\n".join(entry_lines)
    
    def update_changelog(self, new_entry: str) -> bool:
        """Insert new entry at the top of CHANGELOG.md."""
        changelog_path = self.packaged_dir / "CHANGELOG.md"
        
        if not changelog_path.exists():
            print("  ⚠️  CHANGELOG.md not found")
            return False
            
        with open(changelog_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find the first version entry (## v...)
        match = re.search(r'^## v\d+\.\d+\.\d+', content, re.MULTILINE)
        if match:
            insert_pos = match.start()
            new_content = content[:insert_pos] + new_entry + "\n" + content[insert_pos:]
        else:
            # No existing versions, append after header
            new_content = content + "\n" + new_entry
        
        if self.dry_run:
            print(f"  📝 Would update CHANGELOG.md with new v{new_entry.split()[1]} entry")
            return True
            
        with open(changelog_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        print("  ✅ Updated CHANGELOG.md")
        return True
    
    def generate_readme_whats_new(self,
                                   new_version: str,
                                   new_build: int,
                                   ws_version: str,
                                   ws_build: int,
                                   old_ws_version: str,
                                   old_ws_build: int,
                                   ws_changes: List[Dict]) -> str:
        """Generate the 'What's new' section for README.md."""
        
        lines = [
            f"## What's new in v{new_version} (build {new_build})",
            "",
            f"- **Bundled Web Server updated to v{ws_version} (build {ws_build})** (from v{old_ws_version} build {old_ws_build}), bringing:"
        ]
        
        # Extract key features from ALL web server changes
        for change in ws_changes:
            content = change['content']
            
            # Extract Added items (main features)
            added_match = re.search(r'### Added\n(.*?)(?=###|\Z)', content, re.DOTALL)
            if added_match:
                items = re.findall(r'- \*\*([^*]+)\*\*[^-\n]*([^\n]*)?', added_match.group(1))
                for item in items[:5]:
                    feature_name = item[0].strip()
                    # Get the rest of the line after the bold part if present
                    desc = item[1].strip() if len(item) > 1 else ""
                    if desc.startswith(':') or desc.startswith('—') or desc.startswith('-'):
                        desc = desc[1:].strip()
                    if desc:
                        lines.append(f"  - **{feature_name}** — {desc[:80]}")
                    else:
                        lines.append(f"  - **{feature_name}**")
        
        lines.append("")
        
        return "\n".join(lines)
    
    def update_readme(self, new_whats_new: str, new_version: str, new_build: int, 
                      ws_version: str, ws_build: int) -> bool:
        """Update README.md with new version info and What's new section."""
        readme_path = self.packaged_dir / "README.md"
        
        if not readme_path.exists():
            print("  ⚠️  README.md not found")
            return False
            
        with open(readme_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Update version numbers at top
        # Pattern: - **Packaged Version:** **v1.3.0 (build 8)**
        content = re.sub(
            r'(\*\*Packaged Version:\*\*\s*\*\*)v?\d+\.\d+\.\d+\s*\(build\s*\d+\)(\*\*)',
            f'\\1v{new_version} (build {new_build})\\2',
            content
        )
        
        # Pattern: - **Bundled Web Server:** **v6.1.0 (build 32)**
        content = re.sub(
            r'(\*\*Bundled Web Server:\*\*\s*\*\*)v?\d+\.\d+\.\d+\s*\(build\s*\d+\)(\*\*)',
            f'\\1v{ws_version} (build {ws_build})\\2',
            content
        )
        
        # Find and replace the first "What's new" section
        # Keep existing What's new sections but insert new one at top
        whats_new_pattern = r'(## What\'s new in v\d+\.\d+\.\d+ \(build \d+\))'
        match = re.search(whats_new_pattern, content)
        
        if match:
            # Insert new What's new before the first existing one
            insert_pos = match.start()
            content = content[:insert_pos] + new_whats_new + "\n" + content[insert_pos:]
        else:
            # No existing What's new, add after ## What you get section
            get_match = re.search(r'(## What you get.*?)(?=##)', content, re.DOTALL)
            if get_match:
                insert_pos = get_match.end()
                content = content[:insert_pos] + "\n" + new_whats_new + "\n" + content[insert_pos:]
        
        if self.dry_run:
            print(f"  📝 Would update README.md with new v{new_version} info")
            return True
            
        with open(readme_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
        print("  ✅ Updated README.md")
        return True
    
    def update_version_json(self, new_version: str, new_build: int,
                            ws_version: str, ws_build: int) -> bool:
        """Update version.json with new version info."""
        version_path = self.packaged_dir / "version.json"
        
        if version_path.exists():
            with open(version_path, 'r', encoding='utf-8') as f:
                version_data = json.load(f)
        else:
            version_data = {"app_name": "KenpoFlashcardsWebServer_Packaged"}
        
        version_data['version'] = new_version
        version_data['build'] = new_build
        version_data['release_date'] = datetime.now().strftime("%Y-%m-%d")
        version_data['notes'] = f"Synced to web server v{ws_version}."
        version_data['webserver_version'] = ws_version
        version_data['webserver_build'] = ws_build
        version_data['last_sync'] = datetime.now().isoformat()
        
        if self.dry_run:
            print(f"  📝 Would update version.json to v{new_version} (build {new_build})")
            return True
            
        with open(version_path, 'w', encoding='utf-8') as f:
            json.dump(version_data, f, indent=2)
            
        print("  ✅ Updated version.json")
        return True
    
    def update_version_txt(self, new_version: str, new_build: int, 
                           old_version: str, old_build: int) -> bool:
        """Rename the Version-WebServerPackaged-*.txt file WITHOUT changing its contents."""

        # Find existing version file (keep contents)
        old_file = None
        for f in self.packaged_dir.glob("Version-WebServerPackaged-*.txt"):
            old_file = f
            break

        if old_file is None:
            print("  ⏭️  No Version-WebServerPackaged-*.txt found (skipping)")
            return True

        new_filename = f"Version-WebServerPackaged-v{new_version} v{new_build}.txt"
        new_path = self.packaged_dir / new_filename

        if self.dry_run:
            print(f"  📝 Would rename version file: {old_file.name} → {new_filename}")
            return True

        # If target exists, remove it so rename succeeds on Windows
        if new_path.exists():
            new_path.unlink()

        old_file.rename(new_path)

        print(f"  ✅ Renamed version file to {new_filename} (contents preserved)")
        return True


class WebServerSyncer:
    """Main sync tool that coordinates all operations."""
    
    PROTECTED_ITEMS = [
        'packaging', 'windows_service', 'windows_tray', 'build_data', 'tools',
        'KenpoFlashcardsTrayLauncher.py', 'Kenpo_Vocabulary_Study_Flashcards.ico',
        'server_config.json', 'INSTALL_WINDOWS.md', 'RUN_AS_WINDOWS_SERVICE.md',
        'PATCH_README.txt', '.sync_backups', 'README.md', 'CHANGELOG.md', 'version.json'
    ]
    
    PROTECTED_PATTERNS = ['*.lnk', 'Version-WebServerPackaged-*.txt']
    
    SYNC_FILES = ['app.py', 'requirements.txt', 'LICENSE', 'BRANDING_NOTE.md', '.gitattributes']
    
    SYNC_FOLDERS = ['static']

    # Static sync rules:
    # - Mirror WebServer/static into Packaged/static (overwrite from source)
    # - Preserve Packaged-only Windows assets and user-uploaded content:
    #   * static/res/webappservericons/**   (Windows EXE/tray/icons)
    #   * static/res/decklogos/user/**      (user-uploaded deck logos)
    STATIC_EXCLUDE_SUBDIRS = [
        Path('res') / 'webappservericons',
        Path('res') / 'decklogos' / 'user',
    ]
    
    def __init__(self, ws_source: Path, pkg_dest: Path, tools_dir: Path, dry_run: bool = False, upgrade_level: Optional[int] = None, output_mode: str = 'inplace'):
        self.ws_source = Path(ws_source)
        self.pkg_dest = Path(pkg_dest)
        self.tools_dir = Path(tools_dir)
        self.dry_run = dry_run
        self.upgrade_level = upgrade_level
        self.backup_dir = None
        self.changes = []
        self.file_actions: List[Dict] = []
        self.output_mode = output_mode
        self.repo_root = _find_sidscri_apps_root(self.tools_dir)
        self.sync_log_dir = self.repo_root / 'logs' / 'Sync'
        
    def log(self, msg: str, level: str = "INFO"):
        """Log with timestamp and emoji prefix."""
        ts = datetime.now().strftime("%H:%M:%S")
        prefix = {"INFO": "ℹ️", "WARN": "⚠️", "ERROR": "❌", "SUCCESS": "✅", "SKIP": "⏭️"}
        print(f"[{ts}] {prefix.get(level, '')} {msg}")
    
    
    def record_action(self, path: str, action: str, **details):
        """Record a per-file action for the sync log."""
        rec = {"path": path, "action": action}
        if details:
            rec.update(details)
        self.file_actions.append(rec)

    def write_sync_log(self,
                       new_version: str,
                       new_build: int,
                       ws_version: str,
                       ws_build: int,
                       last_sync_iso: str,
                       backup_dir: Optional[Path] = None):
        """Write a JSON log under <sidscri-apps>\logs\Sync\ as vX_bY_YYYYMMDD_HHMMSS.log"""
        try:
            _ensure_dir(self.sync_log_dir)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            log_name = f"v{new_version}_b{new_build}_{ts}.log"
            log_path = self.sync_log_dir / log_name

            # Summary counts
            counts = {}
            for r in self.file_actions:
                a = r.get("action", "unknown")
                counts[a] = counts.get(a, 0) + 1

            payload = {
                "version": new_version,
                "build": new_build,
                "last_sync": last_sync_iso,
                "webserver_version": ws_version,
                "webserver_build": int(ws_build) if str(ws_build).isdigit() else ws_build,
                "output_mode": self.output_mode,
                "dry_run": bool(self.dry_run),
                "backup_dir": str(backup_dir) if backup_dir else None,
                "summary": {
                    "total_records": len(self.file_actions),
                    "by_action": counts,
                    "protected_items": self.PROTECTED_ITEMS,
                    "static_excludes_preserved": [f"static/{p.as_posix()}/**" for p in self.STATIC_EXCLUDE_SUBDIRS],
                },
                "files": self.file_actions,
            }

            if not self.dry_run:
                with open(log_path, "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2)
            self.log(f"Sync log written: {log_path}", "SUCCESS")
            return log_path
        except Exception as e:
            self.log(f"Failed to write sync log: {e}", "WARN")
            return None

    def prompt_upgrade_level(self) -> int:
        """Prompt user for upgrade level."""
        print("\n" + "="*60)
        print("  SELECT UPGRADE LEVEL")
        print("="*60)
        print("""
  1 = Low (Patch)    - Bug fixes, minor tweaks       → x.y.Z+1
  2 = Medium (Minor) - New features, improvements    → x.Y+1.0
  3 = High (Major)   - Breaking changes, major features → X+1.0.0
""")
        
        while True:
            try:
                choice = input("  Enter upgrade level (1/2/3): ").strip()
                level = int(choice)
                if level in [1, 2, 3]:
                    level_names = {1: "Patch", 2: "Minor", 3: "Major"}
                    print(f"\n  Selected: {level_names[level]} upgrade\n")
                    return level
            except ValueError:
                pass
            print("  ⚠️  Please enter 1, 2, or 3")
    
    def create_backup(self, new_version: str, new_build: int):
        """Backup files that will be modified to the tools/sync_backups folder."""
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.backup_dir = self.tools_dir / "sync_backups" / f"v{new_version}_b{new_build}_{ts}"
        
        if self.dry_run:
            self.log(f"Would create backup at: {self.backup_dir}")
            return
            
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Backup sync files and doc files
        files_to_backup = self.SYNC_FILES + ['README.md', 'CHANGELOG.md', 'version.json']
        for filename in files_to_backup:
            src = self.pkg_dest / filename
            if src.exists():
                shutil.copy2(src, self.backup_dir / filename)
        
        # Backup static folder
        static_src = self.pkg_dest / 'static'
        if static_src.exists():
            shutil.copytree(static_src, self.backup_dir / 'static')
        
        # Backup version txt file
        for f in self.pkg_dest.glob("Version-WebServerPackaged-*.txt"):
            shutil.copy2(f, self.backup_dir / f.name)
                
        self.log(f"Created backup at: {self.backup_dir}")
    
    def sync_file(self, filename: str) -> bool:
        """Copy a file from web server to packaged (with per-file action logging)."""
        src = self.ws_source / filename
        dst = self.pkg_dest / filename

        if not src.exists():
            self.log(f"Source not found: {filename}", "WARN")
            self.record_action(filename, "missing_source")
            return False

        exists = dst.exists()
        same = _files_equal(src, dst) if exists else False

        if self.dry_run:
            action = "would_add" if not exists else ("would_skip_unchanged" if same else "would_replace")
            self.log(f"Would sync: {filename} ({action})")
            self.record_action(filename, action)
            return True

        if exists and same:
            self.log(f"Unchanged (skipped): {filename}", "SKIP")
            self.record_action(filename, "skipped_unchanged")
            return True

        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

        action = "added" if not exists else "replaced"
        self.changes.append(f"{action.title()}: {filename}")
        self.record_action(filename, action)
        self.log(f"{action.title()}: {filename}", "SUCCESS")
        return True


    def sync_folder(self, foldername: str) -> bool:
        """Sync an entire folder from web server."""
        if foldername == 'static':
            return self.sync_static_folder()

        src = self.ws_source / foldername
        dst = self.pkg_dest / foldername

        if not src.exists():
            self.log(f"Source folder not found: {foldername}", "WARN")
            return False

        if self.dry_run:
            self.log(f"Would sync folder: {foldername}/")
            return True

        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        self.changes.append(f"Synced folder: {foldername}/")
        self.log(f"Synced folder: {foldername}/", "SUCCESS")
        return True

    def sync_static_folder(self) -> bool:
        """Mirror static/ from web server into packaged, preserving certain Packaged-only subfolders.

        Logs per-file actions (added/replaced/removed/skipped/excluded).
        """
        src_static = self.ws_source / 'static'
        dst_static = self.pkg_dest / 'static'

        if not src_static.exists():
            self.log('Source folder not found: static', 'WARN')
            self.record_action('static/', 'missing_source')
            return False

        if self.dry_run:
            self.log('Would mirror folder: static/ (with safe excludes)')
            for ex in self.STATIC_EXCLUDE_SUBDIRS:
                self.record_action(f"static/{ex.as_posix()}/", 'excluded_preserved', reason='static exclude (dry-run)')
            return True

        dst_static.mkdir(parents=True, exist_ok=True)

        # Track source set for mirroring (for removal)
        src_set = {p.relative_to(src_static) for p in src_static.rglob('*')}

        # 1) Copy/update everything from source → destination (except excluded subtrees)
        for src_file in src_static.rglob('*'):
            if src_file.is_dir():
                continue
            rel = src_file.relative_to(src_static)

            rel_posix = rel.as_posix()
            if self._is_static_excluded(rel):
                # explicitly preserve destination subtree
                self.record_action(f"static/{rel_posix}", 'excluded_preserved', reason='static exclude preserved in destination')
                continue

            dst_file = dst_static / rel
            existed = dst_file.exists()
            same = _files_equal(src_file, dst_file) if existed else False

            if existed and same:
                self.record_action(f"static/{rel_posix}", 'skipped_unchanged')
                continue

            dst_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dst_file)

            action = 'added' if not existed else 'replaced'
            self.record_action(f"static/{rel_posix}", action)

        # 2) Remove destination files not present in source (mirror), BUT preserve excluded subtrees
        for dst_file in sorted([p for p in dst_static.rglob('*') if p.is_file()], reverse=True):
            rel = dst_file.relative_to(dst_static)
            rel_posix = rel.as_posix()
            if self._is_static_excluded(rel):
                continue
            if rel not in src_set:
                try:
                    dst_file.unlink()
                    self.record_action(f"static/{rel_posix}", 'removed_extra')
                except Exception as e:
                    self.log(f"Failed to remove extra file static/{rel_posix}: {e}", 'WARN')
                    self.record_action(f"static/{rel_posix}", 'remove_failed', error=str(e))

        # Remove empty dirs (excluding preserved dirs)
        for dst_dir in sorted([p for p in dst_static.rglob('*') if p.is_dir()], reverse=True):
            rel = dst_dir.relative_to(dst_static)
            if self._is_static_excluded(rel):
                continue
            try:
                if not any(dst_dir.iterdir()):
                    dst_dir.rmdir()
            except Exception:
                pass

        self.changes.append('Mirrored folder: static/ (safe excludes preserved)')
        self.record_action('static/', 'mirrored', excludes_preserved=[f"static/{p.as_posix()}/**" for p in self.STATIC_EXCLUDE_SUBDIRS])
        self.log('Mirrored folder: static/ (safe excludes preserved)', 'SUCCESS')
        return True


    def _is_static_excluded(self, rel_path: Path) -> bool:
        """Return True if rel_path (relative to static/) should be preserved in destination.

        IMPORTANT: must be separator- and case-insensitive on Windows.
        """
        # Normalize both the candidate path and exclude prefixes to forward-slash, lowercase strings
        rp = str(rel_path).replace('\\', '/').lstrip('/').lower()
        for ex in self.STATIC_EXCLUDE_SUBDIRS:
            exs = str(ex).replace('\\', '/').lstrip('/').lower()
            if rp == exs or rp.startswith(exs + '/'):
                return True
        return False

    
    def sync_data_folder(self) -> bool:
        """Merge data folder (preserve user data) and log per-file actions."""
        src_data = self.ws_source / 'data'
        dst_data = self.pkg_dest / 'data'

        if not src_data.exists():
            self.log("Source data folder not found", "WARN")
            self.record_action("data/", "missing_source")
            return False

        if self.dry_run:
            self.log("Would merge data folder")
            self.record_action("data/", "would_merge")
            return True

        dst_data.mkdir(parents=True, exist_ok=True)

        copied_any = False
        # Direct copy files (server-side config / keys)
        for filename in ['helper.json', 'admin_users.json', 'api_keys.enc', 'secret_key.txt']:
            src = src_data / filename
            dst = dst_data / filename
            if not src.exists():
                continue

            existed = dst.exists()
            same = _files_equal(src, dst) if existed else False
            if existed and same:
                self.record_action(f"data/{filename}", "skipped_unchanged")
                continue

            shutil.copy2(src, dst)
            copied_any = True
            action = "added" if not existed else "replaced"
            self.record_action(f"data/{filename}", action)

        self.changes.append("Merged data/ folder")
        self.record_action("data/", "merged", copied=copied_any)
        self.log("Merged data/ folder", "SUCCESS")
        return True



    # ---------------------------------------------------------
    # Post-sync safety: Auto-patch + Regression Scanner
    # ---------------------------------------------------------

    APPDATA_PATCH_MARKER = "APPDATA_SAFE_PATHS_PATCH_v1"

    def post_sync_autopatch(self) -> bool:
        """Always enforce AppData-safe runtime paths in the synced Packaged output.

        - Ensures app.py does NOT write to Program Files / _internal
        - Forces DATA_DIR + LOG_DIR to point to per-user AppData when frozen (or when env vars are present)
        - Seeds missing defaults from the bundled read-only data/ folder into AppData/data
        """
        app_py = self.pkg_dest / "app.py"
        if not app_py.exists():
            self.log("post_sync_autopatch: app.py not found in destination", "WARN")
            self.record_action("app.py", "autopatch_skipped_missing")
            return True

        try:
            original = app_py.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            self.log(f"post_sync_autopatch: failed to read app.py: {e}", "ERROR")
            self.record_action("app.py", "autopatch_failed_read", error=str(e))
            return False

        patched = original

        # 1) Patch the APP_DIR/DATA_DIR early-runtime block (common in webserver truth)
        appdata_block = """APP_DIR = os.path.dirname(os.path.abspath(__file__))  # bundle/read-only when installed (Program Files)

# === {marker} ===
# IMPORTANT:
# - APP_DIR is the read-only bundle location (OK for reading static/ + bundled defaults).
# - DATA_DIR + LOG_DIR must be writable. When frozen (installed EXE) we use per-user AppData.
import sys
from pathlib import Path

_FROZEN = bool(getattr(sys, "frozen", False))
# Use AppData when:
#  - frozen executable, OR
#  - launcher provided KENPO_* env vars
_USE_APPDATA = bool(_FROZEN or os.environ.get("KENPO_DATA_DIR") or os.environ.get("KENPO_LOG_DIR") or os.environ.get("KENPO_APPDATA_BASE_DIR"))

def _get_appdata_base() -> Path:
    base = (os.environ.get("KENPO_APPDATA_BASE_DIR") or "").strip()
    if base:
        return Path(base).expanduser()

    # If KENPO_DATA_DIR points to ...\\data, normalize to parent base folder
    kd = (os.environ.get("KENPO_DATA_DIR") or "").strip()
    if kd:
        p = Path(kd).expanduser()
        if p.name.lower() == "data":
            return p.parent
        return p

    # Frozen fallback: %LOCALAPPDATA%\\Advanced Flashcards WebApp Server
    la = (os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or ".").strip()
    return (Path(la) / "Advanced Flashcards WebApp Server")

if _USE_APPDATA:
    APPDATA_BASE = _get_appdata_base().resolve()
    DATA_DIR = Path(os.environ.get("KENPO_DATA_DIR") or (APPDATA_BASE / "data")).resolve()
    LOG_DIR  = Path(os.environ.get("KENPO_LOG_DIR")  or (APPDATA_BASE / "logs")).resolve()
else:
    # Dev mode: keep behavior of using project-local folders
    APPDATA_BASE = Path(APP_DIR).resolve()
    DATA_DIR = (APPDATA_BASE / "data").resolve()
    LOG_DIR  = (APPDATA_BASE / "logs").resolve()

DATA_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

def _seed_appdata_from_bundle() -> None:
    # Copy missing default files/dirs from bundle data/ into AppData/data on first run.
    if not _USE_APPDATA:
        return
    try:
        # Prefer adjacent bundle data/
        bundle_root = Path(APP_DIR).resolve()
        bundle_data = bundle_root / "data"

        # PyInstaller one-file/onedir fallback
        if not bundle_data.exists():
            meipass = getattr(sys, "_MEIPASS", None)
            if meipass:
                bundle_data = Path(meipass) / "data"

        if not bundle_data.exists():
            return

        for src in bundle_data.rglob("*"):
            rel = src.relative_to(bundle_data)
            dst = DATA_DIR / rel
            if src.is_dir():
                dst.mkdir(parents=True, exist_ok=True)
                continue
            # Only copy if missing (do not overwrite user data)
            if not dst.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                try:
                    import shutil
                    shutil.copy2(src, dst)
                except Exception:
                    # Best-effort; do not crash server startup
                    pass
    except Exception:
        pass

_seed_appdata_from_bundle()
# === /{marker} ===
""".format(marker=self.APPDATA_PATCH_MARKER)

        pattern1 = re.compile(
            r"APP_DIR\s*=\s*os\.path\.dirname\(os\.path\.abspath\(__file__\)\)\s*\n\s*\nDATA_DIR\s*=\s*os\.path\.join\(APP_DIR,\s*['\"]data['\"]\)\s*\n\s*\nfrom\s+pathlib\s+import\s+Path\s*\n\s*\nDATA_DIR\s*=\s*Path\(DATA_DIR\)\s*\n",
            re.MULTILINE
        )
        if pattern1.search(patched):
            patched = pattern1.sub(lambda _m: appdata_block, patched, count=1)

        else:
            # Alternate pattern (some packaged truths don't convert DATA_DIR to Path here)
            pattern2 = re.compile(
                r"APP_DIR\s*=\s*os\.path\.dirname\(os\.path\.abspath\(__file__\)\)\s*\n\s*\nDATA_DIR\s*=\s*os\.path\.join\(APP_DIR,\s*['\"]data['\"]\)\s*\n",
                re.MULTILINE
            )
            if pattern2.search(patched):
                patched = pattern2.sub(lambda _m: appdata_block, patched, count=1)

        # 2) Patch legacy LOG_DIR redefinition block (common in webserver truth)
        patched = re.sub(
            r"BASE_DIR\s*=\s*os\.path\.dirname\(os\.path\.abspath\(__file__\)\)\s*\nLOG_DIR\s*=\s*os\.path\.join\(BASE_DIR,\s*['\"]logs['\"]\)\s*\nos\.makedirs\(LOG_DIR,\s*exist_ok=True\)\s*\n",
            "# LOG_DIR is defined near the top (AppData-safe when installed)\ntry:\n    LOG_DIR = Path(LOG_DIR)\n    LOG_DIR.mkdir(parents=True, exist_ok=True)\nexcept Exception:\n    pass\n\n",
            patched,
            count=1
        )

        # 3) Make FileHandler paths robust when LOG_DIR is a Path
        patched = patched.replace("logging.FileHandler(os.path.join(LOG_DIR, 'server.log')", "logging.FileHandler(str(Path(LOG_DIR) / 'server.log')")
        patched = patched.replace("logging.FileHandler(os.path.join(LOG_DIR, 'error.log')", "logging.FileHandler(str(Path(LOG_DIR) / 'error.log')")

        # 4) Ensure the regression marker exists even if the file was already AppData-safe.
        # Some app.py versions already route DATA_DIR/LOG_DIR correctly but lack our marker.
        if self.APPDATA_PATCH_MARKER not in patched:
            try:
                # Prefer inserting right after the APP_DIR line if present.
                m = re.search(r"^APP_DIR\s*=.*$", patched, flags=re.MULTILINE)
                if m:
                    ins_at = m.end()
                    patched = patched[:ins_at] + f"\n\n# === {self.APPDATA_PATCH_MARKER} ===\n" + patched[ins_at:]
                else:
                    patched = f"# === {self.APPDATA_PATCH_MARKER} ===\n" + patched
            except Exception:
                # If anything goes wrong, don't break the sync; scanner will catch real problems.
                pass

        changed = (patched != original)
        # In dry-run, keep the would-be patched content for regression scanning
        if self.dry_run:
            self._dryrun_app_py_patched_content = patched
            self.log(f"Would auto-patch app.py for AppData-safe paths (changed={changed})")
            self.record_action("app.py", "would_autopatch", changed=changed)
            return True

        if changed:
            try:
                app_py.write_text(patched, encoding="utf-8")
                self.log("Applied AppData-safe runtime auto-patch to app.py", "SUCCESS")
                self.record_action("app.py", "autopatched")
            except Exception as e:
                self.log(f"Failed to write patched app.py: {e}", "ERROR")
                self.record_action("app.py", "autopatch_failed_write", error=str(e))
                return False
        else:
            self.record_action("app.py", "autopatch_no_change")
            self.log("Auto-patch: app.py already AppData-safe (no change)", "SKIP")

        return True

    def regression_scan_or_fail(self) -> bool:
        """Hard-fail if we detect regressions that would write logs/data into Program Files."""
        app_py = self.pkg_dest / "app.py"
        if not app_py.exists():
            self.log("Regression scan: app.py missing", "ERROR")
            return False

        if self.dry_run and hasattr(self, '_dryrun_app_py_patched_content'):
            content = getattr(self, '_dryrun_app_py_patched_content')
        else:
            content = app_py.read_text(encoding="utf-8", errors="ignore")

        problems = []

        # Required marker (ensures our patch is present)
        if self.APPDATA_PATCH_MARKER not in content:
            problems.append(f"Missing marker: {self.APPDATA_PATCH_MARKER}")

        # Known-bad legacy blocks
        if "LOG_DIR = os.path.join(BASE_DIR, 'logs')" in content or "LOG_DIR = os.path.join(BASE_DIR, \"logs\")" in content:
            problems.append("Legacy LOG_DIR based on BASE_DIR detected")

        # Must reference AppData/env-based routing when frozen
        if "LOCALAPPDATA" not in content and "KENPO_DATA_DIR" not in content and "KENPO_APPDATA_BASE_DIR" not in content:
            problems.append("No AppData/env routing detected (LOCALAPPDATA / KENPO_* missing)")

        if problems:
            self.log("REGRESSION SCAN FAILED:", "ERROR")
            for p in problems:
                self.log(f" - {p}", "ERROR")
            self.record_action("app.py", "regression_failed", reasons=problems)
            return False

        self.log("Regression scan passed (AppData-safe runtime paths present)", "SUCCESS")
        self.record_action("app.py", "regression_passed")
        return True


    def run(self):
        """Execute the full sync process."""
        print("\n" + "="*60)
        print("  KenpoFlashcards Web Server → Packaged Sync Tool")
        print("  (with AI Documentation Update)")
        print("="*60 + "\n")
        
        if self.dry_run:
            self.log("DRY RUN MODE - No changes will be made", "WARN")
            print()
        
        # Validate paths
        if not self.ws_source.exists():
            self.log(f"Web server source not found: {self.ws_source}", "ERROR")
            return False
        if not self.pkg_dest.exists():
            self.log(f"Packaged destination not found: {self.pkg_dest}", "ERROR")
            return False
        
        # Read versions
        ws_version_file = self.ws_source / 'version.json'
        pkg_version_file = self.pkg_dest / 'version.json'
        
        if ws_version_file.exists():
            with open(ws_version_file, 'r') as f:
                ws_ver = json.load(f)
            self.log(f"Web Server: v{ws_ver.get('version', '?')} (build {ws_ver.get('build', '?')})")
        else:
            self.log("Web server version.json not found", "ERROR")
            return False
        
        if pkg_version_file.exists():
            with open(pkg_version_file, 'r') as f:
                pkg_ver = json.load(f)
            old_pkg_version = pkg_ver.get('version', '0.0.0')
            old_pkg_build = pkg_ver.get('build', 0)
            old_ws_version = pkg_ver.get('webserver_version', '0.0.0')
            old_ws_build = pkg_ver.get('webserver_build', 0)
            self.log(f"Packaged: v{old_pkg_version} (build {old_pkg_build}) [bundled WS v{old_ws_version}]")
        else:
            old_pkg_version = "1.0.0"
            old_pkg_build = 0
            old_ws_version = "0.0.0"
            old_ws_build = 0
        
        print()
        
        # Prompt for upgrade level
        upgrade_level = self.upgrade_level if self.upgrade_level in (1,2,3) else self.prompt_upgrade_level()
        
        # Calculate new version
        new_version = VersionBumper.bump_version(old_pkg_version, upgrade_level)
        new_build = old_pkg_build + 1
        ws_version = ws_ver.get('version', '0.0.0')
        ws_build = ws_ver.get('build', 0)
        
        self.log(f"New packaged version: v{new_version} (build {new_build})")
        print()
        
        # Read web server changelog to extract changes
        ws_changelog_path = self.ws_source / 'CHANGELOG.md'
        if ws_changelog_path.exists():
            with open(ws_changelog_path, 'r', encoding='utf-8') as f:
                ws_changelog = f.read()
            ws_changes = ChangelogAnalyzer.extract_changes_since_version(ws_changelog, old_ws_version)
            self.log(f"Found {len(ws_changes)} web server version(s) to include")
        else:
            ws_changes = []
            self.log("Web server CHANGELOG.md not found", "WARN")
        
        print()
        # Backups disabled (in-place source is not modified)

        # Sync files
        self.log("Syncing files...")
        for filename in self.SYNC_FILES:
            self.sync_file(filename)
        print()
        
        # Sync folders
        self.log("Syncing folders...")
        for foldername in self.SYNC_FOLDERS:
            self.sync_folder(foldername)
        print()
        
        # Sync data
        self.log("Merging data folder...")
        self.sync_data_folder()
        print()

        # Post-sync: enforce AppData-safe runtime + hard-fail regression scan
        self.log("Post-sync auto-patch (AppData-safe runtime paths)...")
        if not self.post_sync_autopatch():
            self.log("Auto-patch failed", "ERROR")
            return False
        print()

        self.log("Running regression scanner...")
        if not self.regression_scan_or_fail():
            self.log("Regression scanner hard-failed (refusing to continue)", "ERROR")
            return False
        print()

        # Update documentation
        self.log("Updating documentation (AI-assisted)...")
        doc_updater = DocumentationUpdater(self.pkg_dest, self.dry_run)

        changelog_path = self.pkg_dest / "CHANGELOG.md"
        readme_path = self.pkg_dest / "README.md"
        verjson_path = self.pkg_dest / "version.json"

        pre_changelog = changelog_path.read_text(encoding="utf-8") if changelog_path.exists() else None
        pre_readme = readme_path.read_text(encoding="utf-8") if readme_path.exists() else None
        pre_verjson = verjson_path.read_text(encoding="utf-8") if verjson_path.exists() else None
        pre_vtxt = sorted([p.name for p in self.pkg_dest.glob("Version-WebServerPackaged-*.txt")])

        # Generate and apply changelog entry
        changelog_entry = doc_updater.generate_changelog_entry(
            new_version, new_build,
            ws_version, ws_build,
            old_ws_version, old_ws_build,
            ws_changes, upgrade_level
        )
        doc_updater.update_changelog(changelog_entry)

        # Generate and apply README update
        readme_whats_new = doc_updater.generate_readme_whats_new(
            new_version, new_build,
            ws_version, ws_build,
            old_ws_version, old_ws_build,
            ws_changes
        )
        doc_updater.update_readme(readme_whats_new, new_version, new_build, ws_version, ws_build)

        # Update version.json
        doc_updater.update_version_json(new_version, new_build, ws_version, ws_build)

        # Update version txt file (rename only, keep contents)
        doc_updater.update_version_txt(new_version, new_build, old_pkg_version, old_pkg_build)

        # Record documentation actions
        post_changelog = changelog_path.read_text(encoding="utf-8") if changelog_path.exists() else None
        post_readme = readme_path.read_text(encoding="utf-8") if readme_path.exists() else None
        post_verjson = verjson_path.read_text(encoding="utf-8") if verjson_path.exists() else None
        post_vtxt = sorted([p.name for p in self.pkg_dest.glob("Version-WebServerPackaged-*.txt")])

        def _doc_action(path: str, pre: Optional[str], post: Optional[str]):
            if self.dry_run:
                self.record_action(path, "would_edit")
                return
            if pre is None and post is not None:
                self.record_action(path, "added")
            elif pre is not None and post is not None and pre != post:
                self.record_action(path, "edited")
            else:
                self.record_action(path, "skipped_unchanged")

        _doc_action("CHANGELOG.md", pre_changelog, post_changelog)
        _doc_action("README.md", pre_readme, post_readme)
        _doc_action("version.json", pre_verjson, post_verjson)

        if self.dry_run:
            self.record_action("Version-WebServerPackaged-*.txt", "would_rename")
        else:
            if pre_vtxt != post_vtxt:
                self.record_action("Version-WebServerPackaged-*.txt", "renamed", before=pre_vtxt, after=post_vtxt)
            else:
                self.record_action("Version-WebServerPackaged-*.txt", "skipped_unchanged")
        print()
        
        # Summary
        print("="*60)
        print("  SYNC COMPLETE")
        print("="*60)
        
        if self.dry_run:
            print("\n  DRY RUN - No changes were made")
        else:
            print(f"\n  ✅ Sync complete!")
            print(f"  📦 New version: v{new_version} (build {new_build})")
            print(f"  🌐 Bundled web server: v{ws_version} (build {ws_build})")
            print(f"  📁 Backup: {self.backup_dir}")
        
        print("\n  Updated files:")
        print("    ✅ app.py, static/, data/, requirements.txt")
        print("    ✅ README.md (version + What's new)")
        print("    ✅ CHANGELOG.md (new entry)")
        print("    ✅ version.json")
        print("    ✅ Version-WebServerPackaged-*.txt")
        
        print("\n  Next steps:")
        print("    1. Review README.md and CHANGELOG.md")
        print("    2. Test the packaged project")
        print("    3. Run packaging/build_exe.bat")
        print("    4. Run packaging/build_installer_inno.bat")
        
        print("\n" + "="*60 + "\n")

        # Write Sync log (for packaging zip suffix detection)
        last_sync_iso = datetime.now().isoformat()
        sync_log_path = None
        if not self.dry_run:
            sync_log_path = self.write_sync_log(new_version, new_build, ws_version, ws_build, last_sync_iso, backup_dir=self.backup_dir)

        # Ensure packaging\logs exists in the destination (even if we excluded copying old logs)
        try:
            plogs = self.pkg_dest / "packaging" / "logs"
            _ensure_dir(plogs)
            if sync_log_path and isinstance(sync_log_path, Path) and sync_log_path.exists():
                shutil.copy2(sync_log_path, plogs / sync_log_path.name)
                self.log(f"Copied sync log into packaged folder: {plogs / sync_log_path.name}", "SUCCESS")
        except Exception as e:
            self.log(f"Could not create/copy into packaging\\logs: {e}", "WARN")

        return True


def main():
    parser = argparse.ArgumentParser(
        description='Sync KenpoFlashcardsWebServer to Packaged with AI doc updates',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python sync_webserver_to_packaged.py C:\\Projects\\WebServer C:\\Projects\\Packaged
  python sync_webserver_to_packaged.py ..\\..\\KenpoFlashcardsWebServer ..
  python sync_webserver_to_packaged.py source dest --dry-run
        """
    )
    
    parser.add_argument('source', help='Web server project folder')
    parser.add_argument('destination', help='Packaged project folder')
    parser.add_argument('--dry-run', '-n', action='store_true',
                        help='Preview changes without applying')
    parser.add_argument('--level', type=int, choices=[1,2,3],
                        help='Upgrade level: 1=patch, 2=minor, 3=major (skips interactive prompt)')
    parser.add_argument('--output', choices=['inplace','synced'], default='synced',
                        help='Where to write results: inplace=modify destination folder; synced=write into sibling KenpoFlashcardsWebServer_Packaged_Synced')
    
    args = parser.parse_args()
    
    source = Path(args.source).resolve()
    destination = Path(args.destination).resolve()

    # Guard: if user passes the monorepo root (contains both projects), auto-target the Packaged folder.
    try:
        if (destination / 'KenpoFlashcardsWebServer_Packaged').exists() and (destination / 'KenpoFlashcardsWebServer').exists():
            # Looks like repo root was passed as destination
            destination = (destination / 'KenpoFlashcardsWebServer_Packaged').resolve()
            print(f"[INFO] Destination looks like repo root; using Packaged folder: {destination}")
    except Exception:
        pass

    
    # Tools dir is where this script is located
    tools_dir = Path(__file__).parent.resolve()

    # Optional output mode: write into sibling "KenpoFlashcardsWebServer_Packaged_Synced"
    if args.output == 'synced':
        base_destination = destination
        synced_destination = base_destination.parent / 'KenpoFlashcardsWebServer_Packaged_Synced'

        if args.dry_run:
            print(f"[DRY-RUN] Output mode: synced -> would write into: {synced_destination}")
            # For dry-run, keep reading from the real Packaged destination so we can diff versions/actions.
            destination = base_destination
        else:
            destination = synced_destination
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_root = tools_dir / 'sync_backups' / 'synced_outputs'
            backup_root.mkdir(parents=True, exist_ok=True)

            if destination.exists():
                backup_path = backup_root / f"{destination.name}_{timestamp}"
                print(f"[INFO] Existing synced folder found. Moving to backup: {backup_path}")
                shutil.move(str(destination), str(backup_path))

            print(f"[INFO] Creating fresh output folder from base Packaged: {base_destination} -> {destination}")
            # Copy base Packaged folder into the new output folder.
            # IMPORTANT: Do NOT copy bulky/dev/runtime folders into *_Synced.
            # Excluded (as requested):
            #   - .venv, build, dist
            #   - packaging\output, packaging\build_data, packaging\logs
            def _synced_copy_ignore(dirpath: str, names: List[str]) -> set:
                ignore_set = set()

                # Always ignore cache/backup noise
                always_ignore = {'__pycache__', 'sync_backups'}
                for n in names:
                    if n in always_ignore or n.endswith('.pyc'):
                        ignore_set.add(n)

                # Root-level dev/runtime folders to exclude from synced output
                root_excludes = {'.venv', 'build', 'dist'}
                if Path(dirpath).resolve() == base_destination.resolve():
                    ignore_set |= (root_excludes & set(names))

                # Nested packaging exclusions (only within the packaging folder)
                if Path(dirpath).name.lower() == 'packaging':
                    ignore_set |= ({'output', 'build_data', 'logs'} & set(names))

                return ignore_set

            shutil.copytree(
                str(base_destination),
                str(destination),
                ignore=_synced_copy_ignore,
                dirs_exist_ok=False
            )

    # Run sync
    syncer = WebServerSyncer(source, destination, tools_dir, dry_run=args.dry_run, upgrade_level=args.level, output_mode=args.output)
    success = syncer.run()
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
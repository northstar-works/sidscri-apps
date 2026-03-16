# -*- mode: python ; coding: utf-8 -*-

import os
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

# IMPORTANT:
# In CI we `cd` into the project root (PROJ_DIR) before invoking PyInstaller.
# Using the current working directory is the most reliable way to resolve
# project paths across different repo layouts.
project_root = os.path.abspath(os.getcwd())


runtime_dir = os.path.join(project_root, "runtime")
static_dir = os.path.join(project_root, "static")
data_dir = os.environ.get("AFS_DATA_DIR")
if not data_dir:
    # Default: use packaging\build_data when present, otherwise root\data
    pkg_build_data = os.path.join(project_root, "packaging", "build_data")
    if os.path.isdir(pkg_build_data):
        data_dir = pkg_build_data
    else:
        data_dir = os.path.join(project_root, "data")

# NOTE:
# Some deps pull in setuptools/pkg_resources; PyInstaller may enable the
# pkg_resources runtime hook (pyi_rth_pkgres), which can require platformdirs.
# Force include platformdirs + pkg_resources to avoid fresh-machine crashes.
hiddenimports = (
    collect_submodules("flask")
    + collect_submodules("pkg_resources")
    + collect_submodules("runtime")
    + ["platformdirs", "setuptools"]
)

# Bundle runtime data folders/files the server needs.
datas = []
if os.path.isdir(static_dir):
    datas.append((static_dir, "static"))
if os.path.isdir(data_dir):
    datas.append((data_dir, "data"))
if os.path.isdir(runtime_dir):
    datas.append((runtime_dir, "runtime"))
else:
    print("[WARNING] runtime folder not found - imports may fail")

version_json = os.path.join(project_root, "version.json")
if os.path.isfile(version_json):
    datas.append((version_json, "."))

icon_png = os.path.join(project_root, "static", "res", "webappservericons", "AdvancedFlashcardsWebAppServer_tray.png")
if os.path.isfile(icon_png):
    datas.append((icon_png, "."))

# Application icon (.ico) for Windows exe
app_icon = os.path.join(project_root, "static", "res", "webappservericons", "AdvancedFlashcardsWebAppServer.ico")
if not os.path.isfile(app_icon):
    app_icon = None
    print("[WARNING] AdvancedFlashcardsWebAppServer.ico not found - using default icon")

a = Analysis(
    [os.path.join(project_root, "app.py")],
    pathex=[project_root],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="KenpoFlashcardsWebServer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # set True if you want a console window for logs
    icon=app_icon,  # Custom app icon
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="KenpoFlashcardsWebServer",
)
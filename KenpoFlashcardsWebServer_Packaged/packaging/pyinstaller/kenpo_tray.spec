# -*- mode: python ; coding: utf-8 -*-

import os
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None

# IMPORTANT:
# In CI we `cd` into the project root (PROJ_DIR) before invoking PyInstaller.
# Using the current working directory is the most reliable way to resolve
# project paths across different repo layouts.
project_root = os.path.abspath(os.getcwd())

runtime_dir = os.path.join(project_root, "runtime")
static_dir = os.path.join(project_root, "static")
windows_tray_dir = os.path.join(project_root, "windows_tray")

# Data directory: select via env var (set by build scripts) if provided.
data_dir = os.environ.get("AFS_DATA_DIR")
if not data_dir:
    # Default: use packaging\build_data when present, otherwise root\data
    pkg_build_data = os.path.join(project_root, "packaging", "build_data")
    default_data_dir = os.path.join(project_root, "data")
    if os.path.isdir(pkg_build_data):
        data_dir = pkg_build_data
    else:
        data_dir = default_data_dir

# Collect all submodules for packages that have dynamic imports
hiddenimports = (
    collect_submodules("pystray")
    + collect_submodules("jaraco")
    + collect_submodules("jaraco.functools")
    + collect_submodules("jaraco.context")
    + collect_submodules("jaraco.classes")
    + collect_submodules("jaraco.text")
    + collect_submodules("pkg_resources")
    + collect_submodules("runtime")
    + collect_submodules("pkg_resources._vendor")
    + collect_submodules("importlib_resources")
    + [
        "jaraco",
        "jaraco.functools",
        "jaraco.context", 
        "jaraco.classes",
        "jaraco.text",
        "PIL",
        "PIL.Image",
    ]
)


# Bundle app.py so the tray launcher can import it
datas = [
    (os.path.join(project_root, "app.py"), "."),
]

# Bundle version.json for version display
version_json = os.path.join(project_root, "version.json")
if os.path.isfile(version_json):
    datas.append((version_json, "."))
    print(f"[INFO] Bundling version.json from: {version_json}")
else:
    print("[WARNING] version.json not found!")

# Collect data files from jaraco packages (they may have package data)
try:
    datas += collect_data_files("jaraco")
    datas += collect_data_files("jaraco.functools")
    datas += collect_data_files("jaraco.context")
except Exception:
    pass

# Bundle AdvancedFlashcardsWebAppServer_tray.png for tray icon (placed in assets/ inside bundle)
icon_png = os.path.join(project_root, "static", "res", "webappservericons", "AdvancedFlashcardsWebAppServer_tray.png")
if os.path.isfile(icon_png):
    datas.append((icon_png, "assets"))

# Application icon (.ico) for Windows exe
app_icon = os.path.join(project_root, "static", "res", "webappservericons", "AdvancedFlashcardsWebAppServer.ico")
if not os.path.isfile(app_icon):
    app_icon = None
    print("[WARNING] AdvancedFlashcardsWebAppServer.ico not found - using default icon")

# Also check windows_tray/icon.png as fallback
tray_icon = os.path.join(windows_tray_dir, "icon.png")
if os.path.isfile(tray_icon):
    datas.append((tray_icon, "assets"))

if os.path.isdir(static_dir):
    datas.append((static_dir, "static"))
if os.path.isdir(data_dir):
    datas.append((data_dir, "data"))
if os.path.isdir(runtime_dir):
    datas.append((runtime_dir, "runtime"))
else:
    print("[WARNING] runtime folder not found - imports may fail")

# Bundle kenpo_words.json from project data folder
kenpo_json = os.path.join(data_dir, "kenpo_words.json")
if os.path.isfile(kenpo_json):
    datas.append((kenpo_json, "data"))
    print(f"[INFO] Bundling kenpo_words.json from: {kenpo_json}")
else:
    print("[WARNING] kenpo_words.json not found in data folder!")
    print("         Expected at: " + kenpo_json)
    print("         Copy kenpo_words.json to the data folder before building.")

a = Analysis(
    [os.path.join(project_root, "AdvancedFlashcardsWebAppServerLauncher.py")],
    pathex=[project_root],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports + ["flask", "requests", "setuptools"],
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
    name="AdvancedFlashcardsWebAppServer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,   # tray app: no console window
    icon=app_icon,   # Custom app icon
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="AdvancedFlashcardsWebAppServer",
)

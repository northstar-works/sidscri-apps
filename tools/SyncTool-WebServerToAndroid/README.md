# SyncTool-WebServerToAndroid

Version: **v2.0.0 (build 2)**

This tool syncs selected WebAppServer (KenpoFlashcardsWebServer) assets/features into the Android client project (KenpoFlashcardsProject-v2).

## Recommended location

Install here:

```
sidscri-apps\tools\SyncTool-WebServerToAndroid\
```

Default relative project paths (from the tool folder):

- WebServer: `..\..\KenpoFlashcardsWebServer`
- Android: `..\..\KenpoFlashcardsProject-v2`

## Run

- `sync_android.bat`

## Packaging / Zip

Run:

- `make2_zip_SyncTool-WebServerToAndroid.bat`

Outputs:

- Zip file: `sidscri-apps\logs\zips\SyncTool-WebServerToAndroid-vX.Y.Z_bN.zip`
- Zip log: `sidscri-apps\logs\zips\make2_zip_SyncTool-WebServerToAndroid_YYYYMMDD_HHMMSS.log`

## Exclusions

The zip step excludes common junk folders/files (e.g., `output`, `logs`, `sync_backups`, `.venv`, `__pycache__`, `*.log`, `*.zip`).

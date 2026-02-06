# SyncTool-WebServerToPackaged

**Version:** v3.0.4 (build 14)

This tool syncs a clean copy of the web server project into the *packaged* web server repo/folder, while excluding junk folders/files and supporting optional “AppData-safe runtime path” patching + regression scanning.

## Expected repo layout
Place this tool here:

```
<root>\tools\SyncTool-WebServerToPackaged\
```

Where the projects live alongside `tools`:

```
<root>\KenpoFlashcardsWebServer\
<root>\KenpoFlashcardsWebServer_Packaged\
<root>\tools\SyncTool-WebServerToPackaged\
```

## Quick start
From this folder, run:

- **Default sync (uses the expected layout above):**
  - `sync_webserver.bat`

- **Explicit paths:**
  - `sync_webserver.bat "C:\path\to\KenpoFlashcardsWebServer" "C:\path\to\KenpoFlashcardsWebServer_Packaged"`

## Does the mapping work from the new location?
Yes.

- The included `sync_webserver.bat` now defaults to `..\..\KenpoFlashcardsWebServer` and `..\..\KenpoFlashcardsWebServer_Packaged` (because the tool is two levels deep under `tools`).
- The Python entrypoint accepts explicit source/destination paths if your repo layout differs.

## Auto-zip this tool
Run:

- `make_zip.bat`

It reads `version.json` and writes:

- `output\SyncTool-WebServerToPackaged-v3.0.3_b13.zip`

## Files in this folder
- `sync_webserver_to_packaged.py` — main Python tool
- `sync_webserver.bat` — convenience wrapper
- `make_zip.bat` — creates a versioned zip from this folder
- `version.json` — tool version metadata
- `CHANGELOG.md` — tool release notes

> Note: `README_SYNC_TOOL.md` is the original longform documentation; this `README.md` is the standard entrypoint.


## Recommended location
- Place this folder at `tools\SyncTool-WebServerToPackaged` inside your `sidscri-apps` repo.

## Create a versioned zip
- Run `make1_zip_SyncTool-WebServerToPackaged-Zip.bat`
- Output goes to `output/` and the zip contains a versioned root folder like `SyncTool-WebServerToPackaged-vX.Y.Z_bN/`

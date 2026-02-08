# Changelog

## v2.1.2 (build 7) — 2026-02-07
- Sync now reconstructs a **complete Android changelog entry** from WebServer changes included during the sync:
  - Aggregates all WebServer changelog items since last parity into one release (Added / Changed / Fixed)
  - No placeholder/TODO bullets; includes full bullet lists (deduped)
  - Considers WebServer build parity when version is unchanged
- Script internal version bumped to v1.1.0

## v2.0.0 (build 2) — 2026-02-03
- Tool location standardized to `sidscri-apps\tools\SyncTool-WebServerToAndroid\`.
- Added `version.json`, `README.md`, and `CHANGELOG.md`.
- Added `make2_zip_SyncTool-WebServerToAndroid.bat` to create a clean versioned zip.
- Zip outputs and zip logs now go to `sidscri-apps\logs\zips\`.

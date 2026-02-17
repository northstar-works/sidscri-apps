# Android – Remote Config Integration Guide

> **Server version:** 8.9.0 (build 63)  
> **Feature:** Remote Config Push — admin can change which server Android apps point to

---

## Overview

The server now exposes a public endpoint that Android apps should call on every startup (or on each login attempt). If the admin has changed the configured `host`, `port`, or `server_type`, the app can automatically switch to the new server or prompt the user.

---

## Server API

### `GET /api/sync/remote-config`

**No authentication required.**  
Returns the currently configured server connection settings.

**Response:**
```json
{
  "server_type": "rpi",
  "host": "sidscri.tplinkdns.com",
  "port": 8009,
  "updated_at": "2026-02-17T10:00:00Z",
  "updated_by": "sidscri"
}
```

| Field | Type | Values |
|-------|------|--------|
| `server_type` | string | `"standalone"` / `"packaged"` / `"rpi"` |
| `host` | string | Domain or IP (no `http://` prefix) |
| `port` | int | 1–65535 |
| `updated_at` | string | ISO 8601 UTC, empty string if never saved |
| `updated_by` | string | Admin username who saved it |

**Defaults (before admin saves):** `standalone`, `sidscri.tplinkdns.com`, `8009`

---

### `POST /api/sync/admin/remote-config`  _(Admin only)_

Android admin panel can push config updates.

**Auth:** `Authorization: Bearer <token>` (user must be admin)

**Request body:**
```json
{
  "server_type": "rpi",
  "host": "sidscri.tplinkdns.com",
  "port": 8009
}
```

**Success response:** `{ "success": true, "config": { ... } }`

---

## Android App Implementation

### 1. Where to call it

Call `GET /api/sync/remote-config` in these situations:
- **App startup / `onCreate`** of `MainActivity` or `SplashActivity`
- **After a failed server connection** (before showing error to user)
- **In Settings / Admin → "Check for Server Update"** button

Use the app's **currently saved host+port** to make the call, not a hardcoded URL.

---

### 2. Suggested flow

```kotlin
// In your network/repository layer:
suspend fun checkRemoteConfig(): RemoteConfig? {
    return try {
        val url = "${savedBaseUrl}/api/sync/remote-config"
        val response = httpClient.get(url)
        response.body<RemoteConfig>()
    } catch (e: Exception) {
        null  // fail silently, don't block app startup
    }
}

data class RemoteConfig(
    val server_type: String,
    val host: String,
    val port: Int,
    val updated_at: String,
    val updated_by: String
)
```

### 3. Handling the response

```kotlin
val config = checkRemoteConfig() ?: return  // null = network error, skip

val currentHost = prefs.getString("server_host", "sidscri.tplinkdns.com")
val currentPort = prefs.getInt("server_port", 8009)

if (config.host != currentHost || config.port != currentPort) {
    // Config changed — either auto-apply or prompt user
    showServerChangeDialog(
        oldHost = currentHost,
        oldPort = currentPort,
        newHost = config.host,
        newPort = config.port,
        serverType = config.server_type
    )
}
```

---

### 4. Admin Panel UI (Android Admin section)

Add to your existing **Admin** screen (Settings → Admin):

```
┌─────────────────────────────────────────┐
│  📡 Remote Server Config                │
│                                         │
│  Server Type: [Raspberry Pi         ▼]  │
│  Host:        [sidscri.tplinkdns.com ]  │
│  Port:        [8009                  ]  │
│                                         │
│  [ 💾 Save & Push to All Apps ]         │
│  [ 🔄 Load Current Config     ]         │
│                                         │
│  Last updated: 2026-02-17 by sidscri    │
└─────────────────────────────────────────┘
```

**Load:** `GET /api/sync/remote-config` (no auth needed, but call while logged in so you show the `updated_by` field)

**Save:** `POST /api/sync/admin/remote-config` with Bearer token (requires admin user)

---

### 5. SharedPreferences keys (suggested)

```kotlin
const val PREF_SERVER_HOST     = "server_host"      // String, default "sidscri.tplinkdns.com"
const val PREF_SERVER_PORT     = "server_port"      // Int, default 8009
const val PREF_SERVER_TYPE     = "server_type"      // String, default "standalone"
const val PREF_RC_LAST_CHECKED = "rc_last_checked"  // Long (epoch ms)
const val PREF_RC_UPDATED_AT   = "rc_updated_at"    // String (ISO 8601)
```

---

### 6. Base URL construction

```kotlin
fun buildBaseUrl(host: String, port: Int): String {
    // Determine scheme: if host has explicit scheme keep it, else default to http for LAN, https for public
    val cleanHost = host.removePrefix("http://").removePrefix("https://")
    val scheme = if (cleanHost.contains("localhost") || cleanHost.matches(Regex("\\d+\\.\\d+\\.\\d+\\.\\d+"))) "http" else "http"
    return "$scheme://$cleanHost:$port"
}
```

> Note: Your current server uses HTTP. If you add HTTPS/TLS later, update the scheme logic.

---

## Summary of Changes Needed in Android App

| Area | Change |
|------|--------|
| **Network layer** | Add `RemoteConfigApi` / `GET /api/sync/remote-config` call |
| **Admin network** | Add `POST /api/sync/admin/remote-config` call (Bearer auth) |
| **Startup** | Call remote config check after app init, before login |
| **Settings/Admin UI** | Add "Remote Server Config" section with type/host/port fields + Save/Load buttons |
| **SharedPreferences** | Store `server_type` alongside existing `server_host` / `server_port` |
| **Dialog** | Show "Server Changed" dialog if remote config differs from saved |
| **Version bump** | Bump Android app version to reflect this feature |

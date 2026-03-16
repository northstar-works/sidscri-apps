# 📚 Advanced Flashcards (Android)

> This is the **Android app** project inside the `sidscri-apps` monorepo.
> Repo root: `../README.md`

An Android flashcard app designed for studying multiple subjects. It includes a built-in **Kenpo Vocabulary** deck and supports additional synced/custom decks.

This app focuses on **active recall**, **progress tracking**, and **organized learning**, making it ideal for beginners through advanced practitioners.

**Current Version:** v7.2.0 (build 44)
**Changelog:** [CHANGELOG.md](CHANGELOG.md)

---

## Local Build Sanity Checks

### Quick compile gate (matches GitHub)
From the project root (same folder as `gradlew.bat`):

```powershell
.\gradlew.bat :app:compileReleaseKotlin --stacktrace
```

### If Gradle wrapper fails
Ensure these exist in the project:
- `gradle/wrapper/gradle-wrapper.jar`
- `gradle/wrapper/gradle-wrapper.properties`
- `gradlew.bat`

### If Android SDK is not found
Create/update `local.properties` with your SDK path:

```properties
sdk.dir=C:\\Users\\Sidscri\\AppData\\Local\\Android\\Sdk
```

---

## Branding

This app is branded as **Advanced Flashcards**. The built-in **Kenpo Vocabulary** deck keeps its original name/content, but other user-facing "Kenpo" references (app title, generic labels) are rebranded.

---

## 📱 Features

### 🃏 Flash Card Learning
- Vocabulary terms displayed on **interactive flash cards**
- **Tap to flip** between term and definition
- **Swipe navigation** between cards
- Smooth flip animations for intuitive study
- **Pronunciation display** for terms with phonetic guides
- **Reverse mode** — study definition-first

### 📂 Three-State Progress Tracking
Cards can be in one of three states:
- **To Study** — Active cards you're learning
- **Unsure** — Cards you're uncertain about
- **Learned** — Cards you've mastered

### ⭐ Custom Study Sets
- Star any card to add it to your **Custom Set**
- Create personalized review decks
- Access starred cards from any screen
- Perfect for test prep or belt reviews

### 📊 Term Breakdowns
- **Breakdown editor** for each term
- Split compound terms into parts (e.g., TaeKwonDo → Tae, Kwon, Do)
- **Auto-split** feature detects word boundaries
- **AI-powered autofill** (ChatGPT or Gemini)

### 🔍 Filtering & Sorting
- **Group filter** — Study cards from specific categories
- **Search** — Find cards by term, definition, or pronunciation
- **5 sort modes**: Original order, Alphabetical, Groups (A-Z), Groups (random), Random

### 🔊 Text-to-Speech
- **Speak button** reads terms aloud
- Adjustable **speech rate** (0.5x–2.0x)
- **Pronunciation-only mode** — speaks phonetic pronunciation when available
- **Auto-speak** on card change; speak definition when flipped

### 📱 Responsive Design
- Full **landscape mode** support with side-by-side layout
- Adaptive UI for different screen sizes
- Dark theme throughout

### ☁️ Web App Sync (v4.0+)
- **Login** to sync with web app server
- **Push/Pull** progress between devices
- **Sync breakdowns** from shared database
- **First login auto-sync** — always syncs on first device login
- **Auto-sync settings** — auto-pull on future logins, auto-push on change
- **API keys pulled for all users** — AI features available to everyone
- **Remote Config Push** (v7.1.0+) — admin can push server connection settings to all clients
- Server: `sidscri.tplinkdns.com:8009`
- Endpoint: `POST /api/sync/login` (token-based auth)

### 🤖 AI Integration (v4.0+)
- **ChatGPT API** integration for breakdown autofill
- **Gemini API** integration (v4.2.0+)
- **Model selection** — choose gpt-4o, gpt-4o-mini, gemini-1.5-flash, etc.
- **Key validation indicators** — "Key Accepted" / "Key Invalid"
- **Shared API keys** — All users receive API keys on login
- **AI deck generator** — generate cards from keywords, image, or document
- **AI template bulk editor** — batch-edit card fields with instruction + preview

### 👤 Admin Features (v4.2.0+)
- **Admin-only access** — Admin Settings visible only to admin users
- **(Admin) label** — shown after username when logged in as admin
- **API key management** — push/pull encrypted keys to/from server
- **Remote Config Push** (v7.1.0+) — push server connection config to all Android clients
- **In-app Debug Log** (v7.1.0+) — view sync errors with timestamps, level filter, copy-to-clipboard

---

## 🧭 Navigation

| Tab | Description |
|-----|-------------|
| **To Study** | Active cards to learn (formerly "Unlearned") |
| **Unsure** | Cards marked as uncertain |
| **Learned** | Mastered cards (List or Study view) |
| **All** | Browse all cards with status indicators |
| **Custom** | Your starred cards |
| **More** | Settings, Login, Sync, About, Admin (if admin) |

---

## ⚙️ Settings

### Display
- Show/hide group labels and subgroup labels
- Reverse cards (definition first)
- Show breakdown on definition side

### Sorting
- Choose from 5 sort modes
- Per-tab randomization options

### List Views
- Show/hide definitions in lists
- Show/hide action buttons

### Voice
- Speech rate adjustment
- Pronunciation-only mode toggle
- Auto-speak on card change / flip

### Login (v4.2.0+)
- Web app login with server verification
- Auto-sync on login toggle; auto-push on change toggle
- Shows "(Admin)" label for admin users

### Sync Progress (v4.2.0+)
- Manual push/pull progress
- Breakdown sync
- AI service selector (Auto Select, ChatGPT, Gemini)

### AI Access Settings (Admin Only, v4.3.0+)
- ChatGPT API key and model selection
- Gemini API key and model selection
- Key validation indicators
- Push/Pull keys to server
- Remote Config Push — set Host, Port, Server Type; push to all clients
- View Debug Log — real-time error log with level filter and clipboard export

---

## 🧠 Learning Philosophy

- **Active recall** — Test yourself before seeing answers
- **Spaced repetition** — Focus on what you don't know
- **Three-state tracking** — Nuanced progress beyond just learned/unlearned
- **Reduced cognitive overload** — Hide mastered terms

---

## 🛠️ Tech Stack

- **Language:** Kotlin
- **UI:** Jetpack Compose (Material 3)
- **Architecture:** Repository pattern with Flows
- **Local Storage:** DataStore Preferences
- **Networking:** HttpURLConnection (for sync)
- **Minimum SDK:** Android 8.0+ (API 26)
- **Target SDK:** Android 14 (API 34)

---

## 📦 Project Structure

```
app/src/main/
├── java/com/example/kenpoflashcards/
│   ├── MainActivity.kt       # All UI screens (Compose)
│   ├── Models.kt             # Data classes (FlashCard, TermBreakdown, RemoteConfig, etc.)
│   ├── Repository.kt         # Data access layer
│   ├── Store.kt              # DataStore persistence
│   ├── StudySettings.kt      # Settings data classes, AdminUsers object
│   ├── JsonUtil.kt           # JSON parsing utilities
│   ├── TtsHelper.kt          # Text-to-speech wrapper
│   ├── CsvImport.kt          # CSV import functionality
│   ├── WebAppSync.kt         # Server sync API, verifyServer(), normalizeUrl(), pullRemoteConfig()
│   ├── AppLog.kt             # In-app debug log singleton (v7.1.0+)
│   ├── AiGenerationHelper.kt # AI card/definition/description generation (ChatGPT + Gemini)
│   ├── ChatGptHelper.kt      # ChatGPT AI breakdown autofill
│   └── GeminiHelper.kt       # Gemini AI breakdown autofill
├── assets/
│   └── kenpo_words.json      # Default vocabulary data
├── res/
│   └── ...                   # Icons, themes, strings
└── AndroidManifest.xml
```

---

## 📋 Version History

| Version | Build | Date | Key Changes |
|---------|-------|------|-------------|
| **7.1.0** | 42 | 2026-02-17 | Remote Config Push, URL normalization, server name validation fix, 401 session-expired handling, in-app Debug Log |
| **7.0.0** | 41 | 2026-02-09 | Deck AI setting, AI generator **Instructions, AI template bulk editor, Edit Cards management, Edit Deck modal tabs, dmin/System version display, Packaged support version metadata, Packaged support metadata, Packaged support metadata, Version API upgrade, Packaged support version metadata, Admin/System version display, User dropdown version display, Edit Deck modal tabs, Edit Cards management, Per‑card actions, Duplicate handling prompt |
| **6.0.0** | 40 | 2026-02-03 | Allow/Deny access buttons, Deck Ownership, file-based logging, Deck Short Answers mode, collapsible Manage Cards panes |
| **5.6.0** | 39 | 2026-01-31 | Admin access fallback fix, concise AI definitions, per-deck descriptive toggle, server verification on login |
| **5.5.0** | 38 | 2026-01-31 | Deck editing, set/clear default deck, user card deletion sync |
| **5.4.0** | 37 | 2026-01-28 | Invite code redemption, deck logos, Admin Deck Access controls, server-sourced admin state |
| **5.3.1** | 36 | 2026-01-26 | Advanced Flashcards icon/logo branding |
| **5.3.0** | 35 | 2026-01-24 | Deck sync, user cards sync, vocabulary sync |
| **5.2.0** | 34 | 2026-01-22 | Updated server data paths for Windows installer |
| **5.1.1** | 33 | 2026-01-20 | Deck switching fix, AI toggles in Settings, file upload feedback |
| **5.1.0** | 32 | 2026-01-19 | AI Generate buttons, user cards management, Create Deck AI Search |
| **5.0.0** | 29 | 2026-01-18 | Edit Decks screen (Switch / Add Cards / Create Deck) |
| **4.5.0** | 26 | 2026-01-18 | Deck Management groundwork, per-card sync timestamps |
| **4.4.0** | 20 | 2026-01-13 | First-login auto-sync, (Admin) label, key validation, Custom Set isolated status, Random/Reshuffle controls |
| **4.3.0** | 19 | 2026-01-13 | AI model selection, server-based admin users SoT |
| **4.2.0** | 18 | 2026-01-12 | About/User Guide screens, Gemini AI, dedicated Login/Sync screens, auto-sync, API key sync |
| **4.0.0** | 7  | 2026-01-09 | Landscape mode, Web App sync, ChatGPT integration |
| **3.0.1** | —  | —          | Custom sets, Sort modes, Group filtering |
| **2.0.0** | —  | —          | Three-state progress, Term breakdowns, Dark theme |
| **1.0.0** | —  | —          | Basic flashcards, Got It tracking |

---

## 🚀 Getting Started

1. Clone or download the project
2. Open in Android Studio
3. Sync Gradle dependencies
4. Run on device or emulator (API 26+)

### Build Release APK
```bash
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

### Web Sync Setup
Your server needs these endpoints:
- `GET /api/version` — Server identity verification
- `POST /api/sync/login` — Token authentication
- `GET /api/sync/remote-config` — Remote config pull (public)
- `POST /api/sync/admin/remote-config` — Remote config push (admin)
- `GET/POST /api/sync/pull|push` — Progress sync
- `GET /api/sync/breakdowns` — Shared breakdowns
- `GET /api/sync/apikeys` — API keys for all users
- `GET /api/admin/status` — Admin status check
- `GET /api/admin/users` — Admin usernames (SoT)
- `GET/POST /api/admin/apikeys` — Encrypted API keys (admin only for POST)

---

## 📄 License

Personal/educational use for learning and studying flashcards (including the Kenpo Vocabulary deck).

---

## 🙏 Acknowledgments

Includes a Kenpo Vocabulary deck for martial-arts terminology, plus support for other subjects.

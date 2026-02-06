# Build 56 (v8.5.3) — Full Feature Audit

**Date:** February 1, 2026  
**Current Version:** 8.5.3 (build 56)  
**Base Starting Version:** 8.5.1 (build 54)

This audit compares what was discussed/implemented across chat sessions (builds 55–56) against what is actually present in the current v8.5.3 build 56 zip.

---

## ✅ FEATURES THAT ARE PRESENT AND WORKING

These are confirmed implemented in the current zip. No action needed.

### 1. File-Based Logging System (Build 55)
**Status:** ✅ Present  
**What it does:** Logs write to disk (`server.log`, `error.log`, `user_activity.log`) instead of in-memory only. Server/error logs rotate on startup (previous saved as `.prev`). User activity is continuous unless cleared.  
**Files:** `app.py` (logging functions), `runtime/app_paths.py` (`configure_logging`)

### 2. AI Generation Prompt — No Language Assumption (Build 55)
**Status:** ✅ Present  
**What it does:** AI prompt rewritten to determine subject from keywords only. No longer assumes foreign language unless explicitly mentioned (e.g., "Spanish", "French"). Fixes issue where "fast food" generated Spanish translations.  
**Files:** `app.py` (`_ai_generate_from_keywords` function)

### 3. Deck-Specific Short Answer Mode — Backend API (Build 55)
**Status:** ✅ Present  
**What it does:** API endpoints `GET/POST /api/decks/<deckId>/settings` store per-deck `shortAnswers` boolean. AI generation passes this to prompt for 1-4 word answers.  
**Files:** `app.py` (routes at ~line 4452+)

### 4. Deck-Specific Short Answer Toggle — Frontend (Build 55)
**Status:** ✅ Present  
**What it does:** Checkbox in Edit Decks > deck settings toggles `shortAnswers` mode per deck. AI generation reads this setting.  
**Files:** `index.html` (deckShortAnswers checkbox), `app.js` (`loadDeckShortAnswersSetting`, `toggleDeckShortAnswers`)

### 5. Custom Set Tab Switching Fix (Build 55/56)
**Status:** ✅ Present  
**What it does:** Fixed bug where `.hidden{display:none !important}` overrode `.csTabContent.active`. Tab switching now properly removes `hidden` class AND adds `active` class. Manage Cards and Saved Sets tabs now display content.  
**Files:** `app.js` (Custom Set tabs event listener ~line 3965)

### 6. Custom Set Counts — Own Unlearned/Unsure/Learned (Build 55)
**Status:** ✅ Present  
**What it does:** When studying Custom Set, the counts bar shows the custom set's own Unlearned/Unsure/Learned counts instead of the main deck's.  
**Files:** `app.js` (`loadCustomSetForStudy` ~line 1303)

### 7. Add Card Deck Pre-Selection (Build 55)
**Status:** ✅ Present  
**What it does:** When opening the Add Cards tab, the deck dropdown pre-selects the currently active deck.  
**Files:** `app.js` (`updateDeckDropdown` ~line 3177, `if(deck.id === activeDeckId) opt.selected = true`)

### 8. Admin — Allow/Deny Don't Reset Dropdowns (Build 56)
**Status:** ✅ Present  
**What it does:** Clicking Allow or Deny for user deck access no longer calls `loadDeckConfig()` which was resetting the user/deck dropdowns. Now only updates status display.  
**Files:** `admin.html` (`allowDeckForUser`, `denyDeckForUser`)

### 9. Admin — Built-In Toggle Buttons Removed (Build 56)
**Status:** ✅ Present  
**What it does:** Removed "Disable Built-In" / "Enable Built-In" buttons from admin deck access panel. Simplified to just Allow/Deny.  
**Files:** `admin.html`

### 10. Admin — allowNonAdminDeckEdits Default to False (Build 56)
**Status:** ✅ Present  
**What it does:** Non-admin users cannot edit built-in decks by default (was `True`).  
**Files:** `app.py` (`"allowNonAdminDeckEdits": False`)

### 11. Status Line Inline with Card Position (Build 56)
**Status:** ✅ Present  
**What it does:** "All (flat) • Studying: Unlearned" status moved into the cardMeta row alongside "Card 1 / 30" and "Random order" toggle. Dual status elements: `statusHeader` for list view, `statusStudy` for study view.  
**Files:** `index.html` (`statusStudy` div), `app.js` (`setStatus` function), `styles.css`

### 12. Counts + Controls Same Row (Build 56)
**Status:** ✅ Present  
**What it does:** "Unlearned: 30 | Unsure: 10 | Learned: 49" and "Select group... All Cards 🔍" on the same row via `.countsControlsRow` wrapper.  
**Files:** `index.html` (countsControlsRow div), `styles.css`

### 13. Card Auto-Height via resizeCard() (Build 56)
**Status:** ✅ Present  
**What it does:** JavaScript `resizeCard()` function measures both card faces and sets card height dynamically. No more fixed heights cutting off breakdowns. Called after render, flip, and window resize.  
**Files:** `app.js` (`resizeCard` function)

### 14. Study View Indented Padding (Build 56 — current session)
**Status:** ✅ Present  
**What it does:** `#viewStudy{padding:0 10%}` gives the card area, cardMeta, and action buttons matching indentation from both edges. Controls row gets matching `padding-right:10%`.  
**Files:** `styles.css`

### 15. Card 1/30 Centering (Build 56 — current session)
**Status:** ✅ Present  
**What it does:** `#cardPos{flex:1;text-align:center}` with equal flex columns on either side centers "Card 1 / 30" relative to the card.  
**Files:** `styles.css`

### 16. Card-Related Text Smaller Than Page Text (Build 56 — current session)
**Status:** ✅ Present  
**What it does:** Card-related text (statusInMeta, cardPos, randomRow, cardMeta, controls) universally set to `font-size:12px`, smaller than page text (tabs, counts at 13px).  
**Files:** `styles.css`

### 17. Controls Size Reduction ~10% (Build 56 — current session)
**Status:** ✅ Present  
**What it does:** Controls in countsControlsRow: `font-size:12px`, `padding:7px 9px` (down from 10px 12px).  
**Files:** `styles.css` (`.countsControlsRow .groupDropdown .select`, `#allCardsBtn`, `.searchToggleBtn`)

### 18. Group Dropdown Width Reduced (Build 56 — current session)
**Status:** ✅ Present  
**What it does:** `.groupDropdown` width reduced from 220px to 170px.  
**Files:** `styles.css`

---

## ❌ FEATURES THAT ARE MISSING OR BROKEN

These were discussed/partially implemented in chat but are NOT working correctly in the current zip. Each includes exact instructions for reimplementation.

### ❌ 1. Custom Set Random Number Field — Too Wide (Overlaps Text)
**Problem:** The random card count input (`.csRandomInput`) is supposed to be 52px wide, but the global CSS rule `input{min-width:280px}` overrides it, making it 280px — way too wide, overlapping the label text and button.  
**Root cause:** `.csRandomInput` is missing `min-width: auto !important` or `min-width: unset` to override the global input minimum.  
**What to say to reimplement:**
> "In styles.css, the Custom Set random number input (.csRandomInput) is broken because the global `input{min-width:280px}` rule overrides its width:52px. Add `min-width: auto !important;` to the `.csRandomInput` rule so it stays at 52px wide."

### ❌ 2. "Add Random" Button Should Say "Add Random Card"
**Problem:** The button in Custom Set Settings > Settings tab says "🎲 Add Random" but should say "🎲 Add Random Card" for clarity.  
**Root cause:** The button text in `index.html` was never updated.  
**What to say to reimplement:**
> "In index.html, find the button with onclick='pickRandomCardsToCustom()' that says '🎲 Add Random' and change its text to '🎲 Add Random Card'."

### ❌ 3. Manage Cards List Too Short — Can't See Full Card List
**Problem:** The `.csCardList` (In Custom Set and Available Cards lists in Manage Cards tab) has `height: 180px` which only shows ~4 items. Needs to be taller to show more cards.  
**Root cause:** Height value was set conservatively and never increased.  
**What to say to reimplement:**
> "In styles.css, increase the `.csCardList` height from 180px to 300px so the Manage Cards lists in Custom Set Settings show more cards. Also increase the portrait override from 130px to 220px."

---

## 📋 SUMMARY TABLE

| # | Feature | Status | Category |
|---|---------|--------|----------|
| 1 | File-based logging | ✅ Present | Backend |
| 2 | AI prompt no language assumption | ✅ Present | Backend |
| 3 | Deck short answer API | ✅ Present | Backend |
| 4 | Deck short answer toggle UI | ✅ Present | Frontend |
| 5 | Custom Set tab switching fix | ✅ Present | Frontend |
| 6 | Custom Set own counts display | ✅ Present | Frontend |
| 7 | Add Card deck pre-selection | ✅ Present | Frontend |
| 8 | Admin Allow/Deny no dropdown reset | ✅ Present | Admin |
| 9 | Admin built-in toggles removed | ✅ Present | Admin |
| 10 | allowNonAdminDeckEdits default false | ✅ Present | Backend |
| 11 | Status inline with card position | ✅ Present | Layout |
| 12 | Counts + controls same row | ✅ Present | Layout |
| 13 | Card auto-height (resizeCard) | ✅ Present | Layout |
| 14 | Study view indented padding | ✅ Present | Layout |
| 15 | Card 1/30 centering | ✅ Present | Layout |
| 16 | Card-related text smaller | ✅ Present | Layout |
| 17 | Controls size reduction ~10% | ✅ Present | Layout |
| 18 | Group dropdown width reduced | ✅ Present | Layout |
| **19** | **Random number field too wide** | **❌ BROKEN** | **CSS** |
| **20** | **"Add Random" → "Add Random Card"** | **❌ MISSING** | **HTML** |
| **21** | **Manage Cards list too short** | **❌ NEEDS FIX** | **CSS** |

---

## 🔧 QUICK-FIX COPY/PASTE INSTRUCTIONS

To fix all 3 broken items without touching the study deck size/position:

**Fix #19 — Random input width:**
In `styles.css`, change:
```css
.csRandomInput { width: 52px; text-align: center; padding: 6px 2px; font-size: 13px; }
```
To:
```css
.csRandomInput { width: 52px; min-width: auto !important; text-align: center; padding: 6px 2px; font-size: 13px; }
```

**Fix #20 — Button text:**
In `index.html`, change:
```html
<button class="appBtn secondary small" onclick="pickRandomCardsToCustom()">🎲 Add Random</button>
```
To:
```html
<button class="appBtn secondary small" onclick="pickRandomCardsToCustom()">🎲 Add Random Card</button>
```

**Fix #21 — Manage Cards list height:**
In `styles.css`, change:
```css
.csCardList { height: 180px; ...
```
To:
```css
.csCardList { height: 300px; ...
```
And the portrait override from `height: 130px` to `height: 220px`.

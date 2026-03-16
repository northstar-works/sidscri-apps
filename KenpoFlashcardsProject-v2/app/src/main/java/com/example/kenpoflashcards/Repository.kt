package com.example.kenpoflashcards

import android.content.Context
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import org.json.JSONObject
import org.json.JSONArray

class Repository(private val context: Context, private val store: Store) {

    private var cachedDefaults: List<FlashCard>? = null
    
    private fun loadDefaultCards(): List<FlashCard> {
        cachedDefaults?.let { return it }
        val json = context.assets.open("kenpo_words.json").bufferedReader().use { it.readText() }
        val cards = JsonUtil.readAssetCards(json)
        cachedDefaults = cards
        return cards
    }

    fun allCardsFlow(): Flow<List<FlashCard>> {
        val defaults = loadDefaultCards()
        return combine(store.customCardsFlow(), store.userCardsFlow(), progressFlow()) { custom, user, _ ->
            (defaults + custom + user).distinctBy { it.id }
        }
    }
    
    // Cards filtered by active deck
    fun activeCardsFlow(): Flow<List<FlashCard>> {
        val defaults = loadDefaultCards()
        return combine(store.customCardsFlow(), store.userCardsFlow(), store.deckSettingsFlow()) { custom, user, deckSettings ->
            val allCards = (defaults + custom + user).distinctBy { it.id }
            val activeDeckId = deckSettings.activeDeckId
            // "kenpo" is the default built-in deck
            if (activeDeckId == "kenpo") {
                allCards.filter { it.deckId == null || it.deckId == "kenpo" }
            } else {
                allCards.filter { it.deckId == activeDeckId }
            }
        }
    }
    
    fun getGroups(): List<String> = loadDefaultCards().map { it.group }.distinct().sorted()

    fun progressFlow(): Flow<ProgressState> = store.progressFlow()
    fun settingsSingleFlow(): Flow<StudySettings> = store.settingsSingleFlow()
    fun settingsAllFlow(): Flow<StudySettings> = store.settingsAllFlow()
    suspend fun saveSettingsSingle(s: StudySettings) = store.saveSettingsSingle(s)
    suspend fun saveSettingsAll(s: StudySettings) = store.saveSettingsAll(s)

    // Admin settings
    fun adminSettingsFlow(): Flow<AdminSettings> = store.adminSettingsFlow()
    suspend fun saveAdminSettings(s: AdminSettings) = store.saveAdminSettings(s)
    suspend fun getAdminSettings(): AdminSettings = store.adminSettingsFlow().first()

    // Status management
    suspend fun setStatus(id: String, status: CardStatus) {
        store.setStatus(id, status)
        // Queue change for offline sync
        store.markPendingProgressEntry(id, status)
        // Set pendingSync flag if auto-push is enabled
        markPendingSync()
        // Try auto-push if enabled and logged in
        attemptAutoPushIfEnabled()
    }
    suspend fun setLearned(id: String, learned: Boolean) = setStatus(id, if (learned) CardStatus.LEARNED else CardStatus.ACTIVE)
    suspend fun setDeleted(id: String, deleted: Boolean) = setStatus(id, if (deleted) CardStatus.DELETED else CardStatus.ACTIVE)
    suspend fun setUnsure(id: String, unsure: Boolean) = setStatus(id, if (unsure) CardStatus.UNSURE else CardStatus.ACTIVE)

    suspend fun replaceCustomCards(cards: List<FlashCard>) = store.replaceCustomCards(cards)
    suspend fun clearAllProgress() = store.clearAllProgress()
    
    // Custom Study Set
    fun customSetFlow(): Flow<Set<String>> = store.customSetFlow()
    fun customSetStatusFlow(): Flow<Map<String, CustomCardStatus>> = store.customSetStatusFlow()
    suspend fun addToCustomSet(id: String) = store.addToCustomSet(id)
    suspend fun removeFromCustomSet(id: String) = store.removeFromCustomSet(id)
    suspend fun clearCustomSet() = store.clearCustomSet()
    suspend fun setCustomSetStatus(id: String, status: CustomCardStatus) = store.setCustomSetStatus(id, status)
    
    // Deck Management
    fun decksFlow(): Flow<List<StudyDeck>> = store.decksFlow()
    fun deckSettingsFlow(): Flow<DeckSettings> = store.deckSettingsFlow()
    suspend fun saveDeckSettings(settings: DeckSettings) = store.saveDeckSettings(settings)
    suspend fun addDeck(deck: StudyDeck) = store.addDeck(deck)
    suspend fun deleteDeck(deckId: String) {
        store.deleteDeck(deckId)
        // Sync deletion to server if logged in
        try {
            val admin = adminSettingsFlow().first()
            if (admin.isLoggedIn && admin.authToken.isNotBlank()) {
                // Note: Server handles deck deletion differently - user-created decks only
                // For now, local deletion is sufficient as server will sync on next pull
            }
        } catch (_: Exception) {}
    }
    
    /**
     * Update deck name/description (with server sync)
     */
    suspend fun updateDeck(deckId: String, name: String, description: String, descriptiveDefinitions: Boolean? = null): Boolean {
        // Update locally first
        store.updateDeck(deckId, name, description, descriptiveDefinitions)
        
        // Sync to server if logged in
        try {
            val admin = adminSettingsFlow().first()
            if (admin.isLoggedIn && admin.authToken.isNotBlank()) {
                val serverUrl = admin.webAppUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
                val result = WebAppSync.updateDeck(serverUrl, admin.authToken, deckId, name, description)
                return result.success
            }
        } catch (_: Exception) {}
        return true // Local update succeeded
    }
    
    /**
     * Set a deck as the default (with server sync)
     */
    suspend fun setDefaultDeck(deckId: String): Boolean {
        // Update locally first
        store.setDefaultDeck(deckId)
        
        // Sync to server if logged in
        try {
            val admin = adminSettingsFlow().first()
            if (admin.isLoggedIn && admin.authToken.isNotBlank()) {
                val serverUrl = admin.webAppUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
                val result = WebAppSync.setDefaultDeck(serverUrl, admin.authToken, deckId)
                return result.success
            }
        } catch (_: Exception) {}
        return true // Local update succeeded
    }
    
    /**
     * Clear the default flag from a deck (with server sync)
     */
    suspend fun clearDefaultDeck(deckId: String): Boolean {
        // Update locally first
        store.clearDefaultDeck(deckId)
        
        // Sync to server if logged in
        try {
            val admin = adminSettingsFlow().first()
            if (admin.isLoggedIn && admin.authToken.isNotBlank()) {
                val serverUrl = admin.webAppUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
                val result = WebAppSync.clearDefaultDeck(serverUrl, admin.authToken, deckId)
                return result.success
            }
        } catch (_: Exception) {}
        return true // Local update succeeded
    }
    
    fun userCardsFlow(): Flow<List<FlashCard>> = store.userCardsFlow()
    suspend fun addUserCard(card: FlashCard) = store.addUserCard(card)
    suspend fun addUserCards(cards: List<FlashCard>) = store.addUserCards(cards)
    
    /**
     * Delete user card (with server sync)
     */
    suspend fun deleteUserCard(cardId: String) {
        store.deleteUserCard(cardId)
        // Sync deletion to server if logged in
        try {
            val admin = adminSettingsFlow().first()
            if (admin.isLoggedIn && admin.authToken.isNotBlank()) {
                val serverUrl = admin.webAppUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
                WebAppSync.deleteUserCard(serverUrl, admin.authToken, cardId)
            }
        } catch (_: Exception) {}
    }
    
    suspend fun updateUserCard(card: FlashCard) = store.updateUserCard(card)
    
    // Breakdowns
    fun breakdownsFlow(): Flow<Map<String, TermBreakdown>> = store.breakdownsFlow()
    suspend fun getBreakdown(cardId: String): TermBreakdown? = store.breakdownsFlow().first()[cardId]
    suspend fun saveBreakdown(breakdown: TermBreakdown) {
        // Always save locally first
        store.saveBreakdown(breakdown)

        // If logged in, also upload to the server so other devices can pull it
        try {
            val admin = adminSettingsFlow().first()
            val token = admin.authToken
            if (admin.isLoggedIn && token.isNotBlank()) {
                val serverUrl = admin.webAppUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
                WebAppSync.saveBreakdown(serverUrl, token, breakdown)
            }
        } catch (_: Exception) {
            // Keep local save even if server upload fails
        }
    }
suspend fun deleteBreakdown(cardId: String) = store.deleteBreakdown(cardId)
    
    // Sync with web app
    suspend fun syncLogin(username: String, password: String, overrideServerUrl: String = ""): WebAppSync.LoginResult {
        val admin = adminSettingsFlow().first()
        val serverUrl = overrideServerUrl.ifBlank { admin.webAppUrl }.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        val result = WebAppSync.login(serverUrl, username, password)
        // On successful login, silently check if remote config (host/port) has changed
        if (result.success) {
            try { checkAndApplyRemoteConfig() } catch (_: Exception) {}
        }
        return result
    }
    
    suspend fun syncPushProgress(): WebAppSync.SyncResult {
        // Re-read admin settings to ensure we have latest token
        val admin = store.adminSettingsFlow().first()
        if (!admin.isLoggedIn) {
            return WebAppSync.SyncResult(false, error = "Not logged in")
        }
        if (admin.authToken.isBlank()) {
            return WebAppSync.SyncResult(false, error = "No auth token - please login again")
        }
        val serverUrl = admin.webAppUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        val progress = progressFlow().first()
        return WebAppSync.pushProgress(serverUrl, admin.authToken, progress)
    }
    
    // Pass token directly from UI to avoid stale state issues
    suspend fun syncPushProgressWithToken(token: String, serverUrl: String): WebAppSync.SyncResult {
        if (token.isBlank()) return WebAppSync.SyncResult(false, error = "No auth token")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }

        // If there are pending deltas, prefer pushing those.
        val pending = store.getPendingProgressEntries()
        if (pending.isNotEmpty()) {
            val res = WebAppSync.pushProgressEntries(url, token, pending)
            if (res.success) {
                store.clearPendingProgressEntries(pending.keys)
                clearPendingSync()
            }
            return res
        }

        // Otherwise push full progress (timestamped with local updatedAt values).
        val full = store.getProgressEntries()
        val res = WebAppSync.pushProgressEntries(url, token, full)
        if (res.success) {
            clearPendingSync()
        }
        return res
    }

    
    suspend fun syncPullProgressWithToken(token: String, serverUrl: String): WebAppSync.SyncResult {
        if (token.isBlank()) return WebAppSync.SyncResult(false, error = "No auth token")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }

        val (result, remoteEntries) = WebAppSync.pullProgressEntries(url, token)
        if (result.success && remoteEntries != null) {
            // Merge remote -> local by updated_at; keep local newer changes in pending queue.
            val merge = store.mergeRemoteProgress(remoteEntries)
            if (merge.pendingCount > 0) {
                // Mark pending if auto-push is enabled
                markPendingSync()
            }
        }
        return result
    }

    
    suspend fun syncPullProgress(): WebAppSync.SyncResult {
        val admin = store.adminSettingsFlow().first()
        if (!admin.isLoggedIn) {
            return WebAppSync.SyncResult(false, error = "Not logged in")
        }
        if (admin.authToken.isBlank()) {
            return WebAppSync.SyncResult(false, error = "No auth token - please login again")
        }
        val serverUrl = admin.webAppUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        val (result, remoteEntries) = WebAppSync.pullProgressEntries(serverUrl, admin.authToken)
        if (result.success && remoteEntries != null) {
            val merge = store.mergeRemoteProgress(remoteEntries)
            if (merge.pendingCount > 0) {
                markPendingSync()
            }
        }
        return result
    }

    
    suspend fun syncBreakdowns(): WebAppSync.SyncResult {
        val admin = adminSettingsFlow().first()
        val serverUrl = admin.webAppUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        val (result, breakdowns) = WebAppSync.getBreakdowns(serverUrl)
        if (result.success && breakdowns != null) {
            // Merge with local breakdowns (server wins for conflicts)
            breakdowns.forEach { (_, breakdown) ->
                store.saveBreakdown(breakdown)
            }
        }
        return result
    }
    
    // Auto-fill breakdown with selected AI service
    suspend fun autoFillBreakdown(cardId: String, term: String, useAI: Boolean = false): TermBreakdown {
        val admin = adminSettingsFlow().first()
        
        if (!useAI) {
            return ChatGptHelper.createBasicBreakdown(cardId, term)
        }
        
        // Determine which AI to use based on settings
        return when (admin.breakdownAiChoice) {
            BreakdownAiChoice.AUTO_SELECT -> {
                // Try both and pick best result (prioritize ChatGPT if both available)
                if (admin.chatGptEnabled && admin.chatGptApiKey.isNotBlank()) {
                    val chatGptResult = ChatGptHelper.createAIBreakdown(admin.chatGptApiKey, cardId, term, admin.chatGptModel)
                    if (chatGptResult.hasContent()) return chatGptResult
                }
                if (admin.geminiEnabled && admin.geminiApiKey.isNotBlank()) {
                    val geminiResult = GeminiHelper.createAIBreakdown(admin.geminiApiKey, cardId, term, admin.geminiModel)
                    if (geminiResult.hasContent()) return geminiResult
                }
                ChatGptHelper.createBasicBreakdown(cardId, term)
            }
            BreakdownAiChoice.CHATGPT -> {
                if (admin.chatGptEnabled && admin.chatGptApiKey.isNotBlank()) {
                    ChatGptHelper.createAIBreakdown(admin.chatGptApiKey, cardId, term, admin.chatGptModel)
                } else {
                    ChatGptHelper.createBasicBreakdown(cardId, term)
                }
            }
            BreakdownAiChoice.GEMINI -> {
                if (admin.geminiEnabled && admin.geminiApiKey.isNotBlank()) {
                    GeminiHelper.createAIBreakdown(admin.geminiApiKey, cardId, term, admin.geminiModel)
                } else {
                    ChatGptHelper.createBasicBreakdown(cardId, term)
                }
            }
        }
    }
    
    // Check which AI services are available
    fun getAvailableAiServices(admin: AdminSettings): List<BreakdownAiChoice> {
        val available = mutableListOf<BreakdownAiChoice>()
        val hasChatGpt = admin.chatGptEnabled && admin.chatGptApiKey.isNotBlank()
        val hasGemini = admin.geminiEnabled && admin.geminiApiKey.isNotBlank()
        
        if (hasChatGpt && hasGemini) {
            available.add(BreakdownAiChoice.AUTO_SELECT)
        }
        if (hasChatGpt) {
            available.add(BreakdownAiChoice.CHATGPT)
        }
        if (hasGemini) {
            available.add(BreakdownAiChoice.GEMINI)
        }
        return available
    }
    
    // Push API keys to server (encrypted)
    suspend fun syncPushApiKeys(token: String, serverUrl: String, chatGptKey: String, chatGptModel: String, geminiKey: String, geminiModel: String): WebAppSync.SyncResult {
        if (token.isBlank()) return WebAppSync.SyncResult(false, error = "No auth token — please login")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        AppLog.d("Repo", "pushApiKeys → $url")
        val result = WebAppSync.pushApiKeys(url, token, chatGptKey, chatGptModel, geminiKey, geminiModel)
        if (!result.success) {
            val is401 = result.error?.contains("401") == true
            AppLog.e("Repo", "pushApiKeys failed: ${result.error}", "url=$url token=${token.take(8)}… is401=$is401")
            if (is401) {
                // Token was invalidated (server restart / reboot). Mark logged out.
                val current = getAdminSettings()
                saveAdminSettings(current.copy(isLoggedIn = false, authToken = ""))
                return WebAppSync.SyncResult(false, error = "SESSION_EXPIRED")
            }
        } else {
            AppLog.i("Repo", "pushApiKeys success")
        }
        return result
    }
    
    // Pull API keys from server
    suspend fun syncPullApiKeys(token: String, serverUrl: String): WebAppSync.ApiKeysResult {
        if (token.isBlank()) return WebAppSync.ApiKeysResult(false, error = "No auth token — please login")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        AppLog.d("Repo", "pullApiKeys → $url")
        val result = WebAppSync.pullApiKeys(url, token)
        if (!result.success) {
            val is401 = result.error?.contains("401") == true
            AppLog.e("Repo", "pullApiKeys failed: ${result.error}", "url=$url is401=$is401")
            if (is401) {
                val current = getAdminSettings()
                saveAdminSettings(current.copy(isLoggedIn = false, authToken = ""))
                return WebAppSync.ApiKeysResult(false, error = "SESSION_EXPIRED")
            }
        } else {
            AppLog.i("Repo", "pullApiKeys success")
        }
        return result
    }
    
    // Pull API keys for any authenticated user (uses /api/sync/apikeys endpoint)
    suspend fun syncPullApiKeysForUser(token: String, serverUrl: String): WebAppSync.ApiKeysResult {
        if (token.isBlank()) return WebAppSync.ApiKeysResult(false, error = "No auth token")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        return WebAppSync.pullApiKeysForUser(url, token)
    }

    // Pull app/server config (managed server URL) from server
    suspend fun syncPullServerConfig(token: String, serverUrl: String): WebAppSync.ServerConfigResult {
        if (token.isBlank()) return WebAppSync.ServerConfigResult(false, error = "No auth token")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        return WebAppSync.pullServerConfig(url, token)
    }

    // Push managed server URL to server (admin only)
    suspend fun syncPushManagedServerUrl(token: String, serverUrl: String, newServerUrl: String): WebAppSync.SyncResult {
        if (token.isBlank()) return WebAppSync.SyncResult(false, error = "No auth token")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        return WebAppSync.pushManagedServerUrl(url, token, newServerUrl)
    }

    // ── Remote Config Push (v7.1.0) ─────────────────────────────────────────

    /**
     * Pull remote config from the server (no auth required).
     * If the server returns a different host/port than what we have saved, updates
     * webAppUrl and serverType in AdminSettings and returns the new config.
     * Returns null if unreachable, endpoint not present, or config unchanged.
     */
    suspend fun checkAndApplyRemoteConfig(): RemoteConfig? {
        val admin = adminSettingsFlow().first()
        val currentUrl = admin.webAppUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        val result = WebAppSync.pullRemoteConfig(currentUrl)
        if (!result.success) return null

        val newUrl = result.config.toBaseUrl()
        if (newUrl == currentUrl && result.config.serverType == admin.serverType) return null

        // Config changed — save new URL + serverType
        store.saveAdminSettings(
            admin.copy(webAppUrl = newUrl, serverType = result.config.serverType)
        )
        return result.config
    }

    /** Pull remote config without auto-applying — for admin UI display. */
    suspend fun syncPullRemoteConfig(serverUrl: String): WebAppSync.RemoteConfigResult {
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        return WebAppSync.pullRemoteConfig(url)
    }

    /** Push remote config to server (admin only). */
    suspend fun syncPushRemoteConfig(token: String, serverUrl: String, config: RemoteConfig): WebAppSync.SyncResult {
        if (token.isBlank()) return WebAppSync.SyncResult(false, error = "No auth token")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        return WebAppSync.pushRemoteConfig(url, token, config)
    }

    

    // Push only pending progress deltas (if any)
    suspend fun syncPushPendingProgressWithToken(token: String, serverUrl: String): WebAppSync.SyncResult {
        if (token.isBlank()) return WebAppSync.SyncResult(false, error = "No auth token")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        val pending = store.getPendingProgressEntries()
        if (pending.isEmpty()) {
            return WebAppSync.SyncResult(true, message = "No pending changes")
        }
        val res = WebAppSync.pushProgressEntries(url, token, pending)
        if (res.success) {
            store.clearPendingProgressEntries(pending.keys)
            clearPendingSync()
        }
        return res
    }

    suspend fun syncPushPendingProgress(): WebAppSync.SyncResult {
        val admin = store.adminSettingsFlow().first()
        if (!admin.isLoggedIn) return WebAppSync.SyncResult(false, error = "Not logged in")
        if (admin.authToken.isBlank()) return WebAppSync.SyncResult(false, error = "No auth token - please login again")
        return syncPushPendingProgressWithToken(admin.authToken, admin.webAppUrl)
    }

    private suspend fun attemptAutoPushIfEnabled() {
        val admin = adminSettingsFlow().first()
        if (!admin.autoPushOnChange) return
        if (!admin.isLoggedIn) return
        if (admin.authToken.isBlank()) return
        // Best-effort: push pending deltas; if it fails we keep the queue.
        syncPushPendingProgressWithToken(admin.authToken, admin.webAppUrl)
    }

    // Mark pending sync (for offline changes)
    suspend fun markPendingSync() {
        val admin = adminSettingsFlow().first()
        if (admin.autoPushOnChange && !admin.pendingSync) {
            saveAdminSettings(admin.copy(pendingSync = true))
        }
    }
    
    // Clear pending sync flag
    suspend fun clearPendingSync() {
        val admin = adminSettingsFlow().first()
        if (admin.pendingSync) {
            saveAdminSettings(admin.copy(pendingSync = false))
        }
    }
    
    suspend fun getCounts(): StatusCounts {
        val progress = progressFlow().first()
        val allCards = allCardsFlow().first()
        var active = 0; var unsure = 0; var learned = 0; var deleted = 0
        allCards.forEach { card ->
            when (progress.getStatus(card.id)) {
                CardStatus.ACTIVE -> active++
                CardStatus.UNSURE -> unsure++
                CardStatus.LEARNED -> learned++
                CardStatus.DELETED -> deleted++
            }
        }
        return StatusCounts(active, unsure, learned, deleted)
    }
    
    // ============ DECK SYNC ============
    
    /**
     * Pull decks from web server
     */
    suspend fun syncPullDecks(token: String, serverUrl: String): WebAppSync.DeckSyncResult {
        if (token.isBlank()) return WebAppSync.DeckSyncResult(success = false, error = "No auth token")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        
        val result = WebAppSync.pullDecks(url, token)
        if (result.success) {
            // Replace local deck list with the server-authoritative accessible deck set
            store.replaceDecksFromServer(result.decks)
            // Update active deck setting
            if (result.activeDeckId.isNotBlank()) {
                val currentSettings = store.deckSettingsFlow().first()
                store.saveDeckSettings(currentSettings.copy(activeDeckId = result.activeDeckId))
            }
        }
        return result
    }
    
    /**
     * Push decks to web server
     */
    suspend fun syncPushDecks(token: String, serverUrl: String): WebAppSync.SyncResult {
        if (token.isBlank()) return WebAppSync.SyncResult(success = false, error = "No auth token")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        
        val decks = store.decksFlow().first()
        val deckSettings = store.deckSettingsFlow().first()
        
        return WebAppSync.pushDecks(url, token, decks, deckSettings.activeDeckId)
    }
    
    // ============ USER CARDS SYNC ============
    
    /**
     * Pull user cards from web server
     */
    suspend fun syncPullUserCards(token: String, serverUrl: String, deckId: String = ""): WebAppSync.UserCardsSyncResult {
        if (token.isBlank()) return WebAppSync.UserCardsSyncResult(success = false, error = "No auth token")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        
        val result = WebAppSync.pullUserCards(url, token, deckId)
        if (result.success) {
            // Replace local synced cards with the server-authoritative card set
            store.replaceUserCardsFromServer(result.cards)
        }
        return result
    }
    
    /**
     * Push user cards to web server
     */
    suspend fun syncPushUserCards(token: String, serverUrl: String, deckId: String = ""): WebAppSync.SyncResult {
        if (token.isBlank()) return WebAppSync.SyncResult(success = false, error = "No auth token")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        
        val cards = store.userCardsFlow().first()
        val cardsToSync = if (deckId.isNotBlank()) {
            cards.filter { it.deckId == deckId }
        } else {
            cards
        }
        
        return WebAppSync.pushUserCards(url, token, cardsToSync, deckId)
    }
    
    /**
     * Full sync: pull decks, user cards, and progress from server
     */
    suspend fun syncPullAll(token: String, serverUrl: String): WebAppSync.SyncResult {
        if (token.isBlank()) return WebAppSync.SyncResult(success = false, error = "No auth token")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        
        val errors = mutableListOf<String>()
        
        // Pull decks
        val decksResult = syncPullDecks(token, url)
        if (!decksResult.success) {
            errors.add("Decks: ${decksResult.error}")
        }
        
        // Pull user cards
        val cardsResult = syncPullUserCards(token, url)
        if (!cardsResult.success) {
            errors.add("User cards: ${cardsResult.error}")
        }
        
        // Pull progress (existing method)
        val progressResult = syncPullProgressWithToken(token, url)
        if (!progressResult.success) {
            errors.add("Progress: ${progressResult.error}")
        }
        
        return if (errors.isEmpty()) {
            WebAppSync.SyncResult(success = true, message = "Full sync complete")
        } else {
            WebAppSync.SyncResult(success = false, error = errors.joinToString("; "))
        }
    }
    
    /**
     * Full sync: push decks, user cards, and progress to server
     */
    suspend fun syncPushAll(token: String, serverUrl: String): WebAppSync.SyncResult {
        if (token.isBlank()) return WebAppSync.SyncResult(success = false, error = "No auth token")
        val url = serverUrl.ifBlank { WebAppSync.DEFAULT_SERVER_URL }
        
        val errors = mutableListOf<String>()
        
        // Push decks
        val decksResult = syncPushDecks(token, url)
        if (!decksResult.success) {
            errors.add("Decks: ${decksResult.error}")
        }
        
        // Push user cards
        val cardsResult = syncPushUserCards(token, url)
        if (!cardsResult.success) {
            errors.add("User cards: ${cardsResult.error}")
        }
        
        // Push progress (existing method)
        val progressResult = syncPushProgressWithToken(token, url)
        if (!progressResult.success) {
            errors.add("Progress: ${progressResult.error}")
        }
        
        return if (errors.isEmpty()) {
            WebAppSync.SyncResult(success = true, message = "Full sync complete")
        } else {
            WebAppSync.SyncResult(success = false, error = errors.joinToString("; "))
        }
    }
    // =========================
    // GEN8 Admin / Deck Access wrappers
    // =========================

    suspend fun refreshAdminStatus(): Boolean {
        val s = adminSettingsFlow().first()
        if (!s.isLoggedIn || s.authToken.isBlank()) {
            // Not logged in, but still set isAdmin from local check
            val localAdmin = AdminUsers.isAdmin(s.username)
            if (localAdmin != s.isAdmin) {
                store.saveAdminSettings(s.copy(isAdmin = localAdmin))
            }
            return false
        }
        return try {
            val resp = WebAppSync.syncFetchAdminStatus(s.webAppUrl, s.authToken)
            val isAdmin = resp.optBoolean("isAdmin", false)
            store.saveAdminSettings(s.copy(isAdmin = isAdmin))
            true
        } catch (_: Exception) {
            // Server unreachable or token expired — fallback to local admin list
            val localAdmin = AdminUsers.isAdmin(s.username)
            if (localAdmin != s.isAdmin) {
                store.saveAdminSettings(s.copy(isAdmin = localAdmin))
            }
            false
        }
    }

    suspend fun redeemInviteCode(inviteCode: String): JSONObject {
        val s = adminSettingsFlow().first()
        return WebAppSync.syncRedeemInviteCode(s.webAppUrl, s.authToken, inviteCode)
    }

    suspend fun adminGetDeckConfig(): JSONObject {
        val s = adminSettingsFlow().first()
        return WebAppSync.syncAdminGetDeckConfig(s.webAppUrl, s.authToken)
    }

    suspend fun adminSetDeckConfig(config: JSONObject): JSONObject {
        val s = adminSettingsFlow().first()
        return WebAppSync.syncAdminSetDeckConfig(s.webAppUrl, s.authToken, config)
    }

    suspend fun adminCreateInviteCode(deckId: String): JSONObject {
        val s = adminSettingsFlow().first()
        return WebAppSync.syncAdminCreateInviteCode(s.webAppUrl, s.authToken, deckId)
    }

    suspend fun adminDeleteInviteCode(code: String): JSONObject {
        val s = adminSettingsFlow().first()
        return WebAppSync.syncAdminDeleteInviteCode(s.webAppUrl, s.authToken, code)
    }

    /**
     * Pull decks using the currently-stored admin/server settings.
     * Returns a JSON payload shaped similarly to the server response:
     * { success, activeDeckId, decks:[...], error? }
     */
    suspend fun syncPullDecksAuthoritative(): JSONObject {
        val s = adminSettingsFlow().first()
        val result = syncPullDecks(s.authToken, s.webAppUrl)

        val out = JSONObject()
        out.put("success", result.success)
        out.put("activeDeckId", result.activeDeckId)

        if (result.success) {
            val decksArr = JSONArray()
            result.decks.forEach { d ->
                val o = JSONObject()
                o.put("id", d.id)
                o.put("name", d.name)
                o.put("description", d.description)
                o.put("isDefault", d.isDefault)
                o.put("isBuiltIn", d.isBuiltIn)
                o.put("sourceFile", d.sourceFile)
                o.put("cardCount", d.cardCount)
                o.put("createdAt", d.createdAt)
                o.put("updatedAt", d.updatedAt)
                o.put("logoPath", d.logoPath)
                decksArr.put(o)
            }
            out.put("decks", decksArr)
        } else {
            out.put("error", result.error)
        }
        return out
    }

    suspend fun adminClearLogs(type: String): JSONObject {
        val s = adminSettingsFlow().first()
        return WebAppSync.syncAdminClearLogs(s.webAppUrl, s.authToken, type)
    }

    suspend fun adminGetUserDeckAccess(userId: String): JSONObject {
        val s = adminSettingsFlow().first()
        return WebAppSync.syncAdminGetUserDeckAccess(s.webAppUrl, s.authToken, userId)
    }

    suspend fun adminSetUserDeckAccess(userId: String, unlockedDecks: List<String>, builtInDisabled: Boolean): JSONObject {
        val s = adminSettingsFlow().first()
        return WebAppSync.syncAdminSetUserDeckAccess(s.webAppUrl, s.authToken, userId, unlockedDecks, builtInDisabled)
    }

    suspend fun adminUpdateUserIsAdmin(userId: String, isAdmin: Boolean): JSONObject {
        val s = adminSettingsFlow().first()
        return WebAppSync.syncAdminUpdateUser(s.webAppUrl, s.authToken, userId, isAdmin)
    }

    suspend fun adminForcePasswordReset(userId: String): JSONObject {
        val s = adminSettingsFlow().first()
        return WebAppSync.syncAdminResetPassword(s.webAppUrl, s.authToken, userId)
    }
}

data class StatusCounts(val active: Int, val unsure: Int, val learned: Int, val deleted: Int) {
    val total: Int get() = active + unsure + learned + deleted
}

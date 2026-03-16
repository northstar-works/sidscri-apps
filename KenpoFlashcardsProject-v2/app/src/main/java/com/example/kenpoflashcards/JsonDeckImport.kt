package com.example.kenpoflashcards

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject

data class ImportedJsonDeckCard(
    val term: String,
    val definition: String,
    val pronunciation: String = "",
    val group: String = "General"
)

data class ImportedJsonDeck(
    val name: String,
    val description: String,
    val cards: List<ImportedJsonDeckCard>
)

fun parseJsonDeckFromUri(context: Context, uri: Uri?, fallbackDeckName: String = "Imported Deck"): ImportedJsonDeck {
    requireNotNull(uri) { "No document selected" }
    val raw = context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
        ?: throw IllegalArgumentException("Unable to read selected file")
    return parseJsonDeck(raw, fallbackDeckName)
}

fun parseJsonDeck(raw: String, fallbackDeckName: String = "Imported Deck"): ImportedJsonDeck {
    val trimmed = raw.trim()
    require(trimmed.isNotBlank()) { "JSON file is empty" }

    val imported = when {
        trimmed.startsWith("[") -> {
            ImportedJsonDeck(
                name = fallbackDeckName,
                description = "",
                cards = parseCards(JSONArray(trimmed))
            )
        }
        trimmed.startsWith("{") -> {
            val obj = JSONObject(trimmed)
            val cardsArray = obj.optJSONArray("cards")
                ?: obj.optJSONArray("items")
                ?: obj.optJSONArray("flashcards")
                ?: obj.optJSONArray("terms")
                ?: throw IllegalArgumentException("JSON object must include a cards array")
            ImportedJsonDeck(
                name = obj.optString("name").ifBlank {
                    obj.optString("deckName").ifBlank { obj.optString("title").ifBlank { fallbackDeckName } }
                },
                description = obj.optString("description").ifBlank {
                    obj.optString("notes").ifBlank { obj.optString("summary") }
                },
                cards = parseCards(cardsArray)
            )
        }
        else -> throw IllegalArgumentException("File must contain a JSON object or array")
    }

    require(imported.cards.isNotEmpty()) { "JSON file has no valid cards" }
    return imported
}

private fun parseCards(array: JSONArray): List<ImportedJsonDeckCard> {
    val cards = mutableListOf<ImportedJsonDeckCard>()
    for (i in 0 until array.length()) {
        val obj = array.optJSONObject(i) ?: continue
        val term = firstNonBlank(obj, "term", "front", "word", "question", "name")
        val definition = firstNonBlank(obj, "definition", "meaning", "back", "answer", "description")
        if (term.isBlank() || definition.isBlank()) continue
        val pronunciation = firstNonBlank(obj, "pronunciation", "pron", "phonetic")
        val group = firstNonBlank(obj, "group", "category", "tag", "section").ifBlank { "General" }
        cards += ImportedJsonDeckCard(
            term = term,
            definition = definition,
            pronunciation = pronunciation,
            group = group
        )
    }
    return cards
}

private fun firstNonBlank(obj: JSONObject, vararg keys: String): String {
    for (key in keys) {
        val value = obj.optString(key)
        if (value.isNotBlank()) return value.trim()
    }
    return ""
}

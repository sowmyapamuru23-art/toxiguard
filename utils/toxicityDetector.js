// ToxiGuard - DB-Backed Toxicity Detector with Caching
// Loads toxic words from database, caches in memory, refreshes every 5 minutes

const db = require('../config/db');

// In-memory cache
let toxicPatterns = {};
let lastLoaded = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load toxic words from the database into memory cache
 */
async function loadToxicWords() {
    try {
        const [rows] = await db.query('SELECT word, category FROM toxic_words ORDER BY category');
        const patterns = {};
        for (const row of rows) {
            if (!patterns[row.category]) {
                patterns[row.category] = [];
            }
            patterns[row.category].push(row.word.toLowerCase());
        }
        toxicPatterns = patterns;
        lastLoaded = Date.now();
        console.log(`🔄 Toxic words loaded: ${rows.length} words in ${Object.keys(patterns).length} categories`);
    } catch (err) {
        console.error('Failed to load toxic words from DB:', err.message);
        // If DB fails and cache is empty, use fallback
        if (Object.keys(toxicPatterns).length === 0) {
            toxicPatterns = getFallbackPatterns();
            lastLoaded = Date.now();
        }
    }
}

/**
 * Force reload the cache (called by admin when words are updated)
 */
async function reloadCache() {
    await loadToxicWords();
}

/**
 * Get all toxic words grouped by category (for admin panel)
 */
function getCachedPatterns() {
    return { ...toxicPatterns };
}

/**
 * Analyze a message for toxic content
 * @param {string} message - The chat message to analyze
 * @returns {{ isToxic: boolean, category: string|null, confidence: string, matchedWord: string|null }}
 */
async function detectToxicity(message) {
    // Refresh cache if stale
    if (Date.now() - lastLoaded > CACHE_TTL || Object.keys(toxicPatterns).length === 0) {
        await loadToxicWords();
    }

    const lowerMsg = message.toLowerCase().trim();

    // Check each category in priority order
    const priorityOrder = ['severe_toxic', 'threat', 'identity_hate', 'insult', 'obscene', 'toxic'];

    for (const category of priorityOrder) {
        const patterns = toxicPatterns[category];
        if (!patterns) continue;

        for (const pattern of patterns) {
            if (lowerMsg.includes(pattern)) {
                return {
                    isToxic: true,
                    category: category,
                    confidence: 'high',
                    matchedWord: pattern
                };
            }
        }
    }

    // Also check any custom categories not in the priority list
    for (const [category, patterns] of Object.entries(toxicPatterns)) {
        if (priorityOrder.includes(category)) continue;
        for (const pattern of patterns) {
            if (lowerMsg.includes(pattern)) {
                return {
                    isToxic: true,
                    category: category,
                    confidence: 'high',
                    matchedWord: pattern
                };
            }
        }
    }

    return {
        isToxic: false,
        category: null,
        confidence: 'high',
        matchedWord: null
    };
}

/**
 * Fallback patterns if DB is unavailable
 */
function getFallbackPatterns() {
    return {
        toxic: ['stupid', 'idiot', 'dumb', 'moron', 'loser', 'pathetic', 'worthless', 'useless'],
        insult: ['shut up', 'go to hell', 'get lost', 'you suck', 'fuck you', 'stfu'],
        severe_toxic: ['kill yourself', 'kys', 'i hope you die', 'drop dead'],
        threat: ['kill', 'murder', 'attack', 'destroy', 'stab', 'shoot'],
        obscene: ['fuck', 'shit', 'bitch', 'bastard', 'damn', 'crap', 'wtf'],
        identity_hate: ['racist', 'sexist', 'bigot', 'nazi', 'terrorist']
    };
}

// Initial load
loadToxicWords();

module.exports = { detectToxicity, reloadCache, getCachedPatterns };

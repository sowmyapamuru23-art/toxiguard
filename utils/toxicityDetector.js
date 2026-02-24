// ToxiGuard - Keyword-Based Toxicity Detector
// Pure JavaScript NLP — No APIs, No TensorFlow download required
// Categories: toxic, insult, severe_toxic, threat, obscene, identity_hate

const toxicPatterns = {

    // General toxic / rude language
    toxic: [
        'stupid', 'idiot', 'dumb', 'moron', 'retard', 'loser', 'pathetic',
        'worthless', 'useless', 'disgusting', 'disgrace', 'trash', 'garbage',
        'freak', 'creep', 'jerk', 'weirdo', 'lame', 'failure'
    ],

    // Direct insults
    insult: [
        'shut up', 'go to hell', 'go die', 'get lost', 'drop dead',
        'you suck', 'you stink', 'you are nothing', 'nobody likes you',
        'you are a joke', 'you are worthless', 'you are pathetic'
    ],

    // Severe toxic / hate
    severe_toxic: [
        'kill yourself', 'kys', 'i hope you die', 'you deserve to die',
        'go kill', 'end your life'
    ],

    // Threats
    threat: [
        'i will kill you', 'i will hurt you', 'i will find you',
        'watch your back', 'you will pay', 'i will destroy you',
        'going to beat you', "i'll get you", 'you are dead', 'suffer for this'
    ],

    // Obscene content
    obscene: [
        'fuck', 'shit', 'bitch', 'ass', 'bastard', 'damn', 'crap',
        'wtf', 'stfu', 'piss off', 'f***', 's***', 'b****'
    ],

    // Identity-based hate
    identity_hate: [
        'racist', 'sexist', 'bigot', 'homophobic', 'transphobic',
        'nazi', 'terrorist', 'infidel'
    ]
};

/**
 * Analyze a message for toxic content
 * @param {string} message - The chat message to analyze
 * @returns {{ isToxic: boolean, category: string|null, confidence: string }}
 */
function detectToxicity(message) {
    const lowerMsg = message.toLowerCase().trim();

    // Check each category in priority order
    for (const [category, patterns] of Object.entries(toxicPatterns)) {
        for (const pattern of patterns) {
            if (lowerMsg.includes(pattern)) {
                return {
                    isToxic: true,
                    category: category,
                    confidence: 'high'
                };
            }
        }
    }

    return {
        isToxic: false,
        category: null,
        confidence: 'high'
    };
}

module.exports = { detectToxicity };

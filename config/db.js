// ToxiGuard - MySQL Database Connection (Enhanced)
const mysql = require('mysql2');

// Prefer PUBLIC URL (works across different Railway projects)
// Falls back to internal URL, then individual env vars (local dev)
const connectionString =
    process.env.MYSQL_PUBLIC_URL ||
    process.env.MYSQL_URL ||
    null;

let pool;

if (connectionString) {
    pool = mysql.createPool({
        uri: connectionString,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        ssl: { rejectUnauthorized: false }
    });
    console.log('🔗 Using Railway MySQL connection');
} else {
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'toxiguard_db',
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        connectTimeout: 30000
    });
    console.log('🔗 Using local MySQL');
}

const promisePool = pool.promise();

// Default toxic words to seed on first run
const DEFAULT_TOXIC_WORDS = {
    toxic: [
        'stupid', 'idiot', 'dumb', 'moron', 'retard', 'loser', 'pathetic',
        'worthless', 'useless', 'disgusting', 'disgrace', 'trash', 'garbage',
        'freak', 'creep', 'jerk', 'weirdo', 'lame', 'failure', 'fool', 'imbecile'
    ],
    insult: [
        'shut up', 'go to hell', 'get lost', 'you suck', 'you stink',
        'you are nothing', 'nobody likes you', 'you are a joke',
        'you are worthless', 'you are pathetic', 'piece of shit',
        'fuck you', 'stfu', 'piss off'
    ],
    severe_toxic: [
        'kill yourself', 'kys', 'i hope you die', 'you deserve to die',
        'go kill', 'end your life', 'drop dead'
    ],
    threat: [
        'kill', 'murder', 'hurt', 'beat', 'attack', 'destroy',
        'stab', 'shoot', 'punch', 'hit', 'smash', 'harm',
        'threaten', 'watch your back', 'you will pay', 'going to beat you',
        "i'll get you", 'you are dead', 'suffer for this'
    ],
    obscene: [
        'fuck', 'shit', 'bitch', 'ass', 'bastard', 'damn', 'crap',
        'wtf', 'f***', 's***', 'b****', 'dick', 'cunt', 'prick'
    ],
    identity_hate: [
        'racist', 'sexist', 'bigot', 'homophobic', 'transphobic',
        'nazi', 'terrorist', 'infidel', 'hate'
    ]
};

// Auto-create tables on first run
const initDB = async () => {
    try {
        // Users table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                username      VARCHAR(50)  NOT NULL UNIQUE,
                email         VARCHAR(100) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                strikes       INT DEFAULT 0,
                is_blocked    TINYINT(1) DEFAULT 0,
                muted_until   DATETIME DEFAULT NULL,
                blocked_at    DATETIME DEFAULT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Messages table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                user_id        INT          NOT NULL,
                receiver_id    INT          DEFAULT NULL,
                username       VARCHAR(50)  NOT NULL,
                content        TEXT         NOT NULL,
                is_toxic       TINYINT(1)   DEFAULT 0,
                toxic_category VARCHAR(50)  DEFAULT NULL,
                is_read        TINYINT(1)   DEFAULT 0,
                created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Toxic words table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS toxic_words (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                word       VARCHAR(100) NOT NULL,
                category   VARCHAR(50)  NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_word_cat (word, category)
            )
        `);

        // Safe ALTER TABLE: add columns if they don't exist
        const safeAddColumn = async (table, column, definition) => {
            try {
                const [cols] = await promisePool.query(
                    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                    [table, column]
                );
                if (cols.length === 0) {
                    await promisePool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
                    console.log(`  ✅ Added column ${table}.${column}`);
                }
            } catch (e) {
                // Column might already exist — ignore
            }
        };

        await safeAddColumn('users', 'strikes', 'INT DEFAULT 0');
        await safeAddColumn('users', 'is_blocked', 'TINYINT(1) DEFAULT 0');
        await safeAddColumn('users', 'muted_until', 'DATETIME DEFAULT NULL');
        await safeAddColumn('users', 'blocked_at', 'DATETIME DEFAULT NULL');
        await safeAddColumn('messages', 'is_read', 'TINYINT(1) DEFAULT 0');

        // Add indexes for performance
        try {
            await promisePool.query('CREATE INDEX idx_users_blocked ON users(is_blocked)');
        } catch (e) { /* index may already exist */ }
        try {
            await promisePool.query('CREATE INDEX idx_messages_toxic ON messages(is_toxic)');
        } catch (e) { /* index may already exist */ }
        try {
            await promisePool.query('CREATE INDEX idx_messages_users ON messages(user_id, receiver_id)');
        } catch (e) { /* index may already exist */ }

        // Seed toxic words if the table is empty
        const [wordCount] = await promisePool.query('SELECT COUNT(*) as cnt FROM toxic_words');
        if (wordCount[0].cnt === 0) {
            console.log('  📝 Seeding default toxic words...');
            const values = [];
            const params = [];
            for (const [category, words] of Object.entries(DEFAULT_TOXIC_WORDS)) {
                for (const word of words) {
                    values.push('(?, ?)');
                    params.push(word, category);
                }
            }
            await promisePool.query(
                `INSERT IGNORE INTO toxic_words (word, category) VALUES ${values.join(', ')}`,
                params
            );
            console.log('  ✅ Toxic words seeded.');
        }

        console.log('✅ Tables ready.');
    } catch (err) {
        console.error('❌ Table init error:', err.message);
    }
};

pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ DB connection failed:', err.message);
    } else {
        console.log('✅ MySQL connected!');
        connection.release();
        initDB();
    }
});

module.exports = promisePool;

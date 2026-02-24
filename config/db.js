// ToxiGuard - MySQL Database Connection
const mysql = require('mysql2');

let pool;

if (process.env.MYSQL_URL) {
    // Railway: use the built-in connection URL (internal network, no SSL needed)
    pool = mysql.createPool(process.env.MYSQL_URL);
    console.log('🔗 Connected via Railway MYSQL_URL');
} else {
    // Local development
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
    console.log(`🔗 Connected via local MySQL at ${process.env.DB_HOST || 'localhost'}`);
}

const promisePool = pool.promise();

// Auto-create tables on startup
const initDB = async () => {
    try {
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                username      VARCHAR(50)  NOT NULL UNIQUE,
                email         VARCHAR(100) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                user_id        INT NOT NULL,
                username       VARCHAR(50)  NOT NULL,
                content        TEXT NOT NULL,
                is_toxic       TINYINT(1)  DEFAULT 0,
                toxic_category VARCHAR(50) DEFAULT NULL,
                created_at     TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tables ready.');
    } catch (err) {
        console.error('❌ Table init failed:', err.message);
    }
};

pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ DB connection failed:', err.message);
    } else {
        console.log('✅ MySQL connected successfully.');
        connection.release();
        initDB();
    }
});

module.exports = promisePool;

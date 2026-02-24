// ToxiGuard - MySQL Database Connection
const mysql = require('mysql2');

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'toxiguard_db',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    connectTimeout: 30000,
    ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost'
        ? { rejectUnauthorized: false }
        : false
});

const promisePool = pool.promise();

// Auto-create tables if they don't exist
const initDB = async () => {
    try {
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                username     VARCHAR(50)  NOT NULL UNIQUE,
                email        VARCHAR(100) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                user_id        INT NOT NULL,
                username       VARCHAR(50) NOT NULL,
                content        TEXT NOT NULL,
                is_toxic       TINYINT(1) DEFAULT 0,
                toxic_category VARCHAR(50) DEFAULT NULL,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ Database tables ready.');
    } catch (err) {
        console.error('❌ Failed to initialize tables:', err.message);
    }
};

// Test connection and init tables on startup
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        console.error('   → Check your environment variables (DB_HOST, DB_USER, DB_PASS, DB_NAME)');
    } else {
        console.log(`✅ Connected to MySQL at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
        connection.release();
        initDB(); // Auto-create tables
    }
});

module.exports = promisePool;

// ToxiGuard - MySQL Database Connection
const mysql = require('mysql2');

let pool;

// Railway provides MYSQL_URL — use it if available (most reliable)
if (process.env.MYSQL_URL) {
    // Parse Railway's MYSQL_URL: mysql://user:pass@host:port/dbname
    pool = mysql.createPool(process.env.MYSQL_URL + '?ssl={"rejectUnauthorized":false}');
    console.log('🔗 Using MYSQL_URL from Railway environment');
} else {
    // Local dev: use individual .env variables
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'toxiguard_db',
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        connectTimeout: 30000,
        ssl: false
    });
    console.log(`🔗 Using local MySQL at ${process.env.DB_HOST || 'localhost'}`);
}

const promisePool = pool.promise();

// Auto-create tables if they don't exist
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

// Test connection and init tables
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Connected to MySQL successfully.');
        connection.release();
        initDB();
    }
});

module.exports = promisePool;

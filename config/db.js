// ToxiGuard - MySQL Database Connection (Online via db4free.net)
const mysql = require('mysql2');

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db4free.net',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,       // Keep low for free db4free tier
    queueLimit: 0,
    connectTimeout: 30000,    // 30s timeout (db4free can be slow)
    ssl: false
});

// Test connection on startup
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        console.error('   → Check your .env credentials (DB_USER, DB_PASS, DB_NAME)');
    } else {
        console.log(`✅ Connected to MySQL at ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
        connection.release();
    }
});

// Export promise-based pool for async/await usage
module.exports = pool.promise();

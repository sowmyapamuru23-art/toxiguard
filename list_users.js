require('dotenv').config();
const mysql = require('mysql2/promise');

async function listUsers() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });

        const [rows] = await connection.query('SELECT username FROM users');
        console.log('Registered Usernames:');
        rows.forEach(row => console.log(`- ${row.username}`));

        await connection.end();
    } catch (err) {
        console.error('Error connecting to DB:', err.message);
    }
}

listUsers();

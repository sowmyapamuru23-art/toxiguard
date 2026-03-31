require('dotenv').config();
const db = require('./config/db');
const fs = require('fs');

async function check() {
    try {
        const [rows] = await db.query('SELECT id, username, strikes, is_blocked FROM users');
        const [blocked] = await db.query('SELECT id, username, strikes, is_blocked FROM users WHERE is_blocked = 1 OR is_blocked = true');
        fs.writeFileSync('db_output.json', JSON.stringify({
           allUsers: rows,
           blockedUsers: blocked
        }, null, 2));
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
check();

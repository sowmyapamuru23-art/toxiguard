require('dotenv').config();
const mysql = require('mysql2/promise');

async function updateSchema() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });

        // Check if columns already exist to prevent duplicate error
        console.log('Adding strikes and is_blocked columns to users table...');
        
        try {
            await connection.query('ALTER TABLE users ADD COLUMN strikes INT DEFAULT 0, ADD COLUMN is_blocked TINYINT(1) DEFAULT 0');
            console.log('✅ Columns added successfully.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                 console.log('✅ Columns already exist in the database.');
            } else {
                 console.error('❌ Error adding columns:', err.message);
                 // We suppress throwing so script finishes normally if something else goes wrong
            }
        }
        
        await connection.end();
    } catch (err) {
        console.error('Database connection error:', err.message);
    }
}

updateSchema();

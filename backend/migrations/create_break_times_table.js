const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'nexus_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🔄 Starting migration: Create break_times table...');
        await client.query('BEGIN');

        const tableCheck = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name='break_times'
        `);

        if (tableCheck.rows.length === 0) {
            console.log('📝 Creating break_times table...');
            await client.query(`
                CREATE TABLE break_times (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    username VARCHAR(255) NOT NULL,
                    break_start_time TIMESTAMP NOT NULL,
                    break_end_time TIMESTAMP,
                    duration_seconds INTEGER,
                    status VARCHAR(50) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create index for faster queries
            await client.query(`
                CREATE INDEX idx_break_times_user_id ON break_times(user_id);
                CREATE INDEX idx_break_times_username ON break_times(username);
                CREATE INDEX idx_break_times_status ON break_times(status);
                CREATE INDEX idx_break_times_break_start_time ON break_times(break_start_time DESC);
            `);
            
            console.log('✅ break_times table created successfully!');
        } else {
            console.log('✅ break_times table already exists. Migration not needed.');
        }

        await client.query('COMMIT');
        console.log('✅ Migration completed successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(err => {
    console.error('Migration script failed:', err);
    process.exit(1);
});

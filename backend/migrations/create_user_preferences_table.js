// Migration to create user_preferences table for storing dashboard card preferences
require('dotenv').config();
const { Pool } = require('pg');

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
        console.log('🔄 Starting migration: Create user_preferences table...');
        
        await client.query('BEGIN');
        
        // Check if table already exists
        const tableCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name='user_preferences'
        `);
        
        if (tableCheck.rows.length > 0) {
            console.log('✅ user_preferences table already exists. Migration not needed.');
            await client.query('ROLLBACK');
            return;
        }
        
        // Create the table
        console.log('📝 Creating user_preferences table...');
        await client.query(`
            CREATE TABLE user_preferences (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                preference_key VARCHAR(100) NOT NULL,
                preference_value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, preference_key)
            )
        `);
        
        // Create indexes
        console.log('📝 Creating indexes...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
            ON user_preferences(user_id)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_user_preferences_key 
            ON user_preferences(preference_key)
        `);
        
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

// Run migration
runMigration()
    .then(() => {
        console.log('Migration script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration script failed:', error);
        process.exit(1);
    });

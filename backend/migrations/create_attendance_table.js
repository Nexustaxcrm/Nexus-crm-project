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
        console.log('🔄 Starting migration: Create attendance table...');
        await client.query('BEGIN');

        const tableCheck = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name='attendance'
        `);

        if (tableCheck.rows.length === 0) {
            console.log('📝 Creating attendance table...');
            await client.query(`
                CREATE TABLE attendance (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    username VARCHAR(255) NOT NULL,
                    attendance_date DATE NOT NULL,
                    check_in_time TIMESTAMP,
                    check_out_time TIMESTAMP,
                    total_hours_seconds INTEGER,
                    status VARCHAR(50) DEFAULT 'checked_in',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create indexes for faster queries
            await client.query(`
                CREATE INDEX idx_attendance_user_id ON attendance(user_id);
                CREATE INDEX idx_attendance_username ON attendance(username);
                CREATE INDEX idx_attendance_date ON attendance(attendance_date DESC);
                CREATE INDEX idx_attendance_status ON attendance(status);
            `);
            
            console.log('✅ attendance table created successfully!');
        } else {
            console.log('✅ attendance table already exists. Migration not needed.');
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

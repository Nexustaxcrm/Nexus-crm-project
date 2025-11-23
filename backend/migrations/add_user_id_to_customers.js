/**
 * Migration: Add user_id column to customers table
 * 
 * This migration adds a user_id column to the customers table to link
 * customer records to user accounts for customer dashboard functionality.
 * 
 * Run this script with: node migrations/add_user_id_to_customers.js
 */

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
        console.log('🔄 Starting migration: Add user_id to customers table...');
        
        await client.query('BEGIN');
        
        // Check if column already exists
        const columnCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='customers' AND column_name='user_id'
        `);
        
        if (columnCheck.rows.length > 0) {
            console.log('✅ user_id column already exists. Migration not needed.');
            await client.query('ROLLBACK');
            return;
        }
        
        // Add the column
        console.log('📝 Adding user_id column...');
        await client.query(`
            ALTER TABLE customers 
            ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
        `);
        
        // Create index
        console.log('📝 Creating index on user_id...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_customers_user_id 
            ON customers(user_id) 
            WHERE user_id IS NOT NULL
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
        console.log('✅ Migration script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Migration script failed:', error);
        process.exit(1);
    });


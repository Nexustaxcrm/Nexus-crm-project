#!/usr/bin/env node
/**
 * Database Initialization Script
 * 
 * This script can be run manually to initialize the database schema
 * and create the admin user. It's useful for:
 * - Setting up a fresh database
 * - Resetting the admin user
 * - Troubleshooting database issues
 * 
 * Usage:
 *   node init-db.js
 * 
 * Environment variables required:
 *   - DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT
 *   - ADMIN_PASSWORD (optional, defaults to 'admin123')
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initializeDatabase() {
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        ssl: process.env.DB_HOST && process.env.DB_HOST.includes('railway') 
            ? { rejectUnauthorized: false } 
            : false
    });

    try {
        console.log('Connecting to database...');
        await pool.query('SELECT NOW()');
        console.log('✅ Database connected!');

        // Read and execute schema SQL
        const schemaPath = path.join(__dirname, 'database_schema.sql');
        if (fs.existsSync(schemaPath)) {
            console.log('Reading schema file...');
            const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
            const statements = schemaSQL.split(';').filter(s => s.trim().length > 0);
            
            for (const statement of statements) {
                if (statement.trim()) {
                    try {
                        await pool.query(statement);
                    } catch (err) {
                        if (!err.message.includes('already exists')) {
                            console.warn('Warning:', err.message);
                        }
                    }
                }
            }
            console.log('✅ Database schema initialized');
        } else {
            console.log('Schema file not found, creating tables manually...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL DEFAULT 'employee',
                    locked BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS customers (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255),
                    phone VARCHAR(50),
                    status VARCHAR(50) DEFAULT 'pending',
                    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    notes TEXT,
                    archived BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Database tables created');
        }

        // Check if admin user exists
        const adminCheck = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
        
        if (adminCheck.rows.length === 0) {
            // Create admin user
            const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            
            await pool.query(
                'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                ['admin', hashedPassword, 'admin']
            );
            console.log('✅ Default admin user created');
            console.log('   Username: admin');
            console.log('   Password: ' + defaultPassword);
            console.log('   ⚠️  IMPORTANT: Change the admin password after first login!');
        } else {
            console.log('ℹ️  Admin user already exists');
            
            // Option to reset admin password
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            readline.question('Do you want to reset the admin password? (y/n): ', async (answer) => {
                if (answer.toLowerCase() === 'y') {
                    const newPassword = process.env.ADMIN_PASSWORD || 'admin123';
                    const hashedPassword = await bcrypt.hash(newPassword, 10);
                    await pool.query(
                        'UPDATE users SET password = $1 WHERE username = $2',
                        [hashedPassword, 'admin']
                    );
                    console.log('✅ Admin password reset');
                    console.log('   Username: admin');
                    console.log('   Password: ' + newPassword);
                }
                readline.close();
                await pool.end();
                process.exit(0);
            });
            return;
        }

        console.log('\n✅ Database initialization complete!');
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        await pool.end();
        process.exit(1);
    }
}

// Run initialization
initializeDatabase();


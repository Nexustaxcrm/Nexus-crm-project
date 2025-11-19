const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Allow frontend to talk to backend
app.use(cors());
// Increased limits for large Excel file uploads (300k-500k rows)
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Connect to database with optimized connection pool for concurrent users
// CRITICAL: Single shared pool for entire application
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    // Connection pool settings for handling 30-50 concurrent users
    max: 50, // Increased for 30-50 concurrent users (with buffer)
    min: 10, // Minimum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 5000, // Increased timeout for high load scenarios
    // Enable SSL for Railway database (Railway databases require SSL)
    ssl: process.env.DB_HOST && (
        process.env.DB_HOST.includes('railway') || 
        process.env.DB_HOST.includes('railway.app') ||
        process.env.DB_SSL === 'true'
    ) ? { rejectUnauthorized: false } : false
});

// Handle pool errors gracefully
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    // Don't crash the server, just log the error
});

// Initialize database schema and create admin user if needed
async function initializeDatabase() {
    try {
        // Test connection first
        await pool.query('SELECT NOW()');
        console.log('Database connected!');

        // Read and execute schema SQL
        const schemaPath = path.join(__dirname, 'database_schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
            // Split by semicolons and execute each statement
            const statements = schemaSQL.split(';').filter(s => s.trim().length > 0);
            for (const statement of statements) {
                if (statement.trim()) {
                    try {
                        await pool.query(statement);
                    } catch (err) {
                        // Ignore errors for IF NOT EXISTS statements
                        if (!err.message.includes('already exists')) {
                            console.warn('Schema initialization warning:', err.message);
                        }
                    }
                }
            }
            console.log('Database schema initialized');
        } else {
            // If schema file doesn't exist, create tables manually
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
            await pool.query(`
                CREATE TABLE IF NOT EXISTS customer_actions (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
                    action_type VARCHAR(50) NOT NULL,
                    old_value TEXT,
                    new_value TEXT,
                    comment TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            // Create indexes for customer_actions
            await pool.query('CREATE INDEX IF NOT EXISTS idx_customer_actions_customer_id ON customer_actions(customer_id)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_customer_actions_customer_created ON customer_actions(customer_id, created_at DESC)');
            // Create composite index for assigned work queries
            await pool.query('CREATE INDEX IF NOT EXISTS idx_customers_assigned_status ON customers(assigned_to, status, archived) WHERE assigned_to IS NOT NULL');
            console.log('Database tables created');
        }

        // Check if admin user exists, create if not
        const adminCheck = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
        
        if (adminCheck.rows.length === 0) {
            // Create default admin user
            // Default password: 'admin123' (should be changed after first login)
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
            console.log('Admin user already exists');
        }
    } catch (error) {
        console.error('Database initialization error:', error);
        // Don't crash the server, but log the error
    }
}

// Initialize database on startup
initializeDatabase();

// Rate limiting to prevent server overload
// Increased limits for production with 30-50 concurrent users
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Increased to 500 requests per IP per 15 minutes (allows ~33 requests/min per user)
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for successful requests to avoid blocking legitimate traffic
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
});

// Apply rate limiting to API routes
app.use('/api/', limiter);

// Make pool available to routes
app.locals.pool = pool;

// Import routes (they will use app.locals.pool)
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const userRoutes = require('./routes/users');

// Initialize routes with app (so they can access the pool)
if (authRoutes.init) authRoutes.init(app);
if (customerRoutes.init) customerRoutes.init(app);
if (userRoutes.init) userRoutes.init(app);

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/users', userRoutes);

// Health check route at root
app.get('/', (req, res) => {
    res.json({ 
        message: 'Nexus CRM Backend API is running!',
        status: 'ok',
        endpoints: {
            auth: '/api/auth/login',
            customers: '/api/customers',
            users: '/api/users'
        }
    });
});

// Health check route at /api
app.get('/api', (req, res) => {
    res.json({ 
        message: 'Nexus CRM Backend API is working!',
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// Simple test route
app.get('/test', (req, res) => {
    res.json({ message: 'Server is working!' });
});

// Check for required environment variables
if (!process.env.JWT_SECRET) {
    console.warn('⚠️  WARNING: JWT_SECRET is not set! Login will fail.');
    console.warn('   Please set JWT_SECRET in your .env file or environment variables.');
    console.warn('   You can generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
    if (!process.env.JWT_SECRET) {
        console.error('❌ Server started but JWT_SECRET is missing - authentication will not work!');
    }
});
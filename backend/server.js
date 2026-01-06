// Suppress AWS SDK v2 deprecation warnings (not an error, just a maintenance mode notice)
process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CRITICAL: Trust proxy for Railway deployment (but only the first proxy for security)
// Railway uses a reverse proxy, so we need to trust X-Forwarded-* headers
// Setting to 1 means we only trust the first proxy (Railway's), not all proxies
// This prevents IP-based rate limiting bypass while fixing the express-rate-limit error
app.set('trust proxy', 1);

// Security: Helmet.js - Set various HTTP headers for security
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            // CRITICAL: Allow inline event handlers (onclick, onchange, etc.) for navigation
            // This is required because the HTML uses inline onclick handlers like onclick="showTab(...)"
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'", "https://nexus-crm-project-production.up.railway.app"]
        }
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for file uploads
    crossOriginResourcePolicy: { policy: "cross-origin" } // Allow resources from same origin
}));

// CORS: Restrict to specific origins for security
const allowedOrigins = [
    'https://nexus-crm-project-production.up.railway.app',
    'https://nexustaxfiling.com', // Custom domain
    'https://www.nexustaxfiling.com', // Custom domain with www
    'http://nexustaxfiling.com', // HTTP version (for development/testing)
    'http://www.nexustaxfiling.com', // HTTP version with www (for development/testing)
    'http://localhost:3000', // For local development
    'http://localhost:5500', // For local development with Live Server
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5500'
];

// CORS: Only apply to API routes, not static files
// This allows the frontend HTML/CSS/JS to load without CORS checks
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (same-origin requests, static files, direct browser access)
        // These are safe because they're from the same domain
        if (!origin) {
            return callback(null, true);
        }
        
        // For cross-origin requests, check against allowed list
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            // Log blocked origins for security monitoring
            console.warn(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Authorization']
};

// Apply CORS only to API routes (not to static file serving)
app.use('/api/', cors(corsOptions));
// Increased limits for large Excel file uploads (300k-500k rows)
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// CSRF Protection - Generate and validate CSRF tokens
const csrfTokens = new Map(); // In production, use Redis or database

// Generate CSRF token
function generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
}

// CSRF token endpoint (GET request to get token)
app.get('/api/csrf-token', (req, res) => {
    const token = generateCSRFToken();
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour expiry
    csrfTokens.set(token, { expiresAt });
    
    // Clean expired tokens periodically
    const now = Date.now();
    for (const [t, data] of csrfTokens.entries()) {
        if (data.expiresAt < now) {
            csrfTokens.delete(t);
        }
    }
    
    res.json({ csrfToken: token });
});

// CSRF protection middleware (only for state-changing operations)
const csrfProtection = (req, res, next) => {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    
    // Skip CSRF for authentication endpoints (they use JWT)
    // When middleware is mounted at /api/, req.path is relative to that mount point
    // So /api/auth/login becomes /auth/login in req.path
    // req.originalUrl contains the full original URL path
    const originalUrl = req.originalUrl || req.url || '';
    const path = req.path || '';
    const baseUrl = req.baseUrl || '';
    
    // Build full path for checking
    const fullPath = baseUrl + path;
    
    // Check if this is an auth endpoint (login or send-otp)
    // Check multiple path formats to be safe - normalize to lowercase for case-insensitive matching
    const originalUrlLower = (originalUrl || '').toLowerCase();
    const pathLower = (path || '').toLowerCase();
    const fullPathLower = (fullPath || '').toLowerCase();
    
    // Check various path formats that Express might use
    const isAuthEndpoint = 
        originalUrlLower.includes('/auth/login') ||
        originalUrlLower.includes('/auth/send-otp') ||
        pathLower.includes('/auth/login') ||
        pathLower.includes('/auth/send-otp') ||
        fullPathLower.includes('/auth/login') ||
        fullPathLower.includes('/auth/send-otp') ||
        originalUrlLower.endsWith('/auth/login') ||
        originalUrlLower.endsWith('/auth/send-otp') ||
        pathLower.endsWith('/auth/login') ||
        pathLower.endsWith('/auth/send-otp') ||
        pathLower === '/auth/login' ||
        pathLower === '/auth/send-otp' ||
        pathLower.startsWith('/auth/login') ||
        pathLower.startsWith('/auth/send-otp');
    
    if (isAuthEndpoint) {
        // Skip CSRF for authentication endpoints
        console.log('✅ CSRF protection skipped for auth endpoint:', { 
            originalUrl, 
            path, 
            baseUrl, 
            fullPath,
            method: req.method,
            matched: true
        });
        return next();
    }
    
    // Log when CSRF is being checked (for debugging)
    console.log('🔒 CSRF protection active for:', { 
        originalUrl, 
        path, 
        baseUrl, 
        fullPath,
        method: req.method 
    });
    
    const token = req.headers['x-csrf-token'] || req.body.csrfToken;
    const storedToken = csrfTokens.get(token);
    
    if (!token || !storedToken) {
        console.warn('🚨 CSRF token missing or invalid:', { 
            originalUrl, 
            path, 
            method: req.method,
            hasToken: !!token,
            hasStoredToken: !!storedToken
        });
        return res.status(403).json({ error: 'Invalid or missing CSRF token' });
    }
    
    // Check if token expired
    if (Date.now() > storedToken.expiresAt) {
        csrfTokens.delete(token);
        return res.status(403).json({ error: 'CSRF token expired' });
    }
    
    // Token is valid, continue
    next();
};

// Input sanitization middleware - sanitize common XSS and injection patterns
app.use((req, res, next) => {
    // Recursively sanitize object/array values
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            // Remove/nullify potentially dangerous characters and patterns
            return obj
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
                .replace(/javascript:/gi, '') // Remove javascript: protocol
                .replace(/on\w+\s*=/gi, '') // Remove event handlers (onclick, onerror, etc.)
                .replace(/<iframe/gi, '') // Remove iframe tags
                .trim();
        } else if (Array.isArray(obj)) {
            return obj.map(sanitize);
        } else if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    sanitized[key] = sanitize(obj[key]);
                }
            }
            return sanitized;
        }
        return obj;
    };
    
    // Sanitize request body, query, and params
    if (req.body) {
        req.body = sanitize(req.body);
    }
    if (req.query) {
        req.query = sanitize(req.query);
    }
    if (req.params) {
        req.params = sanitize(req.params);
    }
    
    next();
});

// NOTE: CSRF protection is applied AFTER routes are registered (see line ~877)

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

// Migration function to add user_id column to customers table
async function addUserIdColumnMigration(pool) {
    try {
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='customers' AND column_name='user_id'
        `);
        
        if (columnCheck.rows.length === 0) {
            console.log('🔄 Adding user_id column to customers table...');
            await pool.query('ALTER TABLE customers ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
            console.log('✅ user_id column added successfully');
        } else {
            console.log('✅ user_id column already exists');
        }
        
        // Create index if it doesn't exist
        await pool.query('CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id) WHERE user_id IS NOT NULL');
    } catch (alterError) {
        console.error('❌ Error adding user_id column:', alterError.message);
        // Don't fail the server startup, but log the error
        throw alterError; // Re-throw so we know if migration fails
    }
}

// Migration function to create customer_documents table
async function createCustomerDocumentsTableMigration(pool) {
    try {
        const tableCheck = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name='customer_documents'
        `);

        if (tableCheck.rows.length === 0) {
            console.log('🔄 Creating customer_documents table...');
            await pool.query(`
                CREATE TABLE customer_documents (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    file_name VARCHAR(255) NOT NULL,
                    stored_file_name VARCHAR(255),
                    file_path VARCHAR(500) NOT NULL,
                    file_size BIGINT NOT NULL,
                    file_type VARCHAR(100) NOT NULL,
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create indexes
            await pool.query('CREATE INDEX IF NOT EXISTS idx_customer_documents_customer_id ON customer_documents(customer_id)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_customer_documents_user_id ON customer_documents(user_id)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_customer_documents_uploaded_at ON customer_documents(uploaded_at DESC)');
            
            console.log('✅ customer_documents table created successfully');
        } else {
            console.log('✅ customer_documents table already exists');
            // Add stored_file_name column if it doesn't exist (for existing tables)
            try {
                const columnCheck = await pool.query(`
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name='customer_documents' AND column_name='stored_file_name'
                `);
                
                if (columnCheck.rows.length === 0) {
                    console.log('🔄 Adding stored_file_name column to customer_documents table...');
                    await pool.query(`
                        ALTER TABLE customer_documents 
                        ADD COLUMN stored_file_name VARCHAR(255)
                    `);
                    
                    // Populate stored_file_name from file_path for existing records
                    await pool.query(`
                        UPDATE customer_documents 
                        SET stored_file_name = SUBSTRING(file_path FROM '[^/\\\\]+$')
                        WHERE stored_file_name IS NULL
                    `);
                    
                    console.log('✅ stored_file_name column added successfully');
                }
            } catch (columnError) {
                console.error('⚠️ Error adding stored_file_name column:', columnError.message);
            }
        }
        
        // Add temp_password column to users table if it doesn't exist
        try {
            const tempPasswordColumnCheck = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name='users' AND column_name='temp_password'
            `);
            
            if (tempPasswordColumnCheck.rows.length === 0) {
                console.log('🔄 Adding temp_password column to users table...');
                await pool.query(`
                    ALTER TABLE users 
                    ADD COLUMN temp_password BOOLEAN DEFAULT FALSE
                `);
                console.log('✅ temp_password column added successfully');
            }
        } catch (tempPasswordError) {
            console.error('⚠️ Error adding temp_password column:', tempPasswordError.message);
        }
    } catch (error) {
        console.error('❌ Error creating customer_documents table:', error.message);
        throw error;
    }
}

// Migration function to create customer_tax_info table
async function createCustomerTaxInfoTableMigration(pool) {
    try {
        const tableCheck = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name='customer_tax_info'
        `);

        if (tableCheck.rows.length === 0) {
            console.log('🔄 Creating customer_tax_info table...');
            await pool.query(`
                CREATE TABLE customer_tax_info (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                    tax_year VARCHAR(4) NOT NULL DEFAULT '2024',
                    
                    -- Personal Information
                    ssn_itin VARCHAR(20),
                    date_of_birth DATE,
                    filing_status VARCHAR(50),
                    
                    -- Spouse Information
                    spouse_name VARCHAR(255),
                    spouse_ssn_itin VARCHAR(20),
                    spouse_date_of_birth DATE,
                    
                    -- Bank Information
                    bank_tax_payer VARCHAR(50),
                    bank_name VARCHAR(255),
                    bank_account_number VARCHAR(50),
                    bank_routing_number VARCHAR(20),
                    bank_account_type VARCHAR(20),
                    
                    -- Income Information (stored as JSON)
                    w2_income JSONB,
                    income_1099 JSONB,
                    self_employment_income JSONB,
                    rental_income DECIMAL(12, 2),
                    unemployment_compensation DECIMAL(12, 2),
                    social_security_benefits DECIMAL(12, 2),
                    other_income DECIMAL(12, 2),
                    other_income_description TEXT,
                    
                    -- Deductions
                    itemized_deductions JSONB,
                    standard_deduction BOOLEAN DEFAULT TRUE,
                    
                    -- Tax Credits
                    tax_credits JSONB,
                    
                    -- Dependents
                    dependents JSONB,
                    
                    -- Prior Year Information
                    prior_year_agi DECIMAL(12, 2),
                    prior_year_tax_return_available BOOLEAN DEFAULT FALSE,
                    
                    -- Additional Information
                    health_insurance_coverage VARCHAR(50),
                    estimated_tax_payments DECIMAL(12, 2),
                    foreign_accounts BOOLEAN DEFAULT FALSE,
                    foreign_account_details TEXT,
                    business_expenses JSONB,
                    home_office_deduction BOOLEAN DEFAULT FALSE,
                    home_office_details TEXT,
                    
                    -- Filing Checklist
                    filing_checklist JSONB,
                    
                    -- SSN/ITIN Entries (for Identification Details - US)
                    ssn_itin_entries JSONB,
                    
                    -- Visa Information (for Identification Details - Non-US)
                    visa_type VARCHAR(50),
                    latest_visa_change VARCHAR(50),
                    primary_port_of_entry DATE,
                    total_months_stayed_us DECIMAL(10, 2),
                    
                    -- Metadata
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    UNIQUE(customer_id, tax_year)
                )
            `);
            
            // Create indexes
            await pool.query('CREATE INDEX IF NOT EXISTS idx_customer_tax_info_customer_id ON customer_tax_info(customer_id)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_customer_tax_info_tax_year ON customer_tax_info(tax_year)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_customer_tax_info_customer_year ON customer_tax_info(customer_id, tax_year)');
            
            console.log('✅ customer_tax_info table created successfully');
        } else {
            console.log('✅ customer_tax_info table already exists');
        }
    } catch (error) {
        console.error('❌ Error creating customer_tax_info table:', error.message);
        throw error;
    }
}

// Migration function to create blog_posts table
async function createBlogPostsTableMigration(pool) {
    try {
        const tableCheck = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name='blog_posts'
        `);

        if (tableCheck.rows.length === 0) {
            console.log('🔄 Creating blog_posts table...');
            await pool.query(`
                CREATE TABLE blog_posts (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(500) NOT NULL,
                    short_description TEXT NOT NULL,
                    content TEXT NOT NULL,
                    featured_image VARCHAR(500),
                    created_by VARCHAR(255) NOT NULL,
                    category VARCHAR(50) DEFAULT 'blog',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create indexes
            await pool.query('CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts(created_at DESC)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_blog_posts_created_by ON blog_posts(created_by)');
            
            console.log('✅ blog_posts table created successfully');
        } else {
            console.log('✅ blog_posts table already exists');
            // Add category column if it doesn't exist (for existing tables)
            try {
                const columnCheck = await pool.query(`
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name='blog_posts' AND column_name='category'
                `);
                
                if (columnCheck.rows.length === 0) {
                    console.log('🔄 Adding category column to blog_posts table...');
                    await pool.query(`
                        ALTER TABLE blog_posts 
                        ADD COLUMN category VARCHAR(50) DEFAULT 'blog'
                    `);
                    
                    // Create index for category
                    await pool.query('CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category)');
                    
                    console.log('✅ category column added successfully');
                }
            } catch (columnError) {
                console.error('⚠️ Error adding category column:', columnError.message);
            }
        }
    } catch (error) {
        console.error('❌ Error creating blog_posts table:', error.message);
        throw error;
    }
}

// Migration function to create break_times table
async function createBreakTimesTableMigration(pool) {
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
            
            // Create indexes for faster queries
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
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Migration function to create user_preferences table
async function createUserPreferencesTableMigration(pool) {
    try {
        const tableCheck = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name='user_preferences'
        `);

        if (tableCheck.rows.length === 0) {
            console.log('🔄 Creating user_preferences table...');
            await pool.query(`
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
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
                ON user_preferences(user_id)
            `);
            
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_user_preferences_key 
                ON user_preferences(preference_key)
            `);
            
            console.log('✅ user_preferences table created successfully');
        } else {
            console.log('✅ user_preferences table already exists');
        }
    } catch (error) {
        console.error('❌ Error creating user_preferences table:', error.message);
        throw error;
    }
}

// Migration function to create referrals table
async function createReferralsTableMigration(pool) {
    try {
        const tableCheck = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name='referrals'
        `);

        if (tableCheck.rows.length === 0) {
            console.log('🔄 Creating referrals table...');
            await pool.query(`
                CREATE TABLE referrals (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    phone VARCHAR(50),
                    email VARCHAR(255),
                    referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    referred_by_name VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create indexes
            await pool.query('CREATE INDEX IF NOT EXISTS idx_referrals_referred_by ON referrals(referred_by)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at DESC)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_referrals_email ON referrals(email) WHERE email IS NOT NULL');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_referrals_phone ON referrals(phone) WHERE phone IS NOT NULL');
            
            console.log('✅ Referrals table created');
        } else {
            console.log('✅ Referrals table already exists');
        }
    } catch (error) {
        console.error('❌ Error creating referrals table:', error.message);
        throw error;
    }
}

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
                    temp_password BOOLEAN DEFAULT FALSE,
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
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    notes TEXT,
                    archived BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            // Add user_id column migration (runs after manual table creation)
            await addUserIdColumnMigration(pool);
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
        
        // Run migration to add user_id column (runs after schema initialization in both paths)
        try {
            await addUserIdColumnMigration(pool);
        } catch (migrationError) {
            console.error('⚠️ Migration warning (non-fatal):', migrationError.message);
            // Continue - migration failure won't prevent server startup
        }
        
        // Run migration to create customer_documents table
        try {
            await createCustomerDocumentsTableMigration(pool);
        } catch (migrationError) {
            console.error('⚠️ Migration warning (non-fatal):', migrationError.message);
            // Continue - migration failure won't prevent server startup
        }
        
        // Run migration to create customer_tax_info table
        try {
            await createCustomerTaxInfoTableMigration(pool);
        } catch (migrationError) {
            console.error('⚠️ Migration warning (non-fatal):', migrationError.message);
            // Continue - migration failure won't prevent server startup
        }
        
        // Run migration to create referrals table
        try {
            await createReferralsTableMigration(pool);
        } catch (migrationError) {
            console.error('⚠️ Migration warning (non-fatal):', migrationError.message);
            // Continue - migration failure won't prevent server startup
        }
        
        // Run migration to add bank_tax_payer and bank_name columns
        try {
            const migrationPath = path.join(__dirname, 'migrations', 'add_bank_tax_payer_and_name.sql');
            if (fs.existsSync(migrationPath)) {
                const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
                await pool.query(migrationSQL);
                console.log('✅ Bank tax payer and name columns migration completed');
            }
        } catch (migrationError) {
            console.error('⚠️ Migration warning (non-fatal):', migrationError.message);
            // Continue - migration failure won't prevent server startup
        }
        
        // Run migration to add ssn_itin_entries column
        try {
            const columnCheck = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name='customer_tax_info' AND column_name='ssn_itin_entries'
            `);
            
            if (columnCheck.rows.length === 0) {
                await pool.query(`
                    ALTER TABLE customer_tax_info 
                    ADD COLUMN ssn_itin_entries JSONB
                `);
                console.log('✅ ssn_itin_entries column added to customer_tax_info table');
            } else {
                console.log('✅ ssn_itin_entries column already exists');
            }
        } catch (migrationError) {
            console.error('⚠️ Migration warning (non-fatal):', migrationError.message);
            // Continue - migration failure won't prevent server startup
        }
        
        // Run migration to create user_preferences table
        try {
            await createUserPreferencesTableMigration(pool);
            await createBreakTimesTableMigration(pool);
        } catch (migrationError) {
            console.error('⚠️ Migration warning (non-fatal):', migrationError.message);
            // Continue - migration failure won't prevent server startup
        }
        
        // Run migration to add visa information columns
        try {
            const visaColumns = ['visa_type', 'latest_visa_change', 'primary_port_of_entry', 'total_months_stayed_us'];
            for (const columnName of visaColumns) {
                const columnCheck = await pool.query(`
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name='customer_tax_info' AND column_name=$1
                `, [columnName]);
                
                if (columnCheck.rows.length === 0) {
                    let alterQuery = '';
                    if (columnName === 'visa_type' || columnName === 'latest_visa_change') {
                        alterQuery = `ALTER TABLE customer_tax_info ADD COLUMN ${columnName} VARCHAR(50)`;
                    } else if (columnName === 'primary_port_of_entry') {
                        alterQuery = `ALTER TABLE customer_tax_info ADD COLUMN ${columnName} DATE`;
                    } else if (columnName === 'total_months_stayed_us') {
                        alterQuery = `ALTER TABLE customer_tax_info ADD COLUMN ${columnName} DECIMAL(10, 2)`;
                    }
                    
                    if (alterQuery) {
                        await pool.query(alterQuery);
                        console.log(`✅ ${columnName} column added to customer_tax_info table`);
                    }
                }
            }
        } catch (migrationError) {
            console.error('⚠️ Migration warning (non-fatal):', migrationError.message);
            // Continue - migration failure won't prevent server startup
        }
        
        // Run migration to create blog_posts table
        try {
            await createBlogPostsTableMigration(pool);
        } catch (migrationError) {
            console.error('⚠️ Migration warning (non-fatal):', migrationError.message);
            // Continue - migration failure won't prevent server startup
        }
        
        // Run migration to add personal information columns (including marital_status)
        try {
            const personalInfoColumns = [
                { name: 'filing_years', type: 'VARCHAR(10)' },
                { name: 'first_name', type: 'VARCHAR(100)' },
                { name: 'middle_name', type: 'VARCHAR(100)' },
                { name: 'last_name', type: 'VARCHAR(100)' },
                { name: 'gender', type: 'VARCHAR(50)' },
                { name: 'marital_status', type: 'VARCHAR(50)' },
                { name: 'alternate_mobile_no', type: 'VARCHAR(20)' },
                { name: 'country_of_citizenship', type: 'VARCHAR(100)' }
            ];
            
            for (const column of personalInfoColumns) {
                const columnCheck = await pool.query(`
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name='customer_tax_info' AND column_name=$1
                `, [column.name]);
                
                if (columnCheck.rows.length === 0) {
                    await pool.query(`
                        ALTER TABLE customer_tax_info 
                        ADD COLUMN ${column.name} ${column.type}
                    `);
                    console.log(`✅ ${column.name} column added to customer_tax_info table`);
                }
            }
        } catch (migrationError) {
            console.error('⚠️ Migration warning (non-fatal):', migrationError.message);
            // Continue - migration failure won't prevent server startup
        }

        // Check if admin user exists, create if not (case-insensitive check)
        const adminCheck = await pool.query('SELECT id FROM users WHERE LOWER(username) = $1', ['admin']);
        
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
        
        // Check S3 configuration status
        const s3Storage = require('./utils/s3Storage');
        if (s3Storage.isS3Configured()) {
            console.log('✅ AWS S3 storage is configured');
            console.log(`   Bucket: ${process.env.AWS_S3_BUCKET_NAME || 'Not set'}`);
            console.log(`   Region: ${process.env.AWS_REGION || 'Not set'}`);
            console.log(`   Prefix: ${process.env.AWS_S3_PREFIX || 'customer-documents'}`);
        } else {
            console.log('⚠️  AWS S3 storage is NOT configured');
            console.log('   Files will be stored locally and may be lost during redeployments');
            console.log('   To enable S3, set these environment variables:');
            console.log('   - AWS_ACCESS_KEY_ID');
            console.log('   - AWS_SECRET_ACCESS_KEY');
            console.log('   - AWS_REGION');
            console.log('   - AWS_S3_BUCKET_NAME');
        }

        // Initialize email receiver service
        try {
            const EmailReceiverService = require('./services/emailReceiver');
            const emailReceiver = new EmailReceiverService(pool);
            const emailReceiverStarted = emailReceiver.initialize();
            if (emailReceiverStarted) {
                // Store reference for cleanup and manual trigger
                app.locals.emailReceiver = emailReceiver;
                console.log('✅ Email receiver service initialized');
                
                // Add manual trigger endpoint (for testing/admin use) - No CSRF needed, uses JWT auth
                app.post('/api/admin/check-emails', (req, res) => {
                    if (emailReceiver && emailReceiver.isRunning) {
                        console.log('📧 Manual email check triggered (including read emails)');
                        emailReceiver.checkForNewEmails(true); // Include read emails
                        res.json({ success: true, message: 'Email check triggered. Checking unread and recent read emails with attachments.' });
                    } else {
                        res.status(503).json({ error: 'Email receiver service is not running' });
                    }
                });
            } else {
                console.log('⚠️  Email receiver service not started (check EMAIL_PASSWORD)');
            }
        } catch (emailReceiverError) {
            console.error('⚠️  Email receiver service error:', emailReceiverError.message);
            console.log('   Email attachment processing will not be available');
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

// Apply rate limiting to API routes EXCEPT auth routes
// Auth routes need higher limits for login attempts
app.use('/api', (req, res, next) => {
    // Skip rate limiting for auth routes
    if (req.path && req.path.startsWith('/auth/')) {
        console.log('⏭️  Rate limiting skipped for auth route:', req.method, req.path);
        return next();
    }
    // Apply rate limiting to all other API routes
    limiter(req, res, next);
});

// Make pool available to routes
app.locals.pool = pool;

// Import routes (they will use app.locals.pool)
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const userRoutes = require('./routes/users');
const contactRoutes = require('./routes/contact');
const referralRoutes = require('./routes/referrals');
const blogRoutes = require('./routes/blog');

// Initialize routes with app (so they can access the pool)
if (authRoutes.init) authRoutes.init(app);
if (customerRoutes.init) customerRoutes.init(app);
if (userRoutes.init) userRoutes.init(app);
if (contactRoutes.init) contactRoutes.init(app);
if (referralRoutes.init) referralRoutes.init(app);
if (blogRoutes.init) blogRoutes.init(app);

// Use API routes (must come before static file serving)
// Add logging middleware to track API requests
app.use('/api', (req, res, next) => {
    // Block sensitive file access attempts via API routes
    const path = req.path.toLowerCase();
    const sensitiveApiPaths = ['.env', 'config.json', 'package.json', '.git', '.aws', '.ssh'];
    
    if (sensitiveApiPaths.some(sensitive => path.includes(sensitive))) {
        console.warn(`🚨 SECURITY: Blocked API access attempt to sensitive file: ${req.method} ${req.originalUrl} from IP: ${req.ip || req.connection.remoteAddress}`);
        return res.status(404).json({ 
            error: 'API endpoint not found',
            message: 'The requested API endpoint does not exist'
        });
    }
    
    console.log(`📡 API Request: ${req.method} ${req.path}`);
    next();
});

// Security: Block access to sensitive files and common exploit paths
// This must come BEFORE API routes to catch these early
const sensitivePaths = [
    '/.env',
    '/.env.local',
    '/.env.production',
    '/.env.development',
    '/config.json',
    '/package.json',
    '/package-lock.json',
    '/.git',
    '/.git/config',
    '/.gitignore',
    '/.htaccess',
    '/.htpasswd',
    '/web.config',
    '/.well-known',
    '/phpinfo.php',
    '/wp-admin',
    '/wp-login.php',
    '/admin',
    '/.aws',
    '/.ssh'
];

app.use((req, res, next) => {
    const path = req.path.toLowerCase();
    
    // Check for sensitive file paths
    if (sensitivePaths.some(sensitive => path === sensitive || path.startsWith(sensitive + '/'))) {
        console.warn(`🚨 SECURITY: Blocked access attempt to sensitive path: ${req.method} ${req.path} from IP: ${req.ip || req.connection.remoteAddress}`);
        return res.status(404).json({ 
            error: 'Not found',
            message: 'The requested resource does not exist'
        });
    }
    
    // Block common exploit patterns
    if (path.includes('..') || path.includes('%2e%2e') || path.includes('%252e%252e')) {
        console.warn(`🚨 SECURITY: Blocked path traversal attempt: ${req.method} ${req.path} from IP: ${req.ip || req.connection.remoteAddress}`);
        return res.status(400).json({ 
            error: 'Invalid request',
            message: 'Invalid path detected'
        });
    }
    
    next();
});

// IMPORTANT: Register auth routes FIRST without CSRF protection
// Auth routes need to be accessible without CSRF tokens for login to work
app.use('/api/auth', authRoutes);

// Add a test endpoint to verify auth routes are accessible
app.get('/api/auth/test', (req, res) => {
    console.log('✅ Auth routes test endpoint called');
    res.json({ 
        message: 'Auth routes are working!',
        timestamp: new Date().toISOString(),
        path: req.path,
        originalUrl: req.originalUrl
    });
});

// Apply CSRF protection ONLY to specific route groups (NOT to auth routes)
// This ensures auth routes are completely bypassed
app.use('/api/customers', csrfProtection, customerRoutes);
app.use('/api/users', csrfProtection, userRoutes);
app.use('/api/contact', csrfProtection, contactRoutes);
app.use('/api/referrals', csrfProtection, referralRoutes);
app.use('/api/blog', blogRoutes); // Blog routes handle their own auth

// Log registered routes for debugging
console.log('✅ API routes registered:');
console.log('  - /api/auth');
console.log('  - /api/customers');
console.log('  - /api/users');
console.log('  - /api/users/password/:username (GET - password retrieval)');
console.log('  - /api/contact');

// Health check route at /api (must come before catch-all)
app.get('/api', (req, res) => {
    res.json({ 
        message: 'Nexus CRM Backend API is working!',
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// Direct test route for contact (before catch-all)
app.get('/api/contact/test', (req, res) => {
    console.log('✅ Direct /api/contact/test route hit');
    res.json({ 
        success: true, 
        message: 'Direct contact test route is working!',
        note: 'This confirms routing is working before catch-all'
    });
});

// Simple test route
app.get('/test', (req, res) => {
    res.json({ message: 'Server is working!' });
});

// Serve static files from parent directory (project root)
// Railway Root Directory MUST be set to project root (.) not backend
// If Root Directory = ., then __dirname = /app/backend, so parent = /app
const projectRoot = path.join(__dirname, '..');
const websitePath = path.join(projectRoot, 'Website');
const crmPath = path.join(projectRoot, 'CRM');

// Log paths for debugging
console.log('Server starting...');
console.log('Current directory (__dirname):', __dirname);
console.log('Project root:', projectRoot);
console.log('Website path:', websitePath);
console.log('CRM path:', crmPath);
console.log('Website index.html exists:', fs.existsSync(path.join(websitePath, 'index.html')));
console.log('CRM index.html exists:', fs.existsSync(path.join(crmPath, 'index.html')));

// Serve website static files (CSS, JS, images, etc.) from Website folder at root
app.use(express.static(websitePath, {
    fallthrough: true
}));

// Serve CRM static files from CRM folder at /crm path
app.use('/crm', express.static(crmPath, {
    fallthrough: true
}));

// Serve blog uploads
const blogUploadsPath = path.join(__dirname, 'blog_uploads');
if (fs.existsSync(blogUploadsPath)) {
    app.use('/blog_uploads', express.static(blogUploadsPath));
    console.log('✅ Blog uploads directory served at /blog_uploads');
} else {
    console.log('⚠️ Blog uploads directory does not exist yet');
}

// Serve website index.html for root path
app.get('/', (req, res) => {
    const websiteIndexPath = path.join(websitePath, 'index.html');
    if (fs.existsSync(websiteIndexPath)) {
        return res.sendFile(websiteIndexPath);
    }
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Website Not Found</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                h1 { color: #d32f2f; }
            </style>
        </head>
        <body>
            <h1>⚠️ Website Not Found</h1>
            <p>Please add <code>index.html</code> to the <code>Website</code> folder.</p>
            <p>Looking for: <code>${websiteIndexPath}</code></p>
        </body>
        </html>
    `);
});

// Serve CRM index.html for /crm path
app.get('/crm', (req, res) => {
    const crmIndexPath = path.join(crmPath, 'index.html');
    if (fs.existsSync(crmIndexPath)) {
        return res.sendFile(crmIndexPath);
    }
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>CRM Not Found</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                h1 { color: #d32f2f; }
            </style>
        </head>
        <body>
            <h1>⚠️ CRM Not Found</h1>
            <p>Please check the <code>CRM</code> folder.</p>
            <p>Looking for: <code>${crmIndexPath}</code></p>
        </body>
        </html>
    `);
});

// Serve CRM for all /crm/* routes (SPA routing for CRM)
app.get('/crm/*', (req, res) => {
    // Skip API routes (shouldn't reach here, but safety check)
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    const crmIndexPath = path.join(crmPath, 'index.html');
    if (fs.existsSync(crmIndexPath)) {
        return res.sendFile(crmIndexPath);
    }
    res.status(404).send('CRM not found.');
});

// Catch-all for website routes (SPA routing for website)
// NOTE: This should NOT match /api routes as they are handled above
app.get('*', (req, res) => {
    // This should never be reached for /api routes, but safety check
    if (req.path.startsWith('/api')) {
        console.error(`❌ API route ${req.path} reached catch-all - this should not happen!`);
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Skip CRM routes (already handled above)
    if (req.path.startsWith('/crm')) {
        return res.status(404).send('CRM route not found.');
    }
    
    // Try to serve website index.html for all other routes (for website SPA routing)
    const websiteIndexPath = path.join(websitePath, 'index.html');
    if (fs.existsSync(websiteIndexPath)) {
        return res.sendFile(websiteIndexPath);
    }
    
    res.status(404).send('Page not found.');
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

// Graceful shutdown - cleanup email receiver
process.on('SIGTERM', () => {
    console.log('📧 Shutting down email receiver service...');
    if (app.locals.emailReceiver) {
        app.locals.emailReceiver.stopChecking();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📧 Shutting down email receiver service...');
    if (app.locals.emailReceiver) {
        app.locals.emailReceiver.stopChecking();
    }
    process.exit(0);
});
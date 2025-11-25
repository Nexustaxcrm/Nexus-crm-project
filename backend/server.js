const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
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
    'http://nexustaxfiling.com', // HTTP version (for development/testing)
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
                // Store reference for cleanup
                app.locals.emailReceiver = emailReceiver;
                console.log('✅ Email receiver service initialized');
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

// Apply rate limiting to API routes
app.use('/api/', limiter);

// Make pool available to routes
app.locals.pool = pool;

// Import routes (they will use app.locals.pool)
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const userRoutes = require('./routes/users');
const contactRoutes = require('./routes/contact');

// Initialize routes with app (so they can access the pool)
if (authRoutes.init) authRoutes.init(app);
if (customerRoutes.init) customerRoutes.init(app);
if (userRoutes.init) userRoutes.init(app);
if (contactRoutes.init) contactRoutes.init(app);

// Use API routes (must come before static file serving)
// Add logging middleware to track API requests
app.use('/api', (req, res, next) => {
    console.log(`📡 API Request: ${req.method} ${req.path}`);
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contact', contactRoutes);

// Log registered routes for debugging
console.log('✅ API routes registered:');
console.log('  - /api/auth');
console.log('  - /api/customers');
console.log('  - /api/users');
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
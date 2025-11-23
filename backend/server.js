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
            // Add user_id column if it doesn't exist (for existing databases)
            try {
                await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
                await pool.query('CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id) WHERE user_id IS NOT NULL');
            } catch (alterError) {
                // Column might already exist, ignore error
                if (!alterError.message.includes('already exists') && !alterError.message.includes('duplicate')) {
                    console.warn('Warning adding user_id column:', alterError.message);
                }
            }
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
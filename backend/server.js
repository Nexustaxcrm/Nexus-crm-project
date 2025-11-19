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

// Security: Helmet.js - Set various HTTP headers for security
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
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
    'http://localhost:3000', // For local development
    'http://localhost:5500', // For local development with Live Server
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5500'
];

app.use(cors({
    origin: function (origin, callback) {
        // In production, require origin (more secure)
        // In development, allow requests with no origin (for Postman, curl, etc.)
        const isDevelopment = process.env.NODE_ENV !== 'production';
        
        if (!origin) {
            if (isDevelopment) {
                // Allow in development for testing tools
                return callback(null, true);
            } else {
                // Block in production for security
                console.warn('CORS blocked: Request with no origin in production');
                return callback(new Error('Not allowed by CORS'));
            }
        }
        
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
}));
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

// Initialize routes with app (so they can access the pool)
if (authRoutes.init) authRoutes.init(app);
if (customerRoutes.init) customerRoutes.init(app);
if (userRoutes.init) userRoutes.init(app);

// Use API routes (must come before static file serving)
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/users', userRoutes);

// Health check route at /api (must come before catch-all)
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

// Serve static files from parent directory (frontend)
// Railway Root Directory MUST be set to project root (.) not backend
// If Root Directory = ., then __dirname = /app/backend, so parent = /app (where index.html is)
// If Root Directory = backend, then __dirname = /app, and parent = / (which doesn't have index.html)
const frontendPath = path.join(__dirname, '..');

// Log paths for debugging
console.log('Server starting...');
console.log('Current directory (__dirname):', __dirname);
console.log('Frontend path:', frontendPath);
console.log('Looking for index.html at:', path.join(frontendPath, 'index.html'));
console.log('index.html exists:', fs.existsSync(path.join(frontendPath, 'index.html')));

// Serve static files (CSS, JS, images, etc.) from parent directory
app.use(express.static(frontendPath, {
    // Don't fail if directory doesn't exist
    fallthrough: true
}));

// Serve index.html for all non-API routes (SPA routing)
// This catch-all MUST come AFTER all API routes
app.get('*', (req, res) => {
    // Skip API routes (shouldn't reach here, but safety check)
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Try to serve index.html from parent directory
    const indexPath = path.join(frontendPath, 'index.html');
    
    // Check if file exists before sending
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    
    // If index.html not found, provide clear instructions
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Configuration Error</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                h1 { color: #d32f2f; }
                code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
                .instruction { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
            </style>
        </head>
        <body>
            <h1>⚠️ Railway Configuration Error</h1>
            <p><strong>index.html not found.</strong> Railway Root Directory is incorrectly configured.</p>
            
            <div class="instruction">
                <h3>🔧 Fix Railway Settings:</h3>
                <ol>
                    <li>Go to Railway Dashboard → Your Service → <strong>Settings</strong></li>
                    <li>Find <strong>"Source"</strong> or <strong>"Root Directory"</strong></li>
                    <li>Change from: <code>backend</code></li>
                    <li>Change to: <code>.</code> (dot) or leave <strong>empty</strong></li>
                    <li>Go to <strong>Deploy</strong> section</li>
                    <li>Set <strong>Start Command</strong> to: <code>cd backend && node server.js</code></li>
                    <li><strong>Save</strong> and Railway will auto-redeploy</li>
                </ol>
            </div>
            
            <p><strong>Current paths:</strong></p>
            <ul>
                <li>Current directory: <code>${__dirname}</code></li>
                <li>Frontend path: <code>${frontendPath}</code></li>
                <li>Looking for: <code>${indexPath}</code></li>
            </ul>
            
            <p><strong>Why this happens:</strong></p>
            <p>When Root Directory = <code>backend</code>, Railway only deploys files from the backend folder. 
            The <code>index.html</code> file is in the parent directory, which Railway can't access.</p>
        </body>
        </html>
    `);
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
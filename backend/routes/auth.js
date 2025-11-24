const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
require('dotenv').config();

// Get shared pool from app.locals (set in server.js)
// This function will be called with the Express app to get the pool
let pool = null;

// Initialize pool from app (called from server.js)
router.init = function(app) {
    pool = app.locals.pool;
};

// Helper function to verify JWT tokens (used by other routes)
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Store user info in request
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Export verifyToken for use in other routes
router.verifyToken = verifyToken;

// Input validation middleware
const validateLogin = (req, res, next) => {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
        return res.status(400).json({ error: 'Username is required and must be a string' });
    }
    
    if (!password || typeof password !== 'string' || password.length === 0) {
        return res.status(400).json({ error: 'Password is required' });
    }
    
    // Sanitize: trim and limit length
    if (username.trim().length > 255) {
        return res.status(400).json({ error: 'Username is too long (max 255 characters)' });
    }
    
    if (password.length > 1000) {
        return res.status(400).json({ error: 'Password is too long' });
    }
    
    // Check for SQL injection patterns (basic)
    const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)|(--)|(\/\*)|(\*\/)|(;)/i;
    if (sqlInjectionPattern.test(username) || sqlInjectionPattern.test(password)) {
        return res.status(400).json({ error: 'Invalid characters detected' });
    }
    
    next();
};

// Login endpoint
router.post('/login', validateLogin, async (req, res) => {
    try {
        // Get pool from request app (fallback if not initialized)
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const { username, password } = req.body;
        
        // Convert username to lowercase for case-insensitive comparison
        const usernameLower = username.toLowerCase().trim();
        
        // Find user in database (case-insensitive username comparison)
        console.log(`🔍 Searching for user with username: ${usernameLower}`);
        const result = await dbPool.query(
            'SELECT * FROM users WHERE LOWER(username) = $1 AND locked = FALSE',
            [usernameLower]
        );
        
        console.log(`📊 Found ${result.rows.length} user(s) with username: ${usernameLower}`);
        
        if (result.rows.length === 0) {
            console.log(`❌ User not found or account is locked: ${usernameLower}`);
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const user = result.rows[0];
        
        // Check if password is hashed (starts with $2a$ or $2b$) or plain text (legacy)
        let isValid = false;
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            // Hashed password - use bcrypt
            isValid = await bcrypt.compare(password, user.password);
        } else {
            // Plain text password (legacy) - hash it and update the database
            isValid = (password === user.password);
            if (isValid) {
                // Hash the password and update it in database
                const hashedPassword = await bcrypt.hash(password, 10);
                await dbPool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
            }
        }
        
        if (!isValid) {
            console.log(`❌ Password validation failed for user: ${usernameLower}`);
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        console.log(`✅ Password validated successfully for user: ${usernameLower}, role: ${user.role}`);
        
        // Generate JWT token
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not set in environment variables');
            return res.status(500).json({ error: 'Server configuration error: JWT_SECRET not set' });
        }
        
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        console.log(`✅ JWT token generated for user ID: ${user.id}, username: ${user.username}, role: ${user.role}`);
        
        // If customer role, check if customer record is linked
        if (user.role === 'customer') {
            try {
                const customerCheck = await dbPool.query(
                    'SELECT id, name, email FROM customers WHERE user_id = $1 LIMIT 1',
                    [user.id]
                );
                if (customerCheck.rows.length === 0) {
                    console.log(`⚠️ Customer user ${user.username} (ID: ${user.id}) has no linked customer record`);
                } else {
                    console.log(`✅ Customer record found for user ${user.username}: Customer ID ${customerCheck.rows[0].id}`);
                }
            } catch (checkError) {
                console.error('Error checking customer record:', checkError);
            }
        }
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
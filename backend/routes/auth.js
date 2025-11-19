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

// Login endpoint
router.post('/login', async (req, res) => {
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
        const result = await dbPool.query(
            'SELECT * FROM users WHERE LOWER(username) = $1 AND locked = FALSE',
            [usernameLower]
        );
        
        if (result.rows.length === 0) {
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
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
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
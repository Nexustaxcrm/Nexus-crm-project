const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
require('dotenv').config();

// Get shared pool from app.locals (set in server.js)
let pool = null;
let verifyToken = null;

// Initialize pool and auth from app (called from server.js)
router.init = function(app) {
    pool = app.locals.pool;
    // Import verifyToken from auth routes
    const authRoutes = require('./auth');
    verifyToken = authRoutes.verifyToken;
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
    if (verifyToken) {
        return verifyToken(req, res, next);
    }
    // Fallback if verifyToken not initialized
    return res.status(500).json({ error: 'Authentication not initialized' });
};

// Get all users (requires authentication)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const result = await dbPool.query('SELECT id, username, role, locked, created_at FROM users ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create user (requires authentication - only admins should create users)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const { username, password, role } = req.body;
        
        // Check if username already exists (case-insensitive)
        const usernameLower = username.toLowerCase().trim();
        const existingUser = await dbPool.query(
            'SELECT id FROM users WHERE LOWER(username) = $1',
            [usernameLower]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        // Hash the password before storing
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await dbPool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role, locked',
            [username.trim(), hashedPassword, role]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.code === '23505') {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            res.status(500).json({ error: 'Server error' });
        }
    }
});

// Update user (requires authentication)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const { id } = req.params;
        const { username, password, role, locked } = req.body;
        
        // Check if username already exists for another user (case-insensitive)
        if (username) {
            const usernameLower = username.toLowerCase().trim();
            const existingUser = await dbPool.query(
                'SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2',
                [usernameLower, id]
            );
            
            if (existingUser.rows.length > 0) {
                return res.status(400).json({ error: 'Username already exists' });
            }
        }
        
        let query, params;
        if (password) {
            // Hash the password before updating
            const hashedPassword = await bcrypt.hash(password, 10);
            query = 'UPDATE users SET username=$1, password=$2, role=$3, locked=$4 WHERE id=$5 RETURNING id, username, role, locked';
            params = [username ? username.trim() : null, hashedPassword, role, locked, id];
        } else {
            query = 'UPDATE users SET username=$1, role=$2, locked=$3 WHERE id=$4 RETURNING id, username, role, locked';
            params = [username ? username.trim() : null, role, locked, id];
        }
        
        const result = await dbPool.query(query, params);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating user:', error);
        if (error.code === '23505') {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            res.status(500).json({ error: 'Server error' });
        }
    }
});

// Delete user (requires authentication)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const { id } = req.params;
        await dbPool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
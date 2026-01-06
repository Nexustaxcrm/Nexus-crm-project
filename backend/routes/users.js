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

// Input validation middleware
const validateUserInput = (req, res, next) => {
    const { username, password, role } = req.body;
    
    // Validate username
    if (username !== undefined) {
        if (typeof username !== 'string' || username.trim().length === 0) {
            return res.status(400).json({ error: 'Username must be a non-empty string' });
        }
        if (username.trim().length > 255) {
            return res.status(400).json({ error: 'Username is too long (max 255 characters)' });
        }
        if (username.trim().length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }
        // Allow only alphanumeric, underscore, and hyphen
        if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
            return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
        }
    }
    
    // Validate password (if provided)
    if (password !== undefined) {
        if (typeof password !== 'string' || password.length === 0) {
            return res.status(400).json({ error: 'Password must be a non-empty string' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        if (password.length > 1000) {
            return res.status(400).json({ error: 'Password is too long' });
        }
    }
    
    // Validate role (if provided)
    if (role !== undefined) {
        const validRoles = ['admin', 'employee', 'preparation'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}` });
        }
    }
    
    // Check for SQL injection patterns (basic)
    const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)|(--)|(\/\*)|(\*\/)|(;)/i;
    if (username && sqlInjectionPattern.test(username)) {
        return res.status(400).json({ error: 'Invalid characters detected in username' });
    }
    
    next();
};

// Temporary password storage (in-memory cache)
// This stores passwords temporarily when users are created
// Passwords are cleared after 24 hours for security
const passwordCache = new Map();
const PASSWORD_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Store password in cache when user is created
function cacheUserPassword(username, password) {
    passwordCache.set(username.toLowerCase(), {
        password: password,
        timestamp: Date.now()
    });
    console.log(`✅ Password cached for user: ${username}`);
}

// Clean up expired passwords periodically
setInterval(() => {
    const now = Date.now();
    for (const [username, data] of passwordCache.entries()) {
        if (now - data.timestamp > PASSWORD_CACHE_TTL) {
            passwordCache.delete(username);
        }
    }
}, 60 * 60 * 1000); // Check every hour

// Test route to verify routing is working
router.get('/test-password-route', (req, res) => {
    console.log('✅ Password route test endpoint hit!');
    res.json({ 
        message: 'Password route test successful',
        path: req.path,
        originalUrl: req.originalUrl,
        method: req.method
    });
});

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

// Get user password (requires admin authentication)
// CRITICAL: This route MUST be defined BEFORE /:id routes to avoid route conflicts
// Using a more specific route pattern to ensure proper matching
// This endpoint returns the password if it's in the temporary cache
// For existing users with hashed passwords, it returns an error
router.get('/password/:username', authenticateToken, async (req, res) => {
    console.log('🔍 Password route hit!', {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        params: req.params,
        username: req.params.username
    });
    
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            console.error('❌ Database pool not initialized');
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        // Check if requester is admin
        if (!req.user || req.user.role !== 'admin') {
            console.log('❌ Unauthorized access attempt:', {
                user: req.user ? req.user.username : 'none',
                role: req.user ? req.user.role : 'none'
            });
            return res.status(403).json({ error: 'Only administrators can view passwords' });
        }
        
        const { username } = req.params;
        console.log(`📡 Password request for user: ${username} by admin: ${req.user.username}`);
        
        // Check if password is in temporary cache (for newly created users)
        const cachedPassword = passwordCache.get(username.toLowerCase());
        if (cachedPassword) {
            // Check if cache entry is still valid
            const now = Date.now();
            if (now - cachedPassword.timestamp <= PASSWORD_CACHE_TTL) {
                console.log(`✅ Password found in cache for user: ${username}`);
                return res.json({ 
                    password: cachedPassword.password,
                    cached: true,
                    message: 'Password retrieved from temporary cache'
                });
            } else {
                // Cache expired, remove it
                console.log(`⚠️ Password cache expired for user: ${username}`);
                passwordCache.delete(username.toLowerCase());
            }
        } else {
            console.log(`⚠️ Password not found in cache for user: ${username}`);
        }
        
        // Password not in cache - check if user exists
        const userResult = await dbPool.query(
            'SELECT id, username, role FROM users WHERE LOWER(username) = $1',
            [username.toLowerCase()]
        );
        
        if (userResult.rows.length === 0) {
            console.log(`❌ User not found: ${username}`);
            return res.status(404).json({ error: 'User not found' });
        }
        
        // User exists but password is hashed in database
        // Cannot retrieve original password
        console.log(`❌ Password not available for user: ${username} (hashed in database)`);
        return res.status(404).json({ 
            error: 'Password not available',
            message: 'Password is hashed in the database and cannot be retrieved. Only passwords for newly created users (within 24 hours) are available.',
            hashed: true
        });
    } catch (error) {
        console.error('Error fetching user password:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create user (requires authentication - only admins should create users)
router.post('/', authenticateToken, validateUserInput, async (req, res) => {
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
        
        // CRITICAL: Cache the plain text password temporarily for viewing
        // This allows admins to view passwords for newly created users
        cacheUserPassword(username.trim(), password);
        
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
router.put('/:id', authenticateToken, validateUserInput, async (req, res) => {
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
            
            // CRITICAL: Cache the plain text password temporarily when password is updated
            // This allows admins to view passwords after they've been reset
            const updatedUser = await dbPool.query('SELECT username FROM users WHERE id = $1', [id]);
            if (updatedUser.rows.length > 0) {
                const userUsername = updatedUser.rows[0].username;
                cacheUserPassword(userUsername, password);
                console.log(`✅ Password cached after update for user: ${userUsername}`);
            }
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

// Get user dashboard card preferences
router.get('/preferences/dashboard-cards', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        // Get user ID from token (JWT uses 'userId', not 'id')
        const userId = req.user.userId || req.user.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'User ID not found in token' });
        }
        
        // Get dashboard cards preference
        const result = await dbPool.query(`
            SELECT preference_value 
            FROM user_preferences 
            WHERE user_id = $1 AND preference_key = 'dashboard_cards'
        `, [userId]);
        
        if (result.rows.length > 0 && result.rows[0].preference_value) {
            try {
                const cards = JSON.parse(result.rows[0].preference_value);
                res.json({ success: true, cards: cards });
            } catch (parseError) {
                console.error('Error parsing dashboard cards:', parseError);
                res.json({ success: true, cards: null });
            }
        } else {
            // Return null if no preference is saved (frontend will use defaults)
            res.json({ success: true, cards: null });
        }
    } catch (error) {
        console.error('Error fetching dashboard cards:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Save user dashboard card preferences
router.post('/preferences/dashboard-cards', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        // Get user ID from token (JWT uses 'userId', not 'id')
        const userId = req.user.userId || req.user.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'User ID not found in token' });
        }
        
        // Validate request body
        const { cards } = req.body;
        
        if (!Array.isArray(cards)) {
            return res.status(400).json({ error: 'Cards must be an array' });
        }
        
        if (cards.length === 0) {
            return res.status(400).json({ error: 'At least one card must be selected' });
        }
        
        if (cards.length > 4) {
            return res.status(400).json({ error: 'Maximum of 4 cards allowed' });
        }
        
        // Validate card values (status codes)
        const validStatuses = [
            'pending', 'not_called', 'follow_up', 'voice_mail', 'w2_received',
            'call_back', 'not_in_service', 'citizen', 'dnd', 'interested',
            'potential', 'called'
        ];
        
        for (const card of cards) {
            if (!validStatuses.includes(card)) {
                return res.status(400).json({ error: `Invalid status code: ${card}` });
            }
        }
        
        // Save or update preference using UPSERT
        const preferenceValue = JSON.stringify(cards);
        await dbPool.query(`
            INSERT INTO user_preferences (user_id, preference_key, preference_value, updated_at)
            VALUES ($1, 'dashboard_cards', $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, preference_key)
            DO UPDATE SET 
                preference_value = EXCLUDED.preference_value,
                updated_at = CURRENT_TIMESTAMP
        `, [userId, preferenceValue]);
        
        res.json({ success: true, message: 'Dashboard cards saved successfully' });
    } catch (error) {
        console.error('Error saving dashboard cards:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// BREAK TIME ENDPOINTS
// ============================================

// Start break time
router.post('/break-time/start', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }

        const userId = req.user.userId;
        const username = req.user.username;
        const breakStartTime = new Date();

        // Check if user already has an active break
        const activeBreak = await dbPool.query(
            `SELECT id FROM break_times 
             WHERE user_id = $1 AND status = 'active' AND break_end_time IS NULL`,
            [userId]
        );

        if (activeBreak.rows.length > 0) {
            return res.status(400).json({ error: 'You already have an active break' });
        }

        // Insert new break record
        const result = await dbPool.query(
            `INSERT INTO break_times (user_id, username, break_start_time, status)
             VALUES ($1, $2, $3, 'active')
             RETURNING *`,
            [userId, username, breakStartTime]
        );

        res.json({ success: true, breakTime: result.rows[0] });
    } catch (error) {
        console.error('Error starting break time:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// End break time
router.post('/break-time/end', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }

        const userId = req.user.userId;
        const breakEndTime = new Date();

        // Find active break
        const activeBreak = await dbPool.query(
            `SELECT id, break_start_time FROM break_times 
             WHERE user_id = $1 AND status = 'active' AND break_end_time IS NULL
             ORDER BY break_start_time DESC LIMIT 1`,
            [userId]
        );

        if (activeBreak.rows.length === 0) {
            return res.status(400).json({ error: 'No active break found' });
        }

        const breakRecord = activeBreak.rows[0];
        const startTime = new Date(breakRecord.break_start_time);
        const durationSeconds = Math.floor((breakEndTime - startTime) / 1000);

        // Update break record
        const result = await dbPool.query(
            `UPDATE break_times 
             SET break_end_time = $1, duration_seconds = $2, status = 'completed', updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [breakEndTime, durationSeconds, breakRecord.id]
        );

        res.json({ success: true, breakTime: result.rows[0] });
    } catch (error) {
        console.error('Error ending break time:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get break times (for admin - all users, for employee - own breaks)
router.get('/break-times', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }

        const userId = req.user.userId;
        const userRole = req.user.role;
        const { username, date } = req.query;

        let query = `
            SELECT bt.*, u.username as employee_username
            FROM break_times bt
            JOIN users u ON bt.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        // Admin can see all, employees/preparation see only their own
        if (userRole !== 'admin') {
            paramCount++;
            query += ` AND bt.user_id = $${paramCount}`;
            params.push(userId);
        }

        // Filter by username if provided (admin only)
        if (username && userRole === 'admin') {
            paramCount++;
            query += ` AND bt.username = $${paramCount}`;
            params.push(username);
        }

        // Filter by date if provided
        if (date) {
            paramCount++;
            query += ` AND DATE(bt.break_start_time) = $${paramCount}`;
            params.push(date);
        }

        query += ` ORDER BY bt.break_start_time DESC LIMIT 100`;

        const result = await dbPool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching break times:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get active breaks (for admin dashboard)
router.get('/break-times/active', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }

        const userRole = req.user.role;

        // Only admin can see active breaks
        if (userRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await dbPool.query(
            `SELECT bt.*, u.username as employee_username
             FROM break_times bt
             JOIN users u ON bt.user_id = u.id
             WHERE bt.status = 'active' AND bt.break_end_time IS NULL
             ORDER BY bt.break_start_time DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching active break times:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
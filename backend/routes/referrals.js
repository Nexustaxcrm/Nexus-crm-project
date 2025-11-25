const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
    // Use verifyToken from auth routes if available, otherwise use inline version
    if (verifyToken) {
        return verifyToken(req, res, next);
    }
    
    // Fallback authentication (should not happen if init is called properly)
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Get all referrals (admin only)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin only.' });
        }
        
        const result = await dbPool.query(`
            SELECT r.*, 
                   u.username as referred_by_username,
                   u.name as referred_by_name
            FROM referrals r
            LEFT JOIN users u ON r.referred_by = u.id
            ORDER BY r.created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching referrals:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get referral statistics (admin only)
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin only.' });
        }
        
        const result = await dbPool.query(`
            SELECT COUNT(*) as total_referrals
            FROM referrals
        `);
        
        res.json({
            totalReferrals: parseInt(result.rows[0].total_referrals) || 0
        });
    } catch (error) {
        console.error('Error fetching referral stats:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create a new referral (authenticated users)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const { name, phone, email, referred_by, referred_by_name } = req.body;
        
        // Validate required fields
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        // At least phone or email must be provided
        if (!phone && !email) {
            return res.status(400).json({ error: 'Either phone or email must be provided' });
        }
        
        // Validate email format if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }
        }
        
        // Use the authenticated user's ID as referrer if not provided
        const referrerId = referred_by || req.user.id;
        const referrerName = referred_by_name || req.user.username || req.user.name || 'Unknown';
        
        const result = await dbPool.query(`
            INSERT INTO referrals (name, phone, email, referred_by, referred_by_name, created_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            RETURNING *
        `, [name, phone || null, email || null, referrerId, referrerName]);
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating referral:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;


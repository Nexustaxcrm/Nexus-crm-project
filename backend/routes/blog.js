const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Pool will be injected from server.js
let pool;

// Ensure blog_uploads directory exists
const blogUploadsDir = path.join(__dirname, '../blog_uploads');
if (!fs.existsSync(blogUploadsDir)) {
    fs.mkdirSync(blogUploadsDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, blogUploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'blog-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Middleware to verify admin token
const verifyAdmin = async (req, res, next) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user is admin
        const result = await pool.query('SELECT role FROM users WHERE username = $1', [decoded.username]);
        if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Admin authentication endpoint (for blog posting)
router.post('/admin-auth', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Check if user exists and is admin
        const result = await pool.query(
            'SELECT username, password, role FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
            success: true, 
            token,
            message: 'Authentication successful' 
        });
    } catch (error) {
        console.error('Admin auth error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create blog post
router.post('/posts', verifyAdmin, upload.single('featuredImage'), async (req, res) => {
    try {
        const { title, shortDescription, content } = req.body;
        const featuredImage = req.file ? `/blog_uploads/${req.file.filename}` : null;

        if (!title || !shortDescription || !content) {
            return res.status(400).json({ error: 'Title, short description, and content are required' });
        }

        const result = await pool.query(
            `INSERT INTO blog_posts (title, short_description, content, featured_image, created_by, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING *`,
            [title, shortDescription, content, featuredImage, req.admin.username]
        );

        res.status(201).json({ 
            success: true, 
            post: result.rows[0],
            message: 'Blog post created successfully' 
        });
    } catch (error) {
        console.error('Create blog post error:', error);
        res.status(500).json({ error: 'Failed to create blog post' });
    }
});

// Get all blog posts (public)
router.get('/posts', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, short_description, featured_image, created_at, created_by
             FROM blog_posts
             ORDER BY created_at DESC`
        );

        res.json({ posts: result.rows });
    } catch (error) {
        console.error('Get blog posts error:', error);
        res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
});

// Get single blog post by ID (public)
router.get('/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT * FROM blog_posts WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Blog post not found' });
        }

        res.json({ post: result.rows[0] });
    } catch (error) {
        console.error('Get blog post error:', error);
        res.status(500).json({ error: 'Failed to fetch blog post' });
    }
});

// Delete blog post (admin only)
router.delete('/posts/:id', verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Get post to delete image file
        const postResult = await pool.query('SELECT featured_image FROM blog_posts WHERE id = $1', [id]);
        
        if (postResult.rows.length === 0) {
            return res.status(404).json({ error: 'Blog post not found' });
        }

        // Delete image file if exists
        if (postResult.rows[0].featured_image) {
            const imagePath = path.join(__dirname, '..', postResult.rows[0].featured_image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        // Delete post from database
        await pool.query('DELETE FROM blog_posts WHERE id = $1', [id]);

        res.json({ success: true, message: 'Blog post deleted successfully' });
    } catch (error) {
        console.error('Delete blog post error:', error);
        res.status(500).json({ error: 'Failed to delete blog post' });
    }
});

// Serve blog images
router.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(blogUploadsDir, filename);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Image not found' });
    }
});

// Initialize function to receive pool from server.js
router.init = (app) => {
    pool = app.locals.pool;
};

module.exports = router;


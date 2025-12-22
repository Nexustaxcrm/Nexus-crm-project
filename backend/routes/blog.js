const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const s3Storage = require('../utils/s3Storage');
require('dotenv').config();

// Pool will be injected from server.js
let pool;

// Blog images S3 prefix (separate from customer documents)
const BLOG_S3_PREFIX = 'blog-images';

// Ensure blog_uploads directory exists (for fallback local storage)
const blogUploadsDir = path.join(__dirname, '../blog_uploads');
if (!fs.existsSync(blogUploadsDir)) {
    fs.mkdirSync(blogUploadsDir, { recursive: true });
}

// Configure multer for image uploads (use memory storage for S3 upload)
const storage = multer.memoryStorage();

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
        let featuredImage = null;

        // Handle image upload (S3 or local fallback)
        if (req.file) {
            const fileName = req.file.originalname;
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(fileName);
            const storedFileName = `blog-${uniqueSuffix}${ext}`;

            if (s3Storage.isS3Configured()) {
                try {
                    // Upload to S3 with blog-images prefix
                    const fileBuffer = req.file.buffer;
                    const s3Key = `${BLOG_S3_PREFIX}/${storedFileName}`;
                    
                    // Use AWS SDK directly for blog images with custom prefix
                    const AWS = require('aws-sdk');
                    const s3 = new AWS.S3({
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                        region: process.env.AWS_REGION || 'us-east-1'
                    });
                    
                    const contentType = s3Storage.getContentType(fileName);
                    const params = {
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: s3Key,
                        Body: fileBuffer,
                        ContentType: contentType,
                        Metadata: {
                            'original-name': fileName
                        }
                    };
                    
                    await s3.upload(params).promise();
                    console.log(`✅ Blog image uploaded to S3: ${s3Key}`);
                    
                    // Store S3 key in database
                    featuredImage = s3Key;
                } catch (s3Error) {
                    console.error('❌ Error uploading blog image to S3:', s3Error);
                    // Fallback to local storage
                    const localPath = path.join(blogUploadsDir, storedFileName);
                    fs.writeFileSync(localPath, req.file.buffer);
                    featuredImage = `/blog_uploads/${storedFileName}`;
                    console.log(`⚠️ Blog image saved to local storage: ${featuredImage}`);
                }
            } else {
                // Use local storage if S3 is not configured
                const localPath = path.join(blogUploadsDir, storedFileName);
                fs.writeFileSync(localPath, req.file.buffer);
                featuredImage = `/blog_uploads/${storedFileName}`;
                console.log(`📁 Blog image saved to local storage: ${featuredImage}`);
            }
        }

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

// Update blog post (admin only)
router.put('/posts/:id', verifyAdmin, upload.single('featuredImage'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, shortDescription, content } = req.body;
        
        // Check if post exists
        const postResult = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [id]);
        if (postResult.rows.length === 0) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        
        const existingPost = postResult.rows[0];
        let featuredImage = existingPost.featured_image; // Keep existing image by default
        
        // Handle new image upload if provided
        if (req.file) {
            // Delete old image if exists
            if (existingPost.featured_image) {
                const oldImagePath = existingPost.featured_image;
                
                // Check if it's an S3 key
                if (s3Storage.isS3Configured() && oldImagePath.startsWith(BLOG_S3_PREFIX + '/')) {
                    try {
                        await s3Storage.deleteFromS3(oldImagePath);
                        console.log(`✅ Old blog image deleted from S3: ${oldImagePath}`);
                    } catch (s3Error) {
                        console.error('❌ Error deleting old blog image from S3:', s3Error);
                    }
                } else {
                    // Delete from local storage
                    const localPath = path.join(__dirname, '..', oldImagePath);
                    if (fs.existsSync(localPath)) {
                        fs.unlinkSync(localPath);
                        console.log(`✅ Old blog image deleted from local storage: ${oldImagePath}`);
                    }
                }
            }
            
            // Upload new image
            const fileName = req.file.originalname;
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(fileName);
            const storedFileName = `blog-${uniqueSuffix}${ext}`;
            
            if (s3Storage.isS3Configured()) {
                try {
                    const fileBuffer = req.file.buffer;
                    const s3Key = `${BLOG_S3_PREFIX}/${storedFileName}`;
                    
                    const AWS = require('aws-sdk');
                    const s3 = new AWS.S3({
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                        region: process.env.AWS_REGION || 'us-east-1'
                    });
                    
                    const contentType = s3Storage.getContentType(fileName);
                    const params = {
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: s3Key,
                        Body: fileBuffer,
                        ContentType: contentType,
                        Metadata: {
                            'original-name': fileName
                        }
                    };
                    
                    await s3.upload(params).promise();
                    console.log(`✅ New blog image uploaded to S3: ${s3Key}`);
                    featuredImage = s3Key;
                } catch (s3Error) {
                    console.error('❌ Error uploading blog image to S3:', s3Error);
                    // Fallback to local storage
                    const localPath = path.join(blogUploadsDir, storedFileName);
                    fs.writeFileSync(localPath, req.file.buffer);
                    featuredImage = `/blog_uploads/${storedFileName}`;
                    console.log(`⚠️ Blog image saved to local storage: ${featuredImage}`);
                }
            } else {
                // Use local storage if S3 is not configured
                const localPath = path.join(blogUploadsDir, storedFileName);
                fs.writeFileSync(localPath, req.file.buffer);
                featuredImage = `/blog_uploads/${storedFileName}`;
                console.log(`📁 Blog image saved to local storage: ${featuredImage}`);
            }
        }
        
        if (!title || !shortDescription || !content) {
            return res.status(400).json({ error: 'Title, short description, and content are required' });
        }
        
        // Update post in database
        const result = await pool.query(
            `UPDATE blog_posts 
             SET title = $1, short_description = $2, content = $3, featured_image = $4, updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [title, shortDescription, content, featuredImage, id]
        );
        
        res.json({ 
            success: true, 
            post: result.rows[0],
            message: 'Blog post updated successfully' 
        });
    } catch (error) {
        console.error('Update blog post error:', error);
        res.status(500).json({ error: 'Failed to update blog post' });
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

        // Delete image file if exists (S3 or local)
        if (postResult.rows[0].featured_image) {
            const imagePath = postResult.rows[0].featured_image;
            
            // Check if it's an S3 key (starts with blog-images/)
            if (s3Storage.isS3Configured() && imagePath.startsWith(BLOG_S3_PREFIX + '/')) {
                try {
                    await s3Storage.deleteFromS3(imagePath);
                    console.log(`✅ Blog image deleted from S3: ${imagePath}`);
                } catch (s3Error) {
                    console.error('❌ Error deleting blog image from S3:', s3Error);
                    // Continue with database deletion even if S3 delete fails
                }
            } else {
                // Delete from local storage
                const localPath = path.join(__dirname, '..', imagePath);
                if (fs.existsSync(localPath)) {
                    fs.unlinkSync(localPath);
                    console.log(`✅ Blog image deleted from local storage: ${imagePath}`);
                }
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

// Serve blog images (S3 or local) - unified endpoint with optimization
router.get('/image', async (req, res) => {
    try {
        const imagePath = req.query.path;
        const width = req.query.width ? parseInt(req.query.width) : null;
        const quality = req.query.quality ? parseInt(req.query.quality) : 80;
        
        if (!imagePath) {
            return res.status(400).json({ error: 'Image path required. Use ?path=blog-images/filename.jpg' });
        }
        
        let fileBuffer;
        let filename;
        let contentType;
        
        // Check if it's an S3 key (starts with blog-images/)
        if (imagePath.startsWith(BLOG_S3_PREFIX + '/')) {
            // Serve from S3
            if (s3Storage.isS3Configured()) {
                try {
                    fileBuffer = await s3Storage.downloadFromS3(imagePath);
                    filename = path.basename(imagePath);
                    contentType = s3Storage.getContentType(filename);
                } catch (s3Error) {
                    console.error(`❌ Error serving blog image from S3: ${s3Error.message}`);
                    return res.status(404).json({ error: 'Image not found in S3' });
                }
            } else {
                return res.status(404).json({ error: 'S3 not configured' });
            }
        } else if (imagePath.startsWith('/blog_uploads/') || imagePath.startsWith('blog_uploads/')) {
            // Serve from local storage
            filename = path.basename(imagePath);
            const localPath = path.join(blogUploadsDir, filename);
            
            if (fs.existsSync(localPath)) {
                fileBuffer = fs.readFileSync(localPath);
                contentType = s3Storage.getContentType(filename);
            } else {
                return res.status(404).json({ error: 'Image not found in local storage' });
            }
        } else {
            return res.status(400).json({ error: 'Invalid image path format' });
        }
        
        // Optimize image if sharp is available and parameters are provided
        let processedBuffer = fileBuffer;
        const originalSize = fileBuffer.length;
        
        if (contentType && contentType.startsWith('image/') && (width || quality < 100)) {
            try {
                const sharp = require('sharp');
                let sharpInstance = sharp(fileBuffer);
                
                // Resize if width is specified
                if (width) {
                    sharpInstance = sharpInstance.resize(width, null, {
                        withoutEnlargement: true,
                        fit: 'inside'
                    });
                }
                
                // Apply format-specific optimization
                if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
                    processedBuffer = await sharpInstance
                        .jpeg({ quality: quality, progressive: true, mozjpeg: true })
                        .toBuffer();
                } else if (contentType === 'image/png') {
                    processedBuffer = await sharpInstance
                        .png({ quality: quality, progressive: true, compressionLevel: 9 })
                        .toBuffer();
                } else if (contentType === 'image/webp') {
                    processedBuffer = await sharpInstance
                        .webp({ quality: quality })
                        .toBuffer();
                } else {
                    // For other formats, just resize if needed
                    if (width) {
                        processedBuffer = await sharpInstance.toBuffer();
                    }
                }
                
                const optimizedSize = processedBuffer.length;
                const savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
                console.log(`✅ Blog image optimized: ${imagePath} (${(originalSize / 1024).toFixed(2)}KB → ${(optimizedSize / 1024).toFixed(2)}KB, ${savings}% reduction)`);
            } catch (sharpError) {
                // If sharp fails or is not available, serve original image
                console.warn('⚠️ Sharp optimization failed, serving original image:', sharpError.message);
                processedBuffer = fileBuffer;
            }
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
        res.setHeader('Content-Length', processedBuffer.length);
        res.send(processedBuffer);
        
        const sizeKB = (processedBuffer.length / 1024).toFixed(2);
        console.log(`✅ Blog image served: ${imagePath} (${sizeKB}KB)`);
    } catch (error) {
        console.error('Error serving blog image:', error);
        res.status(500).json({ error: 'Error serving image' });
    }
});

// Legacy endpoint for backward compatibility
router.get('/uploads/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const localPath = path.join(blogUploadsDir, filename);
        
        if (fs.existsSync(localPath)) {
            res.sendFile(localPath);
        } else {
            res.status(404).json({ error: 'Image not found' });
        }
    } catch (error) {
        console.error('Error serving blog image:', error);
        res.status(500).json({ error: 'Error serving image' });
    }
});

// Initialize function to receive pool from server.js
router.init = (app) => {
    pool = app.locals.pool;
};

module.exports = router;


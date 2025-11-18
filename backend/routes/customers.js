const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const multer = require('multer');
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

// Configure multer for file uploads
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
    // Use verifyToken from auth routes if available, otherwise use inline version
    if (verifyToken) {
        return verifyToken(req, res, next);
    }
    
    // Fallback inline verification
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Get all customers with pagination (CRITICAL: Prevents crash with 300k+ records)
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Get pool from request app (fallback if not initialized)
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100; // Default 100 records per page
        const offset = (page - 1) * limit;
        
        // Optional filters
        const status = req.query.status;
        const assignedTo = req.query.assigned_to;
        const search = req.query.search;
        
        // Build query with filters
        let query = 'SELECT * FROM customers WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        
        if (assignedTo) {
            query += ` AND assigned_to = $${paramIndex++}`;
            params.push(assignedTo);
        }
        
        if (search) {
            query += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR phone ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        
        // Get total count for pagination
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
        const countResult = await dbPool.query(countQuery, params);
        const totalRecords = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalRecords / limit);
        
        // Add ordering and pagination
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        
        const result = await dbPool.query(query, params);
        
        res.json({
            customers: result.rows,
            pagination: {
                page,
                limit,
                totalRecords,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create customer
router.post('/', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        // Handle both formats: name field or firstName/lastName
        let name = req.body.name;
        if (!name && (req.body.firstName || req.body.lastName)) {
            name = `${req.body.firstName || ''} ${req.body.lastName || ''}`.trim() || 'Unknown';
        }
        if (!name) {
            name = 'Unknown';
        }
        
        const { email, phone, status, assigned_to, notes } = req.body;
        const result = await dbPool.query(
            'INSERT INTO customers (name, email, phone, status, assigned_to, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, email, phone, status, assigned_to, notes]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update customer with optimistic locking (prevents race conditions)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const { id } = req.params;
        const { updated_at } = req.body; // Client sends current updated_at timestamp
        
        // Handle both formats: name field or firstName/lastName
        let name = req.body.name;
        if (!name && (req.body.firstName || req.body.lastName)) {
            name = `${req.body.firstName || ''} ${req.body.lastName || ''}`.trim() || 'Unknown';
        }
        if (!name) {
            // If updating and name not provided, keep existing name
            const existing = await dbPool.query('SELECT name FROM customers WHERE id = $1', [id]);
            if (existing.rows.length > 0) {
                name = existing.rows[0].name;
            } else {
                name = 'Unknown';
            }
        }
        
        const { email, phone, status, assigned_to, notes } = req.body;
        
        // Optimistic locking: Check if record was modified since client last read it
        // This prevents lost updates when multiple users edit simultaneously
        let query, params;
        if (updated_at) {
            // Check if the record was updated after the client's last read
            query = `
                UPDATE customers 
                SET name=$1, email=$2, phone=$3, status=$4, assigned_to=$5, notes=$6, updated_at=CURRENT_TIMESTAMP 
                WHERE id=$7 AND (updated_at IS NULL OR updated_at <= $8)
                RETURNING *
            `;
            params = [name, email, phone, status, assigned_to, notes, id, updated_at];
        } else {
            // No optimistic locking check (backward compatibility)
            query = `
                UPDATE customers 
                SET name=$1, email=$2, phone=$3, status=$4, assigned_to=$5, notes=$6, updated_at=CURRENT_TIMESTAMP 
                WHERE id=$7 
                RETURNING *
            `;
            params = [name, email, phone, status, assigned_to, notes, id];
        }
        
        const result = await dbPool.query(query, params);
        
        if (result.rows.length === 0) {
            // Record was updated by another user (optimistic lock failed)
            return res.status(409).json({ 
                error: 'Conflict: Customer was modified by another user. Please refresh and try again.',
                code: 'CONCURRENT_UPDATE'
            });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete customer
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const { id } = req.params;
        await dbPool.query('DELETE FROM customers WHERE id = $1', [id]);
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Bulk delete customers (for deleting multiple customers at once)
router.post('/bulk-delete', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const { customerIds } = req.body;
        
        if (!Array.isArray(customerIds) || customerIds.length === 0) {
            return res.status(400).json({ error: 'Invalid customer IDs' });
        }
        
        // Convert all IDs to integers to ensure they're valid
        const validIds = customerIds
            .map(id => {
                if (id === null || id === undefined) return null;
                const parsed = parseInt(id);
                return isNaN(parsed) ? null : parsed;
            })
            .filter(id => id !== null && !isNaN(id));
        
        if (validIds.length === 0) {
            return res.status(400).json({ error: 'No valid customer IDs provided' });
        }
        
        // Delete in batches to avoid PostgreSQL parameter limits (max ~65535 parameters)
        // Using batch size of 1000 to be safe
        const batchSize = 1000;
        let totalDeleted = 0;
        
        console.log(`Starting bulk delete: ${validIds.length} customer IDs to delete`);
        
        for (let i = 0; i < validIds.length; i += batchSize) {
            const batch = validIds.slice(i, i + batchSize);
            
            if (batch.length === 0) {
                console.warn('Empty batch detected, skipping');
                continue;
            }
            
            const placeholders = batch.map((_, index) => `$${index + 1}`).join(', ');
            const query = `DELETE FROM customers WHERE id IN (${placeholders})`;
            
            console.log(`Deleting batch ${Math.floor(i / batchSize) + 1}: ${batch.length} customers`);
            
            const result = await dbPool.query(query, batch);
            totalDeleted += result.rowCount || 0;
        }
        
        console.log(`Bulk delete completed: ${totalDeleted} customers deleted`);
        
        res.json({
            success: true,
            deletedCount: totalDeleted,
            message: `Successfully deleted ${totalDeleted} customer(s)`
        });
    } catch (error) {
        console.error('Error bulk deleting customers:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail
        });
        res.status(500).json({ 
            error: 'Server error during bulk deletion',
            details: error.message || 'Unknown error occurred'
        });
    }
});

// Bulk upload customers (optimized for large files - 300K+ records)
router.post('/bulk-upload', authenticateToken, express.json({ limit: '50mb' }), async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const { customers: customersData, batchSize = 2000 } = req.body; // Increased batch size for better performance
        
        if (!Array.isArray(customersData) || customersData.length === 0) {
            return res.status(400).json({ error: 'Invalid customer data' });
        }

        const totalRecords = customersData.length;
        let importedCount = 0;
        let errorCount = 0;
        const errors = [];

        console.log(`Starting bulk upload: ${totalRecords} records in batches of ${batchSize}`);

        // Process in batches with optimized query
        for (let i = 0; i < customersData.length; i += batchSize) {
            const batch = customersData.slice(i, i + batchSize);
            
            // Build bulk insert query using COPY-like approach for better performance
            const values = [];
            const placeholders = [];
            let paramIndex = 1;

            for (const customer of batch) {
                const name = customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown';
                const email = customer.email || null;
                const phone = customer.phone || null;
                const status = customer.status || 'pending';
                const assigned_to = customer.assignedTo || customer.assigned_to || null;
                const notes = customer.notes || customer.comments || null;

                placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
                values.push(name, email, phone, status, assigned_to, notes);
            }

            // Use ON CONFLICT DO NOTHING to handle duplicates gracefully
            const query = `
                INSERT INTO customers (name, email, phone, status, assigned_to, notes)
                VALUES ${placeholders.join(', ')}
                ON CONFLICT DO NOTHING
            `;

            try {
                const startTime = Date.now();
                const result = await dbPool.query(query, values);
                const duration = Date.now() - startTime;
                importedCount += result.rowCount || 0;
                
                if ((i / batchSize) % 10 === 0) {
                    console.log(`Processed ${i + batch.length} / ${totalRecords} records (${Math.round((i / totalRecords) * 100)}%)`);
                }
            } catch (batchError) {
                console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, batchError.message);
                errorCount += batch.length;
                errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${batchError.message}`);
                
                // Continue with next batch even if one fails
            }
        }

        console.log(`Bulk upload completed: ${importedCount} imported, ${errorCount} errors`);

        res.json({
            success: true,
            totalRecords,
            importedCount,
            errorCount,
            errors: errors.slice(0, 10) // Return first 10 errors
        });
    } catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({ error: 'Server error during bulk upload', details: error.message });
    }
});

// File upload endpoint - processes file on server to avoid browser freezing
router.post('/upload-file', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = req.file;
        const fileExtension = file.originalname.split('.').pop().toLowerCase();
        
        let customersData = [];

        // Parse file based on type
        if (fileExtension === 'csv') {
            // Parse CSV
            const text = file.buffer.toString('utf-8');
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                return res.status(400).json({ error: 'CSV file is empty or invalid' });
            }

            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const normalize = (h) => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

            // Build header index map
            const headerIndexByKey = {
                firstName: -1,
                lastName: -1,
                name: -1,
                email: -1,
                phone: -1,
                address: -1
            };

            headers.forEach((h, idx) => {
                const n = normalize(h);
                if (n === 'name') headerIndexByKey.name = idx;
                if (n === 'email') headerIndexByKey.email = idx;
                if (n === 'phone' || n === 'mobile' || n === 'contact') headerIndexByKey.phone = idx;
                if (n === 'address') headerIndexByKey.address = idx;
                if (n === 'first name' || (n.includes('first') && n.includes('name'))) headerIndexByKey.firstName = idx;
                if (n === 'last name' || (n.includes('last') && n.includes('name'))) headerIndexByKey.lastName = idx;
            });

            // Parse data rows - optimized for large files
            const batchSize = 10000; // Process in chunks to avoid memory issues
            for (let chunkStart = 1; chunkStart < lines.length; chunkStart += batchSize) {
                const chunkEnd = Math.min(chunkStart + batchSize, lines.length);
                
                for (let i = chunkStart; i < chunkEnd; i++) {
                    // Optimized CSV parsing - handle quoted values properly
                    const line = lines[i];
                    if (!line || !line.trim()) continue;
                    
                    // Simple CSV parsing (for better performance, consider using a CSV parser library for complex cases)
                    const values = [];
                    let current = '';
                    let inQuotes = false;
                    
                    for (let j = 0; j < line.length; j++) {
                        const char = line[j];
                        if (char === '"') {
                            inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                            values.push(current.trim());
                            current = '';
                        } else {
                            current += char;
                        }
                    }
                    values.push(current.trim()); // Add last value
                    
                    let firstName = headerIndexByKey.firstName >= 0 ? (values[headerIndexByKey.firstName] || '').trim() : '';
                    let lastName = headerIndexByKey.lastName >= 0 ? (values[headerIndexByKey.lastName] || '').trim() : '';
                    let name = headerIndexByKey.name >= 0 ? (values[headerIndexByKey.name] || '').trim() : '';
                    const email = headerIndexByKey.email >= 0 ? (values[headerIndexByKey.email] || '').trim() : '';
                    const phone = headerIndexByKey.phone >= 0 ? (values[headerIndexByKey.phone] || '').trim() : '';
                    const address = headerIndexByKey.address >= 0 ? (values[headerIndexByKey.address] || '').trim() : '';

                    // If only Name provided, split into first/last
                    if (!firstName && !lastName && name) {
                        const parts = name.split(/\s+/);
                        firstName = parts[0] || '';
                        lastName = parts.slice(1).join(' ') || '';
                    }

                    // Skip empty rows
                    if (!firstName && !lastName && !email && !phone) continue;

                    customersData.push({
                        name: name || `${firstName} ${lastName}`.trim() || 'Unknown',
                        firstName,
                        lastName,
                        email: email || null,
                        phone: phone || null,
                        status: 'pending',
                        assignedTo: null,
                        notes: address || null
                    });
                }
                
                // Log progress for large files
                if (chunkStart % 50000 === 1 && lines.length > 50000) {
                    console.log(`Parsed ${chunkStart} / ${lines.length} CSV lines...`);
                }
            }
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            // Parse Excel
            const workbook = XLSX.read(file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
            
            if (rows.length < 2) {
                return res.status(400).json({ error: 'Excel file is empty or invalid' });
            }

            // Find header row
            let headerRowIndex = 0;
            const isLikelyHeader = (r) => {
                const vals = (r || []).map(v => String(v || '').toLowerCase());
                const joined = vals.join(' ');
                const keywords = ['name', 'email', 'phone', 'address', 'first', 'last'];
                const hits = keywords.filter(k => joined.includes(k)).length;
                const nonEmpty = vals.filter(v => v.trim()).length;
                return hits >= 1 && nonEmpty >= 2;
            };
            
            for (let i = 0; i < Math.min(10, rows.length); i++) {
                if (isLikelyHeader(rows[i])) { 
                    headerRowIndex = i; 
                    break; 
                }
            }

            const headers = (rows[headerRowIndex] || []).map(h => String(h).trim());
            const dataRows = rows.slice(headerRowIndex + 1);
            
            const normalize = (h) => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
            
            // Build header index map
            const headerIndexByKey = {
                firstName: -1,
                lastName: -1,
                name: -1,
                email: -1,
                phone: -1,
                address: -1
            };

            headers.forEach((h, idx) => {
                const n = normalize(h);
                if (n === 'name') headerIndexByKey.name = idx;
                if (n === 'email') headerIndexByKey.email = idx;
                if (n === 'phone' || n === 'mobile' || n === 'contact') headerIndexByKey.phone = idx;
                if (n === 'address') headerIndexByKey.address = idx;
                if (n === 'first name' || (n.includes('first') && n.includes('name'))) headerIndexByKey.firstName = idx;
                if (n === 'last name' || (n.includes('last') && n.includes('name'))) headerIndexByKey.lastName = idx;
            });

            // Parse data rows
            for (const row of dataRows) {
                const values = row || [];
                
                let firstName = headerIndexByKey.firstName >= 0 ? String(values[headerIndexByKey.firstName] || '').trim() : '';
                let lastName = headerIndexByKey.lastName >= 0 ? String(values[headerIndexByKey.lastName] || '').trim() : '';
                let name = headerIndexByKey.name >= 0 ? String(values[headerIndexByKey.name] || '').trim() : '';
                const email = headerIndexByKey.email >= 0 ? String(values[headerIndexByKey.email] || '').trim() : '';
                const phone = headerIndexByKey.phone >= 0 ? String(values[headerIndexByKey.phone] || '').trim() : '';
                const address = headerIndexByKey.address >= 0 ? String(values[headerIndexByKey.address] || '').trim() : '';

                // If only Name provided, split into first/last
                if (!firstName && !lastName && name) {
                    const parts = name.split(/\s+/);
                    firstName = parts[0] || '';
                    lastName = parts.slice(1).join(' ') || '';
                }

                // Skip empty rows
                if (!firstName && !lastName && !email && !phone) continue;

                customersData.push({
                    name: name || `${firstName} ${lastName}`.trim() || 'Unknown',
                    firstName,
                    lastName,
                    email: email || null,
                    phone: phone || null,
                    status: 'pending',
                    assignedTo: null,
                    notes: address || null
                });
            }
        } else {
            return res.status(400).json({ error: 'Unsupported file type. Please upload CSV or Excel file.' });
        }

        if (customersData.length === 0) {
            return res.status(400).json({ error: 'No valid customer data found in file' });
        }

        // Process bulk upload
        const totalRecords = customersData.length;
        let importedCount = 0;
        let errorCount = 0;
        const batchSize = 1000;

        // Process in batches
        for (let i = 0; i < customersData.length; i += batchSize) {
            const batch = customersData.slice(i, i + batchSize);
            
            const values = [];
            const placeholders = [];
            let paramIndex = 1;

            for (const customer of batch) {
                const name = customer.name || 'Unknown';
                const email = customer.email || null;
                const phone = customer.phone || null;
                const status = customer.status || 'pending';
                const assigned_to = customer.assignedTo || null;
                const notes = customer.notes || null;

                placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
                values.push(name, email, phone, status, assigned_to, notes);
            }

            const query = `
                INSERT INTO customers (name, email, phone, status, assigned_to, notes)
                VALUES ${placeholders.join(', ')}
            `;

            try {
                const result = await dbPool.query(query, values);
                importedCount += result.rowCount || 0;
            } catch (batchError) {
                console.error(`Batch ${i / batchSize + 1} error:`, batchError);
                errorCount += batch.length;
            }
        }

        res.json({
            success: true,
            totalRecords,
            importedCount,
            errorCount
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ error: 'Server error processing file' });
    }
});

// Get upload progress (for tracking large uploads)
router.get('/upload-progress/:jobId', async (req, res) => {
    // This can be enhanced with Redis or database to track progress
    // For now, return a simple response
    res.json({ message: 'Progress tracking not implemented yet' });
});

module.exports = router;
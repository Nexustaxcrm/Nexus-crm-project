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

// Configure multer for file uploads - increased for large Excel files (300k-500k rows)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit for large Excel files
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
        const includeArchived = req.query.include_archived === 'true' || req.query.include_archived === '1';
        const archivedOnly = req.query.archived_only === 'true' || req.query.archived_only === '1';
        
        // Build query with filters
        // CRITICAL: By default, exclude archived customers from all queries
        // They should only appear when explicitly requested via include_archived or archived_only
        let query = 'SELECT * FROM customers WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        // Archive filtering - exclude archived by default unless explicitly requested
        if (archivedOnly) {
            // Only show archived customers
            query += ` AND archived = TRUE`;
        } else if (!includeArchived) {
            // Default: exclude archived customers (for Assign Work tab and normal operations)
            query += ` AND (archived IS NULL OR archived = FALSE)`;
        }
        // If includeArchived is true, show all customers (both archived and non-archived)
        
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
        // CRITICAL: Build count query BEFORE adding LIMIT/OFFSET to main query
        // This ensures accurate count of all matching records
        // IMPORTANT: Remove any ORDER BY, LIMIT, OFFSET from count query
        let countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
        // Remove ORDER BY, LIMIT, OFFSET if they exist (they shouldn't at this point, but be safe)
        countQuery = countQuery.split(' ORDER BY')[0].split(' LIMIT')[0].split(' OFFSET')[0];
        const countParams = [...params]; // Copy params before adding limit/offset
        const countResult = await dbPool.query(countQuery, countParams);
        const totalRecords = parseInt(countResult.rows[0].count) || 0;
        const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
        
        // CRITICAL: If totalRecords is 0 but we expect data, log a warning
        if (totalRecords === 0) {
            console.warn('⚠️ WARNING: Count query returned 0 records. This might be correct if all customers are archived, or there might be an issue.');
            console.warn('Count query:', countQuery);
            console.warn('Count params:', countParams);
        }
        
        // Debug logging for total count verification
        console.log('=== CUSTOMERS API COUNT DEBUG ===');
        console.log('Query filters:', {
            includeArchived,
            archivedOnly,
            status,
            assignedTo,
            search
        });
        console.log('Count query:', countQuery);
        console.log('Count params:', countParams);
        console.log('Total records found:', totalRecords);
        console.log('Total pages:', totalPages);
        console.log('Current page:', page);
        console.log('Records per page:', limit);
        
        // Add ordering and pagination to main query (AFTER count query)
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

// Get current customer's own information (for customer role)
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const userId = req.user.userId;
        const userRole = req.user.role;
        
        // Only allow customer role to access this endpoint
        if (userRole !== 'customer') {
            return res.status(403).json({ error: 'Access denied. This endpoint is only for customers.' });
        }
        
        // Find customer by user_id
        const result = await dbPool.query(
            'SELECT * FROM customers WHERE user_id = $1 LIMIT 1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer record not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching customer information:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get statistics for all customers (for dashboard)
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        // Get total count (excluding archived by default)
        const includeArchived = req.query.include_archived === 'true' || req.query.include_archived === '1';
        let countQuery = 'SELECT COUNT(*) FROM customers WHERE 1=1';
        if (!includeArchived) {
            countQuery += ' AND (archived IS NULL OR archived = FALSE)';
        }
        
        const totalResult = await dbPool.query(countQuery);
        const totalCustomers = parseInt(totalResult.rows[0].count);
        
        // Get counts by status (excluding archived)
        const statusQuery = `
            SELECT 
                status,
                COUNT(*) as count
            FROM customers
            WHERE (archived IS NULL OR archived = FALSE)
            GROUP BY status
        `;
        const statusResult = await dbPool.query(statusQuery);
        const statusCounts = {};
        statusResult.rows.forEach(row => {
            statusCounts[row.status] = parseInt(row.count);
        });
        
        // Get counts by call_status (excluding archived)
        // The status field contains both call statuses and other statuses
        // Call statuses: 'called', 'voice_mail', 'not_called'
        // Other statuses: 'w2_received', 'follow_up', 'pending', etc.
        const callStatusQuery = `
            SELECT 
                CASE 
                    WHEN status = 'called' THEN 'called'
                    WHEN status = 'voice_mail' THEN 'voice_mail'
                    WHEN status = 'not_called' THEN 'not_called'
                    WHEN status = 'pending' THEN 'not_called'  -- Treat pending as not_called
                    ELSE NULL
                END as call_status,
                COUNT(*) as count
            FROM customers
            WHERE (archived IS NULL OR archived = FALSE)
            AND (status IN ('called', 'voice_mail', 'not_called', 'pending'))
            GROUP BY 
                CASE 
                    WHEN status = 'called' THEN 'called'
                    WHEN status = 'voice_mail' THEN 'voice_mail'
                    WHEN status = 'not_called' THEN 'not_called'
                    WHEN status = 'pending' THEN 'not_called'
                    ELSE NULL
                END
        `;
        const callStatusResult = await dbPool.query(callStatusQuery);
        const callStatusCounts = {
            called: 0,
            voice_mail: 0,
            not_called: 0
        };
        callStatusResult.rows.forEach(row => {
            if (row.call_status && callStatusCounts.hasOwnProperty(row.call_status)) {
                callStatusCounts[row.call_status] = parseInt(row.count);
            }
        });
        
        // Get archived count
        const archivedResult = await dbPool.query('SELECT COUNT(*) FROM customers WHERE archived = TRUE');
        const archivedCount = parseInt(archivedResult.rows[0].count);
        
        // Get interested count (customers with status 'interested')
        const interestedCount = statusCounts['interested'] || 0;
        
        res.json({
            totalCustomers,
            statusCounts,
            callStatusCounts,
            archivedCount,
            interestedCount,
            w2Received: statusCounts['w2_received'] || 0
        });
    } catch (error) {
        console.error('Error fetching customer statistics:', error);
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
        // CRITICAL: Always set archived = FALSE for new customers (bulk uploads and manual creation)
        // Archived customers should only be created via archive operation, not during upload
        const result = await dbPool.query(
            'INSERT INTO customers (name, email, phone, status, assigned_to, notes, archived) VALUES ($1, $2, $3, $4, $5, $6, FALSE) RETURNING *',
            [name, email, phone, status, assigned_to, notes]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update customer with optimistic locking and action tracking (prevents race conditions)
router.put('/:id', authenticateToken, async (req, res) => {
    const client = await (pool || req.app.locals.pool).connect();
    
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const { id } = req.params;
        const { updated_at } = req.body; // Client sends current updated_at timestamp
        const userId = req.user.userId; // From JWT token
        
        // Start transaction for atomicity (critical for concurrent updates)
        await client.query('BEGIN');
        
        // Get existing customer data for comparison
        const existingResult = await client.query('SELECT * FROM customers WHERE id = $1 FOR UPDATE', [id]);
        
        if (existingResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        const existing = existingResult.rows[0];
        
        // Optimistic locking check
        if (updated_at && existing.updated_at && new Date(existing.updated_at) > new Date(updated_at)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ 
                error: 'Conflict: Customer was modified by another user. Please refresh and try again.',
                code: 'CONCURRENT_UPDATE'
            });
        }
        
        // Handle both formats: name field or firstName/lastName
        let name = req.body.name;
        if (!name && (req.body.firstName || req.body.lastName)) {
            name = `${req.body.firstName || ''} ${req.body.lastName || ''}`.trim() || 'Unknown';
        }
        if (!name) {
            name = existing.name || 'Unknown';
        }
        
        let { email, phone, status, assigned_to, notes, archived } = req.body;
        
        // Track changes for audit trail
        const actions = [];
        
        // Track archive status change (critical for archive/restore functionality)
        const finalArchived = archived !== undefined ? archived : existing.archived;
        if (finalArchived !== existing.archived) {
            actions.push({
                customer_id: parseInt(id),
                user_id: userId,
                action_type: finalArchived ? 'archive' : 'restore',
                old_value: existing.archived ? 'archived' : 'active',
                new_value: finalArchived ? 'archived' : 'active',
                comment: finalArchived ? 'Customer archived' : 'Customer restored from archive'
            });
            
            // When archiving, clear assignment (archived customers shouldn't be assigned)
            // When restoring, keep assignment as is
            if (finalArchived) {
                // Archive: clear assignment, keep status but mark as archived
                assigned_to = null;
            }
        }
        
        // Track status change
        if (status && status !== existing.status) {
            actions.push({
                customer_id: parseInt(id),
                user_id: userId,
                action_type: 'status_change',
                old_value: existing.status,
                new_value: status,
                comment: null
            });
        }
        
        // Track assignment change
        if (assigned_to !== undefined && assigned_to !== existing.assigned_to) {
            actions.push({
                customer_id: parseInt(id),
                user_id: userId,
                action_type: 'assignment',
                old_value: existing.assigned_to ? existing.assigned_to.toString() : null,
                new_value: assigned_to ? assigned_to.toString() : null,
                comment: null
            });
        }
        
        // Track comment/notes change
        if (notes !== undefined && notes !== existing.notes && notes && notes.trim()) {
            actions.push({
                customer_id: parseInt(id),
                user_id: userId,
                action_type: 'comment',
                old_value: null,
                new_value: null,
                comment: notes.trim()
            });
        }
        
        // Update customer - include archived field
        const updateQuery = `
            UPDATE customers 
            SET name=$1, email=$2, phone=$3, status=$4, assigned_to=$5, notes=$6, archived=$7, updated_at=CURRENT_TIMESTAMP 
            WHERE id=$8
            RETURNING *
        `;
        const updateParams = [
            name, 
            email || existing.email, 
            phone || existing.phone, 
            status || existing.status, 
            assigned_to !== undefined ? assigned_to : existing.assigned_to, 
            notes !== undefined ? notes : existing.notes,
            finalArchived,
            id
        ];
        
        const result = await client.query(updateQuery, updateParams);
        
        // Save actions to audit trail (for concurrent tracking)
        if (actions.length > 0) {
            // Insert actions one by one to handle potential table non-existence gracefully
            for (const action of actions) {
                try {
                    await client.query(
                        `INSERT INTO customer_actions (customer_id, user_id, action_type, old_value, new_value, comment) 
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [action.customer_id, action.user_id, action.action_type, action.old_value, action.new_value, action.comment]
                    );
                } catch (actionError) {
                    // If table doesn't exist yet, log but don't fail the update
                    if (actionError.code === '42P01') {
                        console.warn('customer_actions table does not exist yet. Run database migration.');
                    } else {
                        console.error('Error saving action:', actionError);
                    }
                }
            }
        }
        
        // Commit transaction
        await client.query('COMMIT');
        
        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating customer:', error);
        
        if (error.code === '23505') {
            res.status(400).json({ error: 'Duplicate entry' });
        } else if (error.code === '23503') {
            res.status(400).json({ error: 'Invalid reference' });
        } else {
            res.status(500).json({ error: 'Server error' });
        }
    } finally {
        client.release();
    }
});

// Delete ALL customers (ADMIN ONLY - DANGEROUS!)
// CRITICAL: This route MUST come before /:id route to avoid route matching conflicts
router.delete('/all', authenticateToken, async (req, res) => {
    try {
        // CRITICAL: Only allow admin users
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can delete all customers' });
        }

        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }

        console.log('⚠️ WARNING: Admin user deleting ALL customers');
        
        // Delete all customers (this will also cascade delete customer_actions if foreign key is set)
        const result = await dbPool.query('DELETE FROM customers');
        const deletedCount = result.rowCount || 0;
        
        // Also delete customer_actions to clean up audit trail
        try {
            await dbPool.query('DELETE FROM customer_actions');
            console.log('✅ Deleted all customer actions');
        } catch (err) {
            console.warn('⚠️ Could not delete customer_actions:', err.message);
        }
        
        console.log(`✅ Deleted all customers: ${deletedCount} records removed`);
        
        res.json({
            success: true,
            deletedCount: deletedCount,
            message: `Successfully deleted ALL ${deletedCount.toLocaleString()} customer(s)`
        });
    } catch (error) {
        console.error('Error deleting all customers:', error);
        res.status(500).json({ 
            error: 'Server error during deletion',
            details: error.message
        });
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

                // CRITICAL: Include archived = FALSE for all bulk uploads
                placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
                values.push(name, email, phone, status, assigned_to, notes, false); // archived = FALSE
            }

            // Insert customers (removed ON CONFLICT since there's no unique constraint)
            const query = `
                INSERT INTO customers (name, email, phone, status, assigned_to, notes, archived)
                VALUES ${placeholders.join(', ')}
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

// File upload endpoint - optimized for 300k-500k rows with streaming and PostgreSQL COPY
router.post('/upload-file', authenticateToken, upload.single('file'), async (req, res) => {
    const client = await (pool || req.app.locals.pool).connect();
    
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
        const assignedTo = req.body.assigned_to || req.body.assignedTo || null; // Support assignment during upload
        
        // Start transaction for better performance
        await client.query('BEGIN');
        
        // For very large files, we'll process in chunks and use COPY for inserts
        let totalRows = 0;
        let importedCount = 0;
        let errorCount = 0;
        const batchSize = 5000; // Process 5000 rows at a time to avoid memory issues

        // Parse file based on type
        if (fileExtension === 'csv') {
            // Optimized CSV parsing for 300k-500k rows
            console.log('Starting CSV file processing...');
            const text = file.buffer.toString('utf-8');
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'CSV file is empty or invalid' });
            }

            totalRows = lines.length - 1; // Exclude header
            console.log(`Processing ${totalRows} rows from CSV file...`);

            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const normalize = (h) => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

            // Build header index map (including assigned_to support)
            const headerIndexByKey = {
                firstName: -1,
                lastName: -1,
                name: -1,
                email: -1,
                phone: -1,
                address: -1,
                assigned: -1,
                assignedTo: -1,
                assigned_to: -1
            };

            headers.forEach((h, idx) => {
                const n = normalize(h);
                if (n === 'name') headerIndexByKey.name = idx;
                if (n === 'email') headerIndexByKey.email = idx;
                if (n === 'phone' || n === 'mobile' || n === 'contact') headerIndexByKey.phone = idx;
                if (n === 'address') headerIndexByKey.address = idx;
                if (n === 'first name' || (n.includes('first') && n.includes('name'))) headerIndexByKey.firstName = idx;
                if (n === 'last name' || (n.includes('last') && n.includes('name'))) headerIndexByKey.lastName = idx;
                if (n === 'assigned' || n === 'assigned to' || n === 'assigned_to') {
                    headerIndexByKey.assigned = idx;
                    headerIndexByKey.assignedTo = idx;
                    headerIndexByKey.assigned_to = idx;
                }
            });

            // Process data rows in chunks and insert directly (avoids storing all in memory)
            console.log(`Processing ${totalRows} rows in batches of ${batchSize}...`);
            
            for (let chunkStart = 1; chunkStart < lines.length; chunkStart += batchSize) {
                const chunkEnd = Math.min(chunkStart + batchSize, lines.length);
                const batchData = [];
                
                for (let i = chunkStart; i < chunkEnd; i++) {
                    const line = lines[i];
                    if (!line || !line.trim()) continue;
                    
                    // Optimized CSV parsing - handle quoted values properly
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
                    let rowAssignedTo = assignedTo;
                    
                    // Check if assigned_to is in the CSV file
                    if (headerIndexByKey.assigned >= 0 && values[headerIndexByKey.assigned]) {
                        rowAssignedTo = String(values[headerIndexByKey.assigned] || '').trim() || assignedTo;
                    }

                    // If only Name provided, split into first/last
                    if (!firstName && !lastName && name) {
                        const parts = name.split(/\s+/);
                        firstName = parts[0] || '';
                        lastName = parts.slice(1).join(' ') || '';
                    }

                    // Skip empty rows
                    if (!firstName && !lastName && !email && !phone && !name) continue;

                    const finalName = name || `${firstName} ${lastName}`.trim() || 'Unknown';
                    
                    batchData.push({
                        name: finalName,
                        email: email || null,
                        phone: phone || null,
                        status: 'pending',
                        assigned_to: rowAssignedTo,
                        notes: address || null
                    });
                }
                
                // Insert batch directly (don't accumulate in memory)
                if (batchData.length > 0) {
                    try {
                        const placeholders = [];
                        const values = [];
                        let paramIndex = 1;
                        
                        for (const customer of batchData) {
                            // CRITICAL: Include archived = FALSE for all bulk uploads
                            placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
                            values.push(
                                customer.name,
                                customer.email,
                                customer.phone,
                                customer.status,
                                customer.assigned_to,
                                customer.notes,
                                false // archived = FALSE - new uploads should never be archived
                            );
                        }
                        
                        const insertQuery = `
                            INSERT INTO customers (name, email, phone, status, assigned_to, notes, archived)
                            VALUES ${placeholders.join(', ')}
                        `;
                        
                        const result = await client.query(insertQuery, values);
                        importedCount += result.rowCount || 0;
                        
                        // Log if no rows inserted (for debugging)
                        if (result.rowCount === 0 && batchData.length > 0) {
                            console.warn(`Warning: Batch of ${batchData.length} rows resulted in 0 inserts. Check data format.`);
                            console.warn(`Sample row from batch:`, JSON.stringify(batchData[0]));
                        }
                        
                        // Log progress every 50k rows
                        if (chunkStart % 50000 === 0 && chunkStart > 0) {
                            console.log(`Processed ${chunkStart} / ${totalRows} rows (${Math.round((chunkStart / totalRows) * 100)}%) - Imported: ${importedCount}`);
                        }
                    } catch (batchError) {
                        console.error(`Batch ${Math.floor(chunkStart / batchSize) + 1} error:`, batchError.message);
                        errorCount += batchData.length;
                        // Continue with next batch
                    }
                }
            }
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            // Optimized Excel parsing for 300k-500k rows - process in chunks to avoid memory issues
            console.log('Starting Excel file processing...');
            
            // Read workbook with options optimized for large files
            const workbook = XLSX.read(file.buffer, { 
                type: 'buffer',
                cellDates: false,
                cellNF: false,
                cellStyles: false,
                sheetStubs: false
            });
            
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Get range to determine total rows
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
            totalRows = range.e.r + 1; // Total rows including header
            
            if (totalRows < 2) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Excel file is empty or invalid' });
            }

            console.log(`Processing ${totalRows} rows from Excel file...`);

            // Convert to array format (more memory efficient than JSON for large files)
            const rows = XLSX.utils.sheet_to_json(worksheet, { 
                header: 1, 
                defval: '', 
                blankrows: false,
                raw: false // Convert all values to strings
            });
            
            // Find header row - improved detection
            let headerRowIndex = 0;
            let hasHeaderRow = false;
            
            const isLikelyHeader = (r) => {
                const vals = (r || []).map(v => String(v || '').trim());
                const valsLower = vals.map(v => v.toLowerCase());
                const joined = valsLower.join(' ');
                const keywords = ['name', 'email', 'phone', 'address', 'first', 'last', 'assigned', 'column', 'customer'];
                const hits = keywords.filter(k => joined.includes(k)).length;
                const nonEmpty = vals.filter(v => v.trim()).length;
                
                // Header row should have keywords AND not look like data
                // Data indicators: email addresses (@), phone numbers (digits with special chars), actual names (capitalized words)
                const hasEmail = vals.some(v => v.includes('@') && v.includes('.'));
                const hasPhonePattern = vals.some(v => /^\+?[\d\s\-\(\)]{7,}$/.test(v));
                const looksLikeName = vals.some(v => /^[A-Z][a-z]+\s+[A-Z]/.test(v)); // "First Last" pattern
                const looksLikeData = hasEmail || hasPhonePattern || looksLikeName;
                
                // Must have header keywords AND not look like actual data
                return hits >= 1 && nonEmpty >= 2 && !looksLikeData;
            };
            
            for (let i = 0; i < Math.min(10, rows.length); i++) {
                if (isLikelyHeader(rows[i])) { 
                    headerRowIndex = i;
                    hasHeaderRow = true;
                    break; 
                }
            }

            const headers = (rows[headerRowIndex] || []).map(h => String(h).trim());
            const dataRows = hasHeaderRow ? rows.slice(headerRowIndex + 1) : rows; // If no header, use all rows as data
            totalRows = dataRows.length;
            
            console.log(`Found header row at index ${headerRowIndex}:`, headers);
            console.log(`Has header row: ${hasHeaderRow}`);
            console.log(`Total data rows to process: ${totalRows}`);
            
            const normalize = (h) => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
            
            // Build header index map (including assigned_to support)
            const headerIndexByKey = {
                firstName: -1,
                lastName: -1,
                name: -1,
                email: -1,
                phone: -1,
                address: -1,
                assigned: -1,
                assignedTo: -1,
                assigned_to: -1
            };

            // If no header row detected, use positional mapping (common Excel format)
            if (!hasHeaderRow) {
                console.log('No header row detected - using positional mapping (Column 0=Name, Column 1=Email, Column 2=Phone)');
                // Common format: Name, Email, Phone, Address (optional)
                headerIndexByKey.name = 0;
                headerIndexByKey.email = 1;
                headerIndexByKey.phone = 2;
                headerIndexByKey.address = 3; // Optional
            } else {
                // Parse headers normally
                headers.forEach((h, idx) => {
                    const n = normalize(h);
                    if (n === 'name') headerIndexByKey.name = idx;
                    if (n === 'email') headerIndexByKey.email = idx;
                    if (n === 'phone' || n === 'mobile' || n === 'contact') headerIndexByKey.phone = idx;
                    if (n === 'address') headerIndexByKey.address = idx;
                    if (n === 'first name' || (n.includes('first') && n.includes('name'))) headerIndexByKey.firstName = idx;
                    if (n === 'last name' || (n.includes('last') && n.includes('name'))) headerIndexByKey.lastName = idx;
                    if (n === 'assigned' || n === 'assigned to' || n === 'assigned_to') {
                        headerIndexByKey.assigned = idx;
                        headerIndexByKey.assignedTo = idx;
                        headerIndexByKey.assigned_to = idx;
                    }
                });
            }
            
            console.log('Header mapping result:', JSON.stringify(headerIndexByKey));
            
            // Check if we found at least one required field
            if (headerIndexByKey.name === -1 && headerIndexByKey.firstName === -1 && headerIndexByKey.lastName === -1) {
                console.warn('WARNING: No name, firstName, or lastName column found! Using positional mapping.');
                // Fallback to positional if still no mapping
                if (!hasHeaderRow) {
                    headerIndexByKey.name = 0;
                    headerIndexByKey.email = 1;
                    headerIndexByKey.phone = 2;
                }
            }

            // Process rows in chunks and insert using COPY (much faster for bulk inserts)
            console.log(`Processing ${totalRows} rows in batches of ${batchSize}...`);
            
            for (let chunkStart = 0; chunkStart < dataRows.length; chunkStart += batchSize) {
                const chunkEnd = Math.min(chunkStart + batchSize, dataRows.length);
                const chunk = dataRows.slice(chunkStart, chunkEnd);
                
                // Prepare batch data
                const batchData = [];
                
                for (const row of chunk) {
                    const values = row || [];
                    
                    let firstName = headerIndexByKey.firstName >= 0 ? String(values[headerIndexByKey.firstName] || '').trim() : '';
                    let lastName = headerIndexByKey.lastName >= 0 ? String(values[headerIndexByKey.lastName] || '').trim() : '';
                    let name = headerIndexByKey.name >= 0 ? String(values[headerIndexByKey.name] || '').trim() : '';
                    const email = headerIndexByKey.email >= 0 ? String(values[headerIndexByKey.email] || '').trim() : '';
                    const phone = headerIndexByKey.phone >= 0 ? String(values[headerIndexByKey.phone] || '').trim() : '';
                    const address = headerIndexByKey.address >= 0 ? String(values[headerIndexByKey.address] || '').trim() : '';
                    let rowAssignedTo = assignedTo;
                    
                    // Check if assigned_to is in the Excel file
                    if (headerIndexByKey.assigned >= 0 && values[headerIndexByKey.assigned]) {
                        const assignedValue = String(values[headerIndexByKey.assigned] || '').trim();
                        // If it's a username, we'd need to look it up, but for now use the provided value or null
                        rowAssignedTo = assignedValue || assignedTo;
                    }

                    // If only Name provided, split into first/last
                    if (!firstName && !lastName && name) {
                        const parts = name.split(/\s+/);
                        firstName = parts[0] || '';
                        lastName = parts.slice(1).join(' ') || '';
                    }

                    // Skip empty rows
                    if (!firstName && !lastName && !email && !phone && !name) {
                        errorCount++;
                        continue;
                    }

                    const finalName = name || `${firstName} ${lastName}`.trim() || 'Unknown';
                    
                    batchData.push({
                        name: finalName,
                        email: email || null,
                        phone: phone || null,
                        status: 'pending',
                        assigned_to: rowAssignedTo,
                        notes: address || null
                    });
                }
                
                // Log first batch sample for debugging
                if (chunkStart === 0) {
                    console.log('First batch processing:');
                    console.log('  - Headers detected:', headers);
                    console.log('  - Header index map:', JSON.stringify(headerIndexByKey));
                    console.log('  - First data row sample:', JSON.stringify(dataRows[0]));
                    console.log('  - Batch data length:', batchData.length);
                    if (batchData.length > 0) {
                        console.log('  - Sample customer data:', JSON.stringify(batchData[0]));
                    } else {
                        console.warn('  - WARNING: First batch is empty! All rows may be getting skipped.');
                    }
                }
                
                // Insert batch using optimized bulk insert
                if (batchData.length > 0) {
                    try {
                        const placeholders = [];
                        const values = [];
                        let paramIndex = 1;
                        
                        for (const customer of batchData) {
                            // CRITICAL: Include archived = FALSE for all bulk uploads
                            placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
                            values.push(
                                customer.name,
                                customer.email,
                                customer.phone,
                                customer.status,
                                customer.assigned_to,
                                customer.notes,
                                false // archived = FALSE - new uploads should never be archived
                            );
                        }
                        
                        const insertQuery = `
                            INSERT INTO customers (name, email, phone, status, assigned_to, notes, archived)
                            VALUES ${placeholders.join(', ')}
                        `;
                        
                        const result = await client.query(insertQuery, values);
                        importedCount += result.rowCount || 0;
                        
                        // Log if no rows inserted (for debugging)
                        if (result.rowCount === 0 && batchData.length > 0) {
                            console.error(`ERROR: Batch of ${batchData.length} rows resulted in 0 inserts!`);
                            console.error(`Sample row from batch:`, JSON.stringify(batchData[0]));
                            console.error(`Query:`, insertQuery.substring(0, 200) + '...');
                        } else if (result.rowCount > 0) {
                            // Log successful batch
                            if (chunkStart % 50000 === 0 || chunkStart === 0) {
                                console.log(`Batch ${Math.floor(chunkStart / batchSize) + 1}: Inserted ${result.rowCount} rows`);
                            }
                        }
                        
                        // Log progress every 50k rows
                        if (chunkStart % 50000 === 0 && chunkStart > 0) {
                            console.log(`Processed ${chunkStart} / ${totalRows} rows (${Math.round((chunkStart / totalRows) * 100)}%) - Imported: ${importedCount}`);
                        }
                    } catch (batchError) {
                        console.error(`Batch ${Math.floor(chunkStart / batchSize) + 1} error:`, batchError.message);
                        errorCount += batchData.length;
                        // Continue with next batch
                    }
                }
            }
        } else {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Unsupported file type. Please upload CSV or Excel file.' });
        }

        // Commit transaction
        await client.query('COMMIT');
        
        console.log(`Upload completed: ${importedCount} imported, ${errorCount} errors out of ${totalRows} total rows`);
        
        // Additional diagnostic logging
        if (importedCount === 0 && totalRows > 0) {
            console.error('CRITICAL: No customers were imported!');
            console.error('Possible causes:');
            console.error('  1. All rows are empty (no name, email, phone, or address)');
            console.error('  2. Header detection failed - column names don\'t match expected format');
            console.error('  3. Data format issue - check Excel file structure');
            console.error(`  4. ${totalRows - errorCount} rows were processed but skipped as empty`);
        }

        res.json({
            success: true,
            totalRecords: totalRows,
            importedCount,
            errorCount,
            message: importedCount > 0 
                ? `Successfully imported ${importedCount} customers${errorCount > 0 ? ` (${errorCount} errors)` : ''}`
                : `No customers imported. ${errorCount} rows were empty or invalid. Please check your Excel file format.`
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('File upload error:', error);
        res.status(500).json({ 
            error: 'Server error processing file',
            details: error.message 
        });
    } finally {
        client.release();
    }
});

// Get upload progress (for tracking large uploads)
router.get('/upload-progress/:jobId', async (req, res) => {
    // This can be enhanced with Redis or database to track progress
    // For now, return a simple response
    res.json({ message: 'Progress tracking not implemented yet' });
});

module.exports = router;
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

// Configure multer for customer document uploads (disk storage)
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Email transporter for notifications
const createEmailTransporter = () => {
    const emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER || 'nexustaxfiling@gmail.com';
    const emailPassword = process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;
    
    if (!emailPassword) {
        console.warn('⚠️ Email credentials not configured. Email notifications will not be sent.');
        return null;
    }
    
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailUser,
            pass: emailPassword
        }
    });
};

// Helper function to format refund status for display
function formatRefundStatus(status) {
    const statusMap = {
        'in_discussions': 'In Discussions',
        'received_w2': 'Received W2',
        'preparing_quote': 'Preparing Quote',
        'quote_sent': 'Quote Sent to Customer',
        'customer_approved': 'Customer Approved for Filing Taxes',
        'taxes_filed': 'Taxes Filed'
    };
    return statusMap[status] || status;
}

// Send refund status notification to customer
async function sendRefundStatusNotification(customer, newStatus, oldStatus, updatedByRole) {
    try {
        const transporter = createEmailTransporter();
        if (!transporter) {
            console.warn('⚠️ Email transporter not available. Skipping notification.');
            return;
        }
        
        // Get customer email and phone
        const customerEmail = customer.email;
        const customerPhone = customer.phone;
        const customerName = customer.name || 'Valued Customer';
        
        // Format status for display
        const oldStatusDisplay = formatRefundStatus(oldStatus);
        const newStatusDisplay = formatRefundStatus(newStatus);
        
        // Send email notification
        if (customerEmail) {
            try {
                const mailOptions = {
                    from: process.env.EMAIL_USER || 'nexustaxfiling@gmail.com',
                    to: customerEmail,
                    subject: `Tax Refund Status Update - ${newStatusDisplay}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #2dce89;">Tax Refund Status Update</h2>
                            <p>Dear ${customerName},</p>
                            <p>We wanted to inform you that your tax refund status has been updated:</p>
                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p style="margin: 5px 0;"><strong>Previous Status:</strong> ${oldStatusDisplay}</p>
                                <p style="margin: 5px 0;"><strong>Current Status:</strong> <span style="color: #2dce89; font-weight: bold;">${newStatusDisplay}</span></p>
                            </div>
                            <p>You can view your updated status and upload any required documents by logging into your customer dashboard.</p>
                            <p style="text-align: center; margin: 20px 0;">
                                <a href="${process.env.FRONTEND_URL || 'https://nexustaxfiling.com'}/CRM/index.html" 
                                   style="display: inline-block; padding: 12px 24px; background-color: #2dce89; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                    Access Your Dashboard
                                </a>
                            </p>
                            <p>If you have any questions or concerns, please don't hesitate to contact us.</p>
                            <p>Best regards,<br>Nexus Tax Filing Team</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="font-size: 12px; color: #666;">This is an automated notification. Please do not reply to this email.</p>
                        </div>
                    `
                };
                
                await transporter.sendMail(mailOptions);
                console.log(`✅ Refund status notification email sent to ${customerEmail} for customer ${customerName}`);
            } catch (emailError) {
                console.error('❌ Error sending email notification:', emailError);
                throw emailError;
            }
        }
        
        // Send SMS notification (if phone number is available)
        // Note: SMS functionality requires Twilio or similar service
        // Uncomment and configure if you have SMS service set up
        /*
        if (customerPhone) {
            try {
                // TODO: Implement SMS sending using Twilio or similar service
                // const twilio = require('twilio');
                // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                // await client.messages.create({
                //     body: `Your tax refund status has been updated to: ${newStatusDisplay}. Previous status: ${oldStatusDisplay}. Login to your dashboard for details.`,
                //     from: process.env.TWILIO_PHONE_NUMBER,
                //     to: customerPhone
                // });
                console.log(`✅ Refund status SMS sent to ${customerPhone} for customer ${customerName}`);
            } catch (smsError) {
                console.error('❌ Error sending SMS notification:', smsError);
                // Don't throw - email is primary notification method
            }
        }
        */
        
    } catch (error) {
        console.error('❌ Error in sendRefundStatusNotification:', error);
        throw error;
    }
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads', 'customer-documents');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for customer document uploads (store on disk)
const documentUpload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadsDir);
        },
        filename: function (req, file, cb) {
            // Generate unique filename: timestamp-customerId-originalname
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            const name = path.basename(file.originalname, ext);
            cb(null, `${uniqueSuffix}-${name}${ext}`);
        }
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit per document
    fileFilter: function (req, file, cb) {
        // Only allow PDF, JPEG, JPG, PNG
        const allowedTypes = /\.(pdf|jpeg|jpg|png)$/i;
        const ext = path.extname(file.originalname);
        if (allowedTypes.test(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, JPEG, JPG, and PNG files are allowed.'));
        }
    }
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
        console.log('📡 /customers/me endpoint called');
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            console.error('❌ Database pool not available');
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const userId = req.user?.userId;
        const userRole = req.user?.role;
        const username = req.user?.username;
        
        console.log(`📋 User info - ID: ${userId}, Role: ${userRole}, Username: ${username}`);
        
        if (!userId) {
            console.error('❌ No userId in token');
            return res.status(401).json({ error: 'Invalid token: missing user ID' });
        }
        
        // Only allow customer role to access this endpoint
        if (userRole !== 'customer') {
            console.log(`⚠️ Access denied - user role is ${userRole}, not customer`);
            return res.status(403).json({ error: 'Access denied. This endpoint is only for customers.' });
        }
        
        // Find customer by user_id
        console.log(`🔍 Searching for customer with user_id: ${userId}`);
        let result = await dbPool.query(
            'SELECT * FROM customers WHERE user_id = $1 LIMIT 1',
            [userId]
        );
        
        console.log(`📊 Found ${result.rows.length} customer(s) by user_id`);
        
        // If not found by user_id, try to find by username (for existing customers not yet linked)
        if (result.rows.length === 0 && username) {
            console.log(`🔍 Customer not found by user_id, trying fallback search with username: ${username}`);
            
            // Try multiple fallback strategies:
            // 1. Find customers with username in email (common pattern: username@domain.com)
            // 2. Find customers with username in name
            // 3. Find customers with no user_id (unlinked customers) - most recent first
            
            // Strategy 1 & 2: Match username to email or name
            result = await dbPool.query(
                `SELECT * FROM customers 
                 WHERE (LOWER(email) LIKE LOWER($1) 
                    OR LOWER(name) LIKE LOWER($1)
                    OR LOWER(email) LIKE LOWER($2))
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [`%${username}%`, `${username}@%`]
            );
            
            console.log(`📊 Fallback search (email/name match) found ${result.rows.length} customer(s)`);
            
            // Strategy 3: If still not found, find any unlinked customer (for manual linking)
            if (result.rows.length === 0) {
                console.log(`🔍 Trying to find any unlinked customer for manual linking...`);
                // This is a last resort - find customers without user_id
                // We'll link the most recently created one as a fallback
                const unlinkedResult = await dbPool.query(
                    `SELECT * FROM customers 
                     WHERE user_id IS NULL 
                     ORDER BY created_at DESC 
                     LIMIT 5`
                );
                
                if (unlinkedResult.rows.length > 0) {
                    console.log(`📊 Found ${unlinkedResult.rows.length} unlinked customer(s), but cannot auto-link without email/name match`);
                    console.log(`ℹ️ Customer needs to be manually linked via admin panel or SQL`);
                }
            }
            
            // If found, link the customer to the user account
            if (result.rows.length > 0) {
                const customerId = result.rows[0].id;
                console.log(`🔗 Linking customer ID ${customerId} to user ID ${userId}`);
                await dbPool.query(
                    'UPDATE customers SET user_id = $1, updated_at = NOW() WHERE id = $2',
                    [userId, customerId]
                );
                console.log(`✅ Linked customer ID ${customerId} to user ID ${userId}`);
                // Re-fetch the updated customer record
                result = await dbPool.query(
                    'SELECT * FROM customers WHERE id = $1',
                    [customerId]
                );
            }
        }
        
        if (result.rows.length === 0) {
            console.log(`❌ No customer record found for user ID ${userId}`);
            
            // Check if there are any customers at all (for debugging)
            const anyCustomerCheck = await dbPool.query('SELECT COUNT(*) as count FROM customers LIMIT 1');
            console.log(`📊 Total customers in database: ${anyCustomerCheck.rows[0]?.count || 0}`);
            
            return res.status(404).json({ 
                error: 'Customer record not found',
                message: 'Your user account exists but no customer record is linked.',
                details: 'This may happen if you registered before the customer linking feature was added. Please contact support to link your account, or re-register through the website contact form.',
                userId: userId,
                username: username,
                suggestion: 'An administrator can link your account using: UPDATE customers SET user_id = $1 WHERE email = \'YOUR_EMAIL\' OR phone = \'YOUR_PHONE\''
            });
        }
        
        console.log(`✅ Returning customer data for customer ID: ${result.rows[0].id}`);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Error fetching customer information:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Server error', details: error.message });
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
        const userRole = req.user.role; // Get user role from JWT token
        
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
        let statusChanged = false;
        let oldStatus = existing.status;
        let newStatus = status || existing.status;
        
        if (status && status !== existing.status) {
            statusChanged = true;
            actions.push({
                customer_id: parseInt(id),
                user_id: userId,
                action_type: 'status_change',
                old_value: existing.status,
                new_value: status,
                comment: null
            });
        }
        
        // Check if this is a refund status change by admin/preparation
        const refundStatuses = ['in_discussions', 'received_w2', 'preparing_quote', 'quote_sent', 'customer_approved', 'taxes_filed'];
        const isRefundStatusChange = statusChanged && 
                                     (userRole === 'admin' || userRole === 'preparation') &&
                                     (refundStatuses.includes(newStatus) || refundStatuses.includes(oldStatus));
        
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
        
        // Get updated customer data for notification
        const updatedCustomer = result.rows[0];
        
        // Send notification to customer if refund status changed by admin/preparation
        if (isRefundStatusChange) {
            try {
                // Use updated customer data (in case email/phone was also updated)
                await sendRefundStatusNotification(updatedCustomer, newStatus, oldStatus, userRole);
            } catch (notificationError) {
                // Don't fail the update if notification fails
                console.error('⚠️ Failed to send refund status notification:', notificationError);
            }
        }
        
        res.json(updatedCustomer);
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

// Customer document upload endpoint
router.post('/documents/upload', authenticateToken, documentUpload.array('files', 10), async (req, res) => {
    const client = await (pool || req.app.locals.pool).connect();
    
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        
        const userId = req.user.userId;
        const userRole = req.user.role;
        
        // Get customer ID - for customers, get from /me endpoint, for admin/employee, get from body
        let customerId;
        if (userRole === 'customer') {
            // Get customer ID from user_id
            const customerResult = await dbPool.query(
                'SELECT id FROM customers WHERE user_id = $1 LIMIT 1',
                [userId]
            );
            
            if (customerResult.rows.length === 0) {
                return res.status(404).json({ error: 'Customer record not found' });
            }
            customerId = customerResult.rows[0].id;
        } else {
            // Admin/employee can specify customer_id in body
            customerId = req.body.customer_id;
            if (!customerId) {
                return res.status(400).json({ error: 'customer_id is required' });
            }
        }
        
        // Verify customer exists
        const customerCheck = await dbPool.query(
            'SELECT id, name, email FROM customers WHERE id = $1',
            [customerId]
        );
        
        if (customerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        const customer = customerCheck.rows[0];
        
        // Start transaction
        await client.query('BEGIN');
        
        const uploadedDocuments = [];
        
        // Process each uploaded file
        for (const file of req.files) {
            const filePath = file.path;
            const fileName = file.originalname;
            const fileSize = file.size;
            const fileType = file.mimetype;
            
            // Insert document record into database
            const result = await client.query(
                `INSERT INTO customer_documents (customer_id, user_id, file_name, file_path, file_size, file_type)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, file_name, uploaded_at`,
                [customerId, userId, fileName, filePath, fileSize, fileType]
            );
            
            uploadedDocuments.push(result.rows[0]);
        }
        
        // Commit transaction
        await client.query('COMMIT');
        
        // Send email notification
        try {
            const transporter = createEmailTransporter();
            if (transporter) {
                const fileList = uploadedDocuments.map(doc => `- ${doc.file_name}`).join('\n');
                const mailOptions = {
                    from: process.env.EMAIL_USER || 'nexustaxfiling@gmail.com',
                    to: 'nexustaxfiling@gmail.com',
                    subject: `New Document Upload: ${customer.name}`,
                    html: `
                        <h2>Document Upload Notification</h2>
                        <p><strong>Customer:</strong> ${customer.name}</p>
                        <p><strong>Email:</strong> ${customer.email || 'N/A'}</p>
                        <p><strong>Uploaded Documents:</strong></p>
                        <ul>
                            ${uploadedDocuments.map(doc => `<li>${doc.file_name}</li>`).join('')}
                        </ul>
                        <p><strong>Upload Date:</strong> ${new Date().toLocaleString()}</p>
                        <p>Please review the uploaded documents in the CRM system.</p>
                    `
                };
                
                await transporter.sendMail(mailOptions);
                console.log(`✅ Email notification sent for document upload by customer: ${customer.name}`);
            }
        } catch (emailError) {
            console.error('⚠️ Failed to send email notification:', emailError);
            // Don't fail the request if email fails
        }
        
        console.log(`✅ ${uploadedDocuments.length} document(s) uploaded for customer ID ${customerId}`);
        
        res.json({
            success: true,
            message: `${uploadedDocuments.length} document(s) uploaded successfully`,
            documents: uploadedDocuments
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error uploading documents:', error);
        
        // Clean up uploaded files on error
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }
        
        res.status(500).json({ 
            error: 'Server error uploading documents', 
            details: error.message 
        });
    } finally {
        client.release();
    }
});

// Get customer documents endpoint
router.get('/documents/:customerId', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const customerId = parseInt(req.params.customerId);
        const userId = req.user.userId;
        const userRole = req.user.role;
        
        // For customers, verify they can only access their own documents
        if (userRole === 'customer') {
            const customerCheck = await dbPool.query(
                'SELECT id FROM customers WHERE id = $1 AND user_id = $2',
                [customerId, userId]
            );
            
            if (customerCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied. You can only view your own documents.' });
            }
        }
        
        // Get documents for customer
        console.log(`📋 Fetching documents for customer ID: ${customerId}`);
        const result = await dbPool.query(
            `SELECT id, file_name, file_path, file_size, file_type, uploaded_at
             FROM customer_documents
             WHERE customer_id = $1
             ORDER BY uploaded_at DESC`,
            [customerId]
        );
        
        console.log(`📊 Found ${result.rows.length} document(s) for customer ID ${customerId}`);
        if (result.rows.length > 0) {
            console.log(`📄 Document IDs: ${result.rows.map(d => d.id).join(', ')}`);
        }
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('❌ Error fetching documents:', error);
        res.status(500).json({ error: 'Server error fetching documents', details: error.message });
    }
});

// Download customer document endpoint
router.get('/documents/:documentId/download', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const documentId = parseInt(req.params.documentId);
        const userId = req.user.userId;
        const userRole = req.user.role;
        
        console.log(`📄 Download request - Document ID: ${documentId}, User ID: ${userId}, Role: ${userRole}`);
        
        // Get document info
        const docResult = await dbPool.query(
            `SELECT cd.*, c.user_id as customer_user_id, c.id as customer_id
             FROM customer_documents cd
             JOIN customers c ON cd.customer_id = c.id
             WHERE cd.id = $1`,
            [documentId]
        );
        
        console.log(`📊 Document query result: Found ${docResult.rows.length} document(s) with ID ${documentId}`);
        
        if (docResult.rows.length === 0) {
            console.log(`❌ Document ID ${documentId} not found in database`);
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const document = docResult.rows[0];
        console.log(`📄 Document found - ID: ${document.id}, Customer ID: ${document.customer_id}, File: ${document.file_name}, Path: ${document.file_path}`);
        
        // For customers, verify they can only download their own documents
        if (userRole === 'customer' && document.customer_user_id !== userId) {
            console.log(`⚠️ Access denied - Document customer_user_id (${document.customer_user_id}) does not match user ID (${userId})`);
            return res.status(403).json({ error: 'Access denied. You can only download your own documents.' });
        }
        
        // Check if file exists
        console.log(`🔍 Checking if file exists at path: ${document.file_path}`);
        if (!fs.existsSync(document.file_path)) {
            console.log(`❌ File not found on server at path: ${document.file_path}`);
            return res.status(404).json({ error: 'File not found on server' });
        }
        
        console.log(`✅ File exists, sending download for: ${document.file_name}`);
        // Send file
        res.download(document.file_path, document.file_name);
        
    } catch (error) {
        console.error('❌ Error downloading document:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Server error downloading document', details: error.message });
    }
});

// Delete customer document endpoint
router.delete('/documents/:documentId', authenticateToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const documentId = parseInt(req.params.documentId);
        const userId = req.user.userId;
        const userRole = req.user.role;
        
        console.log(`🗑️ Delete request - Document ID: ${documentId}, User ID: ${userId}, Role: ${userRole}`);
        
        // Get document info to verify ownership and get file path
        const docResult = await dbPool.query(
            `SELECT cd.*, c.user_id as customer_user_id, c.id as customer_id
             FROM customer_documents cd
             JOIN customers c ON cd.customer_id = c.id
             WHERE cd.id = $1`,
            [documentId]
        );
        
        console.log(`📊 Document query result: Found ${docResult.rows.length} document(s) with ID ${documentId}`);
        
        if (docResult.rows.length === 0) {
            console.log(`❌ Document ID ${documentId} not found in database`);
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const document = docResult.rows[0];
        console.log(`📄 Document found - ID: ${document.id}, Customer ID: ${document.customer_id}, File: ${document.file_name}`);
        
        // For customers, verify they can only delete their own documents
        if (userRole === 'customer' && document.customer_user_id !== userId) {
            console.log(`⚠️ Access denied - Document customer_user_id (${document.customer_user_id}) does not match user ID (${userId})`);
            return res.status(403).json({ error: 'Access denied. You can only delete your own documents.' });
        }
        
        // Delete file from filesystem if it exists
        if (fs.existsSync(document.file_path)) {
            try {
                fs.unlinkSync(document.file_path);
                console.log(`✅ File deleted from filesystem: ${document.file_path}`);
            } catch (fileError) {
                console.error(`⚠️ Error deleting file from filesystem: ${fileError.message}`);
                // Continue with database deletion even if file deletion fails
            }
        } else {
            console.log(`⚠️ File not found on filesystem: ${document.file_path} (continuing with database deletion)`);
        }
        
        // Delete document record from database
        await dbPool.query('DELETE FROM customer_documents WHERE id = $1', [documentId]);
        console.log(`✅ Document ID ${documentId} deleted from database`);
        
        res.json({ 
            success: true, 
            message: 'Document deleted successfully',
            documentId: documentId
        });
        
    } catch (error) {
        console.error('❌ Error deleting document:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Server error deleting document', details: error.message });
    }
});

// ============================================
// TAX INFORMATION ENDPOINTS
// ============================================

// Save or update tax information
router.post('/tax-info', verifyToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }

        const userId = req.user.userId;
        const { customer_id, tax_year, ...taxData } = req.body;

        // Validate customer_id - customers can only save their own tax info
        if (req.user.role === 'customer') {
            // Get customer record to verify ownership
            const customerCheck = await dbPool.query(
                'SELECT id FROM customers WHERE user_id = $1 AND id = $2',
                [userId, customer_id]
            );
            
            if (customerCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied. You can only update your own tax information.' });
            }
        }

        // Prepare tax data for insertion/update
        const taxInfoData = {
            customer_id: customer_id,
            tax_year: tax_year || '2024',
            ssn_itin: taxData.ssn_itin || null,
            date_of_birth: taxData.date_of_birth || null,
            filing_status: taxData.filing_status || null,
            spouse_name: taxData.spouse_name || null,
            spouse_ssn_itin: taxData.spouse_ssn_itin || null,
            spouse_date_of_birth: taxData.spouse_date_of_birth || null,
            bank_account_number: taxData.bank_account_number || null,
            bank_routing_number: taxData.bank_routing_number || null,
            bank_account_type: taxData.bank_account_type || null,
            rental_income: taxData.rental_income || 0,
            unemployment_compensation: taxData.unemployment_compensation || 0,
            social_security_benefits: taxData.social_security_benefits || 0,
            other_income: taxData.other_income || 0,
            other_income_description: taxData.other_income_description || null,
            standard_deduction: taxData.standard_deduction !== undefined ? taxData.standard_deduction : true,
            health_insurance_coverage: taxData.health_insurance_coverage || null,
            estimated_tax_payments: taxData.estimated_tax_payments || 0,
            prior_year_agi: taxData.prior_year_agi || 0,
            prior_year_tax_return_available: taxData.prior_year_tax_return_available || false,
            w2_income: taxData.w2_income ? JSON.stringify(taxData.w2_income) : null,
            income_1099: taxData.income_1099 ? JSON.stringify(taxData.income_1099) : null,
            dependents: taxData.dependents ? JSON.stringify(taxData.dependents) : null,
            itemized_deductions: taxData.itemized_deductions ? JSON.stringify(taxData.itemized_deductions) : null,
            tax_credits: taxData.tax_credits ? JSON.stringify(taxData.tax_credits) : null,
            self_employment_income: taxData.self_employment_income ? JSON.stringify(taxData.self_employment_income) : null,
            business_expenses: taxData.business_expenses ? JSON.stringify(taxData.business_expenses) : null,
            foreign_accounts: taxData.foreign_accounts || false,
            foreign_account_details: taxData.foreign_account_details || null,
            home_office_deduction: taxData.home_office_deduction || false,
            home_office_details: taxData.home_office_details || null,
            filing_checklist: taxData.filing_checklist ? JSON.stringify(taxData.filing_checklist) : null
        };

        // Use UPSERT (INSERT ... ON CONFLICT UPDATE)
        const result = await dbPool.query(`
            INSERT INTO customer_tax_info (
                customer_id, tax_year, ssn_itin, date_of_birth, filing_status,
                spouse_name, spouse_ssn_itin, spouse_date_of_birth,
                bank_account_number, bank_routing_number, bank_account_type,
                rental_income, unemployment_compensation, social_security_benefits,
                other_income, other_income_description, standard_deduction,
                health_insurance_coverage, estimated_tax_payments, prior_year_agi,
                prior_year_tax_return_available, w2_income, income_1099, dependents,
                itemized_deductions, tax_credits, self_employment_income,
                business_expenses, foreign_accounts, foreign_account_details,
                home_office_deduction, home_office_details, filing_checklist,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, CURRENT_TIMESTAMP
            )
            ON CONFLICT (customer_id, tax_year) 
            DO UPDATE SET
                ssn_itin = EXCLUDED.ssn_itin,
                date_of_birth = EXCLUDED.date_of_birth,
                filing_status = EXCLUDED.filing_status,
                spouse_name = EXCLUDED.spouse_name,
                spouse_ssn_itin = EXCLUDED.spouse_ssn_itin,
                spouse_date_of_birth = EXCLUDED.spouse_date_of_birth,
                bank_account_number = EXCLUDED.bank_account_number,
                bank_routing_number = EXCLUDED.bank_routing_number,
                bank_account_type = EXCLUDED.bank_account_type,
                rental_income = EXCLUDED.rental_income,
                unemployment_compensation = EXCLUDED.unemployment_compensation,
                social_security_benefits = EXCLUDED.social_security_benefits,
                other_income = EXCLUDED.other_income,
                other_income_description = EXCLUDED.other_income_description,
                standard_deduction = EXCLUDED.standard_deduction,
                health_insurance_coverage = EXCLUDED.health_insurance_coverage,
                estimated_tax_payments = EXCLUDED.estimated_tax_payments,
                prior_year_agi = EXCLUDED.prior_year_agi,
                prior_year_tax_return_available = EXCLUDED.prior_year_tax_return_available,
                w2_income = EXCLUDED.w2_income,
                income_1099 = EXCLUDED.income_1099,
                dependents = EXCLUDED.dependents,
                itemized_deductions = EXCLUDED.itemized_deductions,
                tax_credits = EXCLUDED.tax_credits,
                self_employment_income = EXCLUDED.self_employment_income,
                business_expenses = EXCLUDED.business_expenses,
                foreign_accounts = EXCLUDED.foreign_accounts,
                foreign_account_details = EXCLUDED.foreign_account_details,
                home_office_deduction = EXCLUDED.home_office_deduction,
                home_office_details = EXCLUDED.home_office_details,
                filing_checklist = EXCLUDED.filing_checklist,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            taxInfoData.customer_id, taxInfoData.tax_year, taxInfoData.ssn_itin, taxInfoData.date_of_birth,
            taxInfoData.filing_status, taxInfoData.spouse_name, taxInfoData.spouse_ssn_itin,
            taxInfoData.spouse_date_of_birth, taxInfoData.bank_account_number, taxInfoData.bank_routing_number,
            taxInfoData.bank_account_type, taxInfoData.rental_income, taxInfoData.unemployment_compensation,
            taxInfoData.social_security_benefits, taxInfoData.other_income, taxInfoData.other_income_description,
            taxInfoData.standard_deduction, taxInfoData.health_insurance_coverage, taxInfoData.estimated_tax_payments,
            taxInfoData.prior_year_agi, taxInfoData.prior_year_tax_return_available, taxInfoData.w2_income,
            taxInfoData.income_1099, taxInfoData.dependents, taxInfoData.itemized_deductions,
            taxInfoData.tax_credits, taxInfoData.self_employment_income, taxInfoData.business_expenses,
            taxInfoData.foreign_accounts, taxInfoData.foreign_account_details, taxInfoData.home_office_deduction,
            taxInfoData.home_office_details, taxInfoData.filing_checklist
        ]);

        // Parse JSON fields for response
        const taxInfo = result.rows[0];
        if (taxInfo.w2_income) taxInfo.w2_income = JSON.parse(taxInfo.w2_income);
        if (taxInfo.income_1099) taxInfo.income_1099 = JSON.parse(taxInfo.income_1099);
        if (taxInfo.dependents) taxInfo.dependents = JSON.parse(taxInfo.dependents);
        if (taxInfo.itemized_deductions) taxInfo.itemized_deductions = JSON.parse(taxInfo.itemized_deductions);
        if (taxInfo.tax_credits) taxInfo.tax_credits = JSON.parse(taxInfo.tax_credits);
        if (taxInfo.self_employment_income) taxInfo.self_employment_income = JSON.parse(taxInfo.self_employment_income);
        if (taxInfo.business_expenses) taxInfo.business_expenses = JSON.parse(taxInfo.business_expenses);
        if (taxInfo.filing_checklist) taxInfo.filing_checklist = JSON.parse(taxInfo.filing_checklist);

        console.log(`✅ Tax information saved for customer ID: ${customer_id}, tax year: ${tax_year}`);
        res.json({ success: true, message: 'Tax information saved successfully', tax_info: taxInfo });
    } catch (error) {
        console.error('❌ Error saving tax information:', error);
        res.status(500).json({ error: 'Server error saving tax information', details: error.message });
    }
});

// Get tax information
router.get('/tax-info/:customerId', verifyToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }

        const userId = req.user.userId;
        const customerId = parseInt(req.params.customerId);
        const taxYear = req.query.tax_year || '2024';

        // Validate access - customers can only view their own tax info
        if (req.user.role === 'customer') {
            const customerCheck = await dbPool.query(
                'SELECT id FROM customers WHERE user_id = $1 AND id = $2',
                [userId, customerId]
            );
            
            if (customerCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied. You can only view your own tax information.' });
            }
        }

        const result = await dbPool.query(
            'SELECT * FROM customer_tax_info WHERE customer_id = $1 AND tax_year = $2',
            [customerId, taxYear]
        );

        if (result.rows.length === 0) {
            return res.json(null); // Return null if no tax info found
        }

        // Parse JSON fields
        const taxInfo = result.rows[0];
        if (taxInfo.w2_income) taxInfo.w2_income = JSON.parse(taxInfo.w2_income);
        if (taxInfo.income_1099) taxInfo.income_1099 = JSON.parse(taxInfo.income_1099);
        if (taxInfo.dependents) taxInfo.dependents = JSON.parse(taxInfo.dependents);
        if (taxInfo.itemized_deductions) taxInfo.itemized_deductions = JSON.parse(taxInfo.itemized_deductions);
        if (taxInfo.tax_credits) taxInfo.tax_credits = JSON.parse(taxInfo.tax_credits);
        if (taxInfo.self_employment_income) taxInfo.self_employment_income = JSON.parse(taxInfo.self_employment_income);
        if (taxInfo.business_expenses) taxInfo.business_expenses = JSON.parse(taxInfo.business_expenses);
        if (taxInfo.filing_checklist) taxInfo.filing_checklist = JSON.parse(taxInfo.filing_checklist);

        res.json(taxInfo);
    } catch (error) {
        console.error('❌ Error fetching tax information:', error);
        res.status(500).json({ error: 'Server error fetching tax information', details: error.message });
    }
});

module.exports = router;
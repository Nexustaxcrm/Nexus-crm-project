const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const router = express.Router();
require('dotenv').config();

// In-memory OTP storage (for production, consider using Redis or database)
const otpStore = new Map(); // key: username, value: { otp, expiresAt, attempts }

// OTP expiration time (10 minutes)
const OTP_EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

// Create email transporter
const createEmailTransporter = () => {
    const emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER || 'nexustaxfiling@gmail.com';
    const emailPassword = process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;
    
    if (!emailPassword) {
        console.warn('⚠️ Email credentials not configured. OTP emails will not be sent.');
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

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Clean expired OTPs periodically
setInterval(() => {
    const now = Date.now();
    for (const [username, data] of otpStore.entries()) {
        if (data.expiresAt < now) {
            otpStore.delete(username);
        }
    }
}, 60000); // Clean every minute

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

// Note: Removed validateLogin middleware as we now handle validation directly in the login endpoint
// to support both password and OTP login methods

// Send OTP endpoint
router.post('/send-otp', async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const { username } = req.body;
        
        if (!username || typeof username !== 'string' || username.trim().length === 0) {
            return res.status(400).json({ error: 'Username/Email is required' });
        }
        
        const usernameLower = username.toLowerCase().trim();
        
        // Find user by username or customer email
        // First try to find by username
        let userResult = await dbPool.query(
            `SELECT u.id, u.username, c.email as customer_email 
             FROM users u 
             LEFT JOIN customers c ON u.id = c.user_id 
             WHERE LOWER(u.username) = $1 
             LIMIT 1`,
            [usernameLower]
        );
        
        // If not found by username, try to find by customer email
        if (userResult.rows.length === 0) {
            userResult = await dbPool.query(
                `SELECT u.id, u.username, c.email as customer_email 
                 FROM users u 
                 INNER JOIN customers c ON u.id = c.user_id 
                 WHERE LOWER(c.email) = $1 
                 LIMIT 1`,
                [usernameLower]
            );
        }
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found. Please check your username or email address.' });
        }
        
        const user = userResult.rows[0];
        const userEmail = user.customer_email;
        const actualUsername = user.username.toLowerCase();
        
        if (!userEmail) {
            return res.status(400).json({ error: 'No email address found for this user. Please contact support.' });
        }
        
        // Generate OTP
        const otp = generateOTP();
        const expiresAt = Date.now() + OTP_EXPIRY_TIME;
        
        // Store OTP with both the input value (username/email) and the actual username
        // This allows login with either username or email
        const otpData = {
            otp,
            expiresAt,
            attempts: 0,
            username: actualUsername
        };
        
        otpStore.set(usernameLower, otpData);
        // Also store with actual username if different from input
        if (usernameLower !== actualUsername) {
            otpStore.set(actualUsername, otpData);
        }
        
        // If input was an email, also store with email for lookup
        if (userEmail && usernameLower === userEmail.toLowerCase()) {
            otpStore.set(userEmail.toLowerCase(), otpData);
        }
        
        // Send OTP email
        const transporter = createEmailTransporter();
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER || 'nexustaxfiling@gmail.com',
                    to: userEmail,
                    subject: 'Your Login OTP - Nexus Tax Filing',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background-color: #063232; color: #ffffff; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                                <h1 style="margin: 0; font-size: 28px;">Your Login OTP</h1>
                            </div>
                            <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 5px 5px;">
                                <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                                    Hello,
                                </p>
                                <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                                    Your One-Time Password (OTP) for logging into Nexus Tax Filing CRM is:
                                </p>
                                <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
                                    <h2 style="margin: 0; font-size: 32px; color: #063232; letter-spacing: 5px;">${otp}</h2>
                                </div>
                                <p style="font-size: 14px; line-height: 1.6; color: #666666; margin: 20px 0 0 0;">
                                    This OTP is valid for 10 minutes. Please do not share this code with anyone.
                                </p>
                                <p style="font-size: 14px; line-height: 1.6; color: #666666; margin: 10px 0 0 0;">
                                    If you did not request this OTP, please ignore this email.
                                </p>
                            </div>
                        </div>
                    `
                });
                console.log(`✅ OTP sent to ${userEmail} for user: ${usernameLower}`);
            } catch (emailError) {
                console.error('❌ Error sending OTP email:', emailError);
                otpStore.delete(usernameLower);
                return res.status(500).json({ error: 'Failed to send OTP email. Please try again later.' });
            }
        } else {
            // For development/testing without email configured
            console.log(`📧 OTP for ${usernameLower}: ${otp} (Email not configured)`);
        }
        
        res.json({ 
            message: 'OTP sent successfully to your email address',
            // In development, return OTP for testing (remove in production)
            ...(process.env.NODE_ENV !== 'production' && { otp })
        });
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login endpoint (supports both password and OTP)
router.post('/login', async (req, res) => {
    try {
        // Get pool from request app (fallback if not initialized)
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const { username, password, otp } = req.body;
        
        // Validate username
        if (!username || typeof username !== 'string' || username.trim().length === 0) {
            return res.status(400).json({ error: 'Username/Email is required' });
        }
        
        const usernameLower = username.toLowerCase().trim();
        
        // Determine login method (check for non-empty values)
        const isOTPLogin = otp !== undefined && otp !== null && otp.toString().trim().length > 0;
        const isPasswordLogin = password !== undefined && password !== null && password.toString().trim().length > 0;
        
        if (!isOTPLogin && !isPasswordLogin) {
            return res.status(400).json({ error: 'Either password or OTP is required' });
        }
        
        if (isOTPLogin && isPasswordLogin) {
            return res.status(400).json({ error: 'Please use either password or OTP, not both' });
        }
        
        // Find user in database (case-insensitive username or customer email comparison)
        console.log(`🔍 Searching for user with username/email: ${usernameLower}`);
        // First try to find by username
        let result = await dbPool.query(
            `SELECT u.*, c.email as customer_email 
             FROM users u 
             LEFT JOIN customers c ON u.id = c.user_id 
             WHERE LOWER(u.username) = $1 
             AND u.locked = FALSE 
             LIMIT 1`,
            [usernameLower]
        );
        
        // If not found by username, try to find by customer email
        if (result.rows.length === 0) {
            result = await dbPool.query(
                `SELECT u.*, c.email as customer_email 
                 FROM users u 
                 INNER JOIN customers c ON u.id = c.user_id 
                 WHERE LOWER(c.email) = $1 
                 AND u.locked = FALSE 
                 LIMIT 1`,
                [usernameLower]
            );
        }
        
        // Ensure temp_password column exists (for existing databases)
        if (result.rows.length > 0 && result.rows[0].temp_password === undefined) {
            // If column doesn't exist, default to false
            result.rows[0].temp_password = false;
        }
        
        console.log(`📊 Found ${result.rows.length} user(s) with username/email: ${usernameLower}`);
        
        if (result.rows.length === 0) {
            console.log(`❌ User not found or account is locked: ${usernameLower}`);
            return res.status(401).json({ error: 'Invalid username/email or password' });
        }
        
        const user = result.rows[0];
        
        let isValid = false;
        
        // Handle OTP login
        if (isOTPLogin) {
            // Try to get OTP data using the input value
            let otpData = otpStore.get(usernameLower);
            
            // If not found, try with the actual username from database
            if (!otpData) {
                const actualUsername = user.username.toLowerCase();
                otpData = otpStore.get(actualUsername);
            }
            
            // If still not found, try with customer email
            if (!otpData && user.customer_email) {
                otpData = otpStore.get(user.customer_email.toLowerCase());
            }
            
            if (!otpData) {
                console.log(`❌ OTP not found for: ${usernameLower}, tried: ${user.username.toLowerCase()}, ${user.customer_email ? user.customer_email.toLowerCase() : 'N/A'}`);
                return res.status(401).json({ error: 'OTP not found or expired. Please request a new OTP.' });
            }
            
            if (otpData.expiresAt < Date.now()) {
                // Clean up all possible keys
                otpStore.delete(usernameLower);
                otpStore.delete(user.username.toLowerCase());
                if (user.customer_email) {
                    otpStore.delete(user.customer_email.toLowerCase());
                }
                return res.status(401).json({ error: 'OTP has expired. Please request a new OTP.' });
            }
            
            if (otpData.attempts >= 5) {
                // Clean up all possible keys
                otpStore.delete(usernameLower);
                otpStore.delete(user.username.toLowerCase());
                if (user.customer_email) {
                    otpStore.delete(user.customer_email.toLowerCase());
                }
                return res.status(401).json({ error: 'Too many failed attempts. Please request a new OTP.' });
            }
            
            if (otpData.otp !== otp) {
                otpData.attempts++;
                console.log(`❌ Invalid OTP attempt for user: ${usernameLower}, attempts: ${otpData.attempts}`);
                return res.status(401).json({ error: 'Invalid OTP' });
            }
            
            // OTP is valid - clean up all possible keys
            otpStore.delete(usernameLower);
            otpStore.delete(user.username.toLowerCase());
            if (user.customer_email) {
                otpStore.delete(user.customer_email.toLowerCase());
            }
            isValid = true;
            console.log(`✅ OTP validated successfully for user: ${usernameLower}, role: ${user.role}`);
        }
        
        // Handle password login
        if (isPasswordLogin) {
            console.log(`🔐 Password login attempt for user: ${usernameLower}, role: ${user.role}`);
            console.log(`🔐 Password provided: ${password ? 'Yes (length: ' + password.length + ')' : 'No'}`);
            console.log(`🔐 Stored password hash: ${user.password ? 'Yes (starts with: ' + user.password.substring(0, 4) + ')' : 'No'}`);
            
            // Check if password is hashed (starts with $2a$ or $2b$) or plain text (legacy)
            if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
                // Hashed password - use bcrypt
                console.log(`🔐 Comparing password using bcrypt...`);
                isValid = await bcrypt.compare(password, user.password);
                console.log(`🔐 Password comparison result: ${isValid ? 'VALID' : 'INVALID'}`);
            } else {
                // Plain text password (legacy) - hash it and update the database
                console.log(`🔐 Comparing password as plain text (legacy)...`);
                isValid = (password === user.password);
                console.log(`🔐 Password comparison result: ${isValid ? 'VALID' : 'INVALID'}`);
                if (isValid) {
                    // Hash the password and update it in database
                    console.log(`🔐 Hashing and updating password in database...`);
                    const hashedPassword = await bcrypt.hash(password, 10);
                    await dbPool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
                    console.log(`✅ Password hashed and updated in database`);
                }
            }
            
            if (!isValid) {
                console.log(`❌ Password validation failed for user: ${usernameLower}`);
                return res.status(401).json({ error: 'Invalid username/email or password' });
            }
            
            console.log(`✅ Password validated successfully for user: ${usernameLower}, role: ${user.role}`);
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
        
        // Check if user has temporary password
        const hasTempPassword = user.temp_password === true;
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                tempPassword: hasTempPassword // Include flag to indicate temp password
            },
            requiresPasswordChange: hasTempPassword // Flag for frontend to show password change
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Change password endpoint (for customers with temporary passwords)
router.post('/change-password', verifyToken, async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }

        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.user.userId;

        // Validate inputs
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ error: 'All password fields are required' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'New password and confirm password do not match' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }

        // Get user from database
        const userResult = await dbPool.query(
            'SELECT id, username, password, temp_password FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear temp_password flag
        await dbPool.query(
            'UPDATE users SET password = $1, temp_password = FALSE, updated_at = NOW() WHERE id = $2',
            [hashedNewPassword, userId]
        );

        console.log(`✅ Password changed for user ID: ${userId}, username: ${user.username}`);

        res.json({
            success: true,
            message: 'Password changed successfully. Please log in again with your new password.'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Diagnostic endpoint to check user account status (for troubleshooting)
router.get('/diagnose/:username', async (req, res) => {
    try {
        const dbPool = pool || req.app.locals.pool;
        if (!dbPool) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        const username = req.params.username.toLowerCase().trim();
        
        // Check if user exists
        const userResult = await dbPool.query(
            'SELECT id, username, role, locked, created_at FROM users WHERE LOWER(username) = $1',
            [username]
        );
        
        const diagnostics = {
            username: username,
            userExists: userResult.rows.length > 0,
            userInfo: userResult.rows.length > 0 ? {
                id: userResult.rows[0].id,
                username: userResult.rows[0].username,
                role: userResult.rows[0].role,
                locked: userResult.rows[0].locked,
                created_at: userResult.rows[0].created_at
            } : null
        };
        
        // If user exists, check customer record
        if (userResult.rows.length > 0) {
            const userId = userResult.rows[0].id;
            const customerResult = await dbPool.query(
                'SELECT id, name, email, phone, user_id FROM customers WHERE user_id = $1',
                [userId]
            );
            
            diagnostics.customerRecord = {
                exists: customerResult.rows.length > 0,
                linked: customerResult.rows.length > 0,
                customerInfo: customerResult.rows.length > 0 ? customerResult.rows[0] : null
            };
            
            // Also check for unlinked customers that might match
            if (customerResult.rows.length === 0) {
                const unlinkedResult = await dbPool.query(
                    `SELECT id, name, email, phone, user_id 
                     FROM customers 
                     WHERE (LOWER(email) LIKE $1 OR LOWER(name) LIKE $1)
                     AND user_id IS NULL
                     LIMIT 5`,
                    [`%${username}%`]
                );
                diagnostics.potentialMatches = unlinkedResult.rows;
            }
        }
        
        res.json(diagnostics);
    } catch (error) {
        console.error('Diagnostic error:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

module.exports = router;
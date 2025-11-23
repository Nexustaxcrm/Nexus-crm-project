const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

// Get shared pool from app.locals (set in server.js)
let pool = null;

// Initialize pool from app (called from server.js)
router.init = function(app) {
    pool = app.locals.pool;
    if (pool) {
        console.log('✅ Contact route initialized with database pool');
    } else {
        console.error('❌ Contact route initialized but pool is null!');
    }
};

// Create reusable transporter object using Gmail SMTP
const createTransporter = () => {
    const emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER || 'nexustaxfiling@gmail.com';
    const emailPassword = process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;
    
    // Check if credentials are provided
    if (!emailPassword) {
        throw new Error('Email credentials not configured. Please set EMAIL_PASSWORD or GMAIL_APP_PASSWORD in Railway environment variables.');
    }
    
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailUser,
            pass: emailPassword
        }
    });
};

// Contact form submission endpoint
router.post('/', async (req, res) => {
    console.log('📧 Contact form submission received');
    console.log('Request method:', req.method);
    console.log('Request path:', req.path);
    console.log('Request body:', req.body);
    console.log('Request headers:', {
        'content-type': req.headers['content-type'],
        'origin': req.headers['origin'],
        'user-agent': req.headers['user-agent']
    });
    try {
        const { fullname, phone, email, username, password, description } = req.body;
        console.log('Parsed form data:', { fullname, phone, email, username: username ? 'provided' : 'missing', password: password ? 'provided' : 'missing', description: description ? 'provided' : 'empty' });

        // Validate required fields
        if (!fullname || !phone || !email || !username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name, Phone, Email, Username, and Password are required fields.' 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please enter a valid email address.' 
            });
        }

        // Validate username (alphanumeric and underscore, 3-30 characters)
        const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username must be 3-30 characters and contain only letters, numbers, and underscores.' 
            });
        }

        // Validate password (minimum 6 characters)
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be at least 6 characters long.' 
            });
        }

        // Create user account for customer login (do this first to fail early if username exists)
        let userId = null;
        try {
            const dbPool = pool || req.app.locals.pool;
            
            if (!dbPool) {
                console.error('❌ Database pool not available in contact route');
                return res.status(500).json({ 
                    success: false, 
                    message: 'Database service is not available. Please try again later.' 
                });
            }
            
            console.log('✅ Database pool available, creating user account...');
            
            // Check if username already exists (case-insensitive)
            const usernameLower = username.toLowerCase().trim();
            const existingUser = await dbPool.query(
                'SELECT id FROM users WHERE LOWER(username) = $1',
                [usernameLower]
            );
            
            if (existingUser.rows.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Username already exists. Please choose a different username.' 
                });
            }
            
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Create user account with 'customer' role
            const userResult = await dbPool.query(
                'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
                [username.trim(), hashedPassword, 'customer']
            );
            
            userId = userResult.rows[0].id;
            console.log(`✅ User account created for customer: ${username} (ID: ${userId})`);
        } catch (userError) {
            console.error('❌ Error creating user account:', userError);
            // Check if it's a duplicate username error
            if (userError.code === '23505') {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Username already exists. Please choose a different username.' 
                });
            }
            // For other database errors, return error
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to create user account. Please try again later.' 
            });
        }

        // Create transporter (check credentials first)
        let transporter;
        try {
            transporter = createTransporter();
        } catch (error) {
            console.error('Email configuration error:', error.message);
            // If email fails but user was created, we should still succeed
            // But log the error
            console.error('⚠️ Email service not configured, but user account was created');
        }

        // Email content
        const mailOptions = {
            from: process.env.EMAIL_USER || 'nexustaxfiling@gmail.com',
            to: 'nexustaxfiling@gmail.com',
            subject: `New Contact Form Submission from ${fullname}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #063232; border-bottom: 2px solid #063232; padding-bottom: 10px;">
                        New Contact Form Submission
                    </h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-top: 20px;">
                        <p style="margin: 10px 0;"><strong style="color: #063232;">Name:</strong> ${fullname}</p>
                        <p style="margin: 10px 0;"><strong style="color: #063232;">Phone:</strong> ${phone}</p>
                        <p style="margin: 10px 0;"><strong style="color: #063232;">Email:</strong> <a href="mailto:${email}">${email}</a></p>
                        ${description ? `<p style="margin: 10px 0;"><strong style="color: #063232;">Description:</strong></p>
                        <p style="margin: 10px 0; padding: 10px; background-color: #ffffff; border-left: 3px solid #063232;">${description.replace(/\n/g, '<br>')}</p>` : ''}
                    </div>
                    <p style="margin-top: 20px; color: #666; font-size: 12px;">
                        This email was sent from the Nexus Tax Filing website contact form.
                    </p>
                </div>
            `,
            text: `
New Contact Form Submission

Name: ${fullname}
Phone: ${phone}
Email: ${email}
${description ? `Description: ${description}` : ''}

---
This email was sent from the Nexus Tax Filing website contact form.
            `
        };

        // Send email to company (only if transporter is available)
        if (transporter) {
            try {
                console.log('📨 Sending email to nexustaxfiling@gmail.com...');
                await transporter.sendMail(mailOptions);
                console.log('✅ Email sent successfully to company');
            } catch (emailError) {
                console.error('⚠️ Error sending email to company:', emailError);
                // Continue - user account was created successfully
            }
        }

        // Send thank you email to customer (only if transporter is available)
        if (transporter) {
            try {
            const thankYouMailOptions = {
                from: process.env.EMAIL_USER || 'nexustaxfiling@gmail.com',
                to: email,
                subject: 'Thank You for Registering with Nexus Tax Filing',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background-color: #063232; color: #ffffff; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                            <h1 style="margin: 0; font-size: 28px;">Thank You for Registering!</h1>
                        </div>
                        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 5px 5px;">
                            <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                                Dear ${fullname},
                            </p>
                            <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                                Thank you for registering with <strong>Nexus Tax Filing</strong>! We appreciate your interest in our tax filing services.
                            </p>
                            <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                                Our team has received your registration and will reach out to you soon to discuss how we can help you with your tax filing needs.
                            </p>
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #063232;">
                                <p style="margin: 0 0 15px 0; font-size: 16px; color: #063232; font-weight: bold;">
                                    🔐 Your Customer Dashboard Access
                                </p>
                                <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;">
                                    <strong>Username:</strong> ${username}<br>
                                    <strong>Password:</strong> [The password you created]
                                </p>
                                <p style="margin: 10px 0 0 0; font-size: 14px; color: #666666;">
                                    You can now login to your customer dashboard at: <a href="${process.env.FRONTEND_URL || 'https://nexustaxfiling.com'}/crm" style="color: #063232; text-decoration: underline;">${process.env.FRONTEND_URL || 'https://nexustaxfiling.com'}/crm</a>
                                </p>
                            </div>
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <p style="margin: 0; font-size: 14px; color: #666666;">
                                    <strong>What's Next?</strong><br>
                                    Our certified tax professionals will review your information and contact you within 1-2 business days to schedule a consultation.
                                </p>
                            </div>
                            <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 20px 0 0 0;">
                                If you have any immediate questions, please feel free to contact us at:
                            </p>
                            <p style="font-size: 14px; color: #063232; margin: 10px 0;">
                                <strong>Email:</strong> <a href="mailto:info@nexustaxfiling.com" style="color: #063232;">info@nexustaxfiling.com</a><br>
                                <strong>Phone:</strong> (123) 456-7890
                            </p>
                            <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 30px 0 0 0;">
                                Best regards,<br>
                                <strong style="color: #063232;">The Nexus Tax Filing Team</strong>
                            </p>
                        </div>
                        <div style="text-align: center; margin-top: 20px; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
                            <p style="font-size: 12px; color: #666666; margin: 0;">
                                This is an automated email. Please do not reply directly to this message.
                            </p>
                        </div>
                    </div>
                `,
                text: `
Thank You for Registering with Nexus Tax Filing!

Dear ${fullname},

Thank you for registering with Nexus Tax Filing! We appreciate your interest in our tax filing services.

Our team has received your registration and will reach out to you soon to discuss how we can help you with your tax filing needs.

Your Customer Dashboard Access
Username: ${username}
Password: [The password you created]

You can now login to your customer dashboard at: ${process.env.FRONTEND_URL || 'https://nexustaxfiling.com'}/crm

What's Next?
Our certified tax professionals will review your information and contact you within 1-2 business days to schedule a consultation.

If you have any immediate questions, please feel free to contact us at:
Email: info@nexustaxfiling.com
Phone: (123) 456-7890

Best regards,
The Nexus Tax Filing Team

---
This is an automated email. Please do not reply directly to this message.
                `
            };

            console.log('📨 Sending thank you email to customer:', email);
            await transporter.sendMail(thankYouMailOptions);
            console.log('✅ Thank you email sent successfully to customer');
        } catch (thankYouError) {
            // Log error but don't fail the entire request if thank you email fails
            console.error('⚠️ Error sending thank you email to customer:', thankYouError);
            console.error('Customer email was:', email);
            // Continue - the main email was sent successfully
        }

        // Automatically create customer in CRM with "interested" status
        try {
            const dbPool = pool || req.app.locals.pool;
            
            if (!dbPool) {
                console.error('❌ Database pool not available in contact route');
                console.error('Pool from module:', pool ? 'exists' : 'null');
                console.error('Pool from app.locals:', req.app.locals.pool ? 'exists' : 'null');
            } else {
                console.log('✅ Database pool available, creating customer...');
                
                // Test database connection first
                try {
                    await dbPool.query('SELECT NOW()');
                    console.log('✅ Database connection verified');
                } catch (testError) {
                    console.error('❌ Database connection test failed:', testError.message);
                    throw testError;
                }
                
                // Use a transaction with row-level locking to prevent duplicate inserts
                // This handles race conditions when multiple form submissions happen simultaneously
                const client = await dbPool.connect();
                try {
                    await client.query('BEGIN');
                    
                    // Check if customer already exists (with row lock to prevent duplicates)
                    // Lock rows to prevent concurrent inserts
                    const existingCustomer = await client.query(
                        `SELECT id, status, name FROM customers 
                         WHERE (LOWER(email) = LOWER($1) OR phone = $2)
                         AND (email IS NOT NULL OR phone IS NOT NULL)
                         FOR UPDATE
                         LIMIT 1`,
                        [email, phone]
                    );

                    if (existingCustomer.rows.length === 0) {
                        // Double-check after lock (handle race condition)
                        const doubleCheck = await client.query(
                            `SELECT id FROM customers 
                             WHERE (LOWER(email) = LOWER($1) OR phone = $2)
                             AND (email IS NOT NULL OR phone IS NOT NULL)
                             LIMIT 1`,
                            [email, phone]
                        );
                        
                        if (doubleCheck.rows.length === 0) {
                            // Create new customer with "interested" status
                            const result = await client.query(
                                `INSERT INTO customers (name, email, phone, status, notes, archived) 
                                 VALUES ($1, $2, $3, $4, $5, $6)
                                 RETURNING id, name, email, phone, status`,
                                [
                                    fullname,
                                    email,
                                    phone,
                                    'interested', // Set status to "interested"
                                    description || null,
                                    false // Not archived
                                ]
                            );
                            console.log(`✅ New customer created from contact form:`, result.rows[0]);
                        } else {
                            // Race condition: customer was inserted by another request
                            const existing = await client.query(
                                `SELECT id, status FROM customers WHERE id = $1`,
                                [doubleCheck.rows[0].id]
                            );
                            if (existing.rows.length > 0) {
                                console.log(`ℹ️ Customer already exists (race condition handled): ID ${existing.rows[0].id}`);
                                // Update status to interested if not already
                                await client.query(
                                    `UPDATE customers SET status = 'interested', updated_at = NOW() 
                                     WHERE id = $1 AND status != 'interested'`,
                                    [existing.rows[0].id]
                                );
                            }
                        }
                    } else {
                        // Customer exists - update status to "interested" and notes
                        const customerId = existingCustomer.rows[0].id;
                        const currentStatus = existingCustomer.rows[0].status;
                        
                        if (currentStatus !== 'interested') {
                            await client.query(
                                `UPDATE customers 
                                 SET status = 'interested', 
                                     notes = COALESCE($1, notes), 
                                     updated_at = NOW() 
                                 WHERE id = $2`,
                                [description || null, customerId]
                            );
                            console.log(`✅ Existing customer updated to "interested" status: ${fullname} (${email}) - ID: ${customerId}`);
                        } else {
                            // Already interested, just update notes if provided
                            if (description) {
                                await client.query(
                                    `UPDATE customers 
                                     SET notes = COALESCE($1, notes), updated_at = NOW() 
                                     WHERE id = $2`,
                                    [description, customerId]
                                );
                            }
                            console.log(`ℹ️ Customer already has "interested" status: ${fullname} (${email}) - ID: ${customerId}`);
                        }
                    }
                    
                    await client.query('COMMIT');
                } catch (dbError) {
                    await client.query('ROLLBACK');
                    throw dbError;
                } finally {
                    client.release();
                }
            }
        } catch (dbError) {
            // Log error but don't fail the email send
            console.error('❌ Error creating customer from contact form:', dbError);
            console.error('Error details:', {
                message: dbError.message,
                code: dbError.code,
                detail: dbError.detail,
                stack: dbError.stack
            });
            // Continue - email was sent successfully
        }

        res.json({ 
            success: true, 
            message: 'Thank you for contacting us! We will get back to you soon.' 
        });

    } catch (error) {
        console.error('Error sending contact form email:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send message. Please try again later or contact us directly.' 
        });
    }
});

// Test endpoint to verify route is working
router.get('/test', (req, res) => {
    console.log('✅ Contact route test endpoint hit');
    res.json({ 
        success: true, 
        message: 'Contact route is working!',
        poolAvailable: pool ? 'yes' : 'no',
        appLocalsPool: req.app && req.app.locals && req.app.locals.pool ? 'yes' : 'no'
    });
});

module.exports = router;


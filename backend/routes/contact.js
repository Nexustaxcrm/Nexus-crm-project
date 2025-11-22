const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

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
    console.log('Request body:', req.body);
    try {
        const { fullname, phone, email, description } = req.body;
        console.log('Parsed form data:', { fullname, phone, email, description: description ? 'provided' : 'empty' });

        // Validate required fields
        if (!fullname || !phone || !email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name, Phone, and Email are required fields.' 
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

        // Create transporter (check credentials first)
        let transporter;
        try {
            transporter = createTransporter();
        } catch (error) {
            console.error('Email configuration error:', error.message);
            return res.status(500).json({ 
                success: false, 
                message: 'Email service is not configured. Please contact the administrator.' 
            });
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

        // Send email
        console.log('📨 Sending email to nexustaxfiling@gmail.com...');
        await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully');

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
                
                // Check if customer already exists (by email or phone)
                const existingCustomer = await dbPool.query(
                    'SELECT id FROM customers WHERE email = $1 OR phone = $2 LIMIT 1',
                    [email, phone]
                );

                if (existingCustomer.rows.length === 0) {
                    // Create new customer with "interested" status
                    // Note: created_at and updated_at are handled by database defaults
                    const result = await dbPool.query(
                        `INSERT INTO customers (name, email, phone, status, notes, archived) 
                         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, phone, status`,
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
                    // Update existing customer status to "interested" if not already
                    const updateResult = await dbPool.query(
                        `UPDATE customers 
                         SET status = $1, notes = COALESCE($2, notes), updated_at = NOW() 
                         WHERE (email = $3 OR phone = $4) AND status != 'interested'
                         RETURNING id`,
                        ['interested', description || null, email, phone]
                    );
                    if (updateResult.rows.length > 0) {
                        console.log(`✅ Existing customer updated to "interested" status: ${fullname} (${email}) - ID: ${updateResult.rows[0].id}`);
                    } else {
                        console.log(`ℹ️ Customer already has "interested" status: ${fullname} (${email})`);
                    }
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


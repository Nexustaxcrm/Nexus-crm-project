const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Get shared pool from app.locals (set in server.js)
let pool = null;

// Initialize pool from app (called from server.js)
router.init = function(app) {
    pool = app.locals.pool;
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
    try {
        const { fullname, phone, email, description } = req.body;

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
        await transporter.sendMail(mailOptions);

        // Automatically create customer in CRM with "interested" status
        try {
            const dbPool = pool || req.app.locals.pool;
            if (dbPool) {
                // Check if customer already exists (by email or phone)
                const existingCustomer = await dbPool.query(
                    'SELECT id FROM customers WHERE email = $1 OR phone = $2 LIMIT 1',
                    [email, phone]
                );

                if (existingCustomer.rows.length === 0) {
                    // Create new customer with "interested" status
                    await dbPool.query(
                        `INSERT INTO customers (name, email, phone, status, notes, archived, created_at, updated_at) 
                         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
                        [
                            fullname,
                            email,
                            phone,
                            'interested', // Set status to "interested"
                            description || null,
                            false // Not archived
                        ]
                    );
                    console.log(`✅ New customer created from contact form: ${fullname} (${email})`);
                } else {
                    // Update existing customer status to "interested" if not already
                    await dbPool.query(
                        `UPDATE customers 
                         SET status = $1, notes = COALESCE($2, notes), updated_at = NOW() 
                         WHERE (email = $3 OR phone = $4) AND status != 'interested'`,
                        ['interested', description || null, email, phone]
                    );
                    console.log(`✅ Existing customer updated to "interested" status: ${fullname} (${email})`);
                }
            }
        } catch (dbError) {
            // Log error but don't fail the email send
            console.error('Error creating customer from contact form:', dbError);
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

module.exports = router;


const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Create reusable transporter object using Gmail SMTP
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER || 'nexustaxfiling@gmail.com',
            pass: process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD // Use App Password for Gmail
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

        // Create transporter
        const transporter = createTransporter();

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


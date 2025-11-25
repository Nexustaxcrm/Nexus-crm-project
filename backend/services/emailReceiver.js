/**
 * Email Receiver Service
 * Monitors nexustaxfiling@gmail.com inbox for emails with attachments
 * and automatically adds attachments to customer accounts in CRM
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const s3Storage = require('../utils/s3Storage');

class EmailReceiverService {
    constructor(dbPool) {
        this.dbPool = dbPool;
        this.imap = null;
        this.isRunning = false;
        this.processedEmails = new Set(); // Track processed email UIDs to avoid duplicates
        this.checkInterval = null;
        this.checkIntervalMs = 5 * 60 * 1000; // Check every 5 minutes
    }

    /**
     * Initialize IMAP connection
     */
    initialize() {
        const emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER || 'nexustaxfiling@gmail.com';
        const emailPassword = process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;

        if (!emailPassword) {
            console.log('⚠️  Email receiver: EMAIL_PASSWORD not configured. Email attachment processing disabled.');
            return false;
        }

        // Gmail IMAP settings
        this.imap = new Imap({
            user: emailUser,
            password: emailPassword,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            connTimeout: 10000, // 10 seconds
            authTimeout: 5000,   // 5 seconds
        });

        this.imap.once('ready', () => {
            console.log('✅ Email receiver: IMAP connection established');
            this.startChecking();
        });

        this.imap.once('error', (err) => {
            console.error('❌ Email receiver: IMAP error:', err.message);
            this.isRunning = false;
        });

        this.imap.once('end', () => {
            console.log('📧 Email receiver: IMAP connection ended');
            this.isRunning = false;
        });

        try {
            this.imap.connect();
            return true;
        } catch (error) {
            console.error('❌ Email receiver: Failed to connect:', error.message);
            return false;
        }
    }

    /**
     * Start checking for new emails periodically
     */
    startChecking() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log('📧 Email receiver: Started checking for new emails with attachments');
        
        // Check immediately
        this.checkForNewEmails();
        
        // Then check every 5 minutes
        this.checkInterval = setInterval(() => {
            if (this.isRunning && this.imap && this.imap.state === 'authenticated') {
                this.checkForNewEmails();
            }
        }, this.checkIntervalMs);
    }

    /**
     * Stop checking for emails
     */
    stopChecking() {
        this.isRunning = false;
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        if (this.imap) {
            this.imap.end();
        }
        console.log('📧 Email receiver: Stopped checking for emails');
    }

    /**
     * Check for new emails with attachments
     */
    checkForNewEmails() {
        if (!this.imap || this.imap.state !== 'authenticated') {
            return;
        }

        this.imap.openBox('INBOX', false, (err, box) => {
            if (err) {
                console.error('❌ Email receiver: Error opening inbox:', err.message);
                return;
            }

            // Search for unread emails from the last 24 hours
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            this.imap.search(['UNSEEN', ['SINCE', yesterday]], (err, results) => {
                if (err) {
                    console.error('❌ Email receiver: Error searching emails:', err.message);
                    return;
                }

                if (!results || results.length === 0) {
                    return; // No new emails
                }

                console.log(`📧 Email receiver: Found ${results.length} new email(s) to process`);

                // Process each email
                const fetch = this.imap.fetch(results, {
                    bodies: '',
                    struct: true
                });

                fetch.on('message', (msg, seqno) => {
                    this.processEmail(msg, seqno);
                });

                fetch.once('error', (err) => {
                    console.error('❌ Email receiver: Error fetching emails:', err.message);
                });
            });
        });
    }

    /**
     * Process a single email message
     */
    async processEmail(msg, seqno) {
        let emailData = {
            uid: null,
            from: null,
            subject: null,
            date: null,
            attachments: []
        };

        msg.on('body', (stream, info) => {
            let buffer = '';
            stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
            });
            stream.on('end', async () => {
                try {
                    const parsed = await simpleParser(buffer);
                    
                    // Extract email address properly - handle different formats
                    let senderEmail = null;
                    if (parsed.from) {
                        if (parsed.from.value && parsed.from.value.length > 0) {
                            // Array format: [{ address: 'email@example.com', name: 'Name' }]
                            senderEmail = parsed.from.value[0].address;
                        } else if (parsed.from.address) {
                            // Direct address property
                            senderEmail = parsed.from.address;
                        } else if (parsed.from.text) {
                            // Text format: "Name <email@example.com>" - extract email
                            const emailMatch = parsed.from.text.match(/<([^>]+)>/);
                            if (emailMatch) {
                                senderEmail = emailMatch[1];
                            } else {
                                // If no angle brackets, try to extract email from text
                                const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/;
                                const match = parsed.from.text.match(emailRegex);
                                senderEmail = match ? match[0] : null;
                            }
                        }
                    }
                    
                    emailData.from = senderEmail;
                    emailData.subject = parsed.subject || 'No Subject';
                    emailData.date = parsed.date || new Date();
                    emailData.attachments = parsed.attachments || [];

                    // Process attachments
                    if (emailData.attachments.length > 0) {
                        console.log(`📎 Email receiver: Processing email from ${emailData.from} with ${emailData.attachments.length} attachment(s)`);
                        await this.processAttachments(emailData);
                    }
                } catch (parseError) {
                    console.error('❌ Email receiver: Error parsing email:', parseError.message);
                }
            });
        });

        msg.once('attributes', (attrs) => {
            emailData.uid = attrs.uid;
        });

        msg.once('end', () => {
            // Mark email as read after processing
            if (emailData.uid && !this.processedEmails.has(emailData.uid)) {
                this.processedEmails.add(emailData.uid);
                this.markAsRead(emailData.uid);
            }
        });
    }

    /**
     * Process attachments from an email
     */
    async processAttachments(emailData) {
        if (!this.dbPool) {
            console.error('❌ Email receiver: Database pool not available');
            return;
        }

        // Ensure we have just the email address, not the full "Name <email>" string
        let senderEmail = emailData.from;
        if (!senderEmail) {
            console.log('⚠️  Email receiver: Could not extract sender email address');
            return;
        }

        // Clean up email - remove any quotes, angle brackets, or extra text
        senderEmail = senderEmail.toString().toLowerCase().trim();
        
        // Extract email from "Name <email@example.com>" format if needed
        const emailMatch = senderEmail.match(/<([^>]+)>/);
        if (emailMatch) {
            senderEmail = emailMatch[1];
        } else {
            // Extract email from text if it contains email pattern
            const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/;
            const match = senderEmail.match(emailRegex);
            if (match) {
                senderEmail = match[0];
            }
        }
        
        senderEmail = senderEmail.toLowerCase().trim();

        if (!senderEmail || !senderEmail.includes('@')) {
            console.log('⚠️  Email receiver: Invalid sender email address:', emailData.from);
            return;
        }

        console.log(`📧 Email receiver: Looking for customer with email: ${senderEmail}`);

        // Find customer by email - try multiple matching strategies
        try {
            // First try exact match
            let customerResult = await this.dbPool.query(
                `SELECT c.id, c.name, c.email, c.user_id, u.id as user_id_from_users
                 FROM customers c
                 LEFT JOIN users u ON c.user_id = u.id OR LOWER(c.email) = LOWER(u.username)
                 WHERE LOWER(TRIM(c.email)) = $1
                 LIMIT 1`,
                [senderEmail]
            );

            // If not found, try matching with username from users table
            if (customerResult.rows.length === 0) {
                customerResult = await this.dbPool.query(
                    `SELECT c.id, c.name, c.email, c.user_id, u.id as user_id_from_users
                     FROM customers c
                     INNER JOIN users u ON c.user_id = u.id
                     WHERE LOWER(TRIM(u.username)) = $1
                     LIMIT 1`,
                    [senderEmail]
                );
            }

            // If still not found, try partial match (for emails with extra characters)
            if (customerResult.rows.length === 0) {
                customerResult = await this.dbPool.query(
                    `SELECT c.id, c.name, c.email, c.user_id, u.id as user_id_from_users
                     FROM customers c
                     LEFT JOIN users u ON c.user_id = u.id
                     WHERE LOWER(TRIM(c.email)) LIKE $1 OR LOWER(TRIM(u.username)) LIKE $1
                     LIMIT 1`,
                    [`%${senderEmail}%`]
                );
            }

            let customer;
            let customerId;
            let userId;

            if (customerResult.rows.length === 0) {
                // Customer doesn't exist - create new customer and user account
                console.log(`📧 Email receiver: No customer found with email: ${senderEmail}`);
                console.log(`   Creating new customer account automatically...`);
                
                try {
                    // Generate temporary password (8 characters, easy to type)
                    const tempPassword = this.generateTempPassword();
                    const hashedPassword = await bcrypt.hash(tempPassword, 10);
                    
                    // Extract name from email (use email prefix as name if no name available)
                    const emailName = senderEmail.split('@')[0].replace(/[._]/g, ' ');
                    const customerName = emailData.from?.name || emailName || 'Customer';
                    
                    // Create user account first
                    const userResult = await this.dbPool.query(
                        `INSERT INTO users (username, password, role, temp_password) 
                         VALUES ($1, $2, $3, $4) 
                         RETURNING id, username, role`,
                        [senderEmail, hashedPassword, 'customer', true]
                    );
                    
                    userId = userResult.rows[0].id;
                    console.log(`✅ Email receiver: Created user account for ${senderEmail} (User ID: ${userId})`);
                    
                    // Create customer account
                    const newCustomerResult = await this.dbPool.query(
                        `INSERT INTO customers (name, email, status, user_id) 
                         VALUES ($1, $2, $3, $4) 
                         RETURNING id, name, email`,
                        [customerName, senderEmail, 'pending', userId]
                    );
                    
                    customer = newCustomerResult.rows[0];
                    customerId = customer.id;
                    console.log(`✅ Email receiver: Created customer account: ${customer.name} (Customer ID: ${customerId})`);
                    
                    // Send welcome email with credentials
                    await this.sendWelcomeEmail(senderEmail, customerName, tempPassword);
                    
                } catch (createError) {
                    console.error(`❌ Email receiver: Error creating customer account:`, createError.message);
                    // If user already exists, try to find and link
                    if (createError.code === '23505' || createError.message.includes('duplicate')) {
                        console.log(`   User already exists, attempting to link...`);
                        const existingUserResult = await this.dbPool.query(
                            'SELECT id FROM users WHERE LOWER(username) = $1',
                            [senderEmail]
                        );
                        if (existingUserResult.rows.length > 0) {
                            userId = existingUserResult.rows[0].id;
                            // Try to find or create customer
                            const existingCustomerResult = await this.dbPool.query(
                                'SELECT id, name, email FROM customers WHERE LOWER(email) = $1 LIMIT 1',
                                [senderEmail]
                            );
                            if (existingCustomerResult.rows.length > 0) {
                                customer = existingCustomerResult.rows[0];
                                customerId = customer.id;
                                // Link customer to user
                                await this.dbPool.query(
                                    'UPDATE customers SET user_id = $1 WHERE id = $2',
                                    [userId, customerId]
                                );
                                console.log(`✅ Email receiver: Linked existing customer to user account`);
                            }
                        }
                    } else {
                        return; // Can't proceed without customer account
                    }
                }
            } else {
                // Customer exists
                customer = customerResult.rows[0];
                customerId = customer.id;
                userId = customer.user_id || customer.user_id_from_users || null;
                console.log(`✅ Email receiver: Found customer: ${customer.name} (ID: ${customerId})`);
            }

            // Process each attachment
            for (const attachment of emailData.attachments) {
                try {
                    await this.saveAttachment(attachment, customerId, userId, emailData);
                } catch (attachmentError) {
                    console.error(`❌ Email receiver: Error processing attachment ${attachment.filename}:`, attachmentError.message);
                }
            }

            console.log(`✅ Email receiver: Processed ${emailData.attachments.length} attachment(s) for customer ${customer.name}`);

        } catch (error) {
            console.error('❌ Email receiver: Error processing attachments:', error.message);
        }
    }

    /**
     * Save an attachment to customer account
     */
    async saveAttachment(attachment, customerId, userId, emailData) {
        const fileName = attachment.filename || `attachment-${Date.now()}`;
        const fileBuffer = attachment.content;
        const fileSize = fileBuffer.length;
        const fileType = attachment.contentType || 'application/octet-stream';

        // Generate unique stored filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(fileName);
        const name = path.basename(fileName, ext);
        const storedFileName = `${uniqueSuffix}-${name}${ext}`;

        let filePath;

        // Upload to S3 if configured, otherwise save locally
        if (s3Storage.isS3Configured()) {
            try {
                filePath = await s3Storage.uploadToS3(fileBuffer, fileName, storedFileName);
                console.log(`✅ Email receiver: Uploaded ${fileName} to S3`);
            } catch (s3Error) {
                console.error(`❌ Email receiver: S3 upload failed, using local storage:`, s3Error.message);
                // Fallback to local storage
                const uploadsDir = path.join(__dirname, '..', 'uploads', 'customer-documents');
                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                }
                filePath = path.join(uploadsDir, storedFileName);
                fs.writeFileSync(filePath, fileBuffer);
            }
        } else {
            // Save to local storage
            const uploadsDir = path.join(__dirname, '..', 'uploads', 'customer-documents');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            filePath = path.join(uploadsDir, storedFileName);
            fs.writeFileSync(filePath, fileBuffer);
        }

        // Save to database
        const result = await this.dbPool.query(
            `INSERT INTO customer_documents (customer_id, user_id, file_name, stored_file_name, file_path, file_size, file_type, uploaded_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, file_name, uploaded_at`,
            [customerId, userId, fileName, storedFileName, filePath, fileSize, fileType, new Date()]
        );

        console.log(`✅ Email receiver: Saved attachment "${fileName}" to customer account (Document ID: ${result.rows[0].id})`);

        // Send notification email to customer (optional)
        try {
            await this.sendNotificationEmail(customerId, fileName, emailData);
        } catch (notifError) {
            console.error('⚠️  Email receiver: Failed to send notification email:', notifError.message);
        }
    }

    /**
     * Mark email as read
     */
    markAsRead(uid) {
        if (!this.imap || this.imap.state !== 'authenticated') {
            return;
        }

        this.imap.openBox('INBOX', false, (err) => {
            if (err) return;
            
            this.imap.addFlags(uid, '\\Seen', (err) => {
                if (err) {
                    console.error('❌ Email receiver: Error marking email as read:', err.message);
                }
            });
        });
    }

    /**
     * Send notification email to customer
     */
    async sendNotificationEmail(customerId, fileName, emailData) {
        const nodemailer = require('nodemailer');
        const emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER || 'nexustaxfiling@gmail.com';
        const emailPassword = process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;

        if (!emailPassword) return;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPassword
            }
        });

        // Get customer email
        const customerResult = await this.dbPool.query(
            'SELECT name, email FROM customers WHERE id = $1',
            [customerId]
        );

        if (customerResult.rows.length === 0 || !customerResult.rows[0].email) {
            return;
        }

        const customer = customerResult.rows[0];

        const mailOptions = {
            from: emailUser,
            to: customer.email,
            subject: 'Document Received - Nexus Tax Filing',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #063232; color: #ffffff; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                        <h2 style="margin: 0;">Document Received</h2>
                    </div>
                    <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 5px 5px;">
                        <p style="font-size: 16px; line-height: 1.6; color: #333333;">
                            Dear ${customer.name},
                        </p>
                        <p style="font-size: 16px; line-height: 1.6; color: #333333;">
                            We have received your document <strong>${fileName}</strong> via email and it has been added to your account.
                        </p>
                        <p style="font-size: 16px; line-height: 1.6; color: #333333;">
                            You can view and manage this document in your customer dashboard.
                        </p>
                        <div style="margin-top: 30px; text-align: center;">
                            <a href="${process.env.FRONTEND_URL || 'https://nexustaxfiling.com'}/crm" 
                               style="background-color: #063232; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                Access Your Dashboard
                            </a>
                        </div>
                        <p style="font-size: 14px; color: #666666; margin-top: 30px;">
                            Thank you for using Nexus Tax Filing!
                        </p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email receiver: Sent notification email to ${customer.email}`);
    }

    /**
     * Generate temporary password (8 characters, easy to type)
     */
    generateTempPassword() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing characters
        let password = '';
        for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    /**
     * Send welcome email to new customer with login credentials
     */
    async sendWelcomeEmail(email, customerName, tempPassword) {
        const emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER || 'nexustaxfiling@gmail.com';
        const emailPassword = process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;

        if (!emailPassword) {
            console.log('⚠️  Email receiver: Cannot send welcome email - EMAIL_PASSWORD not configured');
            return;
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPassword
            }
        });

        const frontendUrl = process.env.FRONTEND_URL || 'https://nexustaxfiling.com';
        const crmUrl = `${frontendUrl}/crm`;

        const mailOptions = {
            from: emailUser,
            to: email,
            subject: 'Welcome to Nexus Tax Filing - Your Account Has Been Created',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #063232; color: #ffffff; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                        <h2 style="margin: 0;">Welcome to Nexus Tax Filing!</h2>
                    </div>
                    <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 5px 5px;">
                        <p style="font-size: 16px; line-height: 1.6; color: #333333;">
                            Dear ${customerName},
                        </p>
                        <p style="font-size: 16px; line-height: 1.6; color: #333333;">
                            Thank you for sending your documents to us! We have received your email and created your customer account.
                        </p>
                        <p style="font-size: 16px; line-height: 1.6; color: #333333;">
                            Your documents have been securely stored and are now available in your customer dashboard.
                        </p>
                        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #063232;">Your Login Credentials:</h3>
                            <p style="margin: 10px 0;"><strong>Username:</strong> ${email}</p>
                            <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background-color: #ffffff; padding: 5px 10px; border-radius: 3px; font-size: 18px; letter-spacing: 2px;">${tempPassword}</code></p>
                            <p style="margin: 10px 0; color: #d32f2f; font-weight: bold;">⚠️ Important: You will be asked to change this password when you first log in.</p>
                        </div>
                        <div style="margin-top: 30px; text-align: center;">
                            <a href="${crmUrl}" 
                               style="background-color: #063232; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                Access Your Dashboard
                            </a>
                        </div>
                        <p style="font-size: 14px; color: #666666; margin-top: 30px;">
                            <strong>Next Steps:</strong><br>
                            1. Click the button above to access your dashboard<br>
                            2. Log in using your email and temporary password<br>
                            3. You will be prompted to set a new password<br>
                            4. Once done, you can view and manage your documents
                        </p>
                        <p style="font-size: 14px; color: #666666; margin-top: 20px;">
                            If you have any questions, please don't hesitate to contact us.
                        </p>
                        <p style="font-size: 14px; color: #666666; margin-top: 20px;">
                            Thank you for choosing Nexus Tax Filing!
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Email receiver: Sent welcome email with credentials to ${email}`);
        } catch (emailError) {
            console.error(`❌ Email receiver: Error sending welcome email:`, emailError.message);
        }
    }
}

module.exports = EmailReceiverService;


# Email Attachment Auto-Processing Feature

## Overview

This feature automatically monitors the `nexustaxfiling@gmail.com` inbox for emails with attachments. When a customer sends an email with attachments, the system:

1. **Identifies the customer** by matching the sender's email address
2. **Extracts attachments** from the email
3. **Uploads attachments** to S3 (if configured) or local storage
4. **Adds documents** to the customer's account in the CRM
5. **Sends notification** to the customer confirming receipt

## How It Works

### Email Monitoring
- The service checks the Gmail inbox every **5 minutes** for new unread emails
- Only emails from the last **24 hours** are processed
- Emails are automatically marked as read after processing

### Customer Matching
- The system matches the sender's email address to customer records in the database
- It searches for customers where:
  - `customer.email` matches the sender's email (case-insensitive)
  - Or the email is similar to the customer's email

### Attachment Processing
- All attachments are extracted from the email
- Supported file types: PDF, images (JPG, PNG), and other documents
- Files are saved with unique names to prevent conflicts
- Attachments are stored in the same location as manually uploaded documents (S3 or local)

### Notification
- After processing, the customer receives an email notification confirming:
  - Which document was received
  - That it's been added to their account
  - A link to access their dashboard

## Requirements

### 1. Email Credentials
The same Gmail credentials used for sending emails are used for receiving:
- `EMAIL_USER` or `GMAIL_USER` = `nexustaxfiling@gmail.com`
- `EMAIL_PASSWORD` or `GMAIL_APP_PASSWORD` = Your Gmail App Password

### 2. Gmail IMAP Access
- IMAP must be enabled in Gmail settings
- Gmail App Password is required (not regular password)
- See `EMAIL_SETUP.md` for instructions on creating App Password

### 3. Customer Account
- The sender must have a customer account in the CRM
- The email address used to send must match the email in the customer record

## Setup Instructions

### Step 1: Enable Gmail IMAP
1. Go to Gmail Settings: https://mail.google.com/mail/u/0/#settings/general
2. Click on "Forwarding and POP/IMAP" tab
3. Enable "Enable IMAP"
4. Click "Save Changes"

### Step 2: Verify Environment Variables
Ensure these are set in Railway/Render:
- `EMAIL_USER` = `nexustaxfiling@gmail.com`
- `EMAIL_PASSWORD` = (Your Gmail App Password)

### Step 3: Install Dependencies
The required packages are already in `package.json`:
- `imap` - For IMAP email access
- `mailparser` - For parsing email content and attachments

Run:
```bash
cd backend
npm install
```

### Step 4: Deploy
After deployment, check server logs for:
```
✅ Email receiver: IMAP connection established
✅ Email receiver: Started checking for new emails with attachments
```

## How Customers Use It

1. **Customer sends email** to `nexustaxfiling@gmail.com` with attachments
2. **System processes** the email (within 5 minutes)
3. **Attachments appear** in customer's dashboard under "Previously Uploaded Documents"
4. **Customer receives** confirmation email

## Example Flow

1. Customer `john@example.com` sends email to `nexustaxfiling@gmail.com` with:
   - Subject: "Tax Documents"
   - Attachment: `W2-2024.pdf`

2. System processes (within 5 minutes):
   - Finds customer with email `john@example.com`
   - Extracts `W2-2024.pdf` attachment
   - Uploads to S3 or local storage
   - Creates document record in database
   - Marks email as read

3. Customer sees:
   - Document appears in their CRM dashboard
   - Receives email: "Document Received - We have received your document W2-2024.pdf..."

## Logs and Monitoring

### Success Logs:
```
📧 Email receiver: Found 1 new email(s) to process
📎 Email receiver: Processing email from john@example.com with 1 attachment(s)
✅ Email receiver: Found customer: John Doe (ID: 123)
✅ Email receiver: Uploaded W2-2024.pdf to S3
✅ Email receiver: Saved attachment "W2-2024.pdf" to customer account (Document ID: 456)
✅ Email receiver: Processed 1 attachment(s) for customer John Doe
```

### Warning Logs:
```
⚠️  Email receiver: No customer found with email: unknown@example.com
   Email subject: Tax Documents
   Consider creating a customer account for this email address
```

### Error Logs:
```
❌ Email receiver: IMAP error: Invalid credentials
❌ Email receiver: Error processing attachment: File too large
```

## Troubleshooting

### Emails Not Being Processed

1. **Check IMAP Connection:**
   - Look for: `✅ Email receiver: IMAP connection established`
   - If missing, check `EMAIL_PASSWORD` is set correctly

2. **Check Gmail IMAP Settings:**
   - Ensure IMAP is enabled in Gmail
   - Verify App Password is correct (16 characters)

3. **Check Customer Email Match:**
   - Ensure sender's email matches customer email in database
   - Check logs for: `⚠️ No customer found with email: ...`

4. **Check Email Age:**
   - Only emails from last 24 hours are processed
   - Older emails won't be processed automatically

### Attachments Not Appearing

1. **Check Database:**
   - Verify document record was created in `customer_documents` table
   - Check `customer_id` matches the customer

2. **Check Storage:**
   - If using S3, verify file appears in bucket
   - If using local, check `backend/uploads/customer-documents/` folder

3. **Check File Size:**
   - Maximum file size: 50MB per attachment
   - Larger files may fail to process

### IMAP Connection Errors

1. **"Invalid credentials":**
   - Verify `EMAIL_PASSWORD` is the App Password, not regular password
   - Check password has no extra spaces

2. **"Connection timeout":**
   - Check internet connectivity
   - Verify Gmail IMAP is not blocked by firewall

3. **"Too many connections":**
   - Gmail has connection limits
   - Service will retry automatically

## Security Considerations

1. **Email Access:**
   - Only processes emails sent to `nexustaxfiling@gmail.com`
   - Only processes unread emails from last 24 hours
   - Emails are marked as read after processing

2. **Customer Matching:**
   - Only matches emails to existing customer accounts
   - Unknown senders are logged but not processed

3. **File Validation:**
   - Files are validated before saving
   - File size limits enforced (50MB)

## Configuration Options

### Check Interval
Default: 5 minutes (300,000 ms)
To change, modify `this.checkIntervalMs` in `emailReceiver.js`

### Email Age Limit
Default: 24 hours
To change, modify the `yesterday` date calculation in `checkForNewEmails()`

### File Size Limit
Default: 50MB per attachment
Configured in multer settings in `customers.js`

## Manual Processing

If you need to manually process an email:
1. Mark the email as unread in Gmail
2. Wait for next check cycle (up to 5 minutes)
3. Or restart the server to trigger immediate check

## Disabling the Feature

To disable email processing:
1. Remove or comment out the email receiver initialization in `server.js`
2. Or set `EMAIL_PASSWORD` to empty (service won't start)

---

**Note**: This feature requires Gmail IMAP access and will only work if `EMAIL_PASSWORD` is configured correctly. The service runs automatically in the background and requires no manual intervention.


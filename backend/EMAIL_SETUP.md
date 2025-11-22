# Email Setup Guide for Contact Form

## Overview
The contact form sends emails to `nexustaxfiling@gmail.com` when customers submit the form.

## Gmail Configuration

### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security**
3. Enable **2-Step Verification** (required for App Passwords)

### Step 2: Generate App Password
1. Go to: https://myaccount.google.com/apppasswords
2. Select **Mail** as the app
3. Select **Other (Custom name)** as the device
4. Enter "Nexus Tax Filing Website" as the name
5. Click **Generate**
6. **Copy the 16-character password** (you'll need this for Railway)

### Step 3: Add Environment Variables to Railway
In your Railway project, add these environment variables:

1. **EMAIL_USER**: `nexustaxfiling@gmail.com`
2. **EMAIL_PASSWORD** or **GMAIL_APP_PASSWORD**: `[The 16-character App Password from Step 2]`

**Important:** Use the App Password, NOT your regular Gmail password!

## How to Add Variables in Railway:
1. Go to your Railway project dashboard
2. Click on your web service
3. Go to the **Variables** tab
4. Click **+ New Variable**
5. Add:
   - Variable: `EMAIL_USER`
   - Value: `nexustaxfiling@gmail.com`
6. Click **+ New Variable** again
7. Add:
   - Variable: `EMAIL_PASSWORD` (or `GMAIL_APP_PASSWORD`)
   - Value: `[Your 16-character App Password]`
8. Click **Deploy** or wait for automatic redeploy

## Testing
After deployment, test the contact form:
1. Go to your website's contact page
2. Fill out the form (Name, Phone, Email, Description)
3. Click "Send Message"
4. Check `nexustaxfiling@gmail.com` inbox for the email

## Troubleshooting

### Email not sending?
1. Verify App Password is correct (16 characters, no spaces)
2. Check Railway logs for error messages
3. Ensure 2-Step Verification is enabled on Gmail account
4. Verify environment variables are set correctly in Railway

### "Invalid login" error?
- Make sure you're using the App Password, not your regular Gmail password
- Regenerate the App Password if needed

### "Less secure app access" error?
- Gmail no longer supports "Less secure apps"
- You MUST use App Passwords with 2-Step Verification enabled


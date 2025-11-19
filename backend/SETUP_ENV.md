# Environment Variables Setup

## Problem
The login is failing with "Server error" because `JWT_SECRET` is not set.

## Solution

Create a `.env` file in the `backend` folder with the following content:

```env
# Database Configuration
DB_USER=postgres
DB_HOST=localhost
DB_NAME=nexus_crm
DB_PASSWORD=your_actual_password
DB_PORT=5432

# JWT Secret for authentication tokens
# This is a randomly generated secret - keep it secure!
JWT_SECRET=f2f29caa222b383f706be3489b98359ba1cae0d3d9debaa1b250a4f43eda5d42

# Admin User Password (optional, defaults to 'admin123')
# This is the password for the default admin user created on first startup
# IMPORTANT: Change this password after first login!
ADMIN_PASSWORD=admin123

# Server Port (optional, defaults to 3000)
PORT=3000
```

## Steps to Fix Login Error

1. **Create the `.env` file**:
   - Navigate to the `backend` folder
   - Create a new file named `.env` (no extension)
   - Copy the content above

2. **Update the database credentials**:
   - Replace `DB_USER` with your PostgreSQL username
   - Replace `DB_PASSWORD` with your PostgreSQL password
   - Replace `DB_NAME` with your database name
   - Update `DB_HOST` if your database is not on localhost

3. **Restart your server**:
   ```bash
   cd backend
   node server.js
   ```

4. **Try logging in again**

## Generate a New JWT_SECRET (Optional)

If you want to generate a new JWT_SECRET, run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Automatic Database Initialization

The server automatically:
- Creates database tables if they don't exist
- Creates a default admin user if one doesn't exist

**Default Admin Credentials:**
- Username: `admin`
- Password: `admin123` (or the value set in `ADMIN_PASSWORD` environment variable)

⚠️ **IMPORTANT:** Change the admin password immediately after first login!

## Railway Deployment

When deploying to Railway, make sure to set these environment variables in your Railway project settings:

1. **Database Variables** (usually auto-configured by Railway PostgreSQL service):
   - `DB_USER`
   - `DB_HOST`
   - `DB_NAME`
   - `DB_PASSWORD`
   - `DB_PORT`

2. **Required Application Variables**:
   - `JWT_SECRET` - Generate a secure random string
   - `ADMIN_PASSWORD` (optional) - Default admin password
   - `PORT` - Usually set automatically by Railway

3. **Generate JWT_SECRET for Railway:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **After deployment:**
   - The database tables will be created automatically
   - The admin user will be created automatically
   - Log in with the default credentials and change the password

## Important Notes

- **Never commit the `.env` file to Git** - it contains sensitive information
- The `.env` file is already in `.gitignore` to protect it
- Keep your `JWT_SECRET` secure - it's used to sign authentication tokens
- If you change `JWT_SECRET`, all existing login sessions will be invalidated
- The admin user is only created if it doesn't already exist


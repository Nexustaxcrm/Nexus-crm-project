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

## Important Notes

- **Never commit the `.env` file to Git** - it contains sensitive information
- The `.env` file is already in `.gitignore` to protect it
- Keep your `JWT_SECRET` secure - it's used to sign authentication tokens
- If you change `JWT_SECRET`, all existing login sessions will be invalidated


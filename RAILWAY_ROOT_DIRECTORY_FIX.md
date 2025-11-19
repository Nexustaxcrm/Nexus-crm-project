# Fix: "Not Found" Error - Root Directory Issue

## Problem
Railway Root Directory is set to `backend`, so Railway only has access to files in the `backend` folder. The `index.html` file is in the parent directory, which Railway can't access.

## Solution: Change Railway Root Directory

### Option 1: Change Root Directory to Project Root (Recommended)

1. **Go to Railway Dashboard:**
   - Open your service
   - Go to **Settings** tab
   - Find **"Source"** section (or look for Root Directory setting)

2. **Change Root Directory:**
   - Change from: `backend`
   - Change to: `.` (or leave empty for project root)

3. **Update Start Command:**
   - Go to **Settings** → **Deploy** section
   - Set **Start Command** to: `cd backend && node server.js`
   - OR: `node backend/server.js`

4. **Redeploy:**
   - Railway will auto-redeploy
   - Or manually redeploy from Deployments tab

### Option 2: Keep Root Directory as `backend` and Copy Files

If you want to keep Root Directory as `backend`, you need to copy `index.html` and related files into the backend folder. This is more complex and not recommended.

## Recommended Configuration

### Railway Settings:
- **Root Directory:** `.` (project root) or empty
- **Start Command:** `cd backend && node server.js`
- **Build Command:** `cd backend && npm install`

### Why This Works:
- Railway has access to all project files (including `index.html`)
- Backend code can access `index.html` using relative path
- Server can serve static files from project root

## After Making Changes

1. **Verify Files Are Accessible:**
   - Check Railway logs for any path errors
   - Should see: "Server running on port..."

2. **Test Root URL:**
   - Visit: `https://nexus-crm-project-production.up.railway.app`
   - Should see: Login page (not "Not Found")

3. **Test API URL:**
   - Visit: `https://nexus-crm-project-production.up.railway.app/api`
   - Should see: JSON response

## Quick Fix Steps

1. Railway → Your Service → Settings
2. Find "Root Directory" or "Source" setting
3. Change from `backend` to `.` (or empty)
4. Update Start Command to: `cd backend && node server.js`
5. Save and redeploy
6. Test the root URL

This should fix the "Not Found" error!


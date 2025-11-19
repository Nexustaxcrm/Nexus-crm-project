# Fix: Railway Build Failure - npm not found

## Problem
Railway build is failing with: `npm: not found` when trying to run `cd backend && npm install`

## Solution: Let Railway Auto-Detect or Fix Build Command

### Option 1: Remove Custom Build Command (Recommended)

Railway's Railpack can auto-detect Node.js projects. If you set a custom build command, it might interfere.

1. **Go to Railway → Settings → Build**
2. **Remove the custom build command** (if you added one)
   - Click the "X" next to the build command
   - Leave it empty so Railway auto-detects

3. **Ensure Root Directory is set correctly:**
   - If Root Directory = `.` (project root):
     - Railway should auto-detect `backend/package.json`
     - It will automatically run `npm install` in the backend folder
   
   - If Root Directory = `backend`:
     - Railway will auto-detect `package.json` in backend folder
     - It will automatically run `npm install`

### Option 2: Fix Build Command (If Custom Command is Needed)

If you need a custom build command:

1. **Go to Railway → Settings → Build**
2. **Set Build Command to:**
   ```
   npm install --prefix backend
   ```
   OR (if Root Directory is already `backend`):
   ```
   npm install
   ```

### Option 3: Use Railway's Auto-Detection (Best)

1. **Remove ALL custom build commands**
2. **Set Root Directory to:** `backend`
3. **Set Start Command to:** `node server.js`
4. **Let Railway auto-detect everything else**

Railway will:
- Auto-detect `package.json` in backend folder
- Auto-install dependencies
- Auto-detect start script from `package.json`

## Recommended Railway Configuration

### If Root Directory = `backend`:
- **Root Directory:** `backend`
- **Build Command:** (leave empty - auto-detect)
- **Start Command:** `node server.js` (or leave empty to use package.json "start" script)

### If Root Directory = `.` (project root):
- **Root Directory:** `.` or empty
- **Build Command:** (leave empty - Railway should auto-detect backend/package.json)
- **Start Command:** `cd backend && node server.js`

## Step-by-Step Fix

1. **Go to Railway Dashboard:**
   - Your service → Settings → Build

2. **Remove Custom Build Command:**
   - If you see a build command like `cd backend && npm install`
   - Click the "X" to remove it
   - Leave it empty

3. **Check Root Directory:**
   - Settings → Source (or look for Root Directory)
   - Should be either:
     - `backend` (if you want to serve only backend)
     - `.` (if you want to serve both frontend and backend)

4. **Check Start Command:**
   - Settings → Deploy → Start Command
   - Should be: `node server.js` (if Root Directory = `backend`)
   - OR: `cd backend && node server.js` (if Root Directory = `.`)

5. **Redeploy:**
   - Railway will auto-redeploy
   - Or manually: Deployments → Redeploy

## Why This Happens

Railway's build process:
1. First installs the runtime (Node.js, Python, etc.)
2. Then runs build commands
3. If you try to run `npm install` before Node.js is installed, you get "npm: not found"

By letting Railway auto-detect, it will:
1. Detect `package.json` → Install Node.js → Run `npm install` automatically

## Quick Fix

**Simplest solution:**
1. Remove custom build command (leave empty)
2. Set Root Directory to `backend`
3. Set Start Command to `node server.js`
4. Redeploy

Railway will handle everything else automatically!


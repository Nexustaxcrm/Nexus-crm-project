# EXACT Railway Configuration Steps - NO ERRORS

## ⚠️ CRITICAL: Root Directory Must Be Project Root

### Step 1: Change Root Directory

1. **Go to Railway Dashboard**
2. **Click on your service** (Nexus-crm-project)
3. **Click "Settings" tab**
4. **Find "Source" section** (or look for "Root Directory")
5. **Change Root Directory:**
   - **FROM:** `backend`
   - **TO:** `.` (just a dot) OR leave it **EMPTY**
6. **Click Save**

### Step 2: Update Start Command

1. **Still in Settings tab**
2. **Go to "Deploy" section**
3. **Find "Custom Start Command"**
4. **Set Start Command to:**
   ```
   cd backend && node server.js
   ```
5. **Click Save**

### Step 3: Remove Build Command (If Any)

1. **Go to "Build" section in Settings**
2. **If you see a "Custom Build Command"**
3. **DELETE IT** (click X or remove it)
4. **Leave it EMPTY** - Railway will auto-detect
5. **Click Save**

### Step 4: Verify Environment Variables

1. **Go to "Variables" tab**
2. **Ensure these are set:**
   - `JWT_SECRET` (REQUIRED - generate if missing)
   - Database variables (auto-set if PostgreSQL is connected)

### Step 5: Redeploy

1. Railway will **auto-redeploy** after you save
2. OR go to **"Deployments" tab** → Click **"Redeploy"**

### Step 6: Verify It Works

1. **Check Logs:**
   - Go to **"Logs" tab**
   - Should see: "Server running on port..."
   - Should see: "index.html exists: true"

2. **Test Root URL:**
   - Visit: `https://nexus-crm-project-production.up.railway.app`
   - Should see: **Login page** ✅

3. **Test API:**
   - Visit: `https://nexus-crm-project-production.up.railway.app/api`
   - Should see: **JSON response** ✅

## ✅ Correct Configuration Summary

- **Root Directory:** `.` (project root) ✅
- **Start Command:** `cd backend && node server.js` ✅
- **Build Command:** (empty - auto-detect) ✅
- **Environment Variables:** All set ✅

## ❌ Wrong Configuration (Current)

- **Root Directory:** `backend` ❌
- This only deploys backend files
- `index.html` is in parent directory → Not accessible ❌

## After Fixing

The server will:
1. ✅ Serve API at `/api/*`
2. ✅ Serve frontend at `/` (root)
3. ✅ Serve static files (CSS, JS, images)
4. ✅ No errors!

**Follow these steps exactly and it will work!**


# Railway Configuration Fix - Step by Step

## Current Status
✅ Root Directory: Set to `backend`
❌ Start Command: Needs to be configured
❌ Build Command: May need to be configured

## Step-by-Step Fix

### Step 1: Configure Start Command

In Railway Settings → Deploy section:

1. Click **"+ Start Command"** button
2. Enter this command:
   ```
   node server.js
   ```
3. Save the changes

**Why:** This tells Railway to run your Node.js backend server.

### Step 2: Configure Build Command (Optional but Recommended)

In Railway Settings → Build section:

1. Click **"+ Build Command"** button
2. Enter this command:
   ```
   npm install
   ```
3. Save the changes

**Why:** This ensures all dependencies are installed before starting the server.

### Step 3: Verify Environment Variables

Go to Railway → Variables tab, ensure these are set:

**Required:**
- `JWT_SECRET` - Generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

**Database Variables** (auto-set if PostgreSQL is added):
- `DB_USER`
- `DB_HOST`
- `DB_NAME`
- `DB_PASSWORD`
- `DB_PORT`

**Optional:**
- `ADMIN_PASSWORD=admin123`
- `PORT` (Railway auto-sets this)

### Step 4: Add PostgreSQL Database (If Not Already Added)

1. In Railway project, click **"New Service"**
2. Select **"PostgreSQL"**
3. Railway will automatically:
   - Create the database
   - Set database environment variables
   - Link it to your backend service

### Step 5: Get Your Backend Service URL

1. Go to Railway → Your backend service
2. Click **Settings** → **Networking**
3. Copy the **public domain** (e.g., `nexus-crm-project-production.up.railway.app`)
4. This is your backend API URL

### Step 6: Update Frontend API URL

In `index.html` line 2870, update to your backend service URL:

```javascript
// Replace with YOUR actual backend service URL from Railway
const API_BASE_URL = 'https://YOUR-BACKEND-SERVICE-URL.up.railway.app/api';
```

**Important:** Use the backend service URL, not the frontend URL!

### Step 7: Redeploy

After making changes:
1. Railway will auto-redeploy, OR
2. Go to **Deployments** tab → Click **"Redeploy"**

### Step 8: Verify Backend is Running

1. **Check Logs:**
   - Go to Railway → Your backend service → **Logs** tab
   - Look for: `Server running on port...`
   - Look for: `Database initialized successfully`

2. **Test Backend URL:**
   Visit: `https://YOUR-BACKEND-URL.up.railway.app/api`
   
   Should see JSON:
   ```json
   {
     "message": "Nexus CRM Backend API is working!",
     "status": "ok",
     "timestamp": "..."
   }
   ```

3. **Test Login:**
   ```bash
   curl -X POST https://YOUR-BACKEND-URL.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   ```

## Expected Railway Configuration

### Deploy Settings:
- **Root Directory:** `backend` ✅
- **Start Command:** `node server.js` ⚠️ (needs to be set)
- **Restart Policy:** `On Failure` ✅

### Build Settings:
- **Builder:** Railpack (Default) ✅
- **Build Command:** `npm install` ⚠️ (recommended)
- **Metal Build Environment:** Off ✅

## Troubleshooting

### If backend still doesn't work:

1. **Check Logs:**
   - Railway → Logs tab
   - Look for errors
   - Common issues:
     - Missing `JWT_SECRET`
     - Database connection errors
     - Port binding errors

2. **Verify Files:**
   - Ensure `backend/server.js` exists
   - Ensure `backend/package.json` exists
   - Ensure all dependencies are in `package.json`

3. **Test Locally First:**
   ```bash
   cd backend
   npm install
   node server.js
   ```
   Should see: "Server running on http://localhost:3000"

## Summary

**What to do now:**
1. ✅ Set Start Command: `node server.js`
2. ✅ Set Build Command: `npm install` (optional but recommended)
3. ✅ Verify environment variables (especially `JWT_SECRET`)
4. ✅ Get backend service URL
5. ✅ Update frontend `index.html` with backend URL
6. ✅ Redeploy and test

After these steps, your backend should be running and accessible at `/api` endpoint!


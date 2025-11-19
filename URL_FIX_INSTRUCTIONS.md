# Fix: Malformed URL Error

## Problem
The error shows: `nexus-crm-project-production.up.railway.app.up.railway.app`
Notice the duplication: `.up.railway.app` appears twice!

This happens because:
1. The frontend service URL is: `nexus-crm-project-production.up.railway.app`
2. The backend needs a **separate service URL**
3. The frontend is trying to use the same URL for the API, causing conflicts

## Solution: Get Backend Service URL

### Step 1: Find Your Backend Service in Railway

1. Go to Railway dashboard: https://railway.app
2. Open your project
3. You should see **TWO services**:
   - One for **frontend** (serving index.html)
   - One for **backend** (running Node.js)

### Step 2: Get Backend Service URL

1. Click on your **backend service** (the one with Root Directory = `backend`)
2. Go to **Settings** → **Networking**
3. Look for **"Public Domain"** or **"Custom Domain"**
4. Copy the URL (it will be different from frontend, e.g., `nexus-crm-backend-production.up.railway.app`)

**Important:** The backend service URL will be **different** from the frontend URL!

### Step 3: Update Frontend API URL

Update `index.html` line 2870 with your **backend service URL**:

```javascript
// Replace with YOUR backend service URL (not frontend URL!)
const API_BASE_URL = 'https://YOUR-BACKEND-SERVICE-URL.up.railway.app/api';
```

**Example:**
If your backend service URL is `nexus-crm-backend-production.up.railway.app`, then:
```javascript
const API_BASE_URL = 'https://nexus-crm-backend-production.up.railway.app/api';
```

### Step 4: Verify Backend is Running

1. **Check Railway Logs:**
   - Go to backend service → **Logs** tab
   - Should see: "Server running on port..."

2. **Test Backend URL:**
   Visit: `https://YOUR-BACKEND-URL.up.railway.app/api`
   
   Should see JSON (not HTML):
   ```json
   {
     "message": "Nexus CRM Backend API is working!",
     "status": "ok"
   }
   ```

## If You Only Have One Service

If you only see **one service** in Railway:

### Option 1: Create Separate Backend Service (Recommended)

1. In Railway project, click **"New Service"**
2. Select **"GitHub Repo"** (connect your repo)
3. Set **Root Directory** to `backend`
4. Set **Start Command** to `node server.js`
5. Get the new service URL
6. Update frontend with new backend URL

### Option 2: Use Same Service for Both (Not Recommended)

If you want to serve both from one service, you need to:
1. Keep Root Directory as project root (not `backend`)
2. Modify `backend/server.js` to serve static files
3. This is more complex and not recommended

## Quick Check

**What to verify:**
1. ✅ Do you have TWO services in Railway? (frontend + backend)
2. ✅ What is the backend service URL? (from Settings → Networking)
3. ✅ Is the backend service running? (check Logs)
4. ✅ Is `index.html` pointing to backend URL? (not frontend URL)

## Common Mistakes

❌ **Wrong:** Using frontend URL for API
```javascript
const API_BASE_URL = 'https://nexus-crm-project-production.up.railway.app/api';
```

✅ **Correct:** Using backend service URL for API
```javascript
const API_BASE_URL = 'https://nexus-crm-backend-production.up.railway.app/api';
```

## Next Steps

1. Get your backend service URL from Railway
2. Update `index.html` line 2870
3. Test the backend URL directly in browser
4. Try login again

Share your backend service URL and I'll help you update the code!


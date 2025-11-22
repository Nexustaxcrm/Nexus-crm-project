# Quick Fix for Connection Error

## Immediate Steps to Diagnose

### 1. Check Browser Console
Open browser Developer Tools (F12) → Console tab, and look for:
- Red error messages
- CORS errors
- Network errors
- The actual error details

### 2. Test Backend Directly
Open this URL in your browser:
```
https://nexus-crm-project-production.up.railway.app/api
```

**Expected:** You should see: `{"message":"Server is working!"}`

**If you see an error:**
- The backend is not running on Railway
- The URL might be wrong
- Railway service might be sleeping

### 3. Check Your Actual Railway URL

1. Go to https://railway.app
2. Click on your project
3. Click on your backend service
4. Go to "Settings" → "Networking"
5. Copy the **actual** Railway URL (it might be different from `nexus-crm-project-production.up.railway.app`)

### 4. Update API URL if Needed

If your Railway URL is different, update `index.html` line 2870:

```javascript
// Replace with YOUR actual Railway URL
const API_BASE_URL = 'https://YOUR-ACTUAL-URL.up.railway.app/api';
```

### 5. Verify Railway Backend is Running

In Railway dashboard:
1. Check if backend service shows "Active" or "Running"
2. Check the "Logs" tab for:
   - "Server running on port..."
   - Any error messages
   - Database connection errors

### 6. Check Environment Variables

In Railway → Your backend service → Variables tab, ensure:
- ✅ `JWT_SECRET` is set
- ✅ Database variables are set (usually auto-set by Railway PostgreSQL)

### 7. Test Login Endpoint with curl

Open terminal/command prompt and run:

```bash
curl -X POST https://nexus-crm-project-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**If this works:** The backend is fine, issue is with frontend
**If this fails:** The backend has a problem

## Common Solutions

### Solution 1: Railway Service is Sleeping
- Visit the Railway service URL directly to wake it up
- Wait 30-60 seconds for it to start
- Try login again

### Solution 2: Wrong Railway URL
- Get your actual Railway URL from Railway dashboard
- Update `index.html` with the correct URL

### Solution 3: Backend Not Deployed
- Check Railway dashboard
- Redeploy if needed
- Check deployment logs

### Solution 4: Environment Variables Missing
- Add `JWT_SECRET` in Railway → Variables
- Verify database variables are set

## Still Not Working?

1. **Check browser console** - What exact error do you see?
2. **Test backend URL** - Does `https://nexus-crm-project-production.up.railway.app/api` work?
3. **Check Railway logs** - What errors appear in Railway logs?
4. **Verify URL** - Is your Railway URL different from the one in code?

Share these details and I can help further!


# Railway Backend Deployment Guide

## Problem
When visiting `https://nexus-crm-project-production.up.railway.app/api`, you see the frontend login page instead of the backend API. This means Railway is serving the frontend HTML file, not running the Node.js backend.

## Solution: Deploy Backend as Separate Service

The backend and frontend need to be deployed as **separate services** on Railway.

### Step 1: Deploy Backend Service

1. **Go to Railway Dashboard**: https://railway.app
2. **Create a New Service** (or use existing backend service):
   - Click "New Project" or select your existing project
   - Click "New Service"
   - Select "GitHub Repo" (connect your GitHub repo)
   - OR select "Empty Service" and connect later

3. **Configure Backend Service**:
   - **Root Directory**: Set to `backend` (important!)
   - **Start Command**: `node server.js` (or Railway will auto-detect from `package.json`)
   - **Build Command**: (leave empty, or `npm install` if needed)

4. **Set Environment Variables**:
   Go to your backend service → Variables tab, add:
   
   **Required:**
   ```
   JWT_SECRET=<generate-a-random-secret>
   ```
   Generate secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   
   **Database Variables** (usually auto-set by Railway):
   - `DB_USER` - Auto-set when you add PostgreSQL
   - `DB_HOST` - Auto-set when you add PostgreSQL
   - `DB_NAME` - Auto-set when you add PostgreSQL
   - `DB_PASSWORD` - Auto-set when you add PostgreSQL
   - `DB_PORT` - Auto-set when you add PostgreSQL
   
   **Optional:**
   ```
   ADMIN_PASSWORD=admin123
   PORT=3000
   ```

5. **Add PostgreSQL Database**:
   - In Railway project, click "New Service"
   - Select "PostgreSQL"
   - Railway will auto-set database environment variables

6. **Get Backend Service URL**:
   - Go to backend service → Settings → Networking
   - Copy the **public domain** (e.g., `nexus-crm-backend-production.up.railway.app`)
   - This is your backend API URL

### Step 2: Update Frontend to Point to Backend

1. **Update `index.html`**:
   Replace the API_BASE_URL with your backend service URL:
   
   ```javascript
   // Replace with YOUR backend service URL from Railway
   const API_BASE_URL = 'https://YOUR-BACKEND-SERVICE-URL.up.railway.app/api';
   ```
   
   Example:
   ```javascript
   const API_BASE_URL = 'https://nexus-crm-backend-production.up.railway.app/api';
   ```

### Step 3: Deploy Frontend (Separate Service)

1. **Create Frontend Service**:
   - In Railway, create another service for frontend
   - Connect to same GitHub repo
   - **Root Directory**: Leave empty (or set to root)
   - **Build Command**: (leave empty for static HTML)
   - **Start Command**: (leave empty, or use a static file server)

2. **OR Use Static File Hosting**:
   - Railway can serve static files
   - Or use Netlify/Vercel for frontend
   - Or serve frontend from backend (see below)

### Alternative: Serve Frontend from Backend

If you want to serve both from one service, update `backend/server.js`:

```javascript
// Serve static files from parent directory (where index.html is)
app.use(express.static(path.join(__dirname, '..')));

// API routes (must come after static files)
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/users', userRoutes);
```

Then:
- Deploy backend service with root directory set to project root
- Frontend will be served at root URL
- API will be at `/api/*`

### Step 4: Verify Backend is Running

1. **Check Railway Logs**:
   - Go to backend service → Logs tab
   - Look for: "Server running on port..."
   - Look for: "Database initialized successfully"

2. **Test Backend URL**:
   Visit: `https://YOUR-BACKEND-URL.up.railway.app/api`
   
   Should see:
   ```json
   {
     "message": "Nexus CRM Backend API is working!",
     "status": "ok",
     "timestamp": "..."
   }
   ```

3. **Test Login Endpoint**:
   ```bash
   curl -X POST https://YOUR-BACKEND-URL.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   ```

## Current Issue

Right now, Railway is serving `index.html` (frontend) instead of running the Node.js backend. You need to:

1. ✅ Deploy backend as separate service (or configure to run Node.js)
2. ✅ Update frontend API URL to point to backend service
3. ✅ Verify backend is accessible at `/api` endpoint

## Quick Check

1. **Is backend service running?**
   - Railway dashboard → Check backend service status
   - Check logs for "Server running..."

2. **What's the backend URL?**
   - Railway dashboard → Backend service → Settings → Networking
   - Copy the public domain

3. **Is frontend pointing to correct URL?**
   - Check `index.html` line 2870
   - Should point to backend service URL, not frontend URL

## Next Steps

1. Deploy backend service on Railway (separate from frontend)
2. Get backend service URL
3. Update `index.html` API_BASE_URL to backend URL
4. Test login again


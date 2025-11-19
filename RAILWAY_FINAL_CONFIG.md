# Railway Final Configuration - WORKING SETUP

## ✅ Correct Railway Settings

### Settings → Source (or Root Directory):
- **Root Directory:** `backend`
- This tells Railway to use the `backend` folder as the root

### Settings → Build:
- **Build Command:** (LEAVE EMPTY - let Railway auto-detect)
- Railway will automatically:
  - Detect `package.json` in backend folder
  - Install Node.js
  - Run `npm install` automatically

### Settings → Deploy:
- **Start Command:** `node server.js`
- This runs the backend server

## ✅ What the Code Does Now

1. **API Routes** (`/api/*`) - Work correctly
2. **Static Files** - Served from parent directory (where index.html is)
3. **Frontend** - Served at root `/` for all non-API routes
4. **Route Order** - Fixed! API routes come before catch-all

## ✅ After Deployment

1. **Visit root:** `https://nexus-crm-project-production.up.railway.app`
   - Should show: Login page ✅

2. **Visit API:** `https://nexus-crm-project-production.up.railway.app/api`
   - Should show: JSON response ✅

3. **Login:** Use `admin` / `admin123`
   - Should work ✅

## ⚠️ If Still Crashing

Check Railway Logs for:
1. Database connection errors
2. Missing environment variables (especially `JWT_SECRET`)
3. Port binding errors

The code is now fixed and should work!


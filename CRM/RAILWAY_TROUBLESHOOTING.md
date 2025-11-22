# Railway Deployment Troubleshooting

## Connection Error: "Is the server running?"

If you're getting a connection error when trying to log in, check the following:

### 1. ✅ Verify API URL is Using HTTPS

The frontend should use `https://` (not `http://`) for Railway deployments.

**Current configuration in `index.html`:**
```javascript
const API_BASE_URL = 'https://nexus-crm-project-production.up.railway.app/api';
```

### 2. ✅ Check if Railway Backend is Deployed

1. Go to your Railway dashboard: https://railway.app
2. Check if your backend service is running
3. Verify the service URL matches the one in `index.html`

### 3. ✅ Test Backend Directly

Open your browser and visit:
```
https://nexus-crm-project-production.up.railway.app/api
```

You should see: `{"message":"Server is working!"}`

If you get an error, the backend is not running or not accessible.

### 4. ✅ Check Railway Environment Variables

In Railway dashboard, verify these environment variables are set:

**Required:**
- `JWT_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `DB_USER` - Usually auto-set by Railway PostgreSQL
- `DB_HOST` - Usually auto-set by Railway PostgreSQL
- `DB_NAME` - Usually auto-set by Railway PostgreSQL
- `DB_PASSWORD` - Usually auto-set by Railway PostgreSQL
- `DB_PORT` - Usually auto-set by Railway PostgreSQL

**Optional:**
- `ADMIN_PASSWORD` - Default admin password (defaults to 'admin123')
- `PORT` - Usually auto-set by Railway

### 5. ✅ Check Railway Logs

1. Go to Railway dashboard
2. Click on your backend service
3. Check the "Logs" tab
4. Look for:
   - "Server running on port..."
   - "Database initialized successfully"
   - Any error messages

### 6. ✅ Verify Database Connection

The backend should automatically:
- Create database tables on startup
- Create admin user if it doesn't exist

Check logs for:
- "Database initialized successfully"
- "Admin user created" or "Admin user already exists"

### 7. ✅ Test Login Endpoint Directly

Use curl or Postman to test:

```bash
curl -X POST https://nexus-crm-project-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Expected response:
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### 8. ✅ Common Issues

#### Issue: CORS Error
**Solution:** The backend already has `cors()` enabled, so this shouldn't be an issue. If you see CORS errors, check Railway logs.

#### Issue: 404 Not Found
**Solution:** 
- Verify the Railway service URL is correct
- Check that the backend service is deployed and running
- Ensure the route `/api/auth/login` exists

#### Issue: 500 Server Error
**Solution:**
- Check Railway logs for database connection errors
- Verify all environment variables are set
- Check if `JWT_SECRET` is configured

#### Issue: Connection Timeout
**Solution:**
- Railway services may take 30-60 seconds to start
- Check if the service is still deploying
- Verify the service is not sleeping (Railway free tier may sleep after inactivity)

### 9. ✅ Quick Fix: Update API URL

If your Railway URL is different, update `index.html`:

```javascript
// Replace with your actual Railway URL
const API_BASE_URL = 'https://YOUR-RAILWAY-URL.up.railway.app/api';
```

### 10. ✅ Verify Backend is Accessible

Test the health check endpoint:
```
https://nexus-crm-project-production.up.railway.app/api
```

Should return: `{"message":"Server is working!"}`

## Still Having Issues?

1. **Check Railway Status**: https://status.railway.app
2. **Review Backend Logs**: Railway dashboard → Your service → Logs
3. **Verify Database**: Railway dashboard → PostgreSQL service → Check connection
4. **Test Locally**: Run backend locally to verify it works

## Local Testing

To test locally while Railway is down:

1. Update `index.html` API URL to:
   ```javascript
   const API_BASE_URL = 'http://localhost:3000/api';
   ```

2. Run backend locally:
   ```bash
   cd backend
   node server.js
   ```

3. Open frontend in browser


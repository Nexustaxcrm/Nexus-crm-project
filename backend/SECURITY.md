# Security Implementation Guide

## Overview
This document outlines the security measures implemented in the Nexus CRM application to protect against common vulnerabilities and attacks.

## Security Features Implemented

### 1. **Helmet.js - HTTP Security Headers**
- **Purpose**: Sets various HTTP headers to protect against common web vulnerabilities
- **Location**: `backend/server.js`
- **Features**:
  - Content Security Policy (CSP) to prevent XSS attacks
  - X-Content-Type-Options to prevent MIME type sniffing
  - X-Frame-Options to prevent clickjacking
  - X-XSS-Protection for additional XSS protection
  - Strict-Transport-Security for HTTPS enforcement

### 2. **CORS (Cross-Origin Resource Sharing) Restrictions**
- **Purpose**: Restricts which domains can access your API
- **Location**: `backend/server.js`
- **Allowed Origins**:
  - `https://nexus-crm-project-production.up.railway.app` (Production)
  - `http://localhost:3000` (Local development)
  - `http://localhost:5500` (Local development with Live Server)
  - `http://127.0.0.1:3000` and `http://127.0.0.1:5500` (Alternative localhost)

**Important**: Update the `allowedOrigins` array in `server.js` if you deploy to a different domain.

### 3. **Input Validation**
- **Purpose**: Prevents injection attacks and validates user input
- **Location**: 
  - `backend/routes/auth.js` - Login validation
  - `backend/routes/users.js` - User creation/update validation

**Validation Rules**:
- Username: 3-255 characters, alphanumeric + underscore + hyphen only
- Password: Minimum 6 characters, maximum 1000 characters
- Role: Must be one of: admin, employee, preparation
- SQL Injection: Basic pattern detection for common SQL keywords

### 4. **Rate Limiting**
- **Purpose**: Prevents brute force attacks and server overload
- **Location**: `backend/server.js`
- **Configuration**:
  - 500 requests per 15 minutes per IP address
  - Applied to all `/api/` routes

### 5. **Password Security**
- **Hashing**: All passwords are hashed using bcrypt (10 rounds)
- **Storage**: Passwords are never stored in plain text
- **Validation**: Minimum 6 characters required

### 6. **JWT Authentication**
- **Purpose**: Secure token-based authentication
- **Expiration**: 24 hours
- **Storage**: Tokens stored in `sessionStorage` (clears on browser close)
- **Validation**: All protected routes require valid JWT token

### 7. **HTTPS/SSL**
- **Enforcement**: Railway automatically provides SSL certificates
- **Encryption**: All data transmitted over HTTPS is encrypted

### 8. **Environment Variables**
- **Purpose**: Keeps sensitive data out of code
- **Protected Variables**:
  - `JWT_SECRET` - Never commit to Git
  - `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_NAME`, `DB_PORT` - Database credentials
  - `ADMIN_PASSWORD` - Default admin password

## Security Best Practices

### ✅ DO:
1. **Keep dependencies updated**: Run `npm audit` regularly
2. **Use strong JWT_SECRET**: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **Change default admin password**: After first login
4. **Monitor logs**: Check Railway logs for suspicious activity
5. **Use strong passwords**: Minimum 8 characters, mix of letters, numbers, symbols
6. **Update CORS origins**: When deploying to new domains

### ❌ DON'T:
1. **Commit `.env` files**: Never commit environment variables to Git
2. **Share JWT_SECRET**: Keep it private and rotate if compromised
3. **Disable security features**: Don't remove Helmet or CORS for convenience
4. **Use weak passwords**: Especially for admin accounts
5. **Expose database credentials**: Keep them in environment variables only

## Updating CORS for New Domains

If you deploy to a new domain, update `backend/server.js`:

```javascript
const allowedOrigins = [
    'https://your-new-domain.com',
    'https://nexus-crm-project-production.up.railway.app',
    'http://localhost:3000',
    // ... other origins
];
```

## Security Checklist

- [x] Helmet.js installed and configured
- [x] CORS restrictions in place
- [x] Input validation on all user inputs
- [x] Rate limiting enabled
- [x] Password hashing (bcrypt)
- [x] JWT authentication
- [x] HTTPS/SSL enabled
- [x] Environment variables for secrets
- [x] SQL injection protection
- [x] XSS protection (CSP headers)

## Reporting Security Issues

If you discover a security vulnerability, please:
1. **DO NOT** create a public GitHub issue
2. Contact the development team privately
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be fixed before public disclosure

## Additional Security Recommendations

### For Production:
1. **Enable Railway's built-in DDoS protection**
2. **Set up monitoring/alerts** for suspicious activity
3. **Regular security audits** of dependencies (`npm audit`)
4. **Backup database regularly**
5. **Implement IP whitelisting** for admin access (if needed)
6. **Add request logging** for audit trails
7. **Consider adding 2FA** for admin accounts (future enhancement)

### For Development:
1. Use different `JWT_SECRET` for development
2. Use local database for testing
3. Never commit real credentials to Git
4. Use `.env.example` file to document required variables

## Dependencies Security

To check for vulnerabilities in dependencies:
```bash
cd backend
npm audit
npm audit fix  # Automatically fix vulnerabilities
```

## Questions?

For security-related questions, refer to:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)


# Testing Checklist After Package Updates

Use this checklist to ensure everything works correctly after updating packages.

## Pre-Testing Setup

- [ ] Backup your project (or ensure Git is up to date)
- [ ] Note the current date/time of update
- [ ] Have admin credentials ready for testing

---

## 1. Server Startup Test

- [ ] Navigate to backend folder
- [ ] Run: `npm start`
- [ ] Server starts without errors
- [ ] No red error messages in console
- [ ] Server shows "Server running on http://localhost:3000"

**If errors occur:**
- Note the error message
- Check if it's related to a specific package
- Consider rolling back the update

---

## 2. Database Connection Test

- [ ] Server logs show "Database connected!"
- [ ] No database connection errors
- [ ] Database schema initialized successfully

---

## 3. Authentication Tests

### Admin Login
- [ ] Navigate to CRM login page
- [ ] Enter admin username and password
- [ ] Login successful
- [ ] Redirected to dashboard
- [ ] No console errors in browser

### Employee Login
- [ ] Logout (if logged in)
- [ ] Login as employee user
- [ ] Login successful
- [ ] Can see assigned work
- [ ] No console errors

---

## 4. Document Access Tests

### Admin Document Access
- [ ] Login as admin
- [ ] Navigate to a customer record
- [ ] Click "View" on a document
- [ ] Document opens successfully
- [ ] Click "Download" on a document
- [ ] Download works correctly

### Employee Document Access (with password)
- [ ] Login as employee
- [ ] Navigate to assigned customer
- [ ] Click "View" on a document
- [ ] Password prompt appears
- [ ] Enter admin password
- [ ] Document opens successfully
- [ ] Click "Download" on a document
- [ ] Password prompt appears again
- [ ] Enter admin password
- [ ] Download works correctly

---

## 5. Customer Management Tests

- [ ] View customer list
- [ ] Search for a customer
- [ ] Filter customers by status
- [ ] Open customer details
- [ ] Edit customer information (if admin)
- [ ] Save changes successfully

---

## 6. File Upload Tests

- [ ] Upload a document to a customer
- [ ] Upload an image file
- [ ] Upload a PDF file
- [ ] Verify files appear in document list
- [ ] Verify files can be viewed/downloaded

---

## 7. API Endpoint Tests

Open browser console (F12) and check for:
- [ ] No 404 errors
- [ ] No 500 errors
- [ ] No CORS errors
- [ ] API calls complete successfully

---

## 8. Performance Check

- [ ] Page loads in reasonable time (< 3 seconds)
- [ ] No significant slowdowns
- [ ] No memory leaks (check browser task manager)
- [ ] Server response times are normal

---

## 9. Browser Console Check

- [ ] Open browser Developer Tools (F12)
- [ ] Go to Console tab
- [ ] Check for red error messages
- [ ] Check for yellow warnings
- [ ] Note any new errors that weren't there before

---

## 10. Server Logs Check

- [ ] Check server terminal/console
- [ ] No new error messages
- [ ] No stack traces
- [ ] All routes loading correctly
- [ ] Database queries executing successfully

---

## If Issues Are Found

### Minor Issues (warnings, non-critical)
- [ ] Document the issue
- [ ] Continue testing
- [ ] Note if it affects functionality

### Major Issues (errors, broken features)
- [ ] **STOP TESTING**
- [ ] Document the exact error
- [ ] Note which feature is broken
- [ ] Check if it's related to a specific package update
- [ ] Consider rolling back the update

---

## Rollback Instructions

If you need to rollback:

1. **If using Git:**
   ```bash
   git checkout package.json package-lock.json
   npm install
   ```

2. **If not using Git:**
   - Restore `package.json` and `package-lock.json` from backup
   - Run: `npm install`

---

## Testing Sign-Off

- [ ] All critical features tested
- [ ] No blocking issues found
- [ ] Performance is acceptable
- [ ] Ready for production use

**Tested by:** _________________  
**Date:** _________________  
**Notes:** _________________

---

## Quick Test Commands

```bash
# Check if server starts
npm start

# Check for security issues
npm audit

# View installed packages
npm list --depth=0

# Check for outdated packages
npm outdated
```

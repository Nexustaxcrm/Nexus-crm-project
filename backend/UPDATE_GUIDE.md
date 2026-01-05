# Complete Package Update Guide

This guide will help you safely update your CRM software dependencies.

## 📋 Table of Contents

1. [Understanding Package Updates](#understanding-package-updates)
2. [Before You Start](#before-you-start)
3. [Update Methods](#update-methods)
4. [Automated Scripts](#automated-scripts)
5. [Manual Update Steps](#manual-update-steps)
6. [Testing After Updates](#testing-after-updates)
7. [Troubleshooting](#troubleshooting)

---

## Understanding Package Updates

### What are Package Updates?

Your CRM uses many software libraries (packages) like:
- **Express** - Web server framework
- **bcryptjs** - Password encryption
- **pg** - PostgreSQL database connector
- And many more...

These packages get updated by their developers to:
- Fix security vulnerabilities
- Add new features
- Fix bugs
- Improve performance

### Types of Updates

1. **Security Updates** - Fix vulnerabilities (update immediately!)
2. **Patch Updates** - Bug fixes (e.g., 4.18.2 → 4.18.3)
3. **Minor Updates** - New features, backward compatible (e.g., 4.18 → 4.19)
4. **Major Updates** - Breaking changes (e.g., 4.x → 5.x)

---

## Before You Start

### ✅ Prerequisites Checklist

- [ ] Node.js installed (version 18 or higher)
- [ ] npm installed (comes with Node.js)
- [ ] Access to your project folder
- [ ] Backup of your project (or Git repository)

### 🔒 Create a Backup

**Option 1: Using Git (Recommended)**
```bash
git add .
git commit -m "Before package update - [DATE]"
git push
```

**Option 2: Manual Backup**
- Copy entire project folder to another location
- Or copy `backend/package.json` and `backend/package-lock.json`

---

## Update Methods

### Method 1: Automated Script (Easiest) ⭐

**For Windows:**
1. Double-click `update-packages.bat`
2. Follow the prompts
3. Script will guide you through the process

**For Mac/Linux:**
1. Open Terminal
2. Navigate to backend folder: `cd backend`
3. Make script executable: `chmod +x update-packages.sh`
4. Run: `./update-packages.sh`

### Method 2: Command Line (Manual)

**Step 1: Open Terminal/Command Prompt**
- Windows: Press `Win + R`, type `cmd`, press Enter
- Mac: Press `Cmd + Space`, type `Terminal`, press Enter

**Step 2: Navigate to Backend Folder**
```bash
cd E:\Nexus-crm-project\backend
```
(Replace with your actual path)

**Step 3: Check Security Issues**
```bash
npm audit
```

**Step 4: Fix Security Issues**
```bash
npm audit fix
```

**Step 5: Check Outdated Packages**
```bash
npm outdated
```

**Step 6: Update Packages (Safe)**
```bash
npm update
```

**Step 7: Verify Updates**
```bash
npm list --depth=0
```

---

## Automated Scripts

### Available Scripts

1. **update-packages.bat / update-packages.sh**
   - Complete update process
   - Checks security
   - Updates packages
   - Shows results

2. **check-security.bat / check-security.sh**
   - Quick security check
   - Shows vulnerabilities
   - No updates performed

### How to Use Scripts

**Windows:**
1. Navigate to `backend` folder
2. Double-click the `.bat` file
3. Follow on-screen instructions

**Mac/Linux:**
1. Open Terminal
2. Navigate to `backend` folder
3. Run: `chmod +x script-name.sh`
4. Run: `./script-name.sh`

---

## Manual Update Steps

### Step-by-Step Process

#### 1. Check Current Status
```bash
cd backend
npm list --depth=0
```
This shows what packages you currently have.

#### 2. Check for Security Issues
```bash
npm audit
```
**If vulnerabilities found:**
```bash
npm audit fix
```

#### 3. Check for Updates
```bash
npm outdated
```
This shows:
- **Current**: What you have
- **Wanted**: Safe update version
- **Latest**: Latest available (may break things)

#### 4. Update Packages

**Safe Update (Recommended):**
```bash
npm update
```
Updates within current version ranges (e.g., 4.18.x stays in 4.x)

**Update to Latest (Advanced):**
```bash
npm install -g npm-check-updates
ncu -u
npm install
```
⚠️ **Warning**: May introduce breaking changes!

#### 5. Verify Updates
```bash
npm list --depth=0
npm audit
```

---

## Testing After Updates

### Quick Test Checklist

1. **Start Server**
   ```bash
   npm start
   ```
   - [ ] Server starts without errors
   - [ ] Shows "Server running on http://localhost:3000"

2. **Test Login**
   - [ ] Admin login works
   - [ ] Employee login works
   - [ ] No console errors

3. **Test Document Access**
   - [ ] Admin can view/download documents
   - [ ] Employee can view/download (with password)
   - [ ] No errors in console

4. **Check Browser Console**
   - [ ] Open Developer Tools (F12)
   - [ ] Check Console tab
   - [ ] No red errors
   - [ ] No new warnings

5. **Check Server Logs**
   - [ ] No error messages
   - [ ] Routes loading correctly
   - [ ] Database connected

### Full Testing Checklist

See `TESTING_CHECKLIST.md` for comprehensive testing guide.

---

## Troubleshooting

### Problem: Server Won't Start

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules
rm package-lock.json
npm install
```

### Problem: "Module not found" Error

**Solution:**
```bash
npm install
```

### Problem: Breaking Changes After Update

**Solution:**
1. Check which package was updated
2. Look at package changelog
3. Rollback if needed:
   ```bash
   git checkout package.json package-lock.json
   npm install
   ```

### Problem: Security Vulnerabilities Remain

**Solution:**
```bash
# Try force fix (may break things)
npm audit fix --force

# Or update specific vulnerable package
npm install package-name@latest
```

---

## Current Security Status

### ⚠️ Known Vulnerabilities

Based on latest audit, you have:
- **5 high severity vulnerabilities**
- Some can be fixed with `npm audit fix`
- `xlsx` package has known issues (no fix available yet)

### Recommended Actions

1. **Immediate:** Run `npm audit fix`
2. **Monitor:** Check for `xlsx` package updates
3. **Consider:** Alternative to `xlsx` if issues persist

---

## Update Schedule Recommendations

- **Security Updates**: Immediately (weekly check)
- **Patch Updates**: Monthly
- **Minor Updates**: Quarterly
- **Major Updates**: Annually (with thorough testing)

---

## Quick Reference Commands

| Task | Command |
|------|---------|
| Check security | `npm audit` |
| Fix security | `npm audit fix` |
| Check outdated | `npm outdated` |
| Safe update | `npm update` |
| View packages | `npm list --depth=0` |
| Install package | `npm install package-name@latest` |
| Reinstall all | `rm -rf node_modules && npm install` |

---

## Need Help?

If you encounter issues:

1. **Document the error:**
   - Copy the exact error message
   - Note which command you ran
   - Check server logs

2. **Check package documentation:**
   - Visit package's GitHub page
   - Look for "Breaking Changes" section

3. **Rollback if needed:**
   - Restore from backup
   - Or use Git to revert

---

## Summary

1. ✅ **Backup first** (Git or manual copy)
2. ✅ **Check security** (`npm audit`)
3. ✅ **Fix security** (`npm audit fix`)
4. ✅ **Update packages** (`npm update`)
5. ✅ **Test thoroughly** (use TESTING_CHECKLIST.md)
6. ✅ **Monitor** (check weekly for security updates)

**Remember:** When in doubt, test in a development environment first!

# 🚀 Quick Start: Update Packages

## For Complete Beginners

### Option 1: Use the Automated Script (Easiest!)

**Windows Users:**
1. Open File Explorer
2. Navigate to: `E:\Nexus-crm-project\backend`
3. Double-click: `update-packages.bat`
4. Follow the on-screen instructions
5. Done! ✅

**Mac/Linux Users:**
1. Open Terminal
2. Type: `cd E:\Nexus-crm-project\backend` (or your path)
3. Type: `chmod +x update-packages.sh`
4. Type: `./update-packages.sh`
5. Done! ✅

---

### Option 2: Manual Update (Step-by-Step)

#### Step 1: Open Command Prompt
- **Windows:** Press `Windows Key + R`, type `cmd`, press Enter
- **Mac:** Press `Command + Space`, type `Terminal`, press Enter

#### Step 2: Go to Backend Folder
Type this (replace with your actual path):
```bash
cd E:\Nexus-crm-project\backend
```
Press Enter.

#### Step 3: Check Security
Type:
```bash
npm audit
```
Press Enter.

#### Step 4: Fix Security Issues
Type:
```bash
npm audit fix
```
Press Enter.

#### Step 5: Update Packages
Type:
```bash
npm update
```
Press Enter.

#### Step 6: Test Your Application
Type:
```bash
npm start
```
Press Enter.

If server starts without errors, you're done! ✅

---

## ⚠️ Important Notes

1. **Always backup first!** (Copy your project folder or use Git)

2. **Test after updating:**
   - Start the server
   - Try logging in
   - Try viewing documents
   - Check for errors

3. **If something breaks:**
   - Don't panic!
   - Restore from backup
   - Or ask for help with the error message

---

## 📚 Need More Help?

- See `UPDATE_GUIDE.md` for detailed instructions
- See `TESTING_CHECKLIST.md` for testing steps
- Run `check-security.bat` to check security anytime

---

## ✅ Quick Checklist

- [ ] Backup created
- [ ] Ran update script or manual commands
- [ ] Security issues fixed
- [ ] Packages updated
- [ ] Server starts successfully
- [ ] Login works
- [ ] Documents can be viewed
- [ ] No errors in console

**All checked? You're good to go!** 🎉

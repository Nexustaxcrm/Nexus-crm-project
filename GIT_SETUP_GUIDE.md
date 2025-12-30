# Git Setup and GitHub Push Guide

This guide will help you push your changes to GitHub.

## Quick Status Check

Your project has:
- ✅ `.gitignore` file (properly configured)
- ✅ New files: `README.md` and `backend/.env.example`
- ⚠️ Git command line tools need to be set up

## Option 1: Using GitHub Desktop (Recommended for Beginners)

### If you have GitHub Desktop installed:

1. **Open GitHub Desktop**
2. **Add Repository**:
   - Click `File` → `Add Local Repository`
   - Browse to: `E:\Nexus-crm-project`
   - Click `Add Repository`

3. **Review Changes**:
   - You'll see `README.md` and `backend/.env.example` as new files
   - Review the changes in the left panel

4. **Commit Changes**:
   - At the bottom, type a commit message: `Add README.md and .env.example files`
   - Click `Commit to main` (or your branch name)

5. **Push to GitHub**:
   - Click `Push origin` button (top right)
   - If not connected to GitHub, you'll be prompted to publish the repository

### If repository is not connected to GitHub:

1. Click `Repository` → `Repository Settings` → `Remote`
2. Add your GitHub repository URL:
   ```
   https://github.com/yourusername/your-repo-name.git
   ```
3. Click `Save`
4. Then push as described above

## Option 2: Using Git Command Line

### Step 1: Install Git (if not installed)

1. Download Git for Windows: https://git-scm.com/download/win
2. Run the installer (use default options)
3. **Important**: Restart your terminal/PowerShell after installation

### Step 2: Verify Installation

Open PowerShell and run:
```powershell
git --version
```

You should see something like: `git version 2.x.x`

### Step 3: Configure Git (First Time Only)

```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Step 4: Initialize Repository (if not already done)

```powershell
cd E:\Nexus-crm-project
git init
```

### Step 5: Check Status

```powershell
git status
```

This shows:
- Files that are new (like `README.md`)
- Files that are modified
- Files that are ignored (like `.env`, `node_modules/`)

### Step 6: Add Files to Staging

```powershell
# Add all changes
git add .

# Or add specific files
git add README.md
git add backend/.env.example
```

### Step 7: Commit Changes

```powershell
git commit -m "Add README.md and .env.example files"
```

### Step 8: Connect to GitHub (if not already connected)

```powershell
# Add remote repository (replace with your actual GitHub repo URL)
git remote add origin https://github.com/yourusername/your-repo-name.git

# Verify remote is added
git remote -v
```

### Step 9: Push to GitHub

```powershell
# Push to main branch (or 'master' if that's your branch name)
git push -u origin main

# If your branch is called 'master', use:
# git push -u origin master
```

## Option 3: Using VS Code (If you use VS Code)

1. **Open VS Code** in your project folder
2. **Open Source Control** panel (Ctrl+Shift+G)
3. You'll see your changes listed
4. **Stage changes**: Click `+` next to files or click `+` next to "Changes"
5. **Commit**: Type message and click checkmark
6. **Push**: Click `...` menu → `Push`

## Troubleshooting

### "Git is not recognized"
- Git is not installed or not in PATH
- Install Git from: https://git-scm.com/download/win
- Restart terminal after installation

### "Repository not found" or "Authentication failed"
- Check your GitHub repository URL is correct
- You may need to authenticate:
  - GitHub Desktop: Sign in through the app
  - Command line: Use Personal Access Token instead of password
    - Generate token: GitHub → Settings → Developer settings → Personal access tokens

### "Branch 'main' does not exist"
- Your default branch might be 'master'
- Use: `git push -u origin master`

### "Everything up-to-date"
- All changes are already pushed
- Check GitHub to verify

## What Gets Pushed

✅ **Will be pushed:**
- `README.md` (new file)
- `backend/.env.example` (new file)
- All other project files

❌ **Will NOT be pushed** (protected by `.gitignore`):
- `backend/.env` (contains secrets)
- `node_modules/` (dependencies)
- `backend/uploads/` (uploaded files)
- Log files
- OS files

## Next Steps After Pushing

1. **Verify on GitHub**: Go to your repository on GitHub.com and check files are there
2. **Update Railway** (if using Railway): Railway will auto-deploy from GitHub
3. **Share Repository**: Others can now clone and contribute

## Quick Reference Commands

```powershell
# Check status
git status

# Add all changes
git add .

# Commit
git commit -m "Your commit message"

# Push
git push origin main

# Check remote
git remote -v

# View commit history
git log --oneline
```

## Need Help?

- GitHub Desktop Help: https://docs.github.com/en/desktop
- Git Documentation: https://git-scm.com/doc
- GitHub Guides: https://guides.github.com/

---

**Remember**: Never commit `.env` files - they contain sensitive information and are already in `.gitignore`!


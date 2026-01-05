#!/bin/bash

echo "========================================"
echo "Nexus CRM - Package Update Script"
echo "========================================"
echo ""

# Navigate to backend directory
cd "$(dirname "$0")"

echo "Step 1: Checking current directory..."
pwd
echo ""

echo "Step 2: Checking for security vulnerabilities..."
npm audit
echo ""

echo "Step 3: Checking for outdated packages..."
npm outdated
echo ""

echo "Step 4: Fixing security vulnerabilities automatically..."
npm audit fix
echo ""

echo "Step 5: Updating packages (safe updates only)..."
npm update
echo ""

echo "Step 6: Re-checking for security vulnerabilities..."
npm audit
echo ""

echo "Step 7: Showing updated package list..."
npm list --depth=0
echo ""

echo "========================================"
echo "Update process completed!"
echo "========================================"
echo ""
echo "IMPORTANT: Please test your application after updating:"
echo "1. Run: npm start"
echo "2. Test login functionality"
echo "3. Test document viewing"
echo "4. Check browser console for errors"
echo ""

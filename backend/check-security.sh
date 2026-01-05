#!/bin/bash

echo "========================================"
echo "Nexus CRM - Security Check Script"
echo "========================================"
echo ""

# Navigate to backend directory
cd "$(dirname "$0")"

echo "Checking for security vulnerabilities..."
echo ""
npm audit
echo ""

echo "========================================"
echo "Security check completed!"
echo "========================================"
echo ""
echo "To fix issues automatically, run: npm audit fix"
echo ""

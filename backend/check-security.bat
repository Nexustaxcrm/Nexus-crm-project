@echo off
echo ========================================
echo Nexus CRM - Security Check Script
echo ========================================
echo.

REM Navigate to backend directory
cd /d "%~dp0"

echo Checking for security vulnerabilities...
echo.
call npm audit
echo.

echo ========================================
echo Security check completed!
echo ========================================
echo.
echo To fix issues automatically, run: npm audit fix
echo.
pause

@echo off
echo ========================================
echo Nexus CRM - Package Update Script
echo ========================================
echo.

REM Navigate to backend directory
cd /d "%~dp0"

echo Step 1: Checking current directory...
cd
echo Current directory: %CD%
echo.

echo Step 2: Checking for security vulnerabilities...
call npm audit
echo.

echo Step 3: Checking for outdated packages...
call npm outdated
echo.

echo Step 4: Do you want to fix security vulnerabilities automatically?
echo (This will run: npm audit fix)
set /p fixSecurity="Fix security issues? (Y/N): "
if /i "%fixSecurity%"=="Y" (
    echo.
    echo Fixing security vulnerabilities...
    call npm audit fix
    echo.
)

echo Step 5: Do you want to update packages?
echo (This will run: npm update - safe updates only)
set /p updatePackages="Update packages? (Y/N): "
if /i "%updatePackages%"=="Y" (
    echo.
    echo Updating packages...
    call npm update
    echo.
)

echo Step 6: Re-checking for security vulnerabilities...
call npm audit
echo.

echo Step 7: Showing updated package list...
call npm list --depth=0
echo.

echo ========================================
echo Update process completed!
echo ========================================
echo.
echo IMPORTANT: Please test your application after updating:
echo 1. Run: npm start
echo 2. Test login functionality
echo 3. Test document viewing
echo 4. Check browser console for errors
echo.
pause

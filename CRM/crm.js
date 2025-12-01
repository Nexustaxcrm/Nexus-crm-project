// Helpers to robustly read workbooks
function readWorkbookFromArrayBuffer(buffer) {
    // Try multiple read strategies to maximize compatibility
    try {
        return XLSX.read(buffer, { type: 'array' });
    } catch (e1) {
        try {
            return XLSX.read(new Uint8Array(buffer), { type: 'array' });
        } catch (e2) {
            try {
                return XLSX.read(buffer, { type: 'buffer' });
            } catch (e3) {
                throw e3;
            }
        }
    }
}

function getFirstNonEmptySheet(workbook) {
    const names = workbook.SheetNames || [];
    for (let i = 0; i < names.length; i++) {
        const ws = workbook.Sheets[names[i]];
        if (ws && ws['!ref']) return ws;
    }
    // Fallback to first even if !ref missing
    return workbook.Sheets[names[0]];
}
// CRM System - Main JavaScript Application

// Global Variables
let currentUser = null;
let customers = [];
let users = [];
let currentChart = null;
let callStatusChart = null;
let monthlyComparisonChart = null;
let userProfiles = [];

// Copy Phone Number to Clipboard Function
// Make it globally available
// CRITICAL: This function prioritizes execCommand for macOS compatibility
window.copyPhoneNumber = function copyPhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber.trim() === '') {
        showNotification('error', 'Copy Failed', 'No phone number to copy');
        return;
    }
    
    // Clean the phone number (remove tel: prefix if present, trim whitespace)
    const cleanPhone = phoneNumber.replace(/^tel:/i, '').trim();
    
    console.log('📋 Copying phone number:', cleanPhone);
    
    // CRITICAL FOR MACOS: Use execCommand first (doesn't require document focus)
    // This is the most reliable method for macOS browsers
    const textArea = document.createElement('textarea');
    textArea.value = cleanPhone;
    
    // Position it off-screen but still in viewport (required for some browsers)
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    textArea.style.width = '1px';
    textArea.style.height = '1px';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    textArea.setAttribute('readonly', '');
    textArea.setAttribute('aria-hidden', 'true');
    
    document.body.appendChild(textArea);
    
    // Focus and select the textarea
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, cleanPhone.length);
    
    let copySuccess = false;
    
    try {
        // PRIMARY METHOD: execCommand (works best on macOS, doesn't need document focus)
        copySuccess = document.execCommand('copy');
        
        if (copySuccess) {
            document.body.removeChild(textArea);
            showNotification('success', 'Copied!', `Phone number "${cleanPhone}" copied to clipboard`, 2000);
            console.log('✅ Phone number copied successfully (execCommand method)');
            return;
        }
    } catch (execError) {
        console.log('execCommand failed:', execError);
    }
    
    // FALLBACK: Try Clipboard API only if execCommand failed
    // But wrap it in a try-catch to handle focus issues
    if (!copySuccess && navigator.clipboard && navigator.clipboard.writeText) {
        // Remove textarea first
        document.body.removeChild(textArea);
        
        // Try Clipboard API as fallback
        navigator.clipboard.writeText(cleanPhone).then(() => {
            showNotification('success', 'Copied!', `Phone number "${cleanPhone}" copied to clipboard`, 2000);
            console.log('✅ Phone number copied successfully (Clipboard API fallback)');
        }).catch((clipboardError) => {
            console.error('Clipboard API also failed:', clipboardError);
            showNotification('error', 'Copy Failed', 'Unable to copy phone number. Please try selecting and copying manually.');
        });
        return;
    }
    
    // If execCommand failed and Clipboard API is not available, show error
    document.body.removeChild(textArea);
    console.error('❌ All copy methods failed');
    showNotification('error', 'Copy Failed', 'Unable to copy phone number. Please try selecting and copying manually.');
};

// Notification System
function showNotification(type, title, message, duration = 4000) {
    const container = document.getElementById('notificationContainer');
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        success: 'fas fa-check',
        error: 'fas fa-times',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    // XSS-safe: Create elements instead of using innerHTML with user input
    const iconDiv = document.createElement('div');
    iconDiv.className = 'notification-icon';
    const icon = document.createElement('i');
    icon.className = icons[type] || 'fas fa-info-circle';
    iconDiv.appendChild(icon);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'notification-content';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'notification-title';
    titleDiv.textContent = title; // Safe: textContent escapes HTML
    const messageDiv = document.createElement('div');
    messageDiv.className = 'notification-message';
    messageDiv.textContent = message; // Safe: textContent escapes HTML
    contentDiv.appendChild(titleDiv);
    contentDiv.appendChild(messageDiv);
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.onclick = () => closeNotification(closeBtn);
    const closeIcon = document.createElement('i');
    closeIcon.className = 'fas fa-times';
    closeBtn.appendChild(closeIcon);
    
    notification.appendChild(iconDiv);
    notification.appendChild(contentDiv);
    notification.appendChild(closeBtn);
    
    container.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            closeNotification(notification.querySelector('.notification-close'));
        }, duration);
    }
}

function closeNotification(closeBtn) {
    const notification = closeBtn.closest('.notification');
    notification.classList.remove('show');
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    initializeDragAndDrop();
});

function initializeDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    
    if (!uploadArea) return;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    uploadArea.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    document.getElementById('uploadArea').classList.add('dragover');
}

function unhighlight(e) {
    document.getElementById('uploadArea').classList.remove('dragover');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        const file = files[0];
        if (file.name.endsWith('.csv')) {
            selectedFile = file;
            document.getElementById('csvFile').files = files;
            showFileInfo(file);
        } else {
            showNotification('error', 'Invalid File Type', 'Only CSV files are allowed.');
        }
    }
}

function initializeApp() {
    // CRITICAL: Load currentUser from sessionStorage if available (for page refreshes)
    const userStr = sessionStorage.getItem('currentUser');
    if (userStr) {
        try {
            currentUser = JSON.parse(userStr);
            window.currentUser = currentUser; // Also set on window for global access
            console.log('✅ Loaded currentUser from sessionStorage:', currentUser.username, currentUser.role);
        } catch (e) {
            console.error('Error parsing currentUser from sessionStorage:', e);
            currentUser = null;
        }
    }
    
    // Check if customer is logged in first - if so, don't initialize admin app
    const customerLoggedIn = sessionStorage.getItem('customerLoggedIn');
    if (customerLoggedIn === 'true') {
        // Customer is logged in, hide everything and let customer script handle it
        const loginPage = document.getElementById('loginPage');
        const dashboardPage = document.getElementById('dashboardPage');
        if (loginPage) loginPage.style.display = 'none';
        if (dashboardPage) dashboardPage.style.display = 'none';
        // Customer page will be shown by checkCustomerLogin() in customer script
        return;
    }
    
    // Check if user is a customer - don't load admin/employee data
    if (currentUser && currentUser.role === 'customer') {
        console.log('✅ Customer user detected, showing customer dashboard');
        console.log('Customer user info:', { id: currentUser.id, username: currentUser.username, role: currentUser.role });
        showDashboard();
        // Setup event listeners
        setupEventListeners();
        return;
    }
    
    // Load users from database (only for admin/employee)
    loadUsers();
    // Load customers from database (only for admin/employee)
    loadCustomers();
    // Load user profiles from sessionStorage
    loadUserProfiles();
    
    // Check if user is already logged in (from sessionStorage)
    if (currentUser && sessionStorage.getItem('authToken')) {
        // User is already logged in, show dashboard instead of login
        console.log('User already logged in, showing dashboard');
        showDashboard();
    } else {
        // No user logged in, show login page
    showLogin();
    }
    
    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Setup navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
        });
    });
    
    // CRITICAL: Add double-click event delegation for phone number copying
    // This works for all phone links, even those added dynamically
    // Use debounce to prevent duplicate copies when both dblclick and click methods fire
    let lastCopyTime = 0;
    let lastCopiedPhone = null;
    const COPY_DEBOUNCE_DELAY = 500; // milliseconds - prevent duplicate copies within this time
    
    // Helper function to handle phone number copying with debounce
    function handlePhoneCopy(phoneLink, source) {
        // Get phone number from href attribute (removes tel: prefix) or text content
        let phoneNumber = phoneLink.getAttribute('href');
        if (!phoneNumber || phoneNumber.trim() === '') {
            phoneNumber = phoneLink.textContent.trim();
        }
        
        const now = Date.now();
        
        // Debounce: prevent duplicate copies if same phone was just copied
        if (lastCopiedPhone === phoneNumber && (now - lastCopyTime) < COPY_DEBOUNCE_DELAY) {
            console.log('⏭️ Skipping duplicate copy (debounced):', phoneNumber);
            return;
        }
        
        // Update last copy info
        lastCopyTime = now;
        lastCopiedPhone = phoneNumber;
        
        console.log(`📞 Double-click detected (${source}) on phone link:`, phoneNumber);
        if (window.copyPhoneNumber) {
            window.copyPhoneNumber(phoneNumber);
        } else {
            copyPhoneNumber(phoneNumber);
        }
    }
    
    // Method 1: Native dblclick event (primary method)
    document.addEventListener('dblclick', function(e) {
        // Check if double-clicked element is a phone link or inside a phone link
        let phoneLink = e.target.closest('a[href^="tel:"]');
        
        // Also check if the clicked element itself is a phone link
        if (!phoneLink && e.target.tagName === 'A' && e.target.getAttribute('href') && e.target.getAttribute('href').startsWith('tel:')) {
            phoneLink = e.target;
        }
        
        if (phoneLink) {
            e.preventDefault(); // Prevent default tel: link behavior on double-click
            e.stopPropagation(); // Stop event from bubbling
            
            handlePhoneCopy(phoneLink, 'dblclick');
        }
    }, true); // Use capture phase to catch event early
    
    // Method 2: Click-based double-click detection (fallback for browsers that don't fire dblclick properly)
    let lastClickTime = 0;
    let lastClickTarget = null;
    const DOUBLE_CLICK_DELAY = 300; // milliseconds
    
    document.addEventListener('click', function(e) {
        const now = Date.now();
        let phoneLink = e.target.closest('a[href^="tel:"]');
        
        if (!phoneLink && e.target.tagName === 'A' && e.target.getAttribute('href') && e.target.getAttribute('href').startsWith('tel:')) {
            phoneLink = e.target;
        }
        
        if (phoneLink) {
            // Check if this is a double-click (two clicks within DOUBLE_CLICK_DELAY ms on the same element)
            if (lastClickTarget === phoneLink && (now - lastClickTime) < DOUBLE_CLICK_DELAY) {
                e.preventDefault();
                e.stopPropagation();
                
                handlePhoneCopy(phoneLink, 'click');
                
                // Reset to prevent triple-click issues
                lastClickTime = 0;
                lastClickTarget = null;
            } else {
                // Store this click for potential double-click detection
                lastClickTime = now;
                lastClickTarget = phoneLink;
                
                // Clear after delay
                setTimeout(() => {
                    if (lastClickTarget === phoneLink) {
                        lastClickTime = 0;
                        lastClickTarget = null;
                    }
                }, DOUBLE_CLICK_DELAY);
            }
        }
    }, true);
    
    console.log('✅ Phone number copy functionality initialized');
}

// Authentication Functions
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const loginForm = document.getElementById('loginForm');
    // Get login method from form data attribute (set when method button is clicked)
    const loginMethod = loginForm ? loginForm.getAttribute('data-login-method') : '';
    
    // Validate that a login method was selected
    if (!loginMethod || (loginMethod !== 'password' && loginMethod !== 'otp')) {
        showNotification('error', 'Validation Error', 'Please select a login method (Password or OTP)');
        return;
    }
    const password = document.getElementById('password').value;
    const otp = document.getElementById('otp').value.trim();
    
    console.log('🔐 Login method:', loginMethod);
    console.log('🔐 Username:', username);
    console.log('🔐 Has password:', !!password);
    console.log('🔐 Has OTP:', !!otp);
    
    // Validate inputs
    if (!username) {
        showNotification('error', 'Validation Error', 'User Name / Email is required');
        return;
    }
    
    // Validate based on login method
    if (loginMethod === 'password') {
        if (!password || password.trim() === '') {
            showNotification('error', 'Validation Error', 'Password is required');
            return;
        }
    } else if (loginMethod === 'otp') {
        if (!otp) {
            showNotification('error', 'Validation Error', 'OTP is required');
            return;
        }
        if (otp.length !== 6 || !/^\d+$/.test(otp)) {
            showNotification('error', 'Validation Error', 'OTP must be 6 digits');
            return;
        }
    }
    
    // Check if API_BASE_URL is defined
    if (typeof API_BASE_URL === 'undefined') {
        console.error('❌ API_BASE_URL is not defined!');
        showNotification('error', 'Configuration Error', 'API URL is not configured. Please contact support.');
        return;
    }
    
    // Normalize username to lowercase for case-insensitive comparison
    const usernameLower = username.toLowerCase();
    
    // Check if customer login credentials first (case-insensitive)
    if (usernameLower === 'customer' && password === 'customer') {
        // Customer login - show customer dashboard
        sessionStorage.setItem('customerLoggedIn', 'true');
        sessionStorage.setItem('customerUsername', username);
        
        // Hide all admin pages
        const loginPage = document.getElementById('loginPage');
        const dashboardPage = document.getElementById('dashboardPage');
        if (loginPage) {
            loginPage.style.display = 'none';
        }
        if (dashboardPage) {
            dashboardPage.style.display = 'none';
        }
        
        // Show customer dashboard
        const customerDashboard = document.getElementById('customerDashboardPage');
        if (customerDashboard) {
            customerDashboard.style.display = 'block';
            
            // Load customer data if function exists
            if (typeof loadCustomerData === 'function') {
                loadCustomerData();
            }
        }
        return;
    }
    
    // Check if preparation login credentials (case-insensitive)
    if (usernameLower === 'preparation' && password === 'preparation') {
        // Preparation login - same dashboard as employee
        const mockUser = {
            id: 1,
            username: username,
            role: 'preparation'
        };
        
        sessionStorage.setItem('authToken', 'dev-token-' + Date.now());
        sessionStorage.setItem('currentUser', JSON.stringify(mockUser));
        currentUser = mockUser;
        showDashboard();
        showNotification('success', 'Login Successful', 'Welcome back!');
        return;
    }
    
    // Development mode: If server is not available, allow login for frontend development
    const DEV_MODE = true; // Set to false when backend is connected
    
    try {
        // Try to connect to server first with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for Railway
        
        console.log('📡 Attempting login for username:', usernameLower);
        console.log('📡 API URL:', API_BASE_URL + '/auth/login');
        
        // Prepare request body based on login method
        const requestBody = loginMethod === 'otp' 
            ? { username: usernameLower, otp: otp }
            : { username: usernameLower, password: password };
        
        console.log('📤 Sending login request:', {
            method: loginMethod,
            username: usernameLower,
            hasPassword: !!password,
            passwordLength: password ? password.length : 0,
            hasOTP: !!otp
        });
        
        const response = await fetch(API_BASE_URL + '/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('📡 Login response status:', response.status, response.statusText);
        
        // Parse response - handle both JSON and non-JSON responses
        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            try {
                data = await response.json();
            } catch (jsonError) {
                console.error('❌ Failed to parse JSON response:', jsonError);
                const textResponse = await response.text();
                console.error('❌ Response body:', textResponse);
                showNotification('error', 'Login Failed', 'Server returned invalid response. Please try again.');
                return;
            }
        } else {
            // Non-JSON response (shouldn't happen, but handle it)
            const textResponse = await response.text();
            console.error('❌ Non-JSON response received:', textResponse);
            showNotification('error', 'Login Failed', 'Server returned unexpected response format.');
            return;
        }
        
        if (response.ok) {
            // Login successful - save token and user info
            console.log('✅ Login successful, user data:', data.user);
            sessionStorage.setItem('authToken', data.token);
            sessionStorage.setItem('currentUser', JSON.stringify(data.user));
            currentUser = data.user;
            // Also set on window for global access
            window.currentUser = data.user;
            
            // If customer role, ensure customer dashboard is shown
            if (data.user.role === 'customer') {
                console.log('🎯 Customer login detected, routing to customer dashboard');
                
                // Check if password change is required
                if (data.requiresPasswordChange || data.user.tempPassword) {
                    console.log('🔐 Temporary password detected - showing password change modal');
                    // Show password change modal instead of dashboard
                    showPasswordChangeModal();
                    return;
                }
                
                // Hide login page and admin dashboard
                const loginPage = document.getElementById('loginPage');
                const dashboardPage = document.getElementById('dashboardPage');
                if (loginPage) {
                    loginPage.style.display = 'none';
                }
                if (dashboardPage) {
                    dashboardPage.style.display = 'none';
                }
                // Show customer dashboard
                const customerDashboard = document.getElementById('customerDashboardPage');
                if (customerDashboard) {
                    customerDashboard.style.display = 'block';
                    // Load customer data
                    if (typeof loadCustomerDashboard === 'function') {
                        loadCustomerDashboard();
                    }
                }
                showNotification('success', 'Login Successful', 'Welcome to your dashboard!');
                return; // Don't call showDashboard() for customers
            }
            
            showDashboard();
            showNotification('success', 'Login Successful', 'Welcome back!');
        } else {
            // Login failed - show detailed error
            console.error('❌ Login failed:', data);
            const errorMsg = data.error || 'Invalid credentials';
            showNotification('error', 'Login Failed', errorMsg);
            
            // If it's a customer account issue, provide helpful message
            if (errorMsg.includes('username') || errorMsg.includes('password')) {
                console.log('💡 Tip: Check that username and password are correct');
            }
        }
    } catch (error) {
        // Log full error details for debugging
        const apiUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL + '/auth/login' : 'API_BASE_URL not defined';
        console.error('❌ Login error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            apiUrl: apiUrl,
            username: usernameLower
        });
        
        // Provide detailed error message
        let errorMessage = 'Connection error. ';
        
        if (error.name === 'AbortError') {
            errorMessage += 'Request timed out. The server may be slow or unreachable.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            const baseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'undefined';
            errorMessage += `Cannot reach server at ${baseUrl}. `;
            errorMessage += 'Please check: 1) Is Railway backend deployed? 2) Is the URL correct? 3) Check browser console for CORS errors.';
        } else if (error.message.includes('CORS')) {
            errorMessage += 'CORS error. Backend may not be configured correctly.';
        } else if (error.message.includes('JSON') || error.message.includes('Unexpected token')) {
            errorMessage += 'Invalid response from server. Please try again or contact support.';
            console.error('❌ This might be a JSON parsing error. Check server response format.');
        } else {
            errorMessage += error.message || 'Unknown error occurred.';
        }
        
        // Server is not available - use development mode if enabled
        if (DEV_MODE && (error.name === 'AbortError' || error.message.includes('Failed to fetch'))) {
            console.warn('Server not available - using development mode');
            
            // Create a mock user based on username
            let userRole = 'employee';
            if (username.toLowerCase() === 'admin') {
                userRole = 'admin';
            } else if (username.toLowerCase() === 'preparation') {
                userRole = 'preparation';
            }
            
            const mockUser = {
                id: 1,
                username: username,
                role: userRole
            };
            
            // Save mock user for development (using sessionStorage - clears when browser closes)
            sessionStorage.setItem('authToken', 'dev-token-' + Date.now());
            sessionStorage.setItem('currentUser', JSON.stringify(mockUser));
            currentUser = mockUser;
            // Also set on window for global access
            window.currentUser = mockUser;
            showDashboard();
            showNotification('info', 'Development Mode', 'Server not connected - using offline mode. Check console for details.');
        } else {
            showNotification('error', 'Login Failed', errorMessage);
        }
    }
}

function logout() {
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('authToken');
    currentUser = null;
    showLogin();
}

function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('dashboardPage').style.display = 'none';
    // Hide customer dashboard if it exists
    const customerDashboard = document.getElementById('customerDashboardPage');
    if (customerDashboard) {
        customerDashboard.style.display = 'none';
    }
}

async function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    
    // Check if user is a customer - show customer dashboard instead
    if (currentUser && currentUser.role === 'customer') {
        console.log('🎯 showDashboard: Customer role detected, showing customer dashboard');
        document.getElementById('dashboardPage').style.display = 'none';
        const customerDashboard = document.getElementById('customerDashboardPage');
        if (customerDashboard) {
            customerDashboard.style.display = 'block';
            // Load customer information
            await loadCustomerDashboard();
        } else {
            console.error('❌ Customer dashboard element not found!');
        }
        return;
    }
    
    console.log('🎯 showDashboard: Admin/Employee role, showing regular dashboard');
    
    // For admin, employee, and preparation roles - show regular dashboard
    document.getElementById('dashboardPage').style.display = 'block';
    // Hide customer dashboard if it exists
    const customerDashboard = document.getElementById('customerDashboardPage');
    if (customerDashboard) {
        customerDashboard.style.display = 'none';
    }
    
    // Update user display
    updateUserDisplay();
    
    // Load customers and users from server
    await loadCustomers();
    await loadUsers();
    
    // Show/hide menu items based on role
    if (currentUser.role === 'admin') {
        // Show all features for admin
        document.getElementById('userManagementLi').style.display = 'block';
        document.getElementById('uploadLi').style.display = 'block';
        document.getElementById('assignWorkLi').style.display = 'block';
        document.getElementById('progressLi').style.display = 'block';
        // Hide employee-specific features
        document.getElementById('assignedWorkLi').style.display = 'none';
    } else if (currentUser.role === 'preparation') {
        // Preparation role - same dashboard as employee
        document.getElementById('userManagementLi').style.display = 'none';
        document.getElementById('uploadLi').style.display = 'none';
        document.getElementById('assignWorkLi').style.display = 'block';
        document.getElementById('progressLi').style.display = 'none';
        // Show employee-specific features
        document.getElementById('assignedWorkLi').style.display = 'block';
    } else {
        // Hide admin-only features for employees
        document.getElementById('userManagementLi').style.display = 'none';
        document.getElementById('uploadLi').style.display = 'none';
        document.getElementById('assignWorkLi').style.display = 'none';
        document.getElementById('progressLi').style.display = 'none';
        // Show employee-specific features
        document.getElementById('assignedWorkLi').style.display = 'block';
    }
    
    // Load dashboard
    showTab('dashboard');
}

function updateUserDisplay() {
    const userProfile = userProfiles.find(p => p.username === currentUser.username);
    const displayName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : currentUser.username;
    
    document.getElementById('userNameDisplay').textContent = displayName;
    
    // Update avatar with photo or initials
    const avatarElement = document.getElementById('userAvatar');
    if (userProfile && userProfile.photo) {
        avatarElement.innerHTML = `<img src="${userProfile.photo}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
        const initials = userProfile ? 
            `${userProfile.firstName.charAt(0)}${userProfile.lastName.charAt(0)}` : 
            currentUser.username.charAt(0).toUpperCase();
        avatarElement.textContent = initials;
    }
}

// Tab Navigation
function showTab(tabName, clickedElement) {
    // CRITICAL: Ensure currentUser is loaded from sessionStorage if not already set
    if (!currentUser) {
        const userStr = sessionStorage.getItem('currentUser');
        if (userStr) {
            try {
                currentUser = JSON.parse(userStr);
                window.currentUser = currentUser; // Also set on window for global access
            } catch (e) {
                console.error('Error parsing currentUser from sessionStorage:', e);
                showNotification('error', 'Session Error', 'Please log in again.');
                return;
            }
        } else {
            console.error('No currentUser found in sessionStorage');
            showNotification('error', 'Not Logged In', 'Please log in to continue.');
            return;
        }
    }
    
    // Check if employee is trying to access restricted tabs
    if (currentUser && currentUser.role !== 'admin' && ['upload', 'assignWork', 'progress', 'userManagement'].includes(tabName)) {
        showNotification('error', 'Access Denied', 'You do not have permission to access this section.');
        return;
    }
    
    // Hide all tabs
    document.getElementById('dashboardTab').style.display = 'none';
    document.getElementById('assignedWorkTab').style.display = 'none';
    document.getElementById('uploadTab').style.display = 'none';
    document.getElementById('assignWorkTab').style.display = 'none';
    document.getElementById('progressTab').style.display = 'none';
    document.getElementById('reportsTab').style.display = 'none';
    document.getElementById('userManagementTab').style.display = 'none';
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    
    // Add active class to the clicked link (if provided) or find by data-tab attribute
    if (clickedElement) {
        clickedElement.classList.add('active');
    } else {
        // Fallback: find by data-tab attribute
        const navLink = document.querySelector(`.nav-link[data-tab="${tabName}"]`);
        if (navLink) {
            navLink.classList.add('active');
        }
    }
    
    // Show selected tab
    switch(tabName) {
        case 'dashboard':
            document.getElementById('dashboardTab').style.display = 'block';
            loadDashboard();
            break;
        case 'assignedWork':
            if (currentUser && currentUser.role !== 'admin') {
                document.getElementById('assignedWorkTab').style.display = 'block';
                loadAssignedWorkTable();
            }
            break;
        case 'upload':
            if (currentUser && currentUser.role === 'admin') {
                document.getElementById('uploadTab').style.display = 'block';
            }
            break;
        case 'assignWork':
            if (currentUser && currentUser.role === 'admin') {
                document.getElementById('assignWorkTab').style.display = 'block';
                // CRITICAL: Call renderAssignWorkPage directly (it calls loadAssignWorkTable internally)
                renderAssignWorkPage();
                // Ensure pagination is visible after tab is shown
                setTimeout(() => {
                    const pagerCheck = document.getElementById('assignPagination');
                    if (!pagerCheck) {
                        console.error('❌ Pagination element missing when tab shown! Creating it...');
                        renderAssignWorkPage();
                    } else if (!pagerCheck.innerHTML || pagerCheck.innerHTML.length < 100 || !pagerCheck.innerHTML.includes('<select')) {
                        console.log('🔄 Re-rendering pagination after tab show (missing dropdown)...');
                        renderAssignWorkPage();
                    } else {
                        // Force show pagination even if it exists
                        pagerCheck.style.display = 'block';
                        pagerCheck.style.visibility = 'visible';
                        pagerCheck.style.width = '100%';
                        pagerCheck.style.opacity = '1';
                        console.log('✅ Pagination element found and made visible');
                    }
                }, 300);
            }
            break;
        case 'progress':
            if (currentUser && currentUser.role === 'admin') {
                document.getElementById('progressTab').style.display = 'block';
                loadProgressCharts();
            }
            break;
        case 'reports':
            if (currentUser && currentUser.role === 'admin') {
                document.getElementById('reportsTab').style.display = 'block';
            }
            break;
        case 'userManagement':
            if (currentUser && currentUser.role === 'admin') {
                document.getElementById('userManagementTab').style.display = 'block';
                loadUsers().then(() => loadUserManagementTable());
            }
            break;
    }
}

// Dashboard Functions
function loadDashboard() {
    if (currentUser.role === 'admin') {
        loadAdminDashboard();
    } else if (currentUser.role === 'customer') {
        loadCustomerDashboard();
    } else {
        loadEmployeeDashboard();
    }
}

// Load customer dashboard with customer's own information
async function loadCustomerDashboard() {
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            console.error('❌ No auth token found');
            showNotification('error', 'Authentication Error', 'You are not logged in. Please log in again.');
            return;
        }
        
        console.log('📡 Fetching customer information from /customers/me');
        
        // Fetch customer information from API
        const response = await fetch(API_BASE_URL + '/customers/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('❌ Failed to fetch customer info:', errorData);
            
            if (response.status === 404) {
                const errorMsg = errorData.message || 'Your customer record was not found.';
                const details = errorData.details || 'Please contact support to link your account.';
                showNotification('warning', 'No Customer Record', `${errorMsg} ${details}`);
                return;
            } else if (response.status === 403) {
                showNotification('error', 'Access Denied', 'You do not have permission to access the customer dashboard.');
                return;
            } else if (response.status === 401) {
                showNotification('error', 'Authentication Error', 'Your session has expired. Please log in again.');
                // Redirect to login
                logout();
                return;
            }
            throw new Error(errorData.error || 'Failed to fetch customer information');
        }
        
        const customer = await response.json();
        
        // Check if this is a new customer (logged in with OTP, has temp_password)
        // Get current user to check temp_password flag
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        const isNewOTPCustomer = currentUser.tempPassword || currentUser.temp_password;
        
        // Update display section with customer information
        const nameDisplay = document.getElementById('customerNameDisplay');
        if (nameDisplay) {
            nameDisplay.textContent = customer.name || '-';
        }
        
        const phoneDisplay = document.getElementById('customerPhoneDisplay');
        if (phoneDisplay) {
            phoneDisplay.textContent = customer.phone || '-';
        }
        
        const emailDisplay = document.getElementById('customerEmailDisplay');
        if (emailDisplay) {
            emailDisplay.textContent = customer.email || '-';
        }
        
        // Parse and display address from notes
        let addressDisplay = '-';
        if (customer.notes) {
            // Try to parse address from notes
            const addressParts = parseAddress(customer.notes);
            if (addressParts.address1 || addressParts.city || addressParts.state || addressParts.zipCode) {
                const addressPartsArray = [];
                if (addressParts.address1) addressPartsArray.push(addressParts.address1);
                if (addressParts.city) addressPartsArray.push(addressParts.city);
                if (addressParts.state) addressPartsArray.push(addressParts.state);
                if (addressParts.zipCode) addressPartsArray.push(addressParts.zipCode);
                addressDisplay = addressPartsArray.join(', ') || customer.notes;
            } else {
                addressDisplay = customer.notes;
            }
        }
        
        const addressDisplayEl = document.getElementById('customerAddressDisplay');
        if (addressDisplayEl) {
            addressDisplayEl.textContent = addressDisplay;
        }
        
        // For new OTP customers, only populate email, leave other fields blank
        if (isNewOTPCustomer) {
            // Only populate email field
            const emailEl = document.getElementById('customerEmail');
            if (emailEl) emailEl.value = customer.email || '';
            
            // Clear all other fields to ensure they're blank
            const firstNameEl = document.getElementById('personalFirstName');
            const middleNameEl = document.getElementById('personalMiddleName');
            const lastNameEl = document.getElementById('personalLastName');
            const phoneEl = document.getElementById('personalPhone') || document.getElementById('personalAlternateMobile');
            
            if (firstNameEl) firstNameEl.value = '';
            if (middleNameEl) middleNameEl.value = '';
            if (lastNameEl) lastNameEl.value = '';
            if (phoneEl) phoneEl.value = '';
            
            // Clear address fields
            const address1El = document.getElementById('addressInfoAddress1');
            const address2El = document.getElementById('addressInfoAddress2');
            const cityEl = document.getElementById('addressInfoCity');
            const stateEl = document.getElementById('addressInfoState');
            const zipEl = document.getElementById('addressInfoZipCode');
            const aptEl = document.getElementById('addressInfoApartmentNumber');
            
            if (address1El) address1El.value = '';
            if (address2El) address2El.value = '';
            if (cityEl) cityEl.value = '';
            if (stateEl) stateEl.value = '';
            if (zipEl) zipEl.value = '';
            if (aptEl) aptEl.value = '';
            
            // Clear date of birth
            const dobInput = document.getElementById('personalDateOfBirth');
            const dobHidden = document.getElementById('personalDateOfBirthHidden');
            if (dobInput) dobInput.value = '';
            if (dobHidden) dobHidden.value = '';
            
            // Clear dropdowns
            const genderEl = document.getElementById('personalGender');
            const maritalStatusEl = document.getElementById('personalMaritalStatus');
            const countryEl = document.getElementById('personalCountryOfCitizenship');
            
            if (genderEl) genderEl.value = '';
            if (maritalStatusEl) maritalStatusEl.value = '';
            if (countryEl) countryEl.value = '';
            
            console.log('📝 New OTP customer detected - only email pre-filled, other fields blank');
        } else {
            // For existing customers, populate all fields as before
            // Populate customer form with data (for editing)
            if (customer.name) {
                const nameParts = customer.name.split(' ');
                const firstNameEl = document.getElementById('personalFirstName');
                const lastNameEl = document.getElementById('customerLastName');
                if (firstNameEl) firstNameEl.value = nameParts[0] || '';
                if (lastNameEl) lastNameEl.value = nameParts.slice(1).join(' ') || '';
            }
            
            const phoneEl = document.getElementById('customerPhone');
            if (phoneEl) phoneEl.value = customer.phone || '';
            
            const emailEl = document.getElementById('customerEmail');
            if (emailEl) emailEl.value = customer.email || '';
            
            // Parse address for form fields
            if (customer.notes) {
                const addressParts = parseAddress(customer.notes);
                const address1El = document.getElementById('customerAddress1');
                const cityEl = document.getElementById('customerCity');
                const stateEl = document.getElementById('customerState');
                const zipEl = document.getElementById('customerZipCode');
                
                if (address1El) address1El.value = addressParts.address1 || '';
                if (cityEl) cityEl.value = addressParts.city || '';
                if (stateEl) {
                    const stateCode = getStateCode(addressParts.state);
                    stateEl.value = stateCode || addressParts.state || '';
                }
                if (zipEl) zipEl.value = addressParts.zipCode || '';
            }
        }
        
        // Set refund status
        if (customer.status) {
            const statusSelect = document.getElementById('customerRefundStatus');
            if (statusSelect) {
                statusSelect.value = customer.status;
            }
        }
        
        // Update user avatar with customer initial
        const customerAvatar = document.getElementById('customerUserAvatar');
        if (customerAvatar && customer.name) {
            customerAvatar.textContent = customer.name.charAt(0).toUpperCase();
        }
        
        // Load customer documents
        await loadCustomerUploadedDocuments(customer.id);
        
        // Populate Tax Payer dropdown in Bank Info section
        populateTaxPayerDropdown(customer);
        
        // Load tax information
        if (typeof loadTaxInformation === 'function') {
            await loadTaxInformation();
        }
        
        // Check Country of Citizenship and show/hide appropriate section
        const countrySelect = document.getElementById('personalCountryOfCitizenship');
        if (countrySelect) {
            handleCountryOfCitizenshipChange();
        }
        
        // Add welcome animation class to main content
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.add('welcome-animation');
        }
        
        console.log('✅ Customer dashboard loaded successfully');
    } catch (error) {
        console.error('❌ Error loading customer dashboard:', error);
        showNotification('error', 'Error', 'Failed to load customer information. Please try again.');
    }
}

// Load customer uploaded documents for customer dashboard
async function loadCustomerUploadedDocuments(customerId) {
    const documentsList = document.getElementById('customerUploadedDocumentsList');
    if (!documentsList) return;
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            documentsList.innerHTML = '<div class="text-center text-muted">Authentication required</div>';
            return;
        }
        
        console.log(`📋 Fetching documents for customer ID: ${customerId}`);
        const response = await fetch(API_BASE_URL + `/customers/documents/${customerId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const documents = await response.json();
            
            console.log(`📄 Loaded ${documents.length} document(s) for customer ID ${customerId}`);
            if (documents.length > 0) {
                console.log(`📄 Document IDs: ${documents.map(d => d.id).join(', ')}`);
                console.log(`📄 Document names: ${documents.map(d => d.file_name).join(', ')}`);
            }
            
            if (documents.length === 0) {
                documentsList.innerHTML = '<div class="text-center text-muted"><i class="fas fa-file-alt"></i> No documents uploaded yet</div>';
            } else {
                // Helper function to format file size
                const formatFileSize = (bytes) => {
                    if (bytes === 0) return '0 Bytes';
                    const k = 1024;
                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
                };
                
                // Filter out any documents with invalid IDs
                const validDocuments = documents.filter(doc => doc.id && !isNaN(doc.id) && doc.id > 0);
                if (validDocuments.length !== documents.length) {
                    console.warn(`⚠️ Filtered out ${documents.length - validDocuments.length} document(s) with invalid IDs`);
                }
                
                if (validDocuments.length === 0) {
                    documentsList.innerHTML = '<div class="text-center text-muted"><i class="fas fa-file-alt"></i> No valid documents found</div>';
                    return;
                }
                
                documentsList.innerHTML = validDocuments.map(doc => {
                    const uploadDate = new Date(doc.uploaded_at).toLocaleString();
                    const fileSize = formatFileSize(doc.file_size);
                    const fileIcon = doc.file_type.includes('pdf') ? 'fa-file-pdf text-danger' : 
                                    doc.file_type.includes('image') ? 'fa-file-image text-primary' : 'fa-file text-secondary';
                    const isImage = doc.file_type.includes('image');
                    const isPDF = doc.file_type.includes('pdf');
                    
                    return `
                        <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded" style="background: var(--card-bg);">
                            <div style="flex: 1;">
                                <i class="fas ${fileIcon} me-2"></i>
                                <span style="font-weight: 500;">${doc.file_name}</span>
                                <small class="text-muted ms-2">(${fileSize})</small>
                                <br>
                                <small class="text-muted">Uploaded: ${uploadDate}</small>
                            </div>
                            <div class="btn-group ms-2" role="group">
                                <button type="button" 
                                        class="btn btn-sm btn-info" 
                                        onclick="viewCustomerDocument(${doc.id}, '${doc.file_name.replace(/'/g, "\\'")}', ${isImage}, ${isPDF})"
                                        title="View document">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button type="button" 
                                        class="btn btn-sm btn-primary" 
                                        onclick="downloadCustomerDocument(${doc.id}, '${doc.file_name.replace(/'/g, "\\'")}')"
                                        title="Download document">
                                    <i class="fas fa-download"></i> Download
                                </button>
                                <button type="button" 
                                        class="btn btn-sm btn-danger" 
                                        onclick="deleteCustomerDocument(${doc.id}, '${doc.file_name.replace(/'/g, "\\'")}', ${customerId})"
                                        title="Delete document">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } else {
            // Don't clear existing documents on error - just show a warning
            console.error('❌ Error loading documents - status:', response.status);
            if (documentsList && documentsList.innerHTML.trim() === '') {
                documentsList.innerHTML = '<div class="text-center text-warning"><i class="fas fa-exclamation-triangle"></i> Unable to refresh document list</div>';
            }
        }
    } catch (error) {
        console.error('❌ Error loading customer documents:', error);
        const documentsList = document.getElementById('customerUploadedDocumentsList');
        if (documentsList) {
            // Only show error if list is empty - don't clear existing documents
            if (documentsList.innerHTML.trim() === '' || documentsList.innerHTML.includes('No documents')) {
                documentsList.innerHTML = '<div class="text-center text-danger"><i class="fas fa-exclamation-circle"></i> Error loading documents. Please refresh the page.</div>';
            } else {
                // If documents are already displayed, just log the error without clearing
                console.warn('⚠️ Error occurred but keeping existing document list visible');
            }
        }
    }
}

async function loadAdminDashboard() {
    // Show loading state
    const statsCards = document.getElementById('statsCards');
    if (statsCards) {
        statsCards.innerHTML = '<div class="col-12 text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading statistics...</span></div></div>';
    }
    
    try {
        // Fetch statistics from API (includes ALL customers, not just first 100)
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(API_BASE_URL + '/customers/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch statistics');
        }
        
        const stats = await response.json();
        
        // Fetch referral statistics
        let referralStats = { totalReferrals: 0 };
        try {
            const referralResponse = await fetch(API_BASE_URL + '/referrals/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (referralResponse.ok) {
                referralStats = await referralResponse.json();
            }
        } catch (error) {
            console.warn('Failed to fetch referral stats:', error);
        }
        
        // Use API statistics for all counts
        const statsHtml = `
            <div class="col-md-3">
                <div class="stats-card" onclick="filterByStatus('all')">
                    <div class="stats-icon" style="background: #5e72e4;">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stats-number">${stats.totalCustomers || 0}</div>
                    <div class="stats-label">Total Customers</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card" onclick="filterByStatus('called')">
                    <div class="stats-icon" style="background: #2dce89;">
                        <i class="fas fa-phone"></i>
                    </div>
                    <div class="stats-number">${stats.callStatusCounts?.called || 0}</div>
                    <div class="stats-label">Total Calls</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card" onclick="filterByStatus('voice_mail')">
                    <div class="stats-icon" style="background: #fb6340;">
                        <i class="fas fa-voicemail"></i>
                    </div>
                    <div class="stats-number">${stats.callStatusCounts?.voice_mail || 0}</div>
                    <div class="stats-label">Voice Mails</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card" onclick="filterByStatus('w2_received')">
                    <div class="stats-icon" style="background: #11cdef;">
                        <i class="fas fa-file-check"></i>
                    </div>
                    <div class="stats-number">${stats.w2Received || 0}</div>
                    <div class="stats-label">W2 Received</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card" onclick="filterByStatus('not_called')">
                    <div class="stats-icon" style="background: #f5365c;">
                        <i class="fas fa-phone-slash"></i>
                    </div>
                    <div class="stats-number">${stats.callStatusCounts?.not_called || 0}</div>
                    <div class="stats-label">Pending Calls</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card" onclick="filterByStatus('interested')">
                    <div class="stats-icon" style="background: #2dce89;">
                        <i class="fas fa-heart"></i>
                    </div>
                    <div class="stats-number">${stats.interestedCount || stats.statusCounts?.interested || 0}</div>
                    <div class="stats-label">Interested</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card" onclick="showNewLeadModal()">
                    <div class="stats-icon" style="background: #2dce89;">
                        <i class="fas fa-plus"></i>
                    </div>
                    <div class="stats-number">+</div>
                    <div class="stats-label">New Lead</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card" onclick="openArchiveView()">
                    <div class="stats-icon" style="background: #6c757d;">
                        <i class="fas fa-archive"></i>
                    </div>
                    <div class="stats-number">${stats.archivedCount || 0}</div>
                    <div class="stats-label">Archived</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card" onclick="showReferralsView()">
                    <div class="stats-icon" style="background: #9b59b6;">
                        <i class="fas fa-user-friends"></i>
                    </div>
                    <div class="stats-number">${referralStats.totalReferrals || 0}</div>
                    <div class="stats-label">Referrals</div>
                </div>
            </div>
        `;
        
        if (statsCards) {
            statsCards.innerHTML = statsHtml;
        }
        
        // Load traffic section for admin
        loadTrafficSection();
        loadMonthlyComparisonChart();
    } catch (error) {
        console.error('Error loading dashboard statistics:', error);
        // Fallback to local data if API fails
    const statsHtml = `
        <div class="col-md-3">
            <div class="stats-card" onclick="filterByStatus('all')">
                <div class="stats-icon" style="background: #5e72e4;">
                    <i class="fas fa-users"></i>
                </div>
                <div class="stats-number">${customers.length}</div>
                <div class="stats-label">Total Customers</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card" onclick="filterByStatus('called')">
                <div class="stats-icon" style="background: #2dce89;">
                    <i class="fas fa-phone"></i>
                </div>
                <div class="stats-number">${getCustomersByCallStatus('called').length}</div>
                <div class="stats-label">Total Calls</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card" onclick="filterByStatus('voice_mail')">
                <div class="stats-icon" style="background: #fb6340;">
                    <i class="fas fa-voicemail"></i>
                </div>
                <div class="stats-number">${getCustomersByCallStatus('voice_mail').length}</div>
                <div class="stats-label">Voice Mails</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card" onclick="filterByStatus('w2_received')">
                <div class="stats-icon" style="background: #11cdef;">
                    <i class="fas fa-file-check"></i>
                </div>
                <div class="stats-number">${getCustomersByStatus('w2_received').length}</div>
                <div class="stats-label">W2 Received</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card" onclick="filterByStatus('not_called')">
                <div class="stats-icon" style="background: #f5365c;">
                    <i class="fas fa-phone-slash"></i>
                </div>
                <div class="stats-number">${getCustomersByCallStatus('not_called').length}</div>
                <div class="stats-label">Pending Calls</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card" onclick="filterByStatus('interested')">
                <div class="stats-icon" style="background: #2dce89;">
                    <i class="fas fa-heart"></i>
                </div>
                <div class="stats-number">${getCustomersByStatus('interested').length}</div>
                <div class="stats-label">Interested</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card" onclick="showNewLeadModal()">
                <div class="stats-icon" style="background: #2dce89;">
                    <i class="fas fa-plus"></i>
                </div>
                <div class="stats-number">+</div>
                <div class="stats-label">New Lead</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card" onclick="openArchiveView()">
                <div class="stats-icon" style="background: #6c757d;">
                    <i class="fas fa-archive"></i>
                </div>
                <div class="stats-number">${getArchivedCount()}</div>
                <div class="stats-label">Archived</div>
            </div>
        </div>
    `;
        if (statsCards) {
            statsCards.innerHTML = statsHtml;
        }
        showNotification('warning', 'Statistics Warning', 'Could not load full statistics. Showing limited data.');
    }
}

function loadEmployeeDashboard() {
    const assignedCustomers = customers.filter(c => c.assignedTo === currentUser.username);
    
    const statsHtml = `
        <div class="col-md-3">
            <div class="stats-card">
                <div class="stats-icon" style="background: #2dce89;">
                    <i class="fas fa-phone"></i>
                </div>
                <div class="stats-number">${assignedCustomers.filter(c => c.callStatus === 'called').length}</div>
                <div class="stats-label">Total Calls</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card">
                <div class="stats-icon" style="background: #f5365c;">
                    <i class="fas fa-phone-slash"></i>
                </div>
                <div class="stats-number">${assignedCustomers.filter(c => c.callStatus === 'not_called').length}</div>
                <div class="stats-label">Pending Calls</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card">
                <div class="stats-icon" style="background: #fb6340;">
                    <i class="fas fa-voicemail"></i>
                </div>
                <div class="stats-number">${assignedCustomers.filter(c => c.callStatus === 'voice_mail').length}</div>
                <div class="stats-label">Voice Mails</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card">
                <div class="stats-icon" style="background: #11cdef;">
                    <i class="fas fa-file-check"></i>
                </div>
                <div class="stats-number">${assignedCustomers.filter(c => c.status === 'w2_received').length}</div>
                <div class="stats-label">W2 Received</div>
            </div>
        </div>
    `;
    
    document.getElementById('statsCards').innerHTML = statsHtml;
}

function loadAssignedWorkTable() {
    const assignedCustomers = customers.filter(c => c.assignedTo === currentUser.username);
    
    // Sort customers alphabetically by name
    assignedCustomers.sort((a, b) => {
        const nameA = (a.name || `${a.firstName || ''} ${a.lastName || ''}`).trim().toLowerCase();
        const nameB = (b.name || `${b.firstName || ''} ${b.lastName || ''}`).trim().toLowerCase();
        return nameA.localeCompare(nameB);
    });
    
    const tbody = document.getElementById('assignedWorkTable');
    
    tbody.innerHTML = assignedCustomers.map(customer => `
        <tr ondblclick="openUpdateStatusModal(${customer.id})" style="cursor: pointer;" title="Double-click to view details">
            <td><strong>${customer.firstName} ${customer.lastName}</strong></td>
            <td><a href="tel:${customer.phone}" class="text-decoration-none phone-link" title="Double-click to copy" onclick="event.stopPropagation();">${customer.phone}</a></td>
            <td><a href="mailto:${customer.email}" class="text-decoration-none" onclick="event.stopPropagation();">${customer.email}</a></td>
            <td><small class="text-muted">${customer.address}</small></td>
            <td><span class="badge bg-${getStatusBadgeColor(customer.status)}">${getStatusDisplayName(customer.status)}</span></td>
            <td><span class="badge bg-${getCallStatusBadgeColor(customer.callStatus)}">${customer.callStatus}</span></td>
            <td><small>${customer.comments || '-'}</small></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); openUpdateStatusModal(${customer.id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function exportAssignedCustomers() {
    const assignedCustomers = customers.filter(c => c.assignedTo === currentUser.username);
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Name,Phone,Email,Address,Status,Call Status,Comments\n"
        + assignedCustomers.map(c => 
            `"${c.firstName} ${c.lastName}","${c.phone}","${c.email}","${c.address}","${c.status}","${c.callStatus}","${c.comments || ''}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "my_assigned_customers.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function filterByStatus(status) {
    showTab('assignWork');
    
    // Reset pagination when filtering
    window.assignCurrentPage = 1;
    
    if (status === 'follow_up') {
        // Filter for follow-up customers
        const followUpCustomers = getFollowUpCustomers();
        loadAssignWorkTableWithFilter(followUpCustomers);
    } else if (status === 'all') {
        // Show all customers - clear status filter
        window.assignStatusFilter = null;
        window.currentFilter = null;
        // Update status dropdown to show "All Statuses"
        updateStatusDropdownFilter([]);
        renderAssignWorkPage();
    } else {
        // Filter by specific status
        // Set assignStatusFilter as array (what renderAssignWorkPage expects)
        window.assignStatusFilter = [status];
        window.currentFilter = status;
        
        // Update status dropdown to show only this status selected
        updateStatusDropdownFilter([status]);
        
        // Render the page with the filter applied
        renderAssignWorkPage();
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
}

// Helper function to update status dropdown filter UI
function updateStatusDropdownFilter(selectedStatuses) {
    // Find all status checkboxes in the dropdown
    const statusCheckboxes = document.querySelectorAll('.status-checkbox');
    if (statusCheckboxes.length > 0) {
        statusCheckboxes.forEach(checkbox => {
            const statusValue = checkbox.value;
            if (selectedStatuses.length === 0) {
                // Show all - check all boxes
                checkbox.checked = true;
            } else {
                // Show only selected - check only matching boxes
                checkbox.checked = selectedStatuses.includes(statusValue);
            }
        });
    }
    
    // Update the dropdown button text if needed
    const dropdownButton = document.querySelector('#statusFilterDropdown');
    if (dropdownButton && selectedStatuses.length === 1) {
        // Find the label for this status
        const statusLabels = {
            'interested': 'Interested',
            'called': 'Called',
            'voice_mail': 'Voice Mail',
            'w2_received': 'W2 Received',
            'not_called': 'Not Called',
            'pending': 'Pending'
        };
        const statusLabel = statusLabels[selectedStatuses[0]] || selectedStatuses[0];
        // Update button text (if it has a span or text node)
        const buttonText = dropdownButton.querySelector('span') || dropdownButton;
        if (buttonText) {
            buttonText.textContent = statusLabel;
        }
    } else if (dropdownButton && selectedStatuses.length === 0) {
        // Reset to "All Statuses"
        const buttonText = dropdownButton.querySelector('span') || dropdownButton;
        if (buttonText) {
            buttonText.textContent = 'All Statuses';
        }
    }
}

function loadAssignWorkTableWithFilter(filteredCustomers) {
    window.assignFiltered = filteredCustomers.slice();
    window.assignPageSize = window.assignPageSize || 200;
    window.assignCurrentPage = 1;
    renderAssignWorkPage();
}

// Traffic Section Functions
function loadTrafficSection() {
    const stateData = getCustomerStateDistribution();
    const topStates = getTopStates(stateData, 20); // Changed to top 20 states
    
    const trafficHtml = `
        <div class="traffic-summary">
            <h5 class="mb-3">Top 20 States by Customer Count</h5>
            <div id="trafficSummaryList">
                ${generateTrafficSummary(topStates)}
            </div>
        </div>
    `;
    
    document.getElementById('trafficContent').innerHTML = trafficHtml;
}

function getCustomerStateDistribution() {
    const stateCount = {};
    
    customers.forEach(customer => {
        let state = null;
        
        // First, check if customer has a state code stored
        if (customer.state) {
            const stateName = getStateName(customer.state);
            state = stateName || customer.state;
        } else {
            // Fallback to extracting from address
            state = extractStateFromAddress(customer.address);
        }
        
        if (state) {
            stateCount[state] = (stateCount[state] || 0) + 1;
        }
    });
    
    return stateCount;
}

function extractStateFromAddress(address) {
    if (!address) return null;
    
    // Common state abbreviations and full names
    const stateMap = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
        'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
        'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
        'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
        'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
        'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
        'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
        'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
    };
    
    // Try to extract state from address
    const addressUpper = address.toUpperCase();
    
    // Check for state abbreviations
    for (const [abbr, fullName] of Object.entries(stateMap)) {
        if (addressUpper.includes(abbr)) {
            return fullName;
        }
    }
    
    // Check for full state names
    for (const [abbr, fullName] of Object.entries(stateMap)) {
        if (addressUpper.includes(fullName.toUpperCase())) {
            return fullName;
        }
    }
    
    return null;
}

function getTopStates(stateData, count) {
    const totalCustomers = customers.length;
    if (totalCustomers === 0) return [];
    
    return Object.entries(stateData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, count)
        .map(([state, count]) => ({
            state,
            count,
            percentage: totalCustomers > 0 ? Math.round((count / totalCustomers) * 100 * 10) / 10 : 0 // One decimal place
        }));
}

function generateTrafficSummary(topStates) {
    const colors = ['#5e72e4', '#2dce89', '#fb6340', '#11cdef', '#f5365c', '#2bffc6', '#ffa726', '#ab47bc', '#26c6da', '#66bb6a', '#ef5350', '#42a5f5', '#7e57c2', '#26a69a', '#d4e157', '#ff7043', '#5c6bc0', '#ec407a', '#29b6f6', '#66bb6a'];
    
    const totalCustomers = customers.length;
    const maxCount = topStates.length > 0 ? topStates[0].count : 1;
    
    return topStates.map((item, index) => {
        const percentage = totalCustomers > 0 ? ((item.count / totalCustomers) * 100).toFixed(1) : '0.0';
        const barWidth = maxCount > 0 ? ((item.count / maxCount) * 100) : 0;
        
        return `
        <div class="traffic-item" onclick="showStateCustomers('${item.state}')">
            <div class="traffic-state">${item.state}</div>
            <div class="traffic-bar">
                <div class="traffic-bar-fill" style="width: ${barWidth}%; background-color: ${colors[index % colors.length]}"></div>
            </div>
            <div class="traffic-info">
                <span class="traffic-count">${item.count} customers</span>
                <span class="traffic-percentage">${percentage}%</span>
            </div>
        </div>
    `;
    }).join('');
}

// Map functions removed - no longer needed


// Monthly Comparison Chart Functions
function loadMonthlyComparisonChart() {
    if (currentUser.role !== 'admin') return;
    
    initializeMonthlyFilter();
    initializeStatusFilter();
    
    const ctx = document.getElementById('monthlyComparisonChart');
    if (!ctx) return;
    
    if (monthlyComparisonChart) {
        monthlyComparisonChart.destroy();
    }
    
    // Get initial data with all months and all statuses selected
    const monthlyData = getMonthlyComparisonData();
    const selectedMonths = getSelectedMonths();
    const selectedStatuses = getSelectedStatuses();
    
    // Filter datasets based on selected statuses
    const filteredDatasets = monthlyData.datasets.filter(dataset => 
        selectedStatuses.includes(dataset.status)
    );
    
    // Filter months
    const monthIndices = selectedMonths.map(month => monthlyData.months.indexOf(month));
    const filteredLabels = selectedMonths;
    
    // Filter data for each dataset
    const finalDatasets = filteredDatasets.map(dataset => ({
        ...dataset,
        data: monthIndices.map(i => dataset.data[i])
    }));
    
    monthlyComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: filteredLabels,
            datasets: finalDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12
                        },
                        boxWidth: 12,
                        boxHeight: 12
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: false,
                    barPercentage: 0.6, // Control bar width as percentage of category width
                    categoryPercentage: 0.8, // Control category spacing
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#8898aa',
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#8898aa',
                        font: {
                            size: 11
                        },
                        stepSize: 1,
                        callback: function(value) {
                            return value;
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function getMonthlyComparisonData() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndices = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    // Get all available statuses
    const allStatuses = ['follow_up', 'call_back', 'not_in_service', 'voice_mail', 'citizen', 'dnd', 'interested', 'w2_received', 'pending', 'potential'];
    
    // Initialize data structure for all statuses
    const statusData = {};
    allStatuses.forEach(status => {
        statusData[status] = new Array(12).fill(0);
    });
    
    // Count customers by month and status
    customers.forEach(customer => {
        // Support both createdAt and createdDate for compatibility
        const dateField = customer.createdAt || customer.createdDate;
        if (dateField) {
            const date = new Date(dateField);
            // Check if date is valid
            if (!isNaN(date.getTime())) {
                const monthIndex = date.getMonth(); // 0-11
                const status = customer.status || 'pending';
                
                if (statusData.hasOwnProperty(status) && monthIndex >= 0 && monthIndex < 12) {
                    statusData[status][monthIndex]++;
                }
            }
        }
    });
    
    // Convert to arrays for chart
    const datasets = allStatuses.map(status => ({
        status: status,
        label: getStatusDisplayName(status),
        data: statusData[status],
        backgroundColor: getStatusChartColor(status),
        borderColor: getStatusChartColor(status),
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
        barThickness: 15, // Make bars thinner for easier comparison
    }));
    
    return {
        months: months,
        datasets: datasets
    };
}

function getStatusChartColor(status) {
    const colors = {
        'follow_up': 'rgba(17, 205, 239, 0.8)',
        'call_back': 'rgba(5, 150, 105, 0.8)',
        'not_in_service': 'rgba(220, 53, 69, 0.8)',
        'voice_mail': 'rgba(245, 54, 92, 0.8)',
        'citizen': 'rgba(255, 193, 7, 0.8)',
        'dnd': 'rgba(108, 117, 125, 0.8)',
        'interested': 'rgba(45, 206, 137, 0.8)',
        'w2_received': 'rgba(40, 167, 69, 0.8)',
        'pending': 'rgba(128, 128, 128, 0.8)',
        'potential': 'rgba(0, 123, 255, 0.8)'
    };
    return colors[status] || 'rgba(128, 128, 128, 0.8)';
}

// Monthly Filter Functions
function initializeMonthlyFilter() {
    const dropdown = document.getElementById('monthFilterDropdown');
    const selectAllCheckbox = document.getElementById('selectAllMonths');
    const monthCheckboxes = document.querySelectorAll('.month-checkbox');
    
    if (!dropdown || !selectAllCheckbox) return;
    
    // Handle "Select All" checkbox
    selectAllCheckbox.addEventListener('change', function() {
        monthCheckboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
        updateFilterStatusText();
    });
    
    // Handle individual month checkboxes
    monthCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const allChecked = Array.from(monthCheckboxes).every(cb => cb.checked);
            const noneChecked = Array.from(monthCheckboxes).every(cb => !cb.checked);
            
            if (allChecked) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else if (noneChecked) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            }
            
            updateFilterStatusText();
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const container = document.querySelector('.excel-filter-container');
        if (container && !container.contains(event.target)) {
            closeMonthFilter();
        }
    });
}

function toggleMonthFilter() {
    const dropdown = document.getElementById('monthFilterDropdown');
    const button = document.querySelector('.excel-filter-btn');
    
    if (dropdown.classList.contains('show')) {
        closeMonthFilter();
    } else {
        dropdown.classList.add('show');
        button.classList.add('active');
    }
}

function closeMonthFilter() {
    const dropdown = document.getElementById('monthFilterDropdown');
    const button = document.querySelector('.excel-filter-btn');
    
    dropdown.classList.remove('show');
    button.classList.remove('active');
}

function resetMonthFilter() {
    const selectAllCheckbox = document.getElementById('selectAllMonths');
    const monthCheckboxes = document.querySelectorAll('.month-checkbox');
    
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
    
    monthCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    
    updateFilterStatusText();
    showNotification('info', 'Filter Reset', 'All months have been selected');
}

function applyMonthFilter() {
    const selectedMonths = getSelectedMonths();
    const selectedStatuses = getSelectedStatuses();
    
    if (selectedMonths.length === 0) {
        showNotification('warning', 'No Selection', 'Please select at least one month to display');
        return;
    }
    
    updateMonthlyChart(selectedMonths, selectedStatuses);
    updateFilterStatusText();
    closeMonthFilter();
    showNotification('success', 'Filter Applied', `Chart updated to show ${selectedMonths.length} selected month(s)`);
}

function updateFilterStatusText() {
    const selectedMonths = getSelectedMonths();
    const statusText = document.getElementById('filterStatusText');
    
    if (selectedMonths.length === 12) {
        statusText.textContent = 'All Months';
    } else if (selectedMonths.length === 0) {
        statusText.textContent = 'No Months';
    } else if (selectedMonths.length === 1) {
        statusText.textContent = selectedMonths[0];
    } else {
        statusText.textContent = `${selectedMonths.length} Months`;
    }
}

function getSelectedMonths() {
    const monthCheckboxes = document.querySelectorAll('.month-checkbox');
    const monthMap = {
        'month-jan': 'Jan', 'month-feb': 'Feb', 'month-mar': 'Mar', 'month-apr': 'Apr',
        'month-may': 'May', 'month-jun': 'Jun', 'month-jul': 'Jul', 'month-aug': 'Aug',
        'month-sep': 'Sep', 'month-oct': 'Oct', 'month-nov': 'Nov', 'month-dec': 'Dec'
    };
    
    const selectedMonths = [];
    monthCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const monthName = monthMap[checkbox.id];
            if (monthName) {
                selectedMonths.push(monthName);
            }
        }
    });
    
    return selectedMonths;
}

// Status Filter Functions
function initializeStatusFilter() {
    const dropdown = document.getElementById('statusFilterDropdown');
    const selectAllCheckbox = document.getElementById('selectAllStatuses');
    const statusCheckboxes = document.querySelectorAll('.status-checkbox');
    
    if (!dropdown || !selectAllCheckbox) return;
    
    // Set initial state for "Select All" checkbox based on current selections
    const allChecked = Array.from(statusCheckboxes).every(cb => cb.checked);
    const noneChecked = Array.from(statusCheckboxes).every(cb => !cb.checked);
    
    if (allChecked) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else if (noneChecked) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
    
    // Update filter status text on initialization
    updateStatusFilterStatusText();
    
    // Handle "Select All" checkbox
    selectAllCheckbox.addEventListener('change', function() {
        statusCheckboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
        updateStatusFilterStatusText();
    });
    
    // Handle individual status checkboxes
    statusCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const allChecked = Array.from(statusCheckboxes).every(cb => cb.checked);
            const noneChecked = Array.from(statusCheckboxes).every(cb => !cb.checked);
            
            if (allChecked) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else if (noneChecked) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            }
            
            updateStatusFilterStatusText();
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const container = document.querySelectorAll('.excel-filter-container');
        let isInside = false;
        container.forEach(c => {
            if (c.contains(event.target) && c.querySelector('#statusFilterDropdown')) {
                isInside = true;
            }
        });
        if (!isInside) {
            closeStatusFilter();
        }
    });
}

function toggleStatusFilter() {
    const dropdown = document.getElementById('statusFilterDropdown');
    const button = document.getElementById('statusFilterBtn');
    
    if (!dropdown || !button) return;
    
    if (dropdown.classList.contains('show')) {
        closeStatusFilter();
    } else {
        // Close month filter if open
        closeMonthFilter();
        dropdown.classList.add('show');
        button.classList.add('active');
    }
}

function closeStatusFilter() {
    const dropdown = document.getElementById('statusFilterDropdown');
    const button = document.getElementById('statusFilterBtn');
    
    if (!dropdown || !button) return;
    
    dropdown.classList.remove('show');
    button.classList.remove('active');
}

function resetStatusFilter() {
    const selectAllCheckbox = document.getElementById('selectAllStatuses');
    const statusCheckboxes = document.querySelectorAll('.status-checkbox');
    
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
    
    statusCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    
    updateStatusFilterStatusText();
    showNotification('info', 'Filter Reset', 'All statuses have been selected');
}

function applyStatusFilter() {
    const selectedMonths = getSelectedMonths();
    const selectedStatuses = getSelectedStatuses();
    
    if (selectedStatuses.length === 0) {
        showNotification('warning', 'No Selection', 'Please select at least one status to display');
        return;
    }
    
    updateMonthlyChart(selectedMonths, selectedStatuses);
    updateStatusFilterStatusText();
    closeStatusFilter();
    showNotification('success', 'Filter Applied', `Chart updated to show ${selectedStatuses.length} selected status(es)`);
}

function updateStatusFilterStatusText() {
    const selectedStatuses = getSelectedStatuses();
    const statusText = document.getElementById('filterStatusStatusText');
    
    if (!statusText) return;
    
    const allStatuses = ['follow_up', 'call_back', 'not_in_service', 'voice_mail', 'citizen', 'dnd', 'interested', 'w2_received', 'pending', 'potential'];
    
    if (selectedStatuses.length === allStatuses.length) {
        statusText.textContent = 'All Statuses';
    } else if (selectedStatuses.length === 0) {
        statusText.textContent = 'No Statuses';
    } else if (selectedStatuses.length === 1) {
        const statusName = getStatusDisplayName(selectedStatuses[0]);
        statusText.textContent = statusName;
    } else {
        statusText.textContent = `${selectedStatuses.length} Statuses`;
    }
}

function getSelectedStatuses() {
    const statusCheckboxes = document.querySelectorAll('.status-checkbox');
    const statusMap = {
        'status-follow_up': 'follow_up',
        'status-call_back': 'call_back',
        'status-not_in_service': 'not_in_service',
        'status-voice_mail': 'voice_mail',
        'status-citizen': 'citizen',
        'status-dnd': 'dnd',
        'status-interested': 'interested',
        'status-w2_received': 'w2_received',
        'status-pending': 'pending',
        'status-potential': 'potential'
    };
    
    const selectedStatuses = [];
    statusCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const statusValue = statusMap[checkbox.id];
            if (statusValue) {
                selectedStatuses.push(statusValue);
            }
        }
    });
    
    return selectedStatuses;
}

function updateMonthlyChart(selectedMonths, selectedStatuses) {
    if (!monthlyComparisonChart) {
        // If chart doesn't exist, reload it
        loadMonthlyComparisonChart();
        return;
    }
    
    if (!selectedMonths || selectedMonths.length === 0) {
        showNotification('warning', 'No Selection', 'Please select at least one month to display');
        return;
    }
    
    if (!selectedStatuses || selectedStatuses.length === 0) {
        showNotification('warning', 'No Selection', 'Please select at least one status to display');
        return;
    }
    
    const monthlyData = getMonthlyComparisonData();
    
    // Filter datasets based on selected statuses
    const filteredDatasets = monthlyData.datasets.filter(dataset => 
        selectedStatuses.includes(dataset.status)
    );
    
    // Filter months
    const monthIndices = selectedMonths.map(month => monthlyData.months.indexOf(month)).filter(i => i >= 0);
    const filteredLabels = selectedMonths;
    
    // Filter data for each dataset
    const finalDatasets = filteredDatasets.map(dataset => ({
        ...dataset,
        data: monthIndices.map(i => dataset.data[i] || 0)
    }));
    
    // Update chart data
    monthlyComparisonChart.data.labels = filteredLabels;
    monthlyComparisonChart.data.datasets = finalDatasets;
    
    // Update chart with animation
    monthlyComparisonChart.update('active');
}

function showStateCustomers(stateName) {
    const stateCustomers = customers.filter(customer => {
        const state = extractStateFromAddress(customer.address);
        return state === stateName;
    });
    
    if (stateCustomers.length === 0) {
        showNotification('info', 'No Customers', `No customers found in ${stateName}`);
        return;
    }
    
    // Create modal content
    const modalContent = `
        <div class="modal fade" id="stateCustomersModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Customers in ${stateName} (${stateCustomers.length})</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Phone</th>
                                        <th>Email</th>
                                        <th>Address</th>
                                        <th>Status</th>
                                        <th>Call Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${stateCustomers.map(customer => `
                                        <tr>
                                            <td><strong>${customer.firstName} ${customer.lastName}</strong></td>
                                            <td><a href="tel:${customer.phone}" class="text-decoration-none phone-link" title="Double-click to copy">${customer.phone}</a></td>
                                            <td><a href="mailto:${customer.email}" class="text-decoration-none">${customer.email}</a></td>
                                            <td><small class="text-muted">${customer.address}</small></td>
                                            <td><span class="badge bg-${getStatusBadgeColor(customer.status)}">${getStatusDisplayName(customer.status)}</span></td>
                                            <td><span class="badge bg-${getCallStatusBadgeColor(customer.callStatus)}">${customer.callStatus}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('stateCustomersModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalContent);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('stateCustomersModal'));
    modal.show();
    
    // Clean up modal after it's hidden
    document.getElementById('stateCustomersModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

function zoomInMap() {
    const svg = document.querySelector("#usaMap svg");
    if (!svg) return;
    
    const currentTransform = svg.getAttribute("transform") || "translate(0,0) scale(1)";
    const scale = parseFloat(currentTransform.match(/scale\(([^)]+)\)/)?.[1] || 1);
    const newScale = Math.min(scale * 1.2, 3);
    
    svg.style.transition = "transform 0.3s ease";
    svg.style.transform = `translate(0,0) scale(${newScale})`;
}

function zoomOutMap() {
    const svg = document.querySelector("#usaMap svg");
    if (!svg) return;
    
    const currentTransform = svg.getAttribute("transform") || "translate(0,0) scale(1)";
    const scale = parseFloat(currentTransform.match(/scale\(([^)]+)\)/)?.[1] || 1);
    const newScale = Math.max(scale / 1.2, 0.5);
    
    svg.style.transition = "transform 0.3s ease";
    svg.style.transform = `translate(0,0) scale(${newScale})`;
}

// Customer Management Functions
function showNewLeadModal() {
    const modal = new bootstrap.Modal(document.getElementById('newLeadModal'));
    modal.show();
}

async function saveNewLead() {
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    const address = document.getElementById('address').value;
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Error', 'You must be logged in to add customers');
            return;
        }
        
        // Create customer directly via API
        const customerData = {
            name: `${firstName} ${lastName}`.trim() || 'Unknown',
            email: email || null,
            phone: phone || null,
        status: 'pending',
            assigned_to: currentUser.role === 'employee' ? currentUser.username : null,
            notes: null
        };
        
        const response = await fetch(API_BASE_URL + '/customers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(customerData)
        });
        
        if (response.ok) {
            const newCustomer = await response.json();
            // Add to local array for immediate UI update
    customers.push(newCustomer);
    
    // Hide modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('newLeadModal'));
    modal.hide();
    
    // Reset form
    document.getElementById('newLeadForm').reset();
    
    // Reload dashboard
    loadDashboard();
    
    showNotification('success', 'Customer Added', 'New customer has been added successfully!');
        } else {
            const error = await response.json();
            showNotification('error', 'Error', error.error || 'Failed to add customer');
        }
    } catch (error) {
        console.error('Error creating customer:', error);
        showNotification('error', 'Error', 'Failed to add customer. Please try again.');
    }
}

// Refer a Friend Functions
function showReferFriendModal() {
    const modal = new bootstrap.Modal(document.getElementById('referFriendModal'));
    modal.show();
}

// Show Referrals View (Admin Dashboard)
async function showReferralsView() {
    const modal = new bootstrap.Modal(document.getElementById('referralsModal'));
    modal.show();
    await loadReferrals();
}

// Load and display referrals
async function loadReferrals() {
    const tbody = document.getElementById('referralsTable');
    const pager = document.getElementById('referralsPagination');
    
    if (!tbody) return;
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Authentication required</td></tr>';
            return;
        }
        
        const response = await fetch(API_BASE_URL + '/referrals', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch referrals');
        }
        
        const referrals = await response.json();
        
        if (referrals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No referrals found</td></tr>';
            if (pager) pager.innerHTML = '';
            return;
        }
        
        // Pagination
        const pageSize = 50;
        const totalPages = Math.ceil(referrals.length / pageSize);
        const currentPage = window.referralsCurrentPage || 1;
        const start = (currentPage - 1) * pageSize;
        const end = Math.min(start + pageSize, referrals.length);
        const pageReferrals = referrals.slice(start, end);
        
        // Render table
        let html = '';
        for (const referral of pageReferrals) {
            const referredDate = new Date(referral.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            html += `
                <tr>
                    <td><strong>${referral.name || 'N/A'}</strong></td>
                    <td>${referral.phone ? `<a href="tel:${referral.phone}" class="text-decoration-none">${referral.phone}</a>` : '-'}</td>
                    <td>${referral.email ? `<a href="mailto:${referral.email}" class="text-decoration-none">${referral.email}</a>` : '-'}</td>
                    <td>${referral.referred_by_name || referral.referred_by_username || 'Unknown'}</td>
                    <td><small class="text-muted">${referredDate}</small></td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="createCustomerFromReferral(${referral.id}, '${referral.name.replace(/'/g, "\\'")}', '${referral.phone || ''}', '${referral.email || ''}')" title="Create Customer">
                            <i class="fas fa-user-plus"></i> Create Customer
                        </button>
                    </td>
                </tr>
            `;
        }
        tbody.innerHTML = html;
        
        // Add event listeners to checkboxes to update delete selected option state
        const checkboxes = document.querySelectorAll('#assignWorkTable .customer-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateDeleteSelectedOption);
        });
        
        // Update delete selected option state on initial render
        updateDeleteSelectedOption();
        
        // Render pagination
        if (pager && totalPages > 1) {
            let pagerHtml = `<div class="d-flex align-items-center gap-2">
                <span class="text-muted">Showing ${start + 1}-${end} of ${referrals.length}</span>
            </div>
            <div class="d-flex align-items-center gap-2">`;
            
            if (currentPage > 1) {
                pagerHtml += `<button class="btn btn-sm btn-outline-primary" onclick="window.referralsCurrentPage = ${currentPage - 1}; loadReferrals();">Previous</button>`;
            }
            
            pagerHtml += `<span class="text-muted">Page ${currentPage} of ${totalPages}</span>`;
            
            if (currentPage < totalPages) {
                pagerHtml += `<button class="btn btn-sm btn-outline-primary" onclick="window.referralsCurrentPage = ${currentPage + 1}; loadReferrals();">Next</button>`;
            }
            
            pagerHtml += '</div>';
            pager.innerHTML = pagerHtml;
        } else if (pager) {
            pager.innerHTML = `<div class="d-flex align-items-center gap-2">
                <span class="text-muted">Showing ${referrals.length} referral${referrals.length !== 1 ? 's' : ''}</span>
            </div>`;
        }
        
    } catch (error) {
        console.error('Error loading referrals:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading referrals. Please try again.</td></tr>';
        if (pager) pager.innerHTML = '';
    }
}

// Create customer from referral
async function createCustomerFromReferral(referralId, name, phone, email) {
    if (!confirm(`Create a new customer from this referral?\n\nName: ${name}\nPhone: ${phone || 'N/A'}\nEmail: ${email || 'N/A'}`)) {
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Error', 'You must be logged in to create customers');
            return;
        }
        
        const customerData = {
            name: name,
            email: email || null,
            phone: phone || null,
            status: 'pending',
            assigned_to: null,
            notes: `Created from referral ID: ${referralId}`
        };
        
        const response = await fetch(API_BASE_URL + '/customers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(customerData)
        });
        
        if (response.ok) {
            const newCustomer = await response.json();
            showNotification('success', 'Customer Created', 'New customer has been created from referral!');
            // Reload referrals to update the list
            await loadReferrals();
            // Optionally reload dashboard
            if (typeof loadDashboard === 'function') {
                loadDashboard();
            }
        } else {
            const error = await response.json();
            showNotification('error', 'Error', error.error || 'Failed to create customer');
        }
    } catch (error) {
        console.error('Error creating customer from referral:', error);
        showNotification('error', 'Error', 'Failed to create customer. Please try again.');
    }
}

// Export referrals
function exportReferrals() {
    // This would export referrals to CSV/Excel
    showNotification('info', 'Export', 'Export functionality coming soon!');
}

async function submitReferral() {
    const name = document.getElementById('referFriendName').value.trim();
    const phone = document.getElementById('referFriendPhone').value.trim();
    const email = document.getElementById('referFriendEmail').value.trim();
    
    // Validate that at least name is provided
    if (!name) {
        showNotification('error', 'Validation Error', 'Name is required.');
        return;
    }
    
    // Validate that at least phone or email is provided
    if (!phone && !email) {
        showNotification('error', 'Validation Error', 'Please provide either a phone number or email address.');
        return;
    }
    
    // Validate email format if provided
    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showNotification('error', 'Validation Error', 'Please enter a valid email address.');
            return;
        }
    }
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Error', 'You must be logged in to submit a referral.');
            return;
        }
        
        // Get current user info for referrer (backend will use token to get user ID)
        const currentUserData = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        
        // Create referral data (backend will extract user ID from token)
        const referralData = {
            name: name,
            phone: phone || null,
            email: email || null,
            referred_by_name: currentUserData.name || currentUserData.username || 'Unknown'
        };
        
        const response = await fetch(API_BASE_URL + '/referrals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(referralData)
        });
        
        if (response.ok) {
            const referral = await response.json();
            
            // Hide modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('referFriendModal'));
            modal.hide();
            
            // Reset form
            document.getElementById('referFriendForm').reset();
            
            showNotification('success', 'Referral Submitted', 'Thank you for referring a friend! We will contact them soon.');
        } else {
            const error = await response.json();
            showNotification('error', 'Error', error.error || 'Failed to submit referral. Please try again.');
        }
    } catch (error) {
        console.error('Error submitting referral:', error);
        showNotification('error', 'Error', 'Failed to submit referral. Please try again.');
    }
}

// Modern File Upload Functions
let selectedFile = null;

function handleFileSelect(input) {
    const file = input.files[0];
    if (file) {
        selectedFile = file;
        showFileInfo(file);
    }
}

function showFileInfo(file) {
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
    document.getElementById('fileInfo').classList.add('show');
    
    // Hide upload area
    document.getElementById('uploadArea').style.display = 'none';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeFile() {
    selectedFile = null;
    document.getElementById('csvFile').value = '';
    document.getElementById('fileInfo').classList.remove('show');
    document.getElementById('csvPreview').classList.remove('show');
    document.getElementById('uploadArea').style.display = 'block';
}

function previewCSV() {
    if (!selectedFile) {
        showNotification('warning', 'No File Selected', 'Please select a CSV file first.');
        return;
    }
    
    if (!selectedFile.name.endsWith('.csv')) {
        showNotification('error', 'Invalid File Type', 'Only CSV files are allowed.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        showCSVPreview(text);
    };
    reader.readAsText(selectedFile);
}

// Excel/CSV detection helpers
function isCSV(file) {
    return /\.csv$/i.test(file.name);
}

function isExcel(file) {
    return /\.(xlsx|xls)$/i.test(file.name);
}

// Generic preview supporting CSV and Excel
function previewFile() {
    if (!selectedFile) {
        showNotification('warning', 'No File Selected', 'Please select a file first.');
        return;
    }
    if (isCSV(selectedFile)) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            showCSVPreview(text);
        };
        reader.readAsText(selectedFile);
    } else if (isExcel(selectedFile)) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const sheetName = wb.SheetNames[0];
                const ws = wb.Sheets[sheetName];
                const csv = XLSX.utils.sheet_to_csv(ws);
                showCSVPreview(csv);
            } catch (err) {
                showNotification('error', 'Preview Failed', 'Unable to read Excel file.');
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    } else {
        showNotification('error', 'Invalid File Type', 'Please upload a .csv, .xlsx, or .xls file.');
    }
}

// Upload file directly to server - prevents browser freezing on large files
async function processFile() {
    if (!selectedFile) {
        showNotification('warning', 'No File Selected', 'Please select a file to import.');
        return;
    }

    // Validate file type
    if (!isCSV(selectedFile) && !isExcel(selectedFile)) {
        showNotification('error', 'Invalid File Type', 'Please upload a .csv, .xlsx, or .xls file.');
        return;
    }

    const token = sessionStorage.getItem('authToken');
    if (!token) {
        showNotification('error', 'Upload Failed', 'You must be logged in to upload files');
        return;
    }

    // Show progress
    const progressDiv = document.getElementById('uploadProgress');
    if (progressDiv) {
        progressDiv.classList.add('show');
    }
    document.getElementById('progressBar').style.width = '10%';
    document.getElementById('progressText').textContent = 'Uploading file to server...';

    try {
        // Create FormData to send file
        const formData = new FormData();
        formData.append('file', selectedFile);

        // Update progress
        document.getElementById('progressBar').style.width = '30%';
        document.getElementById('progressText').textContent = 'Processing file on server...';

        // Send file to server for processing
        const response = await fetch(API_BASE_URL + '/customers/upload-file', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // Don't set Content-Type - browser will set it with boundary for FormData
            },
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            
            // Update progress
            document.getElementById('progressBar').style.width = '100%';
            document.getElementById('progressText').textContent = 'Complete!';

            // Reload customers from server
            await loadCustomers();
            
            // Refresh Assign Work tab if it's currently visible
            const assignWorkTab = document.getElementById('assignWorkTab');
            if (assignWorkTab && assignWorkTab.style.display !== 'none') {
                await renderAssignWorkPage();
            }

            // Show success message
            setTimeout(() => {
                if (progressDiv) {
                    progressDiv.classList.remove('show');
                }
                showNotification('success', 'Upload Complete', 
                    `Successfully imported ${result.importedCount} out of ${result.totalRecords} customers.${result.errorCount > 0 ? ` ${result.errorCount} failed.` : ''}`);
                removeFile();
                showTab('dashboard');
                loadDashboard();
            }, 1000);
        } else {
            const error = await response.json();
            showNotification('error', 'Upload Failed', error.error || 'Failed to process file');
            if (progressDiv) {
                progressDiv.classList.remove('show');
            }
        }
    } catch (error) {
        console.error('File upload error:', error);
        showNotification('error', 'Upload Failed', 'Connection error. Is the server running?');
        const progressDiv = document.getElementById('uploadProgress');
        if (progressDiv) {
            progressDiv.classList.remove('show');
        }
    }
}

// NEW: Header-normalized import from SheetJS worksheet (reliable for CSV and Excel)
function importFromWorksheet(worksheet) {
    // Read as 2D arrays (avoid object mode for speed on large sheets)
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
    if (!rows || rows.length === 0) {
        showNotification('error', 'Invalid Data', 'No rows found to import.');
        return;
    }

    // Heuristic: find the first likely header row within the first 10 rows
    let headerRowIndex = 0;
    const isLikelyHeader = (r) => {
        const vals = (r || []).map(v => String(v || '').toLowerCase());
        const joined = vals.join(' ');
        const keywords = ['name', 'email', 'phone', 'address', 'first', 'last'];
        const hits = keywords.filter(k => joined.includes(k)).length;
        const nonEmpty = vals.filter(v => v.trim()).length;
        return hits >= 1 && nonEmpty >= 2;
    };
    for (let i = 0; i < Math.min(10, rows.length); i++) {
        if (isLikelyHeader(rows[i])) { headerRowIndex = i; break; }
    }

    const headers = (rows[headerRowIndex] || []).map(h => String(h).trim());
    const dataRows = rows.slice(headerRowIndex + 1);
    importTabularData(headers, dataRows);
}

// NEW: Robust header mapping and data ingestion
async function importTabularData(headers, dataRows) {
    const normalize = (h) => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

    // Build header index map
    const headerIndexByKey = {
        firstName: -1,
        lastName: -1,
        name: -1,
        email: -1,
        phone: -1,
        address: -1
    };

    headers.forEach((h, idx) => {
        const n = normalize(h);
        if (n === 'name') headerIndexByKey.name = idx;
        if (n === 'email') headerIndexByKey.email = idx;
        if (n === 'phone' || n === 'mobile' || n === 'contact') headerIndexByKey.phone = idx;
        if (n === 'address' || n === 'state' || n === 'address line' || n === 'address1') headerIndexByKey.address = idx;
        // Also support First Name / Last Name alternatives
        if (n === 'first name' || (n.includes('first') && n.includes('name'))) headerIndexByKey.firstName = idx;
        if (n === 'last name' || (n.includes('last') && n.includes('name'))) headerIndexByKey.lastName = idx;
    });

    let importedCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] || [];

        // Extract by header indices
        let firstName = headerIndexByKey.firstName >= 0 ? String(row[headerIndexByKey.firstName] || '').trim() : '';
        let lastName  = headerIndexByKey.lastName  >= 0 ? String(row[headerIndexByKey.lastName]  || '').trim() : '';
        let name      = headerIndexByKey.name      >= 0 ? String(row[headerIndexByKey.name]      || '').trim() : '';
        let email     = headerIndexByKey.email     >= 0 ? String(row[headerIndexByKey.email]     || '').trim() : '';
        let phone     = headerIndexByKey.phone     >= 0 ? String(row[headerIndexByKey.phone]     || '').trim() : '';
        let address   = headerIndexByKey.address   >= 0 ? String(row[headerIndexByKey.address]   || '').trim() : '';

        // If only Name provided, split into first/last
        if (!firstName && !lastName && name) {
            const parts = name.split(/\s+/);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
        }

        // If no address column, leave blank
        if (headerIndexByKey.address === -1) {
            address = '';
        }

        // Skip empty rows
        if (!firstName && !lastName && !email && !phone) continue;

        const newCustomer = {
            id: Date.now() + i,
            firstName,
            lastName,
            phone,
            email,
            address,
            status: 'pending',
            callStatus: 'not_called',
            comments: '',
            createdAt: new Date().toISOString(),
            assignedTo: ''
        };

        customersData.push(newCustomer);
        importedCount++;
    }

    // Always use bulk upload API (optimized for any size)
        await bulkUploadCustomers(customersData);
    
    showNotification('success', 'Import Complete', `Successfully imported ${importedCount} customers!`);
    document.getElementById('csvFile').value = '';
    showTab('dashboard');
    loadDashboard();
}

// Delete selected customers (ADMIN ONLY)
window.deleteSelectedCustomers = async function deleteSelectedCustomers() {
    console.log('🗑️ deleteSelectedCustomers() called');
    
    try {
        // Check if user is admin
        if (!currentUser || currentUser.role !== 'admin') {
            showNotification('error', 'Access Denied', 'Only administrators can delete customers.');
            console.error('❌ User is not admin:', currentUser);
            return;
        }
        
        // Get selected customer IDs
        const selectedIds = getSelectedCustomerIds();
        
        if (selectedIds.length === 0) {
            showNotification('warning', 'No Selection', 'Please select customers to delete.');
            return;
        }
        
        // Get customer names for confirmation
        const selectedCustomers = customers.filter(c => selectedIds.includes(c.id));
        const customerNames = selectedCustomers.map(c => `${c.firstName} ${c.lastName}`).slice(0, 5);
        const moreCount = selectedCustomers.length > 5 ? selectedCustomers.length - 5 : 0;
        
        // Show confirmation
        const confirmMessage = `You are about to delete ${selectedCustomers.length} customer(s):\n\n${customerNames.join('\n')}${moreCount > 0 ? `\n... and ${moreCount} more` : ''}\n\nThis action CANNOT be undone!\n\nAre you sure you want to continue?`;
        const confirmed = await showCrmConfirm('⚠️ Delete Selected Customers', confirmMessage);
        
        if (!confirmed) {
            console.log('User cancelled deletion');
            return;
        }
        
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            console.error('❌ No auth token found');
            showNotification('error', 'Not Authenticated', 'Please log in again.');
            return;
        }
        
        // Show loading state
        showNotification('info', 'Deleting...', `Deleting ${selectedCustomers.length} customer(s). This may take a moment...`);
        console.log('Making POST request to:', API_BASE_URL + '/customers/bulk-delete');
        console.log('Customer IDs to delete:', selectedIds);
        
        const response = await fetch(API_BASE_URL + '/customers/bulk-delete', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ customerIds: selectedIds })
        });
        
        console.log('Response status:', response.status, response.statusText);
        
        // Check if response has content before parsing JSON
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Server returned non-JSON response: ' + text);
        }
        
        console.log('Response data:', data);
        
        if (!response.ok) {
            throw new Error(data.error || `Server error: ${response.status} ${response.statusText}`);
        }
        
        // Success
        console.log('✅ Successfully deleted customers:', data.deletedCount);
        showNotification('success', 'Deleted Successfully', `Successfully deleted ${data.deletedCount} customer(s)!`);
        
        // Remove deleted customers from local array
        customers = customers.filter(c => !selectedIds.includes(c.id));
        
        // Refresh dashboard and assign work tab
        setTimeout(() => {
            if (currentUser && currentUser.role === 'admin') {
                console.log('Refreshing dashboard and assign work page...');
                loadAdminDashboard();
                renderAssignWorkPage();
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error deleting selected customers:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        showNotification('error', 'Delete Failed', error.message || 'Failed to delete selected customers. Please check console for details.');
    }
};

// Delete ALL customers (ADMIN ONLY - DANGEROUS!)
// CRITICAL: Make sure this function is globally accessible
window.deleteAllCustomers = async function deleteAllCustomers() {
    console.log('🗑️ deleteAllCustomers() called');
    
    try {
        // Check if user is admin
        if (!currentUser || currentUser.role !== 'admin') {
            showNotification('error', 'Access Denied', 'Only administrators can delete all customers.');
            console.error('❌ User is not admin:', currentUser);
            return;
        }
        
        // Double confirmation
        console.log('Showing first confirmation...');
        const confirm1 = await showCrmConfirm('⚠️ WARNING', 'This will delete ALL customers from the database!\n\nThis action CANNOT be undone!\n\nAre you sure you want to continue?');
        if (!confirm1) {
            console.log('User cancelled at first confirmation');
            return;
        }
        
        console.log('Showing second confirmation...');
        const confirm2 = await showCrmConfirm('⚠️ FINAL WARNING', 'You are about to delete ALL customers!\n\nType "DELETE ALL" in the next prompt to confirm.');
        if (!confirm2) {
            console.log('User cancelled at second confirmation');
            return;
        }
        
        console.log('Showing text prompt...');
        const confirmText = await showCrmPrompt('Confirm Deletion', 'Type "DELETE ALL" (in uppercase) to confirm deletion of all customers:', '');
        if (confirmText !== 'DELETE ALL') {
            console.log('User did not type "DELETE ALL" correctly:', confirmText);
            showNotification('error', 'Cancelled', 'Deletion cancelled. You must type "DELETE ALL" exactly to confirm.');
            return;
        }
        
        console.log('✅ All confirmations passed. Starting deletion...');
        
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            console.error('❌ No auth token found');
            showNotification('error', 'Not Authenticated', 'Please log in again.');
            return;
        }
        
        // Show loading state
        showNotification('info', 'Deleting...', 'Deleting all customers. This may take a moment...');
        console.log('Making DELETE request to:', API_BASE_URL + '/customers/all');
        
        const response = await fetch(API_BASE_URL + '/customers/all', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', response.status, response.statusText);
        
        // Check if response has content before parsing JSON
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Server returned non-JSON response: ' + text);
        }
        
        console.log('Response data:', data);
        
        if (!response.ok) {
            throw new Error(data.error || `Server error: ${response.status} ${response.statusText}`);
        }
        
        // Success
        console.log('✅ Successfully deleted customers:', data.deletedCount);
        showNotification('success', 'Deleted Successfully', `Successfully deleted ${data.deletedCount.toLocaleString()} customers!`);
        
        // Refresh dashboard and assign work tab
        setTimeout(() => {
            if (currentUser && currentUser.role === 'admin') {
                console.log('Refreshing dashboard and assign work page...');
                loadAdminDashboard();
                renderAssignWorkPage();
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error deleting all customers:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        showNotification('error', 'Delete Failed', error.message || 'Failed to delete all customers. Please check console for details.');
    }
};

function showCSVPreview(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        showNotification('error', 'Invalid CSV', 'CSV file is empty or invalid.');
        return;
    }
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const previewRows = lines.slice(1, 6); // Show first 5 data rows
    
    const table = document.getElementById('previewTable');
    table.innerHTML = '';
    
    // Create header row
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
    
    // Create data rows
    previewRows.forEach(line => {
        const row = document.createElement('tr');
        const cells = line.split(',').map(cell => cell.trim().replace(/"/g, ''));
        cells.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell || '-';
            row.appendChild(td);
        });
        table.appendChild(row);
    });
    
    document.getElementById('csvPreview').classList.add('show');
}

function processCSV() {
    if (!selectedFile) {
        showNotification('warning', 'No File Selected', 'Please select a CSV file to import.');
        return;
    }
    
    if (!selectedFile.name.endsWith('.csv')) {
        showNotification('error', 'Invalid File Type', 'Only CSV files are allowed.');
        return;
    }
    
    // Show progress
    document.getElementById('uploadProgress').classList.add('show');
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressText').textContent = 'Reading file...';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('progressBar').style.width = '50%';
        document.getElementById('progressText').textContent = 'Processing data...';
        
        setTimeout(() => {
            const text = e.target.result;
            parseCSVData(text);
            
            document.getElementById('progressBar').style.width = '100%';
            document.getElementById('progressText').textContent = 'Complete!';
            
            setTimeout(() => {
                document.getElementById('uploadProgress').classList.remove('show');
                removeFile();
            }, 1000);
        }, 500);
    };
    reader.readAsText(selectedFile);
}

async function parseCSVData(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        showNotification('error', 'Invalid CSV', 'CSV file is empty or invalid.');
        return;
    }
    
    // Parse CSV (assuming format: Name, Phone, Email, Address or First Name, Last Name, Phone, Email, Address)
    const headers = lines[0].split(',').map(h => h.trim());
    
    const customersData = [];
    let importedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        
        if (values.length >= 4) {
            let firstName, lastName, phone, email, address;
            
            if (headers.length === 5 && headers[0].toLowerCase().includes('first')) {
                // Format: First Name, Last Name, Phone, Email, Address
                firstName = values[0];
                lastName = values[1];
                phone = values[2];
                email = values[3];
                address = values.slice(4).join(', ');
            } else {
                // Format: Name, Phone, Email, Address
                const nameParts = values[0].split(' ');
                firstName = nameParts[0];
                lastName = nameParts.slice(1).join(' ') || '';
                phone = values[1];
                email = values[2];
                address = values.slice(3).join(', ');
            }
            
            const newCustomer = {
                name: `${firstName} ${lastName}`.trim() || 'Unknown',
                firstName,
                lastName,
                phone: phone || null,
                email: email || null,
                address: address || '',
                status: 'pending',
                assignedTo: null,
                notes: null
            };
            
            customersData.push(newCustomer);
            importedCount++;
        }
    }
    
    // Use bulk upload API for CSV imports
    if (customersData.length > 0) {
        await bulkUploadCustomers(customersData);
    }
    showNotification('success', 'Import Complete', `Successfully imported ${importedCount} customers!`);
    
    // Clear file input
    document.getElementById('csvFile').value = '';
    
    // Reload dashboard
    showTab('dashboard');
    loadDashboard();
}

// Assign Work Functions
function loadAssignWorkTable() {
    // Initialize pagination defaults and render first page
    window.assignFiltered = null;
    window.assignPageSize = window.assignPageSize || 200;
    window.assignCurrentPage = 1;
    // CRITICAL: Call renderAssignWorkPage to ensure pagination is rendered
    renderAssignWorkPage();
    renderAssignWorkPage();
    // Load employee dropdown
    loadEmployeeDropdown();
}

// Pagination helpers for Assign Work
function getAssignSourceArray() {
    // Always exclude archived customers - they are shown in the Archive modal only
    let base = Array.isArray(window.assignFiltered) ? window.assignFiltered : customers;
    base = base.filter(c => (c.status || '') !== 'archived' && c.archived !== true);
    
    const sel = Array.isArray(window.assignStatusFilter) ? window.assignStatusFilter : null;
    if (sel && sel.length > 0) {
        const set = new Set(sel);
        // Filter by status, excluding 'archived' status
        const filtered = sel.filter(s => s !== 'archived');
        if (filtered.length > 0) {
            const filteredSet = new Set(filtered);
            return base.filter(c => filteredSet.has(c.status || ''));
        }
    }
    return base;
}

function getArchivedCount() {
    return customers.filter(c => c.archived === true || (c.status && c.status === 'archived')).length;
}

function openArchiveView() {
    // Open Archive modal
    const modal = new bootstrap.Modal(document.getElementById('archiveModal'));
    modal.show();
    window.archiveCurrentPage = 1;
    window.archiveStatusFilter = null; // Reset filter
    resetArchiveStatusFilter();
    renderArchiveModal();
}

function getArchiveSourceArray() {
    // Get all archived customers
    let base = customers.filter(c => (c.status || '') === 'archived' || c.archived === true);
    const sel = Array.isArray(window.archiveStatusFilter) ? window.archiveStatusFilter : null;
    if (sel && sel.length > 0) {
        const set = new Set(sel);
        // Filter by previousStatus (original status before archiving)
        return base.filter(c => set.has(c.previousStatus || 'pending'));
    }
    return base;
}

function renderArchiveModal() {
    const tbody = document.getElementById('archiveTable');
    const pager = document.getElementById('archivePagination');
    if (!tbody || !pager) return;
    
    const source = getArchiveSourceArray();
    const total = source.length;
    const size = window.archivePageSize || 200;
    const pages = Math.max(1, Math.ceil(total / size));
    let page = Math.min(Math.max(1, window.archiveCurrentPage || 1), pages);
    window.archiveCurrentPage = page;

    const start = (page - 1) * size;
    const end = Math.min(start + size, total);
    const slice = source.slice(start, end);

    let html = '';
    for (const customer of slice) {
        const statusForDisplay = customer.previousStatus || 'pending';
        html += `
        <tr ondblclick="openUpdateStatusModal(${customer.id})" style="cursor: pointer;" title="Double-click to view details">
            <td><input type="checkbox" class="archive-customer-checkbox" data-id="${customer.id}" onclick="event.stopPropagation();"></td>
            <td><strong>${customer.firstName} ${customer.lastName}</strong></td>
            <td><a href="tel:${customer.phone || ''}" class="text-decoration-none phone-link" title="Double-click to copy" onclick="event.stopPropagation();">${customer.phone || ''}</a></td>
            <td><a href="mailto:${customer.email || ''}" class="text-decoration-none" onclick="event.stopPropagation();">${customer.email || ''}</a></td>
            <td><small class="text-muted">${customer.address || ''}</small></td>
            <td style="text-align:center;"><span class="badge bg-${getStatusBadgeColor(statusForDisplay)}">${getStatusDisplayName(statusForDisplay)}</span></td>
            <td><small>${customer.comments || '-'}</small></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); openUpdateStatusModal(${customer.id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>`;
    }
    tbody.innerHTML = html;

    // Pagination controls
    let pagerHtml = `<div class="d-flex align-items-center gap-2">
        <span class="text-muted">Showing ${start + 1}-${end} of ${total}</span>
        <select class="form-select form-select-sm" style="width:auto;" onchange="window.archivePageSize=parseInt(this.value);window.archiveCurrentPage=1;renderArchiveModal();">
            <option value="100" ${size===100?'selected':''}>100 per page</option>
            <option value="200" ${size===200?'selected':''}>200 per page</option>
            <option value="300" ${size===300?'selected':''}>300 per page</option>
            <option value="500" ${size===500?'selected':''}>500 per page</option>
            <option value="1000" ${size===1000?'selected':''}>1000 per page</option>
        </select>
    </div>
    <div class="d-flex align-items-center gap-2">
        <button class="btn btn-sm btn-outline-secondary" onclick="window.archiveCurrentPage=1;renderArchiveModal();" ${page===1?'disabled':''}>
            <i class="fas fa-angle-double-left"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary" onclick="window.archiveCurrentPage=${page-1};renderArchiveModal();" ${page===1?'disabled':''}>
            <i class="fas fa-angle-left"></i>
        </button>
        <span class="text-muted">Page ${page} / ${pages}</span>
        <button class="btn btn-sm btn-outline-secondary" onclick="window.archiveCurrentPage=${page+1};renderArchiveModal();" ${page===pages?'disabled':''}>
            <i class="fas fa-angle-right"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary" onclick="window.archiveCurrentPage=${pages};renderArchiveModal();" ${page===pages?'disabled':''}>
            <i class="fas fa-angle-double-right"></i>
        </button>
    </div>`;
    pager.innerHTML = pagerHtml;
}

function getSelectedCustomerIds() {
    const checkboxes = document.querySelectorAll('#assignWorkTable .customer-checkbox:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.getAttribute('data-id')));
}

// Update delete selected option state based on selection
function updateDeleteSelectedOption() {
    const deleteSelectedOption = document.getElementById('deleteSelectedOption');
    if (!deleteSelectedOption) return;
    
    const selectedIds = getSelectedCustomerIds();
    const hasSelection = selectedIds.length > 0;
    
    if (hasSelection) {
        deleteSelectedOption.classList.remove('disabled');
        deleteSelectedOption.style.opacity = '1';
        deleteSelectedOption.style.cursor = 'pointer';
        deleteSelectedOption.title = `Delete ${selectedIds.length} selected customer(s)`;
    } else {
        deleteSelectedOption.classList.add('disabled');
        deleteSelectedOption.style.opacity = '0.5';
        deleteSelectedOption.style.cursor = 'not-allowed';
        deleteSelectedOption.title = 'Select customers to delete';
    }
}

async function archiveSelected() {
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('error', 'Not allowed', 'Only admin can archive customers.');
        return;
    }
    const ids = getSelectedCustomerIds();
    if (ids.length === 0) {
        showNotification('info', 'No Selection', 'Select customers to move to Archive.');
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Error', 'You must be logged in to archive customers');
            return;
        }
        
        // Archive each customer via API
        const archivePromises = ids.map(async (id) => {
            const customer = customers.find(c => c.id === id);
            if (!customer) return;
            
            const response = await fetch(API_BASE_URL + '/customers/' + id, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
                    email: customer.email || null,
                    phone: customer.phone || null,
                    status: customer.status || 'pending',
                    assigned_to: null, // Clear assignment when archiving
                    notes: customer.comments || customer.notes || null,
                    archived: true
                })
            });
            
            if (response.ok) {
                const updated = await response.json();
                // Update local array
                const index = customers.findIndex(c => c.id === id);
                if (index !== -1) {
                    customers[index] = { ...customers[index], ...updated, archived: true, assignedTo: null };
                }
            }
        });
        
        await Promise.all(archivePromises);
        
    renderAssignWorkPage();
    // Refresh archive modal if it's open
    const archiveModalEl = document.getElementById('archiveModal');
    if (archiveModalEl && archiveModalEl.classList.contains('show')) {
        renderArchiveModal();
    }
    loadDashboard();
    showNotification('success', 'Archived', `Moved ${ids.length} customer(s) to Archive.`);
    } catch (error) {
        console.error('Error archiving customers:', error);
        showNotification('error', 'Error', 'Failed to archive customers. Please try again.');
    }
}

function getSelectedArchiveCustomerIds() {
    const checkboxes = document.querySelectorAll('#archiveTable .archive-customer-checkbox:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.getAttribute('data-id')));
}

async function restoreFromArchiveSelected() {
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('error', 'Not allowed', 'Only admin can restore customers.');
        return;
    }
    const ids = getSelectedArchiveCustomerIds();
    if (ids.length === 0) {
        showNotification('info', 'No Selection', 'Select archived customers to restore.');
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Error', 'You must be logged in to restore customers');
            return;
        }
        
        // Restore each customer via API
        const restorePromises = ids.map(async (id) => {
            const customer = customers.find(c => c.id === id);
            if (!customer) return;
            
            const previousStatus = customer.previousStatus || customer.status || 'pending';
            
            const response = await fetch(API_BASE_URL + '/customers/' + id, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
                    email: customer.email || null,
                    phone: customer.phone || null,
                    status: previousStatus,
                    assigned_to: customer.assignedTo || customer.assigned_to || null,
                    notes: customer.comments || customer.notes || null,
                    archived: false
                })
            });
            
            if (response.ok) {
                const updated = await response.json();
                // Update local array
                const index = customers.findIndex(c => c.id === id);
                if (index !== -1) {
                    customers[index] = { ...customers[index], ...updated, archived: false };
                }
            }
        });
        
        await Promise.all(restorePromises);
        
    renderArchiveModal();
    renderAssignWorkPage();
    loadDashboard();
    showNotification('success', 'Restored', `Moved ${ids.length} customer(s) back to Assign Work.`);
    } catch (error) {
        console.error('Error restoring customers:', error);
        showNotification('error', 'Error', 'Failed to restore customers. Please try again.');
    }
}

function toggleAllArchiveSelection(checkbox) {
    const checkboxes = document.querySelectorAll('#archiveTable .archive-customer-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

function toggleArchiveStatusFilter() {
    const dropdown = document.getElementById('archiveStatusFilterDropdown');
    if (!dropdown) return;
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
}

function applyArchiveStatusFilter() {
    const checkboxes = document.querySelectorAll('#archiveStatusFilterDropdown .archive-status-checkbox:checked');
    const selected = Array.from(checkboxes).map(cb => cb.value);
    const selectAll = document.getElementById('archiveStatusSelectAll');
    
    if (selected.length === 0 || selectAll.checked) {
        window.archiveStatusFilter = null;
    } else {
        window.archiveStatusFilter = selected;
    }
    
    const textEl = document.getElementById('archiveStatusFilterText');
    if (textEl) {
        if (!window.archiveStatusFilter || window.archiveStatusFilter.length === 0 || selectAll.checked) {
            textEl.textContent = 'Status';
        } else {
            textEl.textContent = `${selected.length} selected`;
        }
    }
    
    document.getElementById('archiveStatusFilterDropdown').style.display = 'none';
    window.archiveCurrentPage = 1;
    renderArchiveModal();
}

function resetArchiveStatusFilter() {
    const checkboxes = document.querySelectorAll('#archiveStatusFilterDropdown .archive-status-checkbox');
    checkboxes.forEach(cb => cb.checked = true);
    document.getElementById('archiveStatusSelectAll').checked = true;
    window.archiveStatusFilter = null;
    const textEl = document.getElementById('archiveStatusFilterText');
    if (textEl) textEl.textContent = 'Status';
}

function exportArchivedCustomers() {
    const source = getArchiveSourceArray();
    if (source.length === 0) {
        showNotification('info', 'No Data', 'No archived customers to export.');
        return;
    }
    const csv = generateCSV(source);
    downloadCSV(csv, 'archived_customers_' + new Date().toISOString().split('T')[0] + '.csv');
    showNotification('success', 'Exported', `Exported ${source.length} archived customer(s).`);
}

// Event listeners for Archive filter dropdown
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('archiveStatusFilterDropdown');
    const btn = document.getElementById('archiveStatusFilterBtn');
    if (!dropdown) return;
    const isVisible = dropdown.style.display === 'block';
    if (!isVisible) return;
    if (btn && (btn === e.target || btn.contains(e.target))) return;
    if (!dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const dropdown = document.getElementById('archiveStatusFilterDropdown');
        if (dropdown && dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
        }
    }
});

function updateAssignArchiveButtonsVisibility() {
    const moveToContainer = document.getElementById('moveToContainer');
    if (!moveToContainer) return;
    const isAdmin = currentUser && currentUser.role === 'admin';
    // Move To dropdown is always visible for admin in Assign Work
    moveToContainer.style.display = isAdmin ? 'block' : 'none';
}

// Toggle Move To status dropdown
function toggleMoveToStatusDropdown() {
    const dropdown = document.getElementById('moveToStatusDropdown');
    if (!dropdown) return;
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
}

// Move selected customers to a specific status
async function moveSelectedCustomersToStatus() {
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('error', 'Not allowed', 'Only admin can move customers.');
        return;
    }
    
    // Get selected status
    const selectedRadio = document.querySelector('input[name="moveToStatus"]:checked');
    if (!selectedRadio) {
        showNotification('info', 'No Status Selected', 'Please select a status to move customers to.');
        return;
    }
    
    const targetStatus = selectedRadio.value;
    const ids = getSelectedCustomerIds();
    if (ids.length === 0) {
        showNotification('info', 'No Selection', 'Select customers to move.');
        return;
    }
    
    // Close dropdown
    document.getElementById('moveToStatusDropdown').style.display = 'none';
    
    // Show confirmation
    const statusDisplayName = getStatusDisplayName(targetStatus);
    const confirmed = await showCrmConfirm(
        'Confirm Move',
        `Move ${ids.length} customer(s) to "${statusDisplayName}" status?`
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Error', 'You must be logged in to move customers');
            return;
        }
        
        // Determine if this is an archive operation
        const isArchive = targetStatus === 'archived';
        
        // Move each customer via API
        const movePromises = ids.map(async (id) => {
            const customer = customers.find(c => c.id === id);
            if (!customer) return;
            
            const updateData = {
                name: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
                email: customer.email || null,
                phone: customer.phone || null,
                status: targetStatus,
                assigned_to: isArchive ? null : customer.assigned_to, // Clear assignment when archiving
                notes: customer.comments || customer.notes || null,
                archived: isArchive
            };
            
            const response = await fetch(API_BASE_URL + '/customers/' + id, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });
            
            if (response.ok) {
                const updated = await response.json();
                // Update local array
                const index = customers.findIndex(c => c.id === id);
                if (index !== -1) {
                    customers[index] = { 
                        ...customers[index], 
                        ...updated, 
                        status: targetStatus,
                        archived: isArchive,
                        assignedTo: isArchive ? null : customers[index].assignedTo
                    };
                }
            }
        });
        
        await Promise.all(movePromises);
        
        // Refresh the page
        renderAssignWorkPage();
        
        // Refresh archive modal if it's open
        const archiveModalEl = document.getElementById('archiveModal');
        if (archiveModalEl && archiveModalEl.classList.contains('show')) {
            renderArchiveModal();
        }
        
        loadDashboard();
        
        showNotification('success', 'Moved', `Moved ${ids.length} customer(s) to "${statusDisplayName}".`);
        
        // Clear selection
        const checkboxes = document.querySelectorAll('#assignWorkTable .customer-checkbox:checked');
        checkboxes.forEach(cb => cb.checked = false);
        
        // Reset radio selection
        if (selectedRadio) {
            selectedRadio.checked = false;
        }
        document.getElementById('moveToStatusText').textContent = 'Move To';
        
    } catch (error) {
        console.error('Error moving customers:', error);
        showNotification('error', 'Error', 'Failed to move customers. Please try again.');
    }
}

// Note: Move To button text remains constant as "Move To"
// Status selection is shown in the dropdown only, not in the button text

// Close Move To dropdown when clicking outside
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('moveToStatusDropdown');
    const btn = document.getElementById('moveToStatusBtn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

async function renderAssignWorkPage() {
    const tbody = document.getElementById('assignWorkTable');
    let pager = document.getElementById('assignPagination');
    
    // CRITICAL: If pagination element doesn't exist, create it immediately
    if (!pager) {
        console.warn('⚠️ Pagination element not found! Creating it now...');
        const assignWorkTab = document.getElementById('assignWorkTab');
        if (assignWorkTab) {
            // Find the table container and add pagination right after it
            const tableContainer = assignWorkTab.querySelector('.data-table');
            if (tableContainer && tableContainer.parentElement) {
                pager = document.createElement('div');
                pager.id = 'assignPagination';
                pager.style.cssText = 'display: block !important; visibility: visible !important; padding: 15px 20px !important; margin-top: 20px !important; border-top: 3px solid #007bff !important; background: #ffffff !important; width: 100% !important; min-height: 60px !important;';
                // Insert after the table container's parent div
                tableContainer.parentElement.parentElement.appendChild(pager);
                console.log('✅ Created pagination element after table');
            } else {
                // Fallback: append to assignWorkTab
                pager = document.createElement('div');
                pager.id = 'assignPagination';
                pager.style.cssText = 'display: block !important; visibility: visible !important; padding: 15px 20px !important; margin-top: 20px !important; border-top: 3px solid #007bff !important; background: #ffffff !important; width: 100% !important; min-height: 60px !important;';
                assignWorkTab.appendChild(pager);
                console.log('✅ Created pagination element (fallback)');
            }
        } else {
            console.error('❌ assignWorkTab not found!');
        }
    }
    
    // Show loading state
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';
    }
    
    // Show a temporary pagination message while loading
    if (pager) {
        pager.innerHTML = '<div style="text-align: center; padding: 10px; color: #666;">Loading pagination...</div>';
        pager.style.cssText = 'display: block !important; visibility: visible !important; padding: 15px 20px !important; margin-top: 20px !important; border-top: 3px solid #007bff !important; background: #ffffff !important; width: 100% !important; min-height: 60px !important;';
    }
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Please log in to view customers</td></tr>';
            return;
        }
        
        // Get pagination parameters
        const size = window.assignPageSize || 100; // Default to 100 per page
        const page = Math.max(1, window.assignCurrentPage || 1);
    window.assignCurrentPage = page;

        // Build query parameters - exclude archived by default
        const params = new URLSearchParams({
            page: page.toString(),
            limit: size.toString()
        });
        
        // Apply status filter if set (send to API for server-side filtering)
        const sel = Array.isArray(window.assignStatusFilter) ? window.assignStatusFilter : null;
        if (sel && sel.length > 0) {
            const filtered = sel.filter(s => s !== 'archived');
            if (filtered.length === 1) {
                // Single status - use API filter
                params.append('status', filtered[0]);
            }
            // For multiple statuses, we'll filter client-side after fetching
        }
        
        // Fetch customers from API with pagination
        const response = await fetch(API_BASE_URL + '/customers?' + params.toString(), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch customers');
        }
        
        const data = await response.json();
        const customersData = data.customers || data;
        const pagination = data.pagination || {};
        
        // CRITICAL: If pagination object is missing or has 0 totalRecords but we have data, 
        // this is a backend bug - log it and try to work around it
        if (!pagination.totalRecords && customersData.length > 0) {
            console.error('❌ CRITICAL: API returned pagination with totalRecords=0 or missing, but we have customer data!');
            console.error('Full API response:', data);
            console.error('This means the backend count query is not working correctly.');
        }
        
        // CRITICAL: Enhanced debug logging to verify total count
        console.log('=== ASSIGN WORK PAGE DEBUG ===');
        console.log('API Response:', {
            customersCount: customersData.length,
            pagination: pagination,
            currentPage: page,
            pageSize: size,
            totalRecords: pagination.totalRecords,
            totalPages: pagination.totalPages,
            expectedTotal: 145713, // Expected total from user
            difference: pagination.totalRecords ? (145713 - pagination.totalRecords) : 'unknown'
        });
        console.log('Full API Response:', data);
        
        // VERIFY: Check if totalRecords matches expected count
        if (pagination.totalRecords && pagination.totalRecords !== 145713) {
            console.warn(`⚠️ WARNING: API returned ${pagination.totalRecords} total records, but expected 145,713. Difference: ${145713 - pagination.totalRecords}`);
            console.warn('This could mean:');
            console.warn('1. Some customers are archived (excluded from count)');
            console.warn('2. Database query is filtering incorrectly');
            console.warn('3. Customers were deleted or not imported correctly');
        } else if (pagination.totalRecords === 145713) {
            console.log('✅ SUCCESS: API returned correct total count of 145,713 customers');
        }
        
        // Transform database records to match frontend expectations
        const slice = customersData.map(customer => {
            let firstName = customer.firstName || '';
            let lastName = customer.lastName || '';
            
            if (!firstName && !lastName && customer.name) {
                const nameParts = customer.name.trim().split(/\s+/);
                firstName = nameParts[0] || '';
                lastName = nameParts.slice(1).join(' ') || '';
            }
            
            // CRITICAL: Separate address from comments
            // The database 'notes' field may contain either address (from bulk upload) or comments (from updates)
            // Strategy:
            // 1. For address: Use customer.address if it exists, otherwise use notes ONLY if it looks like an address (contains comma, city/state pattern)
            // 2. For comments: Use customer.comments if it exists, otherwise use notes ONLY if it doesn't look like an address
            // This prevents comments from appearing in the address column and vice versa
            
            // Check if notes looks like an address (contains comma and typical address patterns)
            const notesIsAddress = customer.notes && (
                customer.notes.includes(',') || 
                /^\d+\s+[A-Za-z]/.test(customer.notes) ||  // Starts with number and street name
                /\b(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct)\b/i.test(customer.notes)
            );
            
            const addressValue = customer.address || (notesIsAddress ? customer.notes : '');
            const commentsValue = customer.comments || (!notesIsAddress && customer.notes ? customer.notes : '');
            
            return {
                ...customer,
                id: customer.id,
                firstName: firstName,
                lastName: lastName,
                name: customer.name || `${firstName} ${lastName}`.trim(),
                phone: customer.phone || '',
                email: customer.email || '',
                address: addressValue,  // Use address field, or notes only if it looks like an address
                status: customer.status || 'pending',
                callStatus: customer.callStatus || 'not_called',
                comments: commentsValue,  // Use comments field, or notes only if it doesn't look like an address
                assignedTo: customer.assignedTo || customer.assigned_to || '',
                archived: customer.archived || false
            };
        });
        
        // Apply status filter if set (client-side filtering for multiple statuses)
        let filteredSlice = slice;
        if (sel && sel.length > 0) {
            const filtered = sel.filter(s => s !== 'archived');
            if (filtered.length > 1) {
                // Multiple statuses - filter client-side
                const filteredSet = new Set(filtered);
                filteredSlice = slice.filter(c => filteredSet.has(c.status || ''));
            }
            // If single status, API already filtered it
        }
        
        // Filter out archived customers (should already be filtered by API, but double-check)
        filteredSlice = filteredSlice.filter(c => !c.archived && c.status !== 'archived');
        
        // Sort customers alphabetically by name
        filteredSlice.sort((a, b) => {
            const nameA = (a.name || `${a.firstName || ''} ${a.lastName || ''}`).trim().toLowerCase();
            const nameB = (b.name || `${b.firstName || ''} ${b.lastName || ''}`).trim().toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        // Use pagination info from API - CRITICAL: Use totalRecords from API, not filteredSlice.length
        // filteredSlice.length is only the current page's data (e.g., 100), not the total
        let total = pagination.totalRecords || 0;
        let pages = pagination.totalPages || Math.max(1, Math.ceil(total / size));
        
        console.log('=== PAGINATION INITIAL VALUES ===');
        console.log({
            total: total,
            pages: pages,
            fromAPI: pagination.totalRecords,
            hasPagination: !!pagination,
            paginationObject: pagination,
            customersDataLength: customersData.length,
            pageSize: size,
            currentPage: page
        });
        
        // CRITICAL FIX: ALWAYS use stats endpoint if total is 0 or missing
        // The stats endpoint is more reliable than the main API's count query
        // This ensures pagination works even if the main API's count query fails
        if ((total === 0 || !pagination.totalRecords || total === null || isNaN(total)) && customersData.length > 0) {
            console.warn('⚠️ API returned invalid totalRecords. Using /customers/stats as reliable fallback...');
            console.warn('Condition check:', {
                totalIsZero: total === 0,
                noTotalRecords: !pagination.totalRecords,
                totalIsNull: total === null,
                totalIsNaN: isNaN(total),
                hasCustomers: customersData.length > 0
            });
            
            // Use the stats endpoint which we know works correctly (it showed 1M+ in your logs)
            try {
                console.log('🔄 Fetching total count from /customers/stats endpoint...');
                console.log('Stats endpoint URL:', API_BASE_URL + '/customers/stats');
                const statsResponse = await fetch(API_BASE_URL + '/customers/stats', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                console.log('Stats response status:', statsResponse.status, statsResponse.statusText);
                
                if (statsResponse.ok) {
                    const statsData = await statsResponse.json();
                    console.log('✅ Stats endpoint response:', statsData);
                    
                    if (statsData.totalCustomers && statsData.totalCustomers > 0) {
                        total = parseInt(statsData.totalCustomers);
                        pages = Math.max(1, Math.ceil(total / size));
                        console.log('✅ SUCCESS: Retrieved correct total from /customers/stats:', total.toLocaleString());
                        console.log('✅ Calculated total pages:', pages.toLocaleString());
                        console.log('✅ Pagination will now work correctly!');
                    } else {
                        console.error('❌ Stats endpoint returned 0 or missing totalCustomers:', statsData);
                    }
                } else {
                    console.error('❌ Stats endpoint failed:', statsResponse.status, statsResponse.statusText);
                    try {
                        const errorText = await statsResponse.text();
                        console.error('Error response:', errorText);
                    } catch (e) {
                        console.error('Could not read error response');
                    }
                }
            } catch (statsError) {
                console.error('❌ Failed to fetch from stats endpoint:', statsError);
                console.error('Error details:', statsError.message, statsError.stack);
            }
        } else if (total > 0) {
            console.log('✅ Using total from API pagination:', total.toLocaleString());
        } else {
            console.warn('⚠️ Total is 0 and no customers data - this might be correct if database is empty');
        }
        
        // VERIFY: Final check - if total is still 0, use last resort estimate
        if (total === 0 && customersData.length > 0) {
            console.error('❌ FINAL CHECK: Total is still 0 after all fallbacks!');
            console.error('This indicates a serious backend issue with the COUNT query.');
            
            // Last resort: if we got exactly the page size, there's definitely more customers
            if (customersData.length === size) {
                // Use a conservative estimate to enable pagination
                total = size * 1000; // Estimate 1000 pages minimum (100k customers)
                pages = 1000;
                console.warn(`⚠️ LAST RESORT: Using estimate: ${total} customers (${pages} pages)`);
                console.warn('⚠️ THIS IS AN ESTIMATE - Backend COUNT query must be fixed!');
                console.warn('⚠️ Pagination will work, but you may need to navigate manually to find the last page.');
            } else {
                // If we got less than page size, that might be all
                total = customersData.length;
                pages = 1;
                console.warn(`⚠️ Only ${customersData.length} customers found (less than page size ${size})`);
            }
        }
        
        console.log('=== PAGINATION CALCULATION ===');
        console.log({
            total: total,
            totalFormatted: total.toLocaleString(),
            pages: pages,
            pagesFormatted: pages.toLocaleString(),
            currentPage: page,
            pageSize: size,
            customersOnThisPage: filteredSlice.length,
            apiPagination: pagination,
            canNavigateNext: page < pages,
            canNavigatePrev: page > 1
        });
        
        // VERIFY: Display summary in console
        if (total > 0) {
            console.log(`✅ Pagination Summary: Showing page ${page} of ${pages.toLocaleString()} (${total.toLocaleString()} total customers)`);
            console.log(`   Customers on this page: ${filteredSlice.length}`);
            console.log(`   Range: ${((page - 1) * size + 1).toLocaleString()} - ${Math.min(page * size, total).toLocaleString()}`);
        } else {
            console.error('❌ ERROR: Total count is 0 - pagination will not work!');
        }
        
        // For display, use the slice directly (already paginated by API)
        const displaySlice = filteredSlice;

    // Show/hide refund status column based on admin role
    const isAdmin = currentUser && currentUser.role === 'admin';
    const refundStatusHeader = document.getElementById('refundStatusHeader');
    if (refundStatusHeader) {
        refundStatusHeader.style.display = isAdmin ? '' : 'none';
    }

    let html = '';
        for (let i = 0; i < displaySlice.length; i++) {
            const customer = displaySlice[i];
        const statusForDisplay = customer.status || '';
        const assignedTo = customer.assignedTo || customer.assigned_to || '';
        const assignedToDisplay = assignedTo ? `<span class="badge bg-info"><i class="fas fa-user"></i> ${assignedTo}</span>` : '<span class="text-muted">-</span>';
        
        // Get refund status for admin
        let refundStatusDisplay = '';
        if (isAdmin) {
            const refundStatusKey = `customerRefundStatus_${customer.email || customer.id}`;
                let refundStatus = sessionStorage.getItem(refundStatusKey);
            if (!refundStatus) {
                    refundStatus = sessionStorage.getItem('customerRefundStatus');
            }
            if (refundStatus) {
                refundStatusDisplay = `<td class="refund-status-column" style="display: table-cell;"><span class="badge bg-info">${getRefundStatusDisplayName(refundStatus)}</span></td>`;
            } else {
                refundStatusDisplay = '<td class="refund-status-column" style="display: table-cell;"><span class="text-muted">-</span></td>';
            }
        }
        
        html += `
        <tr ondblclick="openUpdateStatusModal(${customer.id})" style="cursor: pointer;" title="Double-click to view details">
            <td><input type="checkbox" class="customer-checkbox" data-id="${customer.id}" onclick="event.stopPropagation();"></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); openUpdateStatusModal(${customer.id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
            <td><strong>${customer.firstName} ${customer.lastName}</strong></td>
            <td><a href="tel:${customer.phone || ''}" class="text-decoration-none phone-link" title="Double-click to copy" onclick="event.stopPropagation();">${customer.phone || ''}</a></td>
            <td><a href="mailto:${customer.email || ''}" class="text-decoration-none" onclick="event.stopPropagation();">${customer.email || ''}</a></td>
            <td><small class="text-muted">${customer.address || ''}</small></td>
            <td>${assignedToDisplay}</td>
            ${refundStatusDisplay}
            <td><small>${customer.comments || '-'}</small></td>
            <td><span class="badge bg-${getStatusBadgeColor(statusForDisplay)}">${getStatusDisplayName(statusForDisplay)}</span></td>
        </tr>`;
    }
        if (tbody) tbody.innerHTML = html;
        
        // Add event listeners to checkboxes to update delete selected option state
        const checkboxes = document.querySelectorAll('#assignWorkTable .customer-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateDeleteSelectedOption);
        });
        
        // Update delete selected option state on initial render
        updateDeleteSelectedOption();
    
        // Initialize column reordering for assigned work table (if function exists)
        if (typeof initColumnReordering === 'function') {
    initColumnReordering('assignedWorkTable');
        } else {
            console.warn('⚠️ initColumnReordering function not found - skipping column reordering');
        }

        // CRITICAL: Get or create pagination element - MUST ALWAYS EXIST
        pager = document.getElementById('assignPagination');
        
        // If pagination element doesn't exist, CREATE IT NOW
        if (!pager) {
            console.error('❌ Pagination element not found! Creating it...');
            const assignWorkTab = document.getElementById('assignWorkTab');
            if (assignWorkTab) {
                pager = document.createElement('div');
                pager.id = 'assignPagination';
                // CRITICAL: Always append to the END of assignWorkTab (after table)
                // This ensures it's at the bottom, outside the table
                assignWorkTab.appendChild(pager);
                console.log('✅ Created pagination element at bottom of Assign Work tab');
            } else {
                console.error('❌ assignWorkTab not found! Cannot create pagination.');
                return; // Exit if we can't create pagination
            }
        }
        
        // CRITICAL: Ensure pagination is at the bottom of assignWorkTab
        // Move it if it's not in the right position
        const assignWorkTab = document.getElementById('assignWorkTab');
        if (assignWorkTab && pager && pager.parentNode !== assignWorkTab) {
            console.log('⚠️ Pagination not in correct parent. Moving to assignWorkTab...');
            assignWorkTab.appendChild(pager);
        } else if (assignWorkTab && pager && pager.nextSibling) {
            // If there are siblings after pagination, move it to the end
            assignWorkTab.appendChild(pager);
            console.log('✅ Moved pagination to bottom of assignWorkTab');
        }
        
        // ALWAYS render pagination - this code MUST execute
        const pagesText = Math.max(1, pages);
        const displayStart = total === 0 ? 0 : (page - 1) * size + 1;
        const displayEnd = total === 0 ? 0 : Math.min(page * size, total);
        
        // Show warning if total is 0 but we have data
        let totalDisplay = total.toLocaleString();
        if (total === 0 && displaySlice.length > 0) {
            totalDisplay = `${displaySlice.length}+ (exact count unavailable)`;
        }
        
        // CRITICAL: Build pagination HTML - MUST include dropdown
        // Pagination is placed OUTSIDE the table, at the bottom of the Assign Work page
        const paginationHTML = `
            <div style="display: flex; justify-content: center; align-items: center; gap: 20px; flex-wrap: wrap; padding: 20px; background: #ffffff; border-top: 3px solid #007bff; margin-top: 30px; width: 100%; box-shadow: 0 -2px 10px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button class="btn btn-sm btn-primary" ${page===1?'disabled':''} onclick="window.assignCurrentPage=1; renderAssignWorkPage()">First</button>
                    <button class="btn btn-sm btn-primary" ${page===1?'disabled':''} onclick="window.assignCurrentPage=${page-1}; renderAssignWorkPage()">Prev</button>
                    <span style="font-size: 14px; font-weight: bold; color: #333;">Page ${page} of ${pagesText.toLocaleString()}</span>
                    <button class="btn btn-sm btn-primary" ${page>=pagesText?'disabled':''} onclick="window.assignCurrentPage=${page+1}; renderAssignWorkPage()">Next</button>
                    <button class="btn btn-sm btn-primary" ${page>=pagesText?'disabled':''} onclick="window.assignCurrentPage=${pagesText}; renderAssignWorkPage()">Last</button>
            </div>
                <div style="display: flex; align-items: center; gap: 10px; padding: 8px 15px; background: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6;">
                    <label style="margin: 0; font-size: 14px; font-weight: 600; color: #495057;">Items per page:</label>
                    <select class="form-select form-select-sm" style="width: 100px; padding: 6px 10px; border: 2px solid #007bff; border-radius: 4px; font-weight: 500; cursor: pointer;" onchange="window.assignPageSize=parseInt(this.value); window.assignCurrentPage=1; renderAssignWorkPage()">
                    <option ${size===100?'selected':''} value="100">100</option>
                    <option ${size===200?'selected':''} value="200">200</option>
                    <option ${size===300?'selected':''} value="300">300</option>
                        <option ${size===400?'selected':''} value="400">400</option>
                    <option ${size===500?'selected':''} value="500">500</option>
                </select>
                </div>
                <div style="font-size: 13px; color: #666; font-weight: 500; padding: 8px 15px; background: #e9ecef; border-radius: 6px;">
                    Showing <strong style="color: #007bff;">${displayStart.toLocaleString()}-${displayEnd.toLocaleString()}</strong> of <strong style="color: #007bff; font-size: 15px;">${totalDisplay}</strong> customers
                </div>
            </div>
        `;
        
        // Update the existing pagination elements (they're already in HTML)
        // Update page numbers
        const currentPageDisplay = document.getElementById('assignCurrentPageDisplay');
        const totalPagesDisplay = document.getElementById('assignTotalPagesDisplay');
        const displayRange = document.getElementById('assignDisplayRange');
        const totalDisplayEl = document.getElementById('assignTotalDisplay');
        const pageSizeSelect = document.getElementById('assignPageSizeSelect');
        
        if (currentPageDisplay) currentPageDisplay.textContent = page;
        if (totalPagesDisplay) totalPagesDisplay.textContent = pagesText.toLocaleString();
        if (displayRange) displayRange.textContent = `${displayStart.toLocaleString()}-${displayEnd.toLocaleString()}`;
        if (totalDisplayEl) totalDisplayEl.textContent = totalDisplay.toLocaleString();
        if (pageSizeSelect) {
            pageSizeSelect.value = size.toString();
            // Update button states
            const buttons = pager.querySelectorAll('button');
            buttons[0].disabled = page === 1; // First
            buttons[1].disabled = page === 1; // Prev
            buttons[2].disabled = page >= pagesText; // Next
            buttons[3].disabled = page >= pagesText; // Last
        }
        
        // FORCE set innerHTML as fallback (in case HTML structure changed)
        // But prefer updating individual elements for better performance
        if (!currentPageDisplay || !totalPagesDisplay) {
            pager.innerHTML = paginationHTML;
        }
        
        // Force visibility with !important styles
        pager.style.cssText = 'display: flex !important; visibility: visible !important; width: 100% !important; opacity: 1 !important; margin-top: 30px !important; margin-bottom: 20px !important; clear: both !important; position: relative !important; z-index: 10 !important;';
        
        // VERIFY it was set
        console.log('✅ PAGINATION RENDERED:', {
            elementExists: !!pager,
            innerHTMLLength: pager.innerHTML.length,
            hasSelect: pager.innerHTML.includes('<select'),
            hasDropdown: pager.innerHTML.includes('value="100"'),
            total: total,
            pages: pagesText,
            currentPage: page
        });
        
        // Double-check: if HTML wasn't set, try again
        if (!pager.innerHTML || pager.innerHTML.length < 100 || !pager.innerHTML.includes('<select')) {
            console.error('❌ Pagination HTML not set correctly! Retrying...');
            pager.innerHTML = paginationHTML;
    }

    // Initialize column resizing once per render
    initAssignWorkColumnResize();
    updateAssignArchiveButtonsVisibility();
    } catch (error) {
        console.error('Error loading assign work table:', error);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Error loading customers. Please refresh the page.</td></tr>';
        }
        
        // CRITICAL: Show pagination even on error - MUST ALWAYS SHOW
        let errorPager = document.getElementById('assignPagination');
        if (!errorPager) {
            // Create it if it doesn't exist
            const assignWorkTab = document.getElementById('assignWorkTab');
            if (assignWorkTab) {
                errorPager = document.createElement('div');
                errorPager.id = 'assignPagination';
                const dataTable = assignWorkTab.querySelector('.data-table');
                if (dataTable && dataTable.parentNode) {
                    assignWorkTab.insertBefore(errorPager, dataTable.nextSibling);
                } else {
                    assignWorkTab.appendChild(errorPager);
                }
            }
        }
        
        if (errorPager) {
            const defaultSize = window.assignPageSize || 200;
            const defaultPage = window.assignCurrentPage || 1;
            errorPager.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; gap: 20px; flex-wrap: wrap; padding: 15px 20px; background: #f8f9fa; border-top: 2px solid #007bff; margin-top: 20px; width: 100%;">
                    <button class="btn btn-sm btn-primary" disabled>First</button>
                    <button class="btn btn-sm btn-primary" disabled>Prev</button>
                    <span style="font-size: 14px; font-weight: bold;">Page ${defaultPage} of 1</span>
                    <label style="margin: 0; font-size: 14px; font-weight: 500;">Show: 
                        <select class="form-select form-select-sm d-inline-block" style="width: 90px; margin-left: 8px; padding: 4px 8px; border: 2px solid #007bff; border-radius: 4px;" onchange="window.assignPageSize=parseInt(this.value); window.assignCurrentPage=1; renderAssignWorkPage()">
                            <option ${defaultSize===100?'selected':''} value="100">100</option>
                            <option ${defaultSize===200?'selected':''} value="200">200</option>
                            <option ${defaultSize===300?'selected':''} value="300">300</option>
                            <option ${defaultSize===400?'selected':''} value="400">400</option>
                            <option ${defaultSize===500?'selected':''} value="500">500</option>
                        </select>
                    </label>
                    <button class="btn btn-sm btn-primary" disabled>Next</button>
                    <button class="btn btn-sm btn-primary" disabled>Last</button>
                    <span style="font-size: 13px; color: #333; font-weight: 500;">Error loading customers</span>
                </div>
            `;
            errorPager.style.display = 'block';
            errorPager.style.visibility = 'visible';
            errorPager.style.width = '100%';
            errorPager.style.opacity = '1';
            console.log('✅ Error pagination rendered with dropdown');
        }
        
        showNotification('error', 'Load Failed', 'Failed to load customers. Please try again.');
    }
}

// Add draggable column resizers to Assign Work table
function initAssignWorkColumnResize() {
    const tbody = document.getElementById('assignWorkTable');
    if (!tbody) return;
    const table = tbody.closest('table');
    if (!table || table.getAttribute('data-resize-init') === '1') return;
    const headerCells = table.querySelectorAll('thead th');
    
    // Initialize all columns with fixed widths - prefer width attribute, fallback to rendered width
    let initialTableWidth = 0;
    headerCells.forEach((th, idx) => {
        // Try to get width from width attribute first, then fallback to rendered width
        let columnWidth = parseInt(th.getAttribute('width')) || th.getBoundingClientRect().width;
        // Ensure minimum width of 60px
        columnWidth = Math.max(60, columnWidth);
        
        initialTableWidth += columnWidth;
        
        // Apply width to header cell
        th.style.width = columnWidth + 'px';
        th.style.minWidth = columnWidth + 'px';
        th.style.maxWidth = columnWidth + 'px';
        th.style.flexShrink = '0';
        th.style.flexGrow = '0';
        
        // Apply same width to all body cells in this column
        const cells = table.querySelectorAll(`tbody td:nth-child(${idx + 1})`);
        cells.forEach(td => {
            td.style.width = columnWidth + 'px';
            td.style.minWidth = columnWidth + 'px';
            td.style.maxWidth = columnWidth + 'px';
            td.style.flexShrink = '0';
            td.style.flexGrow = '0';
        });
    });
    // Set initial table width
    table.style.width = initialTableWidth + 'px';
    
    headerCells.forEach((th, idx) => {
        // Skip if a resizer already exists
        if (th.querySelector('.col-resizer')) return;
        const resizer = document.createElement('div');
        resizer.className = 'col-resizer';
        th.appendChild(resizer);

        let startX = 0;
        let startWidth = 0;
        let otherColumnWidths = [];
        
        const onMouseMove = (e) => {
            const dx = e.clientX - startX;
            const newWidth = Math.max(60, startWidth + dx);
            
            // Calculate total table width: sum of all column widths
            let totalWidth = newWidth; // Start with the resized column
            
            // Add all other locked column widths
            headerCells.forEach((otherTh, otherIdx) => {
                if (otherIdx !== idx) {
                    if (otherColumnWidths[otherIdx] !== undefined) {
                        totalWidth += otherColumnWidths[otherIdx];
                    } else {
                        totalWidth += otherTh.getBoundingClientRect().width;
                    }
                }
            });
            
            // Set explicit table width to prevent browser from redistributing
            table.style.width = totalWidth + 'px';
            
            // Only update the column being resized
            th.style.width = newWidth + 'px';
            th.style.minWidth = newWidth + 'px';
            th.style.maxWidth = newWidth + 'px';
            
            const cells = table.querySelectorAll(`tbody td:nth-child(${idx + 1})`);
            cells.forEach(td => {
                td.style.width = newWidth + 'px';
                td.style.minWidth = newWidth + 'px';
                td.style.maxWidth = newWidth + 'px';
            });
            
            // Force other columns to maintain their locked widths (critical for Excel-like behavior)
            headerCells.forEach((otherTh, otherIdx) => {
                if (otherIdx !== idx && otherColumnWidths[otherIdx] !== undefined) {
                    // Reapply locked width forcefully on every mouse move
                    const lockedWidth = otherColumnWidths[otherIdx];
                    otherTh.style.width = lockedWidth + 'px';
                    otherTh.style.minWidth = lockedWidth + 'px';
                    otherTh.style.maxWidth = lockedWidth + 'px';
                    otherTh.style.flexShrink = '0';
                    otherTh.style.flexGrow = '0';
                    
                    const otherCells = table.querySelectorAll(`tbody td:nth-child(${otherIdx + 1})`);
                    otherCells.forEach(td => {
                        td.style.width = lockedWidth + 'px';
                        td.style.minWidth = lockedWidth + 'px';
                        td.style.maxWidth = lockedWidth + 'px';
                        td.style.flexShrink = '0';
                        td.style.flexGrow = '0';
                    });
                }
            });
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startX = e.clientX;
            startWidth = th.getBoundingClientRect().width;
            
            // Capture and lock all other columns' widths BEFORE starting resize
            otherColumnWidths = [];
            headerCells.forEach((otherTh, otherIdx) => {
                if (otherIdx !== idx) {
                    const lockedWidth = otherTh.getBoundingClientRect().width;
                    otherColumnWidths[otherIdx] = lockedWidth;
                    
                    // Lock this column's width with all three properties
                    otherTh.style.width = lockedWidth + 'px';
                    otherTh.style.minWidth = lockedWidth + 'px';
                    otherTh.style.maxWidth = lockedWidth + 'px';
                    
                    const otherCells = table.querySelectorAll(`tbody td:nth-child(${otherIdx + 1})`);
                    otherCells.forEach(td => {
                        td.style.width = lockedWidth + 'px';
                        td.style.minWidth = lockedWidth + 'px';
                        td.style.maxWidth = lockedWidth + 'px';
                    });
                }
            });
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });
    table.setAttribute('data-resize-init', '1');
}

function loadEmployeeDropdown() {
    const employeeList = document.getElementById('employeeDropdownList');
    if (!employeeList) {
        console.warn('employeeDropdownList element not found');
        return;
    }
    
    // Include both 'employee' and 'preparation' role users
    const assignableUsers = users.filter(u => 
        (u.role === 'employee' || u.role === 'preparation') && !u.locked
    );
    
    if (assignableUsers.length === 0) {
        employeeList.innerHTML = '<li><span class="dropdown-item text-muted">No employees available</span></li>';
        return;
    }
    
    employeeList.innerHTML = assignableUsers.map(user => {
        const roleBadge = user.role === 'preparation' ? '<span class="badge bg-secondary ms-1">Prep</span>' : '';
        return `
        <li><a class="dropdown-item" href="#" onclick="assignToEmployee('${user.username}')">
            <i class="fas fa-user"></i> ${user.username}${roleBadge}
        </a></li>
    `;
    }).join('');
}

// Delete-by-status workflow
function openDeleteByStatusModal() {
    const statuses = getSelectedDeleteStatuses();
    if (!statuses.length) {
        showNotification('warning', 'Select Status', 'Please choose at least one status.');
        return;
    }
    const source = Array.isArray(window.assignFiltered) ? window.assignFiltered : customers;
    const set = new Set(statuses);
    const count = source.filter(c => set.has(c.status || '')).length;
    if (count === 0) {
        showNotification('info', 'Nothing To Delete', 'No customers found with the selected statuses.');
        return;
    }
    document.getElementById('confirmDeleteText').textContent = `You are about to delete ${count} customer(s) with selected statuses. This action cannot be undone.`;
    document.getElementById('confirmDeletePassword').value = '';
    document.getElementById('confirmDeleteModal').setAttribute('data-statuses', JSON.stringify(statuses));
    const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
    modal.show();
}

async function confirmDeleteByStatus() {
    const modalEl = document.getElementById('confirmDeleteModal');
    const statuses = JSON.parse(modalEl.getAttribute('data-statuses') || '[]');
    const password = document.getElementById('confirmDeletePassword').value;
    if (!currentUser || password !== currentUser.password) {
        showNotification('error', 'Incorrect Password', 'The password you entered is incorrect.');
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Error', 'You must be logged in to delete customers');
            return;
        }
        
        // Find all customers with the selected statuses
    const set = new Set(statuses);
        const customersToDelete = customers.filter(c => set.has(c.status || ''));
        const customerIds = customersToDelete.map(c => c.id);
        
        if (customerIds.length === 0) {
            showNotification('info', 'Nothing To Delete', 'No customers found with the selected statuses.');
            return;
        }
        
        // Use bulk delete API
        const response = await fetch(API_BASE_URL + '/customers/bulk-delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ customerIds })
        });
        
        if (response.ok) {
            const result = await response.json();
            // Remove from local array
    customers = customers.filter(c => !set.has(c.status || ''));
            
    // Refresh UI
    window.assignFiltered = null; // reset any filtered view; status may not exist now
    renderAssignWorkPage();
    loadDashboard();
            
    // Close modal
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
            
            showNotification('success', 'Deleted', `Removed ${result.deletedCount || customerIds.length} customer(s).`);
        } else {
            const error = await response.json();
            showNotification('error', 'Error', error.error || 'Failed to delete customers');
        }
    } catch (error) {
        console.error('Error deleting customers:', error);
        showNotification('error', 'Error', 'Failed to delete customers. Please try again.');
    }
}

// Delete All functionality for Assign Work tab
async function openDeleteAllModal() {
    // Get all customers currently shown in Assign Work tab
    const assignWorkCustomers = getAssignSourceArray();
    
    if (assignWorkCustomers.length === 0) {
        showNotification('warning', 'No Customers', 'There are no customers in the Assign Work tab to delete.');
        return;
    }
    
    // Update modal text
    document.getElementById('confirmDeleteText').textContent = 
        `You are about to delete ALL ${assignWorkCustomers.length} customer(s) currently listed in the Assign Work tab. This will also remove them from all employees' assigned lists. This action cannot be undone.`;
    document.getElementById('confirmDeletePassword').value = '';
    
    // Update password label
    const passwordLabel = document.querySelector('#confirmDeleteModal .form-label');
    if (passwordLabel) {
        passwordLabel.textContent = 'Enter admin password to confirm';
    }
    
    // Set modal type to 'delete-all'
    document.getElementById('confirmDeleteModal').setAttribute('data-delete-type', 'delete-all');
    
    // Change button text
    const deleteBtn = document.querySelector('#confirmDeleteModal .btn-danger');
    if (deleteBtn) {
        deleteBtn.textContent = 'Delete All';
        deleteBtn.setAttribute('onclick', 'confirmDeleteAll()');
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
    modal.show();
}

async function confirmDeleteAll() {
    const modalEl = document.getElementById('confirmDeleteModal');
    const password = document.getElementById('confirmDeletePassword').value;
    
    if (!password) {
        showNotification('error', 'Password Required', 'Please enter your admin password to confirm deletion.');
        return;
    }
    
    // Check if current user is admin
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('error', 'Access Denied', 'Only administrators can delete all customers.');
        return;
    }
    
    // Verify admin password with server by attempting login
    try {
        // Get authentication token
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Authentication Error', 'You must be logged in.');
            return;
        }
        
        // Verify password by attempting to login as admin
        const loginResponse = await fetch(API_BASE_URL + '/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: currentUser.username, password })
        });
        
        if (!loginResponse.ok) {
            showNotification('error', 'Incorrect Password', 'The admin password you entered is incorrect.');
            return;
        }
        
        // Get all customers from Assign Work tab
        const assignWorkCustomers = getAssignSourceArray();
        const customerIds = assignWorkCustomers.map(c => c.id).filter(id => id);
        
        if (customerIds.length === 0) {
            showNotification('warning', 'No Customers', 'No customers found to delete.');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            return;
        }
        
        // Delete all customers from server using bulk delete
        const deleteResponse = await fetch(API_BASE_URL + '/customers/bulk-delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ customerIds })
        });
        
        if (!deleteResponse.ok) {
            let errorMessage = 'Failed to delete customers.';
            try {
                const error = await deleteResponse.json();
                errorMessage = error.error || errorMessage;
                if (error.details) {
                    errorMessage += ` (${error.details})`;
                }
            } catch (e) {
                errorMessage = `Server error: ${deleteResponse.status} ${deleteResponse.statusText}`;
            }
            showNotification('error', 'Delete Failed', errorMessage);
            return;
        }
        
        const result = await deleteResponse.json();
        const deletedCount = result.deletedCount || 0;
        
        // Reload customers from server
        await loadCustomers();
        
        // Refresh UI
        window.assignFiltered = null;
        renderAssignWorkPage();
        loadDashboard();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        
        // Reset button and label
        const deleteBtn = document.querySelector('#confirmDeleteModal .btn-danger');
        if (deleteBtn) {
            deleteBtn.textContent = 'Delete';
            deleteBtn.setAttribute('onclick', 'confirmDeleteByStatus()');
        }
        const passwordLabel = document.querySelector('#confirmDeleteModal .form-label');
        if (passwordLabel) {
            passwordLabel.textContent = 'Enter your password to confirm';
        }
        modalEl.removeAttribute('data-delete-type');
        
        // Show success message
        showNotification('success', 'Deleted', `Successfully deleted ${deletedCount} customer(s). All customers have been removed from employees' assigned lists.`);
    } catch (error) {
        console.error('Delete all error:', error);
        const errorMessage = error.message || 'An error occurred while deleting customers.';
        showNotification('error', 'Delete Failed', errorMessage);
    }
}

// Excel-like delete filter helpers
function toggleDeleteStatusFilter(force) {
    const dropdown = document.getElementById('deleteStatusFilterDropdown');
    const btn = document.getElementById('deleteStatusFilterBtn');
    const show = typeof force === 'boolean' ? force : !dropdown.classList.contains('show');
    if (show) {
        dropdown.classList.add('show');
        btn.classList.add('active');
        const selectAll = document.getElementById('selectAllDeleteStatuses');
        const boxes = Array.from(document.querySelectorAll('.delete-status-checkbox'));
        selectAll.onchange = () => boxes.forEach(b => b.checked = selectAll.checked);
    } else {
        dropdown.classList.remove('show');
        btn.classList.remove('active');
    }
}

function getSelectedDeleteStatuses() {
    const boxes = Array.from(document.querySelectorAll('.delete-status-checkbox'));
    return boxes.filter(b => b.checked).map(b => b.value);
}

function applyDeleteStatusFilter() {
    toggleDeleteStatusFilter(false);
    const statuses = getSelectedDeleteStatuses();
    const text = statuses.length === 0 ? 'Select status to delete' : `${statuses.length} statuses selected`;
    document.getElementById('deleteFilterText').textContent = text;
    openDeleteByStatusModal();
}

// Close delete dropdown when clicking outside or pressing Esc
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('deleteStatusFilterDropdown');
    const btn = document.getElementById('deleteStatusFilterBtn');
    if (!dropdown || !dropdown.classList.contains('show')) return;
    if (btn && (btn === e.target || btn.contains(e.target))) return;
    if (!dropdown.contains(e.target)) {
        toggleDeleteStatusFilter(false);
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const dropdown = document.getElementById('deleteStatusFilterDropdown');
        if (dropdown && dropdown.classList.contains('show')) toggleDeleteStatusFilter(false);
    }
});

// Assign Status column filter handlers
function toggleAssignStatusFilter(force) {
    const dd = document.getElementById('assignStatusFilterDropdown');
    const btn = document.getElementById('assignStatusFilterBtn');
    const show = typeof force === 'boolean' ? force : !dd.classList.contains('show');
    if (show) {
        dd.classList.add('show');
        btn.classList.add('active');
        const selectAll = document.getElementById('assignStatusSelectAll');
        const boxes = Array.from(document.querySelectorAll('.assign-status-checkbox'));
        selectAll.onchange = () => boxes.forEach(b => b.checked = selectAll.checked);
    } else {
        dd.classList.remove('show');
        btn.classList.remove('active');
    }
}

function applyAssignStatusFilter() {
    const boxes = Array.from(document.querySelectorAll('.assign-status-checkbox'));
    const selected = boxes.filter(b => b.checked).map(b => b.value);
    window.assignStatusFilter = selected.length === boxes.length ? [] : selected;
    document.getElementById('assignStatusFilterText').textContent = (window.assignStatusFilter && window.assignStatusFilter.length) ? `${window.assignStatusFilter.length} selected` : 'Status';
    toggleAssignStatusFilter(false);
    window.assignCurrentPage = 1;
    renderAssignWorkPage();
    updateAssignArchiveButtonsVisibility();
}

function resetAssignStatusFilter() {
    const selectAll = document.getElementById('assignStatusSelectAll');
    const boxes = Array.from(document.querySelectorAll('.assign-status-checkbox'));
    boxes.forEach(b => b.checked = false);
    if (selectAll) selectAll.checked = false;
    window.assignStatusFilter = [];
    document.getElementById('assignStatusFilterText').textContent = 'Status';
    updateAssignArchiveButtonsVisibility();
}

document.addEventListener('click', function(e) {
    const dd = document.getElementById('assignStatusFilterDropdown');
    const btn = document.getElementById('assignStatusFilterBtn');
    if (!dd || !dd.classList.contains('show')) return;
    if (btn && (btn === e.target || btn.contains(e.target))) return;
    if (!dd.contains(e.target)) toggleAssignStatusFilter(false);
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const dd = document.getElementById('assignStatusFilterDropdown');
        if (dd && dd.classList.contains('show')) toggleAssignStatusFilter(false);
    }
});

function openUpdateStatusModal(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    const isAdmin = currentUser && currentUser.role === 'admin';
    const isPreparation = currentUser && currentUser.role === 'preparation';
    
    document.getElementById('updateCustomerId').value = customerId;
    document.getElementById('updateCustomerName').value = customer.name || `${customer.firstName} ${customer.lastName}`;
    document.getElementById('updateCustomerStatus').value = customer.status || '';
    document.getElementById('updateComments').value = customer.comments || '';
    
    // Load refund status from sessionStorage (clears when browser closes)
    const refundStatusKey = `customerRefundStatus_${customer.email || customerId}`;
    const savedRefundStatus = sessionStorage.getItem(refundStatusKey);
    const refundStatusField = document.getElementById('updateCustomerRefundStatus');
    if (refundStatusField) {
        refundStatusField.value = savedRefundStatus || '';
    }
    
    // Show/hide refund status field based on role
    const refundStatusFieldContainer = document.getElementById('refundStatusField');
    if (refundStatusFieldContainer) {
        if (isPreparation) {
            refundStatusFieldContainer.style.display = 'block';
        } else {
            refundStatusFieldContainer.style.display = 'none';
        }
    }
    
    // Populate new fields
    document.getElementById('updateCustomerPhone').value = customer.phone || '';
    document.getElementById('updateCustomerEmail').value = customer.email || '';
    
    // Parse address into separate fields
    const addressParts = parseAddress(customer.address || '');
    document.getElementById('updateCustomerAddress1').value = addressParts.address1 || '';
    document.getElementById('updateCustomerCity').value = addressParts.city || '';
    
    // Set state - use customer.state if available, otherwise use parsed state
    const stateValue = customer.state || addressParts.state || '';
    // Convert full state name to code if needed
    const stateCode = getStateCode(stateValue);
    document.getElementById('updateCustomerState').value = stateCode || '';
    document.getElementById('updateCustomerZipCode').value = addressParts.zipCode || '';
    
    // Set field permissions
    const phoneField = document.getElementById('updateCustomerPhone');
    const emailField = document.getElementById('updateCustomerEmail');
    const address1Field = document.getElementById('updateCustomerAddress1');
    const cityField = document.getElementById('updateCustomerCity');
    const stateField = document.getElementById('updateCustomerState');
    const zipCodeField = document.getElementById('updateCustomerZipCode');
    const statusField = document.getElementById('updateCustomerStatus');
    const editPhoneIcon = document.getElementById('editPhoneIcon');
    const editEmailIcon = document.getElementById('editEmailIcon');
    const editAddress1Icon = document.getElementById('editAddress1Icon');
    const editCityIcon = document.getElementById('editCityIcon');
    const editStateIcon = document.getElementById('editStateIcon');
    const editZipCodeIcon = document.getElementById('editZipCodeIcon');
    
    // Users can only edit status, admins can edit everything
    if (isAdmin) {
        // Admin: Show edit icons on hover for phone, email, and address fields
        editPhoneIcon.classList.add('show');
        editEmailIcon.classList.add('show');
        editAddress1Icon.classList.add('show');
        editCityIcon.classList.add('show');
        editStateIcon.classList.add('show');
        editZipCodeIcon.classList.add('show');
        statusField.disabled = false;
        phoneField.readOnly = true; // Start in view mode
        emailField.readOnly = true;
        address1Field.readOnly = true;
        cityField.readOnly = true;
        stateField.readOnly = true;
        zipCodeField.readOnly = true;
    } else {
        // User: Hide edit icons, make fields readonly, but status is editable
        editPhoneIcon.classList.remove('show');
        editEmailIcon.classList.remove('show');
        editAddress1Icon.classList.remove('show');
        editCityIcon.classList.remove('show');
        editStateIcon.classList.remove('show');
        editZipCodeIcon.classList.remove('show');
        phoneField.readOnly = true;
        emailField.readOnly = true;
        address1Field.readOnly = true;
        cityField.readOnly = true;
        stateField.disabled = true; // Select element uses disabled, not readOnly
        zipCodeField.readOnly = true;
        statusField.disabled = false; // Users can edit status
    }
    
    // Reset field states
    phoneField.classList.remove('field-edit-mode');
    phoneField.classList.add('field-view-mode');
    emailField.classList.remove('field-edit-mode');
    emailField.classList.add('field-view-mode');
    address1Field.classList.remove('field-edit-mode');
    address1Field.classList.add('field-view-mode');
    cityField.classList.remove('field-edit-mode');
    cityField.classList.add('field-view-mode');
    stateField.classList.remove('field-edit-mode');
    stateField.classList.add('field-view-mode');
    zipCodeField.classList.remove('field-edit-mode');
    zipCodeField.classList.add('field-view-mode');
    
    // Load follow-up date and time if they exist
    if (customer.followUpDate) {
        const dateValue = customer.followUpDate;
        document.getElementById('followUpDate').value = dateValue;
        // Format display if date is in ISO format
        if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const dateObj = new Date(dateValue);
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            const displayDate = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
            document.getElementById('followUpDate').setAttribute('data-display', displayDate);
        }
    } else {
        document.getElementById('followUpDate').value = '';
    }
    // Load follow-up time in new format (hour, minute, AM/PM)
    if (customer.followUpTime) {
        // If stored in HH:MM:SS format (24-hour), convert to 12-hour
        if (customer.followUpTime.match(/^\d{2}:\d{2}/)) {
            const timeParts = customer.followUpTime.split(':');
            let hour24 = parseInt(timeParts[0]);
            const minute = parseInt(timeParts[1]);
            
            let hour12 = hour24;
            let ampm = 'AM';
            
            if (hour24 === 0) {
                hour12 = 12;
                ampm = 'AM';
            } else if (hour24 === 12) {
                hour12 = 12;
                ampm = 'PM';
            } else if (hour24 > 12) {
                hour12 = hour24 - 12;
                ampm = 'PM';
            }
            
            document.getElementById('followUpTimeHour').value = hour12;
            document.getElementById('followUpTimeMinute').value = minute;
            document.getElementById('followUpTimeAMPM').value = ampm;
        } else {
            // If stored in custom format (HH:MM AM/PM), parse it
            const timeMatch = customer.followUpTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (timeMatch) {
                document.getElementById('followUpTimeHour').value = parseInt(timeMatch[1]);
                document.getElementById('followUpTimeMinute').value = parseInt(timeMatch[2]);
                document.getElementById('followUpTimeAMPM').value = timeMatch[3].toUpperCase();
            }
        }
    } else {
        document.getElementById('followUpTimeHour').value = '';
        document.getElementById('followUpTimeMinute').value = '';
        document.getElementById('followUpTimeAMPM').value = 'AM';
    }
    
    // Load interested value if it exists
    if (customer.interested !== undefined && customer.interested !== null && customer.interested !== '') {
        document.getElementById('updateInterested').value = customer.interested;
    } else {
        document.getElementById('updateInterested').value = '';
    }
    
    // Show/hide follow-up fields based on status
    toggleFollowUpFields();
    // Show/hide interested field based on status
    toggleInterestedField();
    
    // Load customer documents
    loadCustomerDocuments(customerId);
    
    const modal = new bootstrap.Modal(document.getElementById('updateStatusModal'));
    modal.show();
}

// ============================================
// TAX INFORMATION FUNCTIONS
// ============================================

// Show/hide spouse section based on filing status
function toggleSpouseSection() {
    const filingStatus = document.getElementById('taxFilingStatus');
    if (!filingStatus) return;
    
    const filingStatusValue = filingStatus.value;
    const spouseSection = document.getElementById('spouseInfoSection');
    
    if (spouseSection) {
        if (filingStatusValue === 'married_jointly' || filingStatusValue === 'married_separately') {
            spouseSection.style.display = 'block';
        } else {
            spouseSection.style.display = 'none';
        }
    }
}

// Add W-2 Form
function addW2Form() {
    const container = document.getElementById('w2FormsContainer');
    if (!container) return;
    
    const newForm = document.createElement('div');
    newForm.className = 'w2-form-entry mb-3 p-3 border rounded';
    newForm.style.background = 'var(--card-bg)';
    newForm.style.borderColor = 'var(--border-color)';
    newForm.innerHTML = `
        <div class="row">
            <div class="col-md-3 mb-2">
                <input type="text" class="form-control form-control-sm w2-employer" placeholder="Employer Name" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-color);">
            </div>
            <div class="col-md-3 mb-2">
                <input type="text" class="form-control form-control-sm w2-wages" placeholder="Wages (Box 1)" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-color);">
            </div>
            <div class="col-md-3 mb-2">
                <input type="text" class="form-control form-control-sm w2-federal-tax" placeholder="Federal Tax Withheld" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-color);">
            </div>
            <div class="col-md-3 mb-2">
                <button type="button" class="btn btn-sm btn-danger" onclick="removeW2Form(this)">
                    <i class="fas fa-times"></i> Remove
                </button>
            </div>
        </div>
    `;
    container.appendChild(newForm);
}

// Remove W-2 Form
function removeW2Form(button) {
    button.closest('.w2-form-entry').remove();
}

// Add 1099 Form
function add1099Form() {
    const container = document.getElementById('income1099Container');
    if (!container) return;
    
    const newForm = document.createElement('div');
    newForm.className = 'income-1099-entry mb-3 p-3 border rounded';
    newForm.style.background = 'var(--card-bg)';
    newForm.style.borderColor = 'var(--border-color)';
    newForm.innerHTML = `
        <div class="row">
            <div class="col-md-3 mb-2">
                <select class="form-control form-control-sm 1099-type" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-color);">
                    <option value="">Form Type</option>
                    <option value="1099-NEC">1099-NEC</option>
                    <option value="1099-MISC">1099-MISC</option>
                    <option value="1099-INT">1099-INT</option>
                    <option value="1099-DIV">1099-DIV</option>
                    <option value="1099-B">1099-B</option>
                    <option value="1099-R">1099-R</option>
                    <option value="1099-G">1099-G</option>
                </select>
            </div>
            <div class="col-md-3 mb-2">
                <input type="text" class="form-control form-control-sm 1099-payer" placeholder="Payer Name" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-color);">
            </div>
            <div class="col-md-3 mb-2">
                <input type="text" class="form-control form-control-sm 1099-amount" placeholder="Amount" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-color);">
            </div>
            <div class="col-md-3 mb-2">
                <button type="button" class="btn btn-sm btn-danger" onclick="remove1099Form(this)">
                    <i class="fas fa-times"></i> Remove
                </button>
            </div>
        </div>
    `;
    container.appendChild(newForm);
}

// Remove 1099 Form
function remove1099Form(button) {
    button.closest('.income-1099-entry').remove();
}

// Add Dependent
function addDependent() {
    const container = document.getElementById('dependentsContainer');
    if (!container) return;
    
    const dependentCount = container.querySelectorAll('.dependent-entry').length;
    
    if (dependentCount === 0) {
        container.innerHTML = '';
    }
    
    const newDependent = document.createElement('div');
    newDependent.className = 'dependent-entry mb-3 p-3 border rounded';
    newDependent.style.background = 'var(--card-bg)';
    newDependent.style.borderColor = 'var(--border-color)';
    newDependent.innerHTML = `
        <div class="row">
            <div class="col-md-3 mb-2">
                <input type="text" class="form-control form-control-sm dependent-name" placeholder="Dependent Name" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-color);">
            </div>
            <div class="col-md-3 mb-2">
                <input type="text" class="form-control form-control-sm dependent-ssn" placeholder="SSN/ITIN" maxlength="11" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-color);">
            </div>
            <div class="col-md-2 mb-2">
                <input type="date" class="form-control form-control-sm dependent-dob" placeholder="Date of Birth" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-color);">
            </div>
            <div class="col-md-2 mb-2">
                <input type="text" class="form-control form-control-sm dependent-relationship" placeholder="Relationship" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-color);">
            </div>
            <div class="col-md-2 mb-2">
                <button type="button" class="btn btn-sm btn-danger" onclick="removeDependent(this)">
                    <i class="fas fa-times"></i> Remove
                </button>
            </div>
        </div>
    `;
    container.appendChild(newDependent);
    
    // Update Tax Payer dropdown after adding dependent
    updateTaxPayerDropdownWithDependents();
}

// Remove Dependent
function removeDependent(button) {
    const container = document.getElementById('dependentsContainer');
    if (!container) return;
    
    button.closest('.dependent-entry').remove();
    
    if (container.querySelectorAll('.dependent-entry').length === 0) {
        container.innerHTML = '<p class="text-muted">No dependents added yet.</p>';
    }
    
    // Update Tax Payer dropdown after removing dependent
    updateTaxPayerDropdownWithDependents();
}

// Save Tax Information
async function saveTaxInformation() {
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Authentication Error', 'You are not logged in. Please log in again.');
            return;
        }

        // Get customer ID
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!currentUser || currentUser.role !== 'customer') {
            showNotification('error', 'Error', 'Customer information not found.');
            return;
        }

        // Get customer record to get customer_id
        const meResponse = await fetch(API_BASE_URL + '/customers/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!meResponse.ok) {
            throw new Error('Failed to fetch customer information');
        }

        const customer = await meResponse.json();
        const customerId = customer.id;

        // Collect all tax information
        const taxYear = document.getElementById('taxYear')?.value || '2024';
        
        // Personal Information
        const taxData = {
            customer_id: customerId,
            tax_year: taxYear,
            ssn_itin: document.getElementById('taxSsnItin')?.value.trim() || '',
            date_of_birth: document.getElementById('taxDateOfBirthHidden')?.value || '',
            filing_status: document.getElementById('taxFilingStatus')?.value || '',
            spouse_name: document.getElementById('taxSpouseName')?.value.trim() || '',
            spouse_ssn_itin: document.getElementById('taxSpouseSsnItin')?.value.trim() || '',
            spouse_date_of_birth: document.getElementById('taxSpouseDateOfBirth')?.value || '',
            bank_tax_payer: document.getElementById('taxBankTaxPayer')?.value || '',
            bank_name: document.getElementById('taxBankName')?.value.trim() || '',
            bank_account_number: document.getElementById('taxBankAccountNumber')?.value.trim() || '',
            bank_routing_number: document.getElementById('taxBankRoutingNumber')?.value.trim() || '',
            bank_account_type: document.getElementById('taxBankAccountType')?.value || '',
            rental_income: parseFloat(document.getElementById('taxRentalIncome')?.value) || 0,
            unemployment_compensation: parseFloat(document.getElementById('taxUnemploymentComp')?.value) || 0,
            social_security_benefits: parseFloat(document.getElementById('taxSocialSecurity')?.value) || 0,
            other_income: parseFloat(document.getElementById('taxOtherIncome')?.value) || 0,
            other_income_description: document.getElementById('taxOtherIncomeDesc')?.value.trim() || '',
            standard_deduction: document.getElementById('standardDeduction')?.checked !== false,
            health_insurance_coverage: document.getElementById('taxHealthInsurance')?.value || '',
            estimated_tax_payments: parseFloat(document.getElementById('taxEstimatedPayments')?.value) || 0,
            prior_year_agi: parseFloat(document.getElementById('taxPriorYearAgi')?.value) || 0,
            prior_year_tax_return_available: document.getElementById('taxPriorYearReturn')?.checked || false
        };

        // Collect W-2 Forms
        const w2Forms = [];
        document.querySelectorAll('.w2-form-entry').forEach(form => {
            const employer = form.querySelector('.w2-employer')?.value.trim() || '';
            const wages = form.querySelector('.w2-wages')?.value.trim() || '';
            const federalTax = form.querySelector('.w2-federal-tax')?.value.trim() || '';
            
            if (employer || wages || federalTax) {
                w2Forms.push({
                    employer: employer,
                    wages: wages,
                    federal_tax_withheld: federalTax
                });
            }
        });
        taxData.w2_income = w2Forms;

        // Collect 1099 Forms
        const income1099 = [];
        document.querySelectorAll('.income-1099-entry').forEach(form => {
            const type = form.querySelector('.1099-type')?.value || '';
            const payer = form.querySelector('.1099-payer')?.value.trim() || '';
            const amount = form.querySelector('.1099-amount')?.value.trim() || '';
            
            if (type || payer || amount) {
                income1099.push({
                    type: type,
                    payer: payer,
                    amount: amount
                });
            }
        });
        taxData.income_1099 = income1099;

        // Collect Dependents
        const dependents = [];
        document.querySelectorAll('.dependent-entry').forEach(dep => {
            const name = dep.querySelector('.dependent-name')?.value.trim() || '';
            const ssn = dep.querySelector('.dependent-ssn')?.value.trim() || '';
            const dob = dep.querySelector('.dependent-dob')?.value || '';
            const relationship = dep.querySelector('.dependent-relationship')?.value.trim() || '';
            
            if (name || ssn || dob || relationship) {
                dependents.push({
                    name: name,
                    ssn_itin: ssn,
                    date_of_birth: dob,
                    relationship: relationship
                });
            }
        });
        taxData.dependents = dependents;

        // Collect Itemized Deductions
        if (!taxData.standard_deduction) {
            taxData.itemized_deductions = {
                medical_expenses: parseFloat(document.getElementById('taxMedicalExpenses')?.value) || 0,
                salt: parseFloat(document.getElementById('taxSalt')?.value) || 0,
                mortgage_interest: parseFloat(document.getElementById('taxMortgageInterest')?.value) || 0,
                charitable_contributions: parseFloat(document.getElementById('taxCharitable')?.value) || 0
            };
        }

        // Save to backend
        const response = await fetch(API_BASE_URL + '/customers/tax-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(taxData)
        });

        if (response.ok) {
            showNotification('success', 'Tax Information Saved', 'Your tax information has been saved successfully!');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save tax information');
        }
    } catch (error) {
        console.error('Error saving tax information:', error);
        showNotification('error', 'Save Failed', error.message || 'Failed to save tax information. Please try again.');
    }
}

// Load Tax Information
async function loadTaxInformation() {
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) return;

        // Check if this is a new OTP customer - skip loading tax info to keep fields blank
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        const isNewOTPCustomer = currentUser.tempPassword || currentUser.temp_password;
        
        if (isNewOTPCustomer) {
            console.log('📝 Skipping tax info load for new OTP customer - keeping fields blank');
            return; // Don't load tax info for new customers, keep fields blank
        }

        // Get customer ID
        const meResponse = await fetch(API_BASE_URL + '/customers/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!meResponse.ok) return;

        const customer = await meResponse.json();
        const customerId = customer.id;
        const taxYear = document.getElementById('taxYear')?.value || '2024';

        // Fetch tax information
        const response = await fetch(API_BASE_URL + `/customers/tax-info/${customerId}?tax_year=${taxYear}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const taxInfo = await response.json();
            
            // Check if taxInfo exists and is not null
            if (!taxInfo || typeof taxInfo !== 'object') {
                console.log('📋 No tax information found for this tax year');
                return; // Exit early if no tax info
            }
            
            // Populate form fields
            if (taxInfo.ssn_itin && document.getElementById('taxSsnItin')) document.getElementById('taxSsnItin').value = taxInfo.ssn_itin;
            if (taxInfo.date_of_birth && document.getElementById('taxDateOfBirth')) document.getElementById('taxDateOfBirth').value = taxInfo.date_of_birth;
            if (taxInfo.filing_status && document.getElementById('taxFilingStatus')) {
                document.getElementById('taxFilingStatus').value = taxInfo.filing_status;
                toggleSpouseSection();
            }
            if (taxInfo.spouse_name && document.getElementById('taxSpouseName')) document.getElementById('taxSpouseName').value = taxInfo.spouse_name;
            if (taxInfo.spouse_ssn_itin && document.getElementById('taxSpouseSsnItin')) document.getElementById('taxSpouseSsnItin').value = taxInfo.spouse_ssn_itin;
            if (taxInfo.spouse_date_of_birth && document.getElementById('taxSpouseDateOfBirth')) document.getElementById('taxSpouseDateOfBirth').value = taxInfo.spouse_date_of_birth;
            if (taxInfo.bank_account_number && document.getElementById('taxBankAccountNumber')) document.getElementById('taxBankAccountNumber').value = taxInfo.bank_account_number;
            if (taxInfo.bank_routing_number && document.getElementById('taxBankRoutingNumber')) document.getElementById('taxBankRoutingNumber').value = taxInfo.bank_routing_number;
            if (taxInfo.bank_account_type && document.getElementById('taxBankAccountType')) document.getElementById('taxBankAccountType').value = taxInfo.bank_account_type;
            if (taxInfo.rental_income && document.getElementById('taxRentalIncome')) document.getElementById('taxRentalIncome').value = taxInfo.rental_income;
            if (taxInfo.unemployment_compensation && document.getElementById('taxUnemploymentComp')) document.getElementById('taxUnemploymentComp').value = taxInfo.unemployment_compensation;
            if (taxInfo.social_security_benefits && document.getElementById('taxSocialSecurity')) document.getElementById('taxSocialSecurity').value = taxInfo.social_security_benefits;
            if (taxInfo.other_income && document.getElementById('taxOtherIncome')) document.getElementById('taxOtherIncome').value = taxInfo.other_income;
            if (taxInfo.other_income_description && document.getElementById('taxOtherIncomeDesc')) document.getElementById('taxOtherIncomeDesc').value = taxInfo.other_income_description;
            if (taxInfo.health_insurance_coverage && document.getElementById('taxHealthInsurance')) document.getElementById('taxHealthInsurance').value = taxInfo.health_insurance_coverage;
            if (taxInfo.estimated_tax_payments && document.getElementById('taxEstimatedPayments')) document.getElementById('taxEstimatedPayments').value = taxInfo.estimated_tax_payments;
            if (taxInfo.prior_year_agi && document.getElementById('taxPriorYearAgi')) document.getElementById('taxPriorYearAgi').value = taxInfo.prior_year_agi;
            if (taxInfo.prior_year_tax_return_available !== undefined && document.getElementById('taxPriorYearReturn')) document.getElementById('taxPriorYearReturn').checked = taxInfo.prior_year_tax_return_available;

            // Load W-2 Forms
            if (taxInfo.w2_income && Array.isArray(taxInfo.w2_income) && document.getElementById('w2FormsContainer')) {
                const container = document.getElementById('w2FormsContainer');
                container.innerHTML = '';
                taxInfo.w2_income.forEach(w2 => {
                    addW2Form();
                    const lastForm = container.lastElementChild;
                    if (lastForm) {
                        if (lastForm.querySelector('.w2-employer')) lastForm.querySelector('.w2-employer').value = w2.employer || '';
                        if (lastForm.querySelector('.w2-wages')) lastForm.querySelector('.w2-wages').value = w2.wages || '';
                        if (lastForm.querySelector('.w2-federal-tax')) lastForm.querySelector('.w2-federal-tax').value = w2.federal_tax_withheld || '';
                    }
                });
            }

            // Load 1099 Forms
            if (taxInfo.income_1099 && Array.isArray(taxInfo.income_1099) && document.getElementById('income1099Container')) {
                const container = document.getElementById('income1099Container');
                container.innerHTML = '';
                taxInfo.income_1099.forEach(form1099 => {
                    add1099Form();
                    const lastForm = container.lastElementChild;
                    if (lastForm) {
                        if (lastForm.querySelector('.1099-type')) lastForm.querySelector('.1099-type').value = form1099.type || '';
                        if (lastForm.querySelector('.1099-payer')) lastForm.querySelector('.1099-payer').value = form1099.payer || '';
                        if (lastForm.querySelector('.1099-amount')) lastForm.querySelector('.1099-amount').value = form1099.amount || '';
                    }
                });
            }

            // Load Dependents
            if (taxInfo.dependents && Array.isArray(taxInfo.dependents) && document.getElementById('dependentsContainer')) {
                const container = document.getElementById('dependentsContainer');
                container.innerHTML = '';
                taxInfo.dependents.forEach(dep => {
                    addDependent();
                    const lastDep = container.lastElementChild;
                    if (lastDep) {
                        if (lastDep.querySelector('.dependent-name')) lastDep.querySelector('.dependent-name').value = dep.name || '';
                        
                        // Update Tax Payer dropdown after adding each dependent
                        updateTaxPayerDropdownWithDependents();
                        if (lastDep.querySelector('.dependent-ssn')) lastDep.querySelector('.dependent-ssn').value = dep.ssn_itin || '';
                        if (lastDep.querySelector('.dependent-dob')) lastDep.querySelector('.dependent-dob').value = dep.date_of_birth || '';
                        if (lastDep.querySelector('.dependent-relationship')) lastDep.querySelector('.dependent-relationship').value = dep.relationship || '';
                    }
                });
                
                // Update Tax Payer dropdown after all dependents are loaded
                setTimeout(() => {
                    updateTaxPayerDropdownWithDependents();
                }, 100);
            }

            // Load Deductions
            if (taxInfo.standard_deduction !== undefined) {
                if (document.getElementById('standardDeduction')) document.getElementById('standardDeduction').checked = taxInfo.standard_deduction;
                if (document.getElementById('itemizedDeduction')) document.getElementById('itemizedDeduction').checked = !taxInfo.standard_deduction;
                if (!taxInfo.standard_deduction && document.getElementById('itemizedDeductionsSection')) {
                    document.getElementById('itemizedDeductionsSection').style.display = 'block';
                    if (taxInfo.itemized_deductions) {
                        if (taxInfo.itemized_deductions.medical_expenses && document.getElementById('taxMedicalExpenses')) document.getElementById('taxMedicalExpenses').value = taxInfo.itemized_deductions.medical_expenses;
                        if (taxInfo.itemized_deductions.salt && document.getElementById('taxSalt')) document.getElementById('taxSalt').value = taxInfo.itemized_deductions.salt;
                        if (taxInfo.itemized_deductions.mortgage_interest && document.getElementById('taxMortgageInterest')) document.getElementById('taxMortgageInterest').value = taxInfo.itemized_deductions.mortgage_interest;
                        if (taxInfo.itemized_deductions.charitable_contributions && document.getElementById('taxCharitable')) document.getElementById('taxCharitable').value = taxInfo.itemized_deductions.charitable_contributions;
                    }
                }
            }
            
            // Load SSN/ITIN entries for Identification Details (US)
            if (taxInfo.ssn_itin_entries && Array.isArray(taxInfo.ssn_itin_entries) && taxInfo.ssn_itin_entries.length > 0) {
                const container = document.getElementById('identificationSsnContainer');
                if (container) {
                    container.innerHTML = '';
                    taxInfo.ssn_itin_entries.forEach(entry => {
                        addIdentificationSsnEntry();
                        const lastEntry = container.lastElementChild;
                        if (lastEntry) {
                            const nameSelect = lastEntry.querySelector('.identification-name-select');
                            const ssnInput = lastEntry.querySelector('.identification-ssn-input');
                            if (nameSelect && entry.name) {
                                // Wait a bit for dropdown to be populated, then set value
                                setTimeout(() => {
                                    nameSelect.value = entry.name;
                                    if (ssnInput && entry.ssn_itin) {
                                        ssnInput.value = entry.ssn_itin;
                                    }
                                }, 300);
                            }
                        }
                    });
                }
            }
            
            // Load Visa information for non-US countries
            if (taxInfo.visa_type || taxInfo.latest_visa_change || taxInfo.primary_port_of_entry || taxInfo.total_months_stayed_us) {
                if (document.getElementById('identificationVisaType')) {
                    document.getElementById('identificationVisaType').value = taxInfo.visa_type || '';
                }
                if (document.getElementById('identificationLatestVisaChange')) {
                    document.getElementById('identificationLatestVisaChange').value = taxInfo.latest_visa_change || '';
                }
                if (document.getElementById('identificationPrimaryPortOfEntry')) {
                    document.getElementById('identificationPrimaryPortOfEntry').value = taxInfo.primary_port_of_entry || '';
                }
                if (document.getElementById('identificationTotalMonthsUS')) {
                    document.getElementById('identificationTotalMonthsUS').value = taxInfo.total_months_stayed_us || '';
                }
            }
            
            // Load Personal Information fields from tax info
            if (taxInfo.first_name && document.getElementById('personalFirstName')) {
                document.getElementById('personalFirstName').value = taxInfo.first_name;
            }
            if (taxInfo.middle_name && document.getElementById('personalMiddleName')) {
                document.getElementById('personalMiddleName').value = taxInfo.middle_name;
            }
            if (taxInfo.last_name && document.getElementById('personalLastName')) {
                document.getElementById('personalLastName').value = taxInfo.last_name;
            }
            if (taxInfo.date_of_birth) {
                const dobField = document.getElementById('personalDateOfBirth');
                const dobHidden = document.getElementById('personalDateOfBirthHidden');
                if (dobField && dobHidden) {
                    dobHidden.value = taxInfo.date_of_birth;
                    // Format for display
                    const date = new Date(taxInfo.date_of_birth);
                    if (!isNaN(date.getTime())) {
                        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                           'July', 'August', 'September', 'October', 'November', 'December'];
                        const displayDate = `${monthNames[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
                        dobField.value = displayDate;
                    }
                }
            }
            if (taxInfo.gender && document.getElementById('personalGender')) {
                document.getElementById('personalGender').value = taxInfo.gender;
            }
            if (taxInfo.marital_status && document.getElementById('personalMaritalStatus')) {
                document.getElementById('personalMaritalStatus').value = taxInfo.marital_status;
            }
            if (taxInfo.alternate_mobile_no && document.getElementById('personalAlternateMobile')) {
                document.getElementById('personalAlternateMobile').value = taxInfo.alternate_mobile_no;
            }
            if (taxInfo.country_of_citizenship && document.getElementById('personalCountryOfCitizenship')) {
                document.getElementById('personalCountryOfCitizenship').value = taxInfo.country_of_citizenship;
                // Trigger change event to show/hide appropriate identification section
                if (typeof handleCountryOfCitizenshipChange === 'function') {
                    handleCountryOfCitizenshipChange();
                }
            }
            if (taxInfo.filing_years && document.getElementById('personalFilingYears')) {
                document.getElementById('personalFilingYears').value = taxInfo.filing_years;
            }
            
            // Load Bank Information
            if (taxInfo.bank_tax_payer && document.getElementById('taxBankTaxPayer')) {
                document.getElementById('taxBankTaxPayer').value = taxInfo.bank_tax_payer;
            }
            if (taxInfo.bank_name && document.getElementById('taxBankName')) {
                document.getElementById('taxBankName').value = taxInfo.bank_name;
            }
            if (taxInfo.bank_account_number && document.getElementById('taxBankAccountNumber')) {
                document.getElementById('taxBankAccountNumber').value = taxInfo.bank_account_number;
            }
            if (taxInfo.bank_routing_number && document.getElementById('taxBankRoutingNumber')) {
                document.getElementById('taxBankRoutingNumber').value = taxInfo.bank_routing_number;
            }
            if (taxInfo.bank_account_type && document.getElementById('taxBankAccountType')) {
                document.getElementById('taxBankAccountType').value = taxInfo.bank_account_type;
            }
        }
    } catch (error) {
        console.error('Error loading tax information:', error);
    }
}

// Initialize tax form event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Filing status change
    const filingStatusSelect = document.getElementById('taxFilingStatus');
    if (filingStatusSelect) {
        filingStatusSelect.addEventListener('change', toggleSpouseSection);
    }
    
    // Deduction type toggle
    const standardDeduction = document.getElementById('standardDeduction');
    const itemizedDeduction = document.getElementById('itemizedDeduction');
    const itemizedSection = document.getElementById('itemizedDeductionsSection');
    
    if (standardDeduction && itemizedSection) {
        standardDeduction.addEventListener('change', function() {
            if (this.checked) {
                itemizedSection.style.display = 'none';
            }
        });
    }
    
    if (itemizedDeduction && itemizedSection) {
        itemizedDeduction.addEventListener('change', function() {
            if (this.checked) {
                itemizedSection.style.display = 'block';
            }
        });
    }
    
    // Tax year change
    const taxYearSelect = document.getElementById('taxYear');
    if (taxYearSelect) {
        taxYearSelect.addEventListener('change', loadTaxInformation);
    }
});

// Show password change modal
function showPasswordChangeModal() {
    const modal = new bootstrap.Modal(document.getElementById('passwordChangeModal'));
    modal.show();
    
    // Clear form
    document.getElementById('passwordChangeForm').reset();
    document.getElementById('passwordChangeError').style.display = 'none';
    document.getElementById('passwordChangeSuccess').style.display = 'none';
    
    // Check if user logged in with OTP (temp_password)
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const isTempPassword = currentUser.tempPassword || currentUser.temp_password;
    
    const tempPasswordFields = document.getElementById('tempPasswordFields');
    const regularPasswordFields = document.getElementById('regularPasswordFields');
    const infoAlert = document.getElementById('passwordChangeInfo');
    
    if (isTempPassword) {
        // Show temp password fields (username, new password, confirm password)
        tempPasswordFields.style.display = 'block';
        regularPasswordFields.style.display = 'none';
        
        // Set username field
        const usernameField = document.getElementById('usernameField');
        if (usernameField && currentUser.username) {
            usernameField.value = currentUser.username;
        }
        
        // Update info message
        if (infoAlert) {
            infoAlert.innerHTML = '<i class="fas fa-info-circle me-2"></i><strong>Set Your Password:</strong> Please create a password for your account.';
        }
        
        // Focus on new password field
        setTimeout(() => {
            document.getElementById('newPassword').focus();
        }, 300);
    } else {
        // Show regular password fields (current password, new password, confirm password)
        tempPasswordFields.style.display = 'none';
        regularPasswordFields.style.display = 'block';
        
        // Update info message
        if (infoAlert) {
            infoAlert.innerHTML = '<i class="fas fa-info-circle me-2"></i><strong>Password Change Required:</strong> You are using a temporary password. Please set a new password to continue.';
        }
        
        // Focus on current password field
        setTimeout(() => {
            document.getElementById('currentPassword').focus();
        }, 300);
    }
}

// Change password function
async function changePassword() {
    // Check which form is visible (temp password or regular)
    const tempPasswordFields = document.getElementById('tempPasswordFields');
    const isTempPassword = tempPasswordFields && tempPasswordFields.style.display !== 'none';
    
    let currentPassword = '';
    let newPassword = '';
    let confirmPassword = '';
    
    if (isTempPassword) {
        // For OTP login - no current password needed
        newPassword = document.getElementById('newPassword').value;
        confirmPassword = document.getElementById('confirmPassword').value;
    } else {
        // For regular password change
        currentPassword = document.getElementById('currentPassword').value;
        newPassword = document.getElementById('newPasswordRegular').value;
        confirmPassword = document.getElementById('confirmPasswordRegular').value;
    }
    
    const errorDiv = document.getElementById('passwordChangeError');
    const successDiv = document.getElementById('passwordChangeSuccess');
    const changeBtn = document.getElementById('changePasswordBtn');
    
    // Clear previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    // Validate inputs
    if (isTempPassword) {
        // For temp password, only new password and confirm password are required
        if (!newPassword || !confirmPassword) {
            errorDiv.textContent = 'New password and confirm password are required';
            errorDiv.style.display = 'block';
            return;
        }
    } else {
        // For regular password change, all fields are required
        if (!currentPassword || !newPassword || !confirmPassword) {
            errorDiv.textContent = 'All fields are required';
            errorDiv.style.display = 'block';
            return;
        }
    }
    
    if (newPassword.length < 6) {
        errorDiv.textContent = 'New password must be at least 6 characters long';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'New password and confirm password do not match';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Disable button during request
    changeBtn.disabled = true;
    changeBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Changing Password...';
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            throw new Error('Authentication token not found. Please log in again.');
        }
        
        const requestBody = {
            newPassword: newPassword,
            confirmPassword: confirmPassword
        };
        
        // Only include currentPassword if it's not a temp password login
        if (!isTempPassword && currentPassword) {
            requestBody.currentPassword = currentPassword;
        }
        
        // Add flag to indicate temp password change
        if (isTempPassword) {
            requestBody.isTempPassword = true;
        }
        
        const response = await fetch(API_BASE_URL + '/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Show success message
            successDiv.style.display = 'block';
            errorDiv.style.display = 'none';
            
            // Hide form
            document.getElementById('passwordChangeForm').style.display = 'none';
            changeBtn.style.display = 'none';
            
            // Check if this is a temp password change (OTP login)
            if (isTempPassword) {
                // For OTP login users, automatically log them in and show dashboard
                setTimeout(() => {
                    // Hide modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('passwordChangeModal'));
                    if (modal) {
                        modal.hide();
                    }
                    
                    // Hide login page and admin dashboard
                    const loginPage = document.getElementById('loginPage');
                    const dashboardPage = document.getElementById('dashboardPage');
                    if (loginPage) {
                        loginPage.style.display = 'none';
                    }
                    if (dashboardPage) {
                        dashboardPage.style.display = 'none';
                    }
                    
                    // Update currentUser to clear tempPassword flag (but keep it for this session to show blank fields)
                    // We'll keep tempPassword in sessionStorage for this session so dashboard shows blank fields
                    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
                    // Keep tempPassword flag for this session to control dashboard behavior
                    // It will be cleared when they submit their details
                    
                    // Show customer dashboard
                    const customerDashboard = document.getElementById('customerDashboardPage');
                    if (customerDashboard) {
                        customerDashboard.style.display = 'block';
                        
                        // Load customer dashboard (will show email pre-filled, other fields blank)
                        if (typeof loadCustomerDashboard === 'function') {
                            loadCustomerDashboard();
                        }
                    }
                    
                    // Show success notification
                    showNotification('success', 'Password Set', 'Your password has been set successfully! Please complete your profile information.');
                }, 1000);
            } else {
                // For regular password change, redirect to login
                setTimeout(() => {
                    // Clear session
                    sessionStorage.removeItem('authToken');
                    sessionStorage.removeItem('currentUser');
                    currentUser = null;
                    
                    // Hide modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('passwordChangeModal'));
                    if (modal) {
                        modal.hide();
                    }
                    
                    // Show login page
                    const loginPage = document.getElementById('loginPage');
                    const customerDashboard = document.getElementById('customerDashboardPage');
                    if (loginPage) {
                        loginPage.style.display = 'block';
                    }
                    if (customerDashboard) {
                        customerDashboard.style.display = 'none';
                    }
                    
                    // Show success notification
                    showNotification('success', 'Password Changed', 'Your password has been changed successfully. Please log in again with your new password.');
                    
                    // Clear login form
                    const loginForm = document.getElementById('loginForm');
                    if (loginForm) {
                        loginForm.reset();
                    }
                }, 2000);
            }
            
        } else {
            // Show error
            errorDiv.textContent = data.error || 'Failed to change password. Please try again.';
            errorDiv.style.display = 'block';
            changeBtn.disabled = false;
            changeBtn.innerHTML = '<i class="fas fa-save me-2"></i>Change Password';
        }
        
    } catch (error) {
        console.error('Error changing password:', error);
        errorDiv.textContent = error.message || 'An error occurred. Please try again.';
        errorDiv.style.display = 'block';
        changeBtn.disabled = false;
        changeBtn.innerHTML = '<i class="fas fa-save me-2"></i>Change Password';
    }
}

// Load customer documents for admin/preparation view
async function loadCustomerDocuments(customerId) {
    const documentsList = document.getElementById('customerDocumentsList');
    if (!documentsList) return;
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            documentsList.innerHTML = '<div class="text-center text-muted">Authentication required</div>';
            return;
        }
        
        const response = await fetch(API_BASE_URL + `/customers/documents/${customerId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const documents = await response.json();
            
            if (documents.length === 0) {
                documentsList.innerHTML = '<div class="text-center text-muted"><i class="fas fa-file-alt"></i> No documents uploaded yet</div>';
            } else {
                // Helper function to format file size
                const formatFileSize = (bytes) => {
                    if (bytes === 0) return '0 Bytes';
                    const k = 1024;
                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
                };
                
                // Filter out any documents with invalid IDs
                const validDocuments = documents.filter(doc => {
                    const hasValidId = doc.id && !isNaN(doc.id) && doc.id > 0;
                    const hasFileName = doc.file_name && doc.file_name.trim().length > 0;
                    return hasValidId && hasFileName;
                });
                
                if (validDocuments.length !== documents.length) {
                    console.warn(`⚠️ Filtered out ${documents.length - validDocuments.length} document(s) with invalid IDs or missing file names`);
                }
                
                if (validDocuments.length === 0) {
                    documentsList.innerHTML = '<div class="text-center text-muted"><i class="fas fa-file-alt"></i> No valid documents found</div>';
                    return;
                }
                
                documentsList.innerHTML = validDocuments.map(doc => {
                    const uploadDate = new Date(doc.uploaded_at).toLocaleString();
                    const fileSize = formatFileSize(doc.file_size);
                    const fileIcon = doc.file_type.includes('pdf') ? 'fa-file-pdf' : 
                                    doc.file_type.includes('image') ? 'fa-file-image' : 'fa-file';
                    const isImage = doc.file_type.includes('image');
                    const isPDF = doc.file_type.includes('pdf');
                    
                    return `
                        <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded document-item" style="background: var(--card-bg); transition: background-color 0.2s;">
                            <div style="flex: 1; cursor: pointer; padding: 5px; border-radius: 4px;" 
                                 onclick="viewCustomerDocument(${doc.id}, '${doc.file_name.replace(/'/g, "\\'")}', ${isImage}, ${isPDF})" 
                                 onmouseover="this.style.backgroundColor='rgba(0,123,255,0.1)'" 
                                 onmouseout="this.style.backgroundColor='transparent'"
                                 title="Click to view document">
                                <i class="fas ${fileIcon} me-2"></i>
                                <span style="font-weight: 500;">${doc.file_name}</span>
                                <small class="text-muted ms-2">(${fileSize})</small>
                                <br>
                                <small class="text-muted">Uploaded: ${uploadDate}</small>
                            </div>
                            <div class="btn-group ms-2" role="group">
                                <button type="button" 
                                        class="btn btn-sm btn-info" 
                                        onclick="event.stopPropagation(); viewCustomerDocument(${doc.id}, '${doc.file_name.replace(/'/g, "\\'")}', ${isImage}, ${isPDF})"
                                        title="View document">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button type="button" 
                                        class="btn btn-sm btn-primary" 
                                        onclick="event.stopPropagation(); downloadCustomerDocument(${doc.id}, '${doc.file_name.replace(/'/g, "\\'")}')"
                                        title="Download document">
                                    <i class="fas fa-download"></i> Download
                                </button>
                                <button type="button" 
                                        class="btn btn-sm btn-danger" 
                                        onclick="event.stopPropagation(); deleteCustomerDocument(${doc.id}, '${doc.file_name.replace(/'/g, "\\'")}', ${customerId})"
                                        title="Delete document">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } else {
            documentsList.innerHTML = '<div class="text-center text-danger">Error loading documents</div>';
        }
    } catch (error) {
        console.error('Error loading documents:', error);
        documentsList.innerHTML = '<div class="text-center text-danger">Error loading documents</div>';
    }
}

// Store current document info for download from viewer
let currentViewingDocument = null;

// View customer document in pop-up
async function viewCustomerDocument(documentId, fileName, isImage, isPDF) {
    try {
        // Convert to number and validate inputs
        const docId = parseInt(documentId, 10);
        if (!documentId || isNaN(docId) || docId <= 0) {
            console.error('❌ Invalid document ID:', documentId, 'Parsed as:', docId);
            showNotification('error', 'Invalid Document', 'Invalid document ID. Please refresh the page and try again.');
            return;
        }
        
        if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0) {
            console.error('❌ Invalid file name:', fileName);
            showNotification('error', 'Invalid Document', 'Invalid file name. Please refresh the page and try again.');
            return;
        }
        
        // Use validated ID
        documentId = docId;
        
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Authentication Error', 'You are not logged in. Please log in again.');
            return;
        }
        
        // Store document info for download button
        currentViewingDocument = { id: documentId, fileName: fileName };
        
        console.log(`📄 Attempting to view document: ID=${documentId}, Name=${fileName}, isImage=${isImage}, isPDF=${isPDF}`);
        
        // Update modal title
        const modalTitle = document.getElementById('documentViewerTitle');
        if (modalTitle) {
            modalTitle.textContent = fileName;
        }
        
        // Show loading state
        const viewerContent = document.getElementById('documentViewerContent');
        if (viewerContent) {
            viewerContent.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-3 text-muted">Loading document...</p>
                </div>
            `;
        }
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('documentViewerModal'));
        modal.show();
        
        // Fetch document
        console.log(`📡 Fetching document ID ${documentId} for viewing`);
        const downloadUrl = API_BASE_URL + `/customers/documents/${documentId}/download`;
        console.log(`📡 Document URL: ${downloadUrl}`);
        
        const response = await fetch(downloadUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log(`📡 Document fetch response status: ${response.status}`);
        
        if (!response.ok) {
            // Handle different error statuses
            if (response.status === 404) {
                console.error(`❌ Document not found: ID ${documentId}`);
                if (viewerContent) {
                    viewerContent.innerHTML = `
                        <div class="text-center text-danger p-5">
                            <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                            <h5>Document Not Found</h5>
                            <p>The document you're trying to view no longer exists or has been deleted.</p>
                            <p class="text-muted small">Document ID: ${documentId}</p>
                        </div>
                    `;
                }
                showNotification('error', 'Document Not Found', 'The document file is missing from the server. The document record exists but the file cannot be found.');
                // Don't reload documents list - keep existing documents visible
                return;
            } else if (response.status === 403) {
                console.error(`❌ Access denied for document ID ${documentId}`);
                if (viewerContent) {
                    viewerContent.innerHTML = `
                        <div class="text-center text-danger p-5">
                            <i class="fas fa-lock fa-3x mb-3"></i>
                            <h5>Access Denied</h5>
                            <p>You don't have permission to view this document.</p>
                        </div>
                    `;
                }
                showNotification('error', 'Access Denied', 'You don\'t have permission to view this document.');
                return;
            } else {
                let errorText = '';
                try {
                    errorText = await response.text();
                } catch (e) {
                    errorText = response.statusText || `Status ${response.status}`;
                }
                console.error(`❌ Error fetching document: ${response.status} - ${errorText}`);
                if (viewerContent) {
                    viewerContent.innerHTML = `
                        <div class="text-center text-danger p-5">
                            <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                            <h5>Error Loading Document</h5>
                            <p>Failed to load the document. Please try again later.</p>
                            <p class="text-muted small">Error: ${response.status}</p>
                        </div>
                    `;
                }
                showNotification('error', 'Error Loading Document', 'Failed to load the document. Please try again.');
                return;
            }
        }
        
        // Response is OK, proceed with displaying document
        if (viewerContent) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            if (isImage) {
                // Display image
                viewerContent.innerHTML = `
                    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 20px;">
                        <img src="${url}" 
                             alt="${fileName}" 
                             style="max-width: 100%; max-height: 80vh; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
                             onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'text-center text-danger\\'><i class=\\'fas fa-exclamation-triangle fa-3x mb-3\\'></i><p>Failed to load image</p></div>'">
                    </div>
                `;
            } else if (isPDF) {
                // Display PDF using iframe
                viewerContent.innerHTML = `
                    <div style="width: 100%; height: 80vh; padding: 0;">
                        <iframe src="${url}" 
                                style="width: 100%; height: 100%; border: none; border-radius: 4px;"
                                title="${fileName}">
                            <p>Your browser does not support PDFs. <a href="${url}" download="${fileName}">Download the PDF</a> instead.</p>
                        </iframe>
                    </div>
                `;
            } else {
                // For other file types, show download option
                viewerContent.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-file fa-5x text-muted mb-3"></i>
                        <h5>${fileName}</h5>
                        <p class="text-muted">This file type cannot be previewed. Please download to view.</p>
                        <button type="button" class="btn btn-primary" onclick="downloadCurrentDocument()">
                            <i class="fas fa-download"></i> Download File
                        </button>
                    </div>
                `;
            }
            
            // Clean up URL when modal is closed
            const modalElement = document.getElementById('documentViewerModal');
            modalElement.addEventListener('hidden.bs.modal', function cleanup() {
                window.URL.revokeObjectURL(url);
                modalElement.removeEventListener('hidden.bs.modal', cleanup);
            }, { once: true });
            
        } else {
            // Handle error response
            let errorMessage = 'Failed to load document';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                console.error('❌ Document fetch error:', errorData);
            } catch (jsonError) {
                // If response is not JSON, use status text
                errorMessage = response.statusText || `Server returned status ${response.status}`;
                console.error('❌ Document fetch error (non-JSON):', response.status, response.statusText);
            }
            
            viewerContent.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                    <h5>Error Loading Document</h5>
                    <p class="text-muted">${errorMessage}</p>
                    ${response.status === 404 ? '<p class="text-muted small">The document may have been deleted or moved.</p>' : ''}
                    <button type="button" class="btn btn-secondary mt-3" onclick="bootstrap.Modal.getInstance(document.getElementById('documentViewerModal')).hide()">
                        Close
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error viewing document:', error);
        const viewerContent = document.getElementById('documentViewerContent');
        if (viewerContent) {
            viewerContent.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                    <h5>Error Loading Document</h5>
                    <p class="text-muted">Failed to load document. Please try again.</p>
                </div>
            `;
        }
    }
}

// Download current viewing document
function downloadCurrentDocument() {
    if (currentViewingDocument) {
        downloadCustomerDocument(currentViewingDocument.id, currentViewingDocument.fileName);
    }
}

// Download customer document
async function downloadCustomerDocument(documentId, fileName) {
    try {
        // Convert to number and validate inputs
        const docId = parseInt(documentId, 10);
        if (!documentId || isNaN(docId) || docId <= 0) {
            console.error('❌ Invalid document ID for download:', documentId, 'Parsed as:', docId);
            showNotification('error', 'Invalid Document', 'Invalid document ID. Please refresh the page and try again.');
            return;
        }
        
        if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0) {
            console.error('❌ Invalid file name for download:', fileName);
            showNotification('error', 'Invalid Document', 'Invalid file name. Please refresh the page and try again.');
            return;
        }
        
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Authentication Error', 'You are not logged in. Please log in again.');
            return;
        }
        
        // Use validated ID
        documentId = docId;
        
        console.log(`📥 Downloading document ID: ${documentId}, Name: ${fileName}`);
        
        const response = await fetch(API_BASE_URL + `/customers/documents/${documentId}/download`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            const error = await response.json();
            showNotification('error', 'Download Failed', error.error || 'Failed to download document');
        }
    } catch (error) {
        console.error('Error downloading document:', error);
        showNotification('error', 'Download Failed', 'Failed to download document. Please try again.');
    }
}

// Delete customer document
async function deleteCustomerDocument(documentId, fileName, customerId) {
    try {
        // Convert to number and validate inputs
        const docId = parseInt(documentId, 10);
        if (!documentId || isNaN(docId) || docId <= 0) {
            console.error('❌ Invalid document ID for deletion:', documentId, 'Parsed as:', docId);
            showNotification('error', 'Invalid Document', 'Invalid document ID. Please refresh the page and try again.');
            return;
        }
        
        if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0) {
            console.error('❌ Invalid file name for deletion:', fileName);
            showNotification('error', 'Invalid Document', 'Invalid file name. Please refresh the page and try again.');
            return;
        }
        
        // Use validated ID
        documentId = docId;
        
        // Confirm deletion
        if (!confirm(`Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`)) {
            return;
        }
        
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Authentication Error', 'You are not logged in. Please log in again.');
            return;
        }
        
        console.log(`🗑️ Deleting document ID ${documentId}: ${fileName}`);
        
        const response = await fetch(API_BASE_URL + `/customers/documents/${documentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log(`✅ Document deleted successfully: ${result.message}`);
            showNotification('success', 'Document Deleted', `"${fileName}" has been deleted successfully.`);
            
            // Reload documents list
            // Check if we're in customer dashboard or admin/preparation view
            const customerDocumentsList = document.getElementById('customerUploadedDocumentsList');
            const adminDocumentsList = document.getElementById('customerDocumentsList');
            
            if (customerDocumentsList && customerId) {
                // Customer dashboard - reload customer documents
                console.log(`🔄 Reloading customer documents for customer ID: ${customerId}`);
                await loadCustomerUploadedDocuments(customerId);
            } else if (adminDocumentsList && customerId) {
                // Admin/Preparation view - reload customer documents in modal
                console.log(`🔄 Reloading customer documents in admin view for customer ID: ${customerId}`);
                await loadCustomerDocuments(customerId);
            }
        } else {
            const error = await response.json();
            console.error('❌ Delete failed:', error);
            showNotification('error', 'Delete Failed', error.error || 'Failed to delete document');
        }
    } catch (error) {
        console.error('Error deleting document:', error);
        showNotification('error', 'Delete Failed', 'Failed to delete document. Please try again.');
    }
}

function updateCommentsByStatus() {
    const status = document.getElementById('updateCustomerStatus').value;
    const commentsField = document.getElementById('updateComments');
    
    // Status to comment mapping
    const statusComments = {
        'follow_up': 'Client and asked us to call back later.',
        'call_back': 'Client asked us to call back',
        'not_in_service': 'Number not in Service',
        'voice_mail': 'Reached Voice Mail',
        'citizen': 'Call reached Citizen',
        'dnd': 'Customer wants us not to disturb',
        'interested': 'Client Agreed and wants to share his W2'
    };
    
    // Auto-populate comments if status is selected and comments field is empty or contains default comment
    if (status && statusComments[status]) {
        const currentComment = commentsField.value.trim();
        // Only auto-fill if field is empty or contains one of the status comments
        const isDefaultComment = Object.values(statusComments).includes(currentComment);
        
        if (!currentComment || isDefaultComment) {
            commentsField.value = statusComments[status];
        }
    }
}

function validateTimeInput(type) {
    if (type === 'hour') {
        const hourInput = document.getElementById('followUpTimeHour');
        let value = parseInt(hourInput.value);
        if (isNaN(value) || value < 1) {
            hourInput.value = '';
        } else if (value > 12) {
            hourInput.value = 12;
        } else {
            hourInput.value = value;
        }
    } else if (type === 'minute') {
        const minuteInput = document.getElementById('followUpTimeMinute');
        let value = parseInt(minuteInput.value);
        if (isNaN(value) || value < 0) {
            minuteInput.value = '';
        } else if (value > 59) {
            minuteInput.value = 59;
        } else {
            minuteInput.value = value;
        }
        // Pad with zero if single digit
        if (minuteInput.value && minuteInput.value.length === 1) {
            minuteInput.value = '0' + minuteInput.value;
        }
    }
}

function toggleFollowUpFields() {
    const status = document.getElementById('updateCustomerStatus').value;
    const followUpFields = document.getElementById('followUpFields');
    
    if (status === 'follow_up') {
        followUpFields.style.display = 'block';
    } else {
        followUpFields.style.display = 'none';
        // Clear date and time when hiding
        document.getElementById('followUpDate').value = '';
        document.getElementById('followUpTimeHour').value = '';
        document.getElementById('followUpTimeMinute').value = '';
        document.getElementById('followUpTimeAMPM').value = 'AM';
    }
}

function toggleInterestedField() {
    const status = document.getElementById('updateCustomerStatus').value;
    const interestedField = document.getElementById('interestedField');
    
    if (status === 'citizen') {
        interestedField.style.display = 'block';
    } else {
        interestedField.style.display = 'none';
        // Clear interested value when hiding
        document.getElementById('updateInterested').value = '';
    }
}

// Date Picker Variables
let currentCalendarDate = new Date();
let selectedCalendarDate = null;
let currentView = 'calendar'; // 'calendar', 'month', 'year'

function openDatePicker() {
    selectedCalendarDate = null;
    currentView = 'calendar';
    // Hide month/year panel
    document.getElementById('monthYearPanel').style.display = 'none';
    // Set current date to today or existing selected date
    const existingDate = document.getElementById('followUpDate').value;
    if (existingDate) {
        currentCalendarDate = new Date(existingDate);
    } else {
        currentCalendarDate = new Date();
    }
    renderCalendar();
    const modal = new bootstrap.Modal(document.getElementById('datePickerModal'));
    modal.show();
}

function renderCalendar() {
    const calendarContainer = document.getElementById('datePickerCalendar');
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Month names
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Weekday names
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    let html = `
        <div class="calendar-container">
            <div class="calendar-header">
                <button class="calendar-nav-btn" onclick="changeMonth(-1)">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div class="calendar-month-year" onclick="showMonthYearPanel()">${monthNames[month]} ${year}</div>
                <button class="calendar-nav-btn" onclick="changeMonth(1)">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="calendar-weekdays">
    `;
    
    // Weekday headers
    weekdays.forEach(day => {
        html += `<div class="calendar-weekday">${day}</div>`;
    });
    
    html += `</div><div class="calendar-days">`;
    
    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
        html += `<div class="calendar-day other-month"></div>`;
    }
    
    // Today's date
    const today = new Date();
    const isTodayMonth = today.getMonth() === month && today.getFullYear() === year;
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isToday = isTodayMonth && day === today.getDate();
        const isSelected = selectedCalendarDate && 
                          date.getDate() === selectedCalendarDate.getDate() &&
                          date.getMonth() === selectedCalendarDate.getMonth() &&
                          date.getFullYear() === selectedCalendarDate.getFullYear();
        
        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';
        
        html += `<div class="${classes}" onclick="selectDate(${year}, ${month}, ${day})">${day}</div>`;
    }
    
    html += `</div></div>`;
    
    calendarContainer.innerHTML = html;
}

function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar();
}

function selectDate(year, month, day) {
    selectedCalendarDate = new Date(year, month, day);
    renderCalendar();
}

function confirmDateSelection() {
    if (selectedCalendarDate) {
        const year = selectedCalendarDate.getFullYear();
        const month = String(selectedCalendarDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedCalendarDate.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        
        // Format for display (e.g., "January 15, 2024")
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const displayDate = `${monthNames[selectedCalendarDate.getMonth()]} ${day}, ${year}`;
        
        // Store ISO format but display formatted date
        document.getElementById('followUpDate').value = formattedDate;
        document.getElementById('followUpDate').setAttribute('data-display', displayDate);
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('datePickerModal'));
        modal.hide();
    }
}

function showMonthYearPanel() {
    currentView = 'month';
    document.getElementById('monthYearPanel').style.display = 'flex';
    document.getElementById('panelTitle').textContent = 'Select Month';
    renderMonthSelection();
}

function renderMonthSelection() {
    const panelContent = document.getElementById('monthYearPanelContent');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonth = currentCalendarDate.getMonth();
    
    let html = `
        <div style="margin-bottom: 8px;">
            <div class="year-item" style="font-weight: 600; padding: 12px 16px; border-bottom: 1px solid #e5e5e5; margin-bottom: 8px; cursor: pointer;" onclick="showYearSelection()">
                ${currentCalendarDate.getFullYear()} <i class="fas fa-chevron-right" style="float: right; font-size: 12px; margin-top: 2px;"></i>
            </div>
        </div>
        <div class="month-grid">
    `;
    
    monthNames.forEach((monthName, index) => {
        const isCurrentMonth = index === currentMonth;
        const classes = isCurrentMonth ? 'month-item current-month' : 'month-item';
        html += `<div class="${classes}" onclick="selectMonth(${index})">${monthName.substring(0, 3)}</div>`;
    });
    
    html += '</div>';
    panelContent.innerHTML = html;
}

function showYearSelection() {
    currentView = 'year';
    document.getElementById('panelTitle').textContent = 'Select Year';
    renderYearSelection();
}

function renderYearSelection() {
    const panelContent = document.getElementById('monthYearPanelContent');
    const currentYear = currentCalendarDate.getFullYear();
    const startDecade = Math.floor(currentYear / 10) * 10; // Get starting year of decade (e.g., 2020)
    const endDecade = startDecade + 9; // End of decade (e.g., 2029)
    
    let html = `<div class="year-grid">`;
    
    // Show years in the current decade range (show a bit more for easier navigation)
    for (let year = startDecade - 1; year <= endDecade + 1; year++) {
        const isCurrentYear = year === currentYear;
        const classes = isCurrentYear ? 'year-item current-year' : 'year-item';
        html += `<div class="${classes}" onclick="selectYear(${year})">${year}</div>`;
    }
    
    html += '</div>';
    panelContent.innerHTML = html;
}

function selectMonth(monthIndex) {
    currentCalendarDate.setMonth(monthIndex);
    currentView = 'calendar';
    document.getElementById('monthYearPanel').style.display = 'none';
    renderCalendar();
}

function selectYear(year) {
    currentCalendarDate.setFullYear(year);
    // Go back to month selection after selecting year
    currentView = 'month';
    document.getElementById('panelTitle').textContent = 'Select Month';
    renderMonthSelection();
}

function goBackToCalendar() {
    if (currentView === 'month') {
        // If in month view, go back to calendar
        currentView = 'calendar';
        document.getElementById('monthYearPanel').style.display = 'none';
    } else if (currentView === 'year') {
        // If in year view, go back to month view
        currentView = 'month';
        document.getElementById('panelTitle').textContent = 'Select Month';
        renderMonthSelection();
    }
}

async function saveStatusUpdate() {
    const customerId = parseInt(document.getElementById('updateCustomerId').value);
    const status = document.getElementById('updateCustomerStatus').value;
    const comments = document.getElementById('updateComments').value;
    
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        customer.status = status;
        customer.comments = comments;
        
        // Save phone, email, address fields if they were edited (only for admin)
        const isAdmin = currentUser && currentUser.role === 'admin';
        const phoneField = document.getElementById('updateCustomerPhone');
        const emailField = document.getElementById('updateCustomerEmail');
        const address1Field = document.getElementById('updateCustomerAddress1');
        const cityField = document.getElementById('updateCustomerCity');
        const stateField = document.getElementById('updateCustomerState');
        const zipCodeField = document.getElementById('updateCustomerZipCode');
        
        if (isAdmin) {
            // Only update if field is in edit mode (not readonly/disabled)
            if (!phoneField.readOnly) {
                customer.phone = phoneField.value || '';
            }
            if (!emailField.readOnly) {
                customer.email = emailField.value || '';
            }
            // Save state code if field was edited (not disabled)
            if (!stateField.disabled) {
                customer.state = stateField.value || '';
            }
        } else {
            // For non-admin users, preserve existing state or extract from address
            if (!customer.state) {
                const stateFromAddress = extractStateFromAddress(customer.address);
                customer.state = stateFromAddress ? getStateCode(stateFromAddress) : '';
            }
        }
        
        // Always combine address fields back into single address string (for both admin and users)
        // This ensures the address is saved in a consistent format
        const addressParts = [];
        if (address1Field.value) addressParts.push(address1Field.value);
        if (cityField.value) addressParts.push(cityField.value);
        // Use state code for address string
        const stateCode = stateField.value || customer.state || '';
        if (stateCode) {
            const stateName = getStateName(stateCode);
            addressParts.push(stateName || stateCode);
        }
        if (zipCodeField.value) addressParts.push(zipCodeField.value);
        const updatedAddress = addressParts.join(', ') || '';
        customer.address = updatedAddress;
        
        // CRITICAL: Preserve address separately from comments
        // The database only has a 'notes' field, but we need to keep address and comments separate
        // Store address in customer object for frontend display, but only send comments to notes field
        // This prevents comments from overwriting the address
        
        // Save follow-up date and time if status is follow_up
        if (status === 'follow_up') {
            customer.followUpDate = document.getElementById('followUpDate').value;
            
            // Combine hour, minute, and AM/PM into time string
            const hour = document.getElementById('followUpTimeHour').value;
            const minute = document.getElementById('followUpTimeMinute').value;
            const ampm = document.getElementById('followUpTimeAMPM').value;
            
            if (hour && minute) {
                // Format: "HH:MM AM/PM"
                const formattedMinute = String(minute).padStart(2, '0');
                customer.followUpTime = `${hour}:${formattedMinute} ${ampm}`;
            } else {
                customer.followUpTime = '';
            }
        } else {
            // Clear follow-up date and time for other statuses
            customer.followUpDate = '';
            customer.followUpTime = '';
        }
        
        // Save interested value if status is citizen
        if (status === 'citizen') {
            customer.interested = document.getElementById('updateInterested').value || '';
        } else {
            // Clear interested value for other statuses
            customer.interested = '';
        }
        
        // Save refund status if preparation role or admin updated it
        const isPreparation = currentUser && currentUser.role === 'preparation';
        // Note: isAdmin is already declared earlier in this function (line 4988)
        let refundStatus = null;
        
        if (isPreparation || isAdmin) {
            const refundStatusField = document.getElementById('updateCustomerRefundStatus');
            if (refundStatusField) {
                refundStatus = refundStatusField.value || '';
                // Save to sessionStorage (clears when browser closes) keyed by customer email or ID
                const refundStatusKey = `customerRefundStatus_${customer.email || customerId}`;
                if (refundStatus) {
                    sessionStorage.setItem(refundStatusKey, refundStatus);
                    // Also save globally for customer dashboard
                    sessionStorage.setItem('customerRefundStatus', refundStatus);
                } else {
                    sessionStorage.removeItem(refundStatusKey);
                }
            }
        }
        
        // Update customer via API
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Error', 'You must be logged in to update customers');
            return;
        }
        
        // CRITICAL: Only send comments to notes field, NOT the address
        // The address should be preserved separately and not sent to the backend
        // The backend 'notes' field should only contain comments, not address
        // Address is stored in the customer object for frontend display only
        // If refund status is set, use it as the status; otherwise use the regular status
        const finalStatus = refundStatus || status;
        const customerData = {
            name: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
            email: customer.email || null,
            phone: customer.phone || null,
            status: finalStatus,
            assigned_to: customer.assignedTo || customer.assigned_to || null,
            notes: comments || null  // Only send comments, NOT address
        };
        
        try {
            const response = await fetch(API_BASE_URL + '/customers/' + customerId, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(customerData)
            });
            
            if (response.ok) {
                const updated = await response.json();
                // Update local array
                const index = customers.findIndex(c => c.id === customerId);
                if (index !== -1) {
                    // CRITICAL: Preserve address separately from comments
                    // The backend returns 'notes' which contains comments, but we need to keep address separate
                    // The address should remain in the frontend customer object and NOT be overwritten by the API response
                    const existingAddress = customers[index].address || updatedAddress || '';
                    customers[index] = { 
                        ...customers[index], 
                        ...updated, 
                        status, 
                        comments: comments,
                        address: existingAddress  // Always preserve existing address, never overwrite with notes
                    };
                }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('updateStatusModal'));
        modal.hide();
        
        loadAssignWorkTable();
        // Refresh archive modal if it's open
        const archiveModalEl = document.getElementById('archiveModal');
        if (archiveModalEl && archiveModalEl.classList.contains('show')) {
            renderArchiveModal();
        }
        loadDashboard();
        
        // Refresh Top 20 States chart if Progress tab is visible
        const progressTab = document.getElementById('progressTab');
        if (progressTab && progressTab.style.display !== 'none') {
            loadTrafficSection();
        }
        
        showNotification('success', 'Status Updated', 'Customer status has been updated successfully!');
            } else {
                const error = await response.json();
                showNotification('error', 'Error', error.error || 'Failed to update customer');
            }
        } catch (error) {
            console.error('Error updating customer:', error);
            showNotification('error', 'Error', 'Failed to update customer. Please try again.');
        }
    }
}

// Request to edit a field (admin only)
function requestEditField(fieldName) {
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('error', 'Access Denied', 'Only administrators can edit this field.');
        return;
    }
    
    // Store which field we're trying to edit
    document.getElementById('pendingEditField').value = fieldName;
    
    // Show password verification modal
    document.getElementById('adminPasswordInput').value = '';
    const modal = new bootstrap.Modal(document.getElementById('adminPasswordModal'));
    modal.show();
    
    // Focus on password input
    setTimeout(() => {
        document.getElementById('adminPasswordInput').focus();
    }, 500);
}

// Verify admin password
async function verifyAdminPassword() {
    const password = document.getElementById('adminPasswordInput').value;
    const fieldName = document.getElementById('pendingEditField').value;
    
    if (!password) {
        showNotification('error', 'Password Required', 'Please enter your admin password.');
        return;
    }
    
    // Check if current user is admin
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('error', 'Access Denied', 'Only administrators can edit this field.');
        return;
    }
    
    // Verify password - try server first, fallback to dev mode
    const DEV_MODE = true; // Same as in handleLogin
    let passwordValid = false;
    
    try {
        // Try to verify with server
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(API_BASE_URL + '/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: currentUser.username, password }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            passwordValid = true;
        }
    } catch (error) {
        // Server not available - use dev mode
        if (DEV_MODE && (error.name === 'AbortError' || error.message.includes('Failed to fetch'))) {
            // In dev mode, check against users array
            const adminUser = users.find(u => u.username === currentUser.username && u.role === 'admin');
            if (adminUser && adminUser.password === password) {
                passwordValid = true;
            } else {
                // Fallback: if no password stored, allow any password in dev mode for admin
                passwordValid = true;
            }
        }
    }
    
    if (passwordValid) {
        // Enable editing for the field
        enableFieldEdit(fieldName);
        
        // Close password modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('adminPasswordModal'));
        modal.hide();
        
        showNotification('success', 'Password Verified', 'You can now edit this field.');
    } else {
        showNotification('error', 'Incorrect Password', 'The password you entered is incorrect.');
        document.getElementById('adminPasswordInput').value = '';
        document.getElementById('adminPasswordInput').focus();
    }
}

// Parse address string into separate components
function parseAddress(address) {
    if (!address) {
        return { address1: '', city: '', state: '', zipCode: '' };
    }
    
    // Common patterns: "123 Main St, City, State 12345" or "123 Main St, City, State, 12345"
    const parts = address.split(',').map(p => p.trim());
    
    let address1 = '';
    let city = '';
    let state = '';
    let zipCode = '';
    
    if (parts.length >= 1) {
        address1 = parts[0];
    }
    if (parts.length >= 2) {
        city = parts[1];
    }
    if (parts.length >= 3) {
        // State might be with zip code like "CA 12345" or separate
        const stateZip = parts[2].trim();
        const zipMatch = stateZip.match(/(.+?)\s+(\d{5}(?:-\d{4})?)$/);
        if (zipMatch) {
            state = zipMatch[1].trim();
            zipCode = zipMatch[2].trim();
        } else {
            state = stateZip;
            if (parts.length >= 4) {
                zipCode = parts[3];
            }
        }
    }
    
    return { address1, city, state, zipCode };
}

// Get state code from state name or code
function getStateCode(state) {
    if (!state) return '';
    
    const stateMap = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
        'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
        'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
        'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
        'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
        'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
        'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
        'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
    };
    
    // If it's already a code (2 letters), return it
    if (state.length === 2 && stateMap[state.toUpperCase()]) {
        return state.toUpperCase();
    }
    
    // Find code by state name
    for (const [code, name] of Object.entries(stateMap)) {
        if (name.toLowerCase() === state.toLowerCase()) {
            return code;
        }
    }
    
    return '';
}

// Get state name from state code
function getStateName(stateCode) {
    if (!stateCode) return '';
    
    const stateMap = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
        'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
        'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
        'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
        'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
        'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
        'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
        'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
    };
    
    return stateMap[stateCode.toUpperCase()] || stateCode;
}

// Enable editing for a specific field
function enableFieldEdit(fieldName) {
    let fieldId, editIconId;
    
    switch(fieldName) {
        case 'phone':
            fieldId = 'updateCustomerPhone';
            editIconId = 'editPhoneIcon';
            break;
        case 'email':
            fieldId = 'updateCustomerEmail';
            editIconId = 'editEmailIcon';
            break;
        case 'address1':
            fieldId = 'updateCustomerAddress1';
            editIconId = 'editAddress1Icon';
            break;
        case 'city':
            fieldId = 'updateCustomerCity';
            editIconId = 'editCityIcon';
            break;
        case 'state':
            fieldId = 'updateCustomerState';
            editIconId = 'editStateIcon';
            break;
        case 'zipCode':
            fieldId = 'updateCustomerZipCode';
            editIconId = 'editZipCodeIcon';
            break;
        default:
            return;
    }
    
    const field = document.getElementById(fieldId);
    const editIcon = document.getElementById(editIconId);
    
    if (field && editIcon) {
        // Handle select elements differently
        if (fieldName === 'state') {
            field.disabled = false;
        } else {
            field.readOnly = false;
        }
        field.classList.remove('field-view-mode');
        field.classList.add('field-edit-mode');
        field.focus();
        
        // Change edit icon to save icon
        editIcon.classList.remove('fa-edit');
        editIcon.classList.add('fa-save');
        editIcon.setAttribute('onclick', `saveFieldEdit('${fieldName}')`);
    }
}

// Save field edit and return to view mode
function saveFieldEdit(fieldName) {
    let fieldId, editIconId;
    
    switch(fieldName) {
        case 'phone':
            fieldId = 'updateCustomerPhone';
            editIconId = 'editPhoneIcon';
            break;
        case 'email':
            fieldId = 'updateCustomerEmail';
            editIconId = 'editEmailIcon';
            break;
        case 'address1':
            fieldId = 'updateCustomerAddress1';
            editIconId = 'editAddress1Icon';
            break;
        case 'city':
            fieldId = 'updateCustomerCity';
            editIconId = 'editCityIcon';
            break;
        case 'state':
            fieldId = 'updateCustomerState';
            editIconId = 'editStateIcon';
            break;
        case 'zipCode':
            fieldId = 'updateCustomerZipCode';
            editIconId = 'editZipCodeIcon';
            break;
        default:
            return;
    }
    
    const field = document.getElementById(fieldId);
    const editIcon = document.getElementById(editIconId);
    
    if (field && editIcon) {
        // Return to view mode
        if (fieldName === 'state') {
            field.disabled = true;
        } else {
            field.readOnly = true;
        }
        field.classList.remove('field-edit-mode');
        field.classList.add('field-view-mode');
        
        // Change save icon back to edit icon
        editIcon.classList.remove('fa-save');
        editIcon.classList.add('fa-edit');
        editIcon.setAttribute('onclick', `requestEditField('${fieldName}')`);
        
        showNotification('success', 'Field Updated', 'The field will be saved when you click "Update Status".');
    }
}

function toggleAllSelection(checkbox) {
    const checkboxes = document.querySelectorAll('.customer-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

function exportCustomers() {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Name,Phone,Email,Address,Status,Call Status,Comments\n"
        + customers.map(c => 
            `"${c.firstName} ${c.lastName}","${c.phone}","${c.email}","${c.address}","${c.status}","${c.callStatus}","${c.comments || ''}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "customers.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function assignToEmployee(employeeUsername) {
    const selectedCheckboxes = document.querySelectorAll('.customer-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        showNotification('warning', 'No Selection', 'Please select customers to assign.');
        return;
    }
    
    const selectedIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.id));
    const selectedCustomers = customers.filter(c => selectedIds.includes(c.id));
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Error', 'You must be logged in to assign customers');
            return;
        }
        
        // Assign each customer via API
        const assignPromises = selectedCustomers.map(async (customer) => {
            const response = await fetch(API_BASE_URL + '/customers/' + customer.id, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
                    email: customer.email || null,
                    phone: customer.phone || null,
                    status: customer.status || 'pending',
                    assigned_to: employeeUsername,
                    notes: customer.comments || customer.notes || null
                })
            });
            
            if (response.ok) {
                const updated = await response.json();
                // Update local array
                const index = customers.findIndex(c => c.id === customer.id);
                if (index !== -1) {
                    customers[index] = { ...customers[index], ...updated, assignedTo: employeeUsername };
                }
            }
        });
        
        await Promise.all(assignPromises);
        
    loadAssignWorkTable();
    
    // Uncheck all checkboxes
    selectedCheckboxes.forEach(cb => cb.checked = false);
    document.querySelector('input[onchange="toggleAllSelection(this)"]').checked = false;
    
    showNotification('success', 'Assignment Complete', `Assigned ${selectedCustomers.length} customers to ${employeeUsername}`);
    } catch (error) {
        console.error('Error assigning customers:', error);
        showNotification('error', 'Error', 'Failed to assign customers. Please try again.');
    }
}

async function assignToUnassigned() {
    const selectedCheckboxes = document.querySelectorAll('.customer-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        showNotification('warning', 'No Selection', 'Please select customers to unassign.');
        return;
    }
    
    const selectedIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.id));
    const selectedCustomers = customers.filter(c => selectedIds.includes(c.id));
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Error', 'You must be logged in to unassign customers');
            return;
        }
        
        // Unassign each customer via API
        const unassignPromises = selectedCustomers.map(async (customer) => {
            const response = await fetch(API_BASE_URL + '/customers/' + customer.id, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
                    email: customer.email || null,
                    phone: customer.phone || null,
                    status: customer.status || 'pending',
                    assigned_to: null,
                    notes: customer.comments || customer.notes || null
                })
            });
            
            if (response.ok) {
                const updated = await response.json();
                // Update local array
                const index = customers.findIndex(c => c.id === customer.id);
                if (index !== -1) {
                    customers[index] = { ...customers[index], ...updated, assignedTo: null };
                }
            }
        });
        
        await Promise.all(unassignPromises);
        
    loadAssignWorkTable();
    
    // Uncheck all checkboxes
    selectedCheckboxes.forEach(cb => cb.checked = false);
    document.querySelector('input[onchange="toggleAllSelection(this)"]').checked = false;
    
    showNotification('success', 'Unassignment Complete', `Unassigned ${selectedCustomers.length} customers`);
    } catch (error) {
        console.error('Error unassigning customers:', error);
        showNotification('error', 'Error', 'Failed to unassign customers. Please try again.');
    }
}

// Chart Type Management
let chartTypes = {
    status: 'bar',
    call: 'bar'
};

function toggleChartType(chartType, newType) {
    chartTypes[chartType] = newType;
    
    // Update button states
    const barBtn = document.getElementById(chartType + 'BarBtn');
    const pieBtn = document.getElementById(chartType + 'PieBtn');
    
    if (newType === 'bar') {
        barBtn.classList.add('active');
        pieBtn.classList.remove('active');
    } else {
        pieBtn.classList.add('active');
        barBtn.classList.remove('active');
    }
    
    // Adjust container height based on chart type
    adjustChartContainerHeight(chartType, newType);
    
    // Reload charts
    loadProgressCharts();
}

function adjustChartContainerHeight(chartType, chartTypeValue) {
    const container = document.getElementById(chartType === 'status' ? 'progressChart' : 'callStatusChart').closest('.progress-chart-container');
    
    if (chartTypeValue === 'pie') {
        // Pie charts need more space for legends
        container.style.height = '420px';
        container.querySelector('canvas').style.maxHeight = '340px';
    } else {
        // Bar charts need less space for legends
        container.style.height = '380px';
        container.querySelector('canvas').style.maxHeight = '300px';
    }
}

// Progress Charts Functions
function loadProgressCharts() {
    // Set initial container heights based on current chart types
    adjustChartContainerHeight('status', chartTypes.status);
    adjustChartContainerHeight('call', chartTypes.call);
    
    // Customer Status Chart
    const statusData = {
        'Pending': customers.filter(c => c.status === 'pending').length,
        'Potential': customers.filter(c => c.status === 'potential').length,
        'Voice Mail': customers.filter(c => c.status === 'voice_mail').length,
        'W2 Received': customers.filter(c => c.status === 'w2_received').length
    };

    const statusCtx = document.getElementById('progressChart').getContext('2d');
    if (currentChart) {
        currentChart.destroy();
    }
    
    const statusChartConfig = {
        type: chartTypes.status,
        data: {
            labels: Object.keys(statusData),
            datasets: [{
                label: 'Customers',
                data: Object.values(statusData),
                backgroundColor: [
                    'rgba(94, 114, 228, 1)',
                    'rgba(45, 206, 137, 1)',
                    'rgba(245, 54, 92, 1)',
                    'rgba(17, 205, 239, 1)'
                ],
                borderColor: [
                    '#5e72e4',
                    '#2dce89',
                    '#f5365c',
                    '#11cdef'
                ],
                borderWidth: 0,
                borderRadius: 6,
                borderSkipped: false,
                barThickness: 35,
            }]
        },
        options: getChartOptions(chartTypes.status, 'customers')
    };
    
    currentChart = new Chart(statusCtx, statusChartConfig);

    // Call Status Chart
    const callStatusData = {
        'Not Called': customers.filter(c => c.callStatus === 'not_called').length,
        'Called': customers.filter(c => c.callStatus === 'called').length,
        'Voice Mail': customers.filter(c => c.callStatus === 'voice_mail').length,
        'New': customers.filter(c => c.callStatus === 'new').length
    };

    const callStatusCtx = document.getElementById('callStatusChart').getContext('2d');
    if (callStatusChart) {
        callStatusChart.destroy();
    }
    
    const callChartConfig = {
        type: chartTypes.call,
        data: {
            labels: Object.keys(callStatusData),
            datasets: [{
                label: 'Calls',
                data: Object.values(callStatusData),
                backgroundColor: [
                    'rgba(136, 152, 170, 0.8)',
                    'rgba(45, 206, 137, 0.8)',
                    'rgba(245, 54, 92, 0.8)',
                    'rgba(17, 205, 239, 0.8)'
                ],
                borderColor: [
                    '#8898aa',
                    '#2dce89',
                    '#f5365c',
                    '#11cdef'
                ],
                borderWidth: 0,
                borderRadius: 6,
                borderSkipped: false,
                barThickness: 35,
            }]
        },
        options: getChartOptions(chartTypes.call, 'calls')
    };
    
    callStatusChart = new Chart(callStatusCtx, callChartConfig);
}

function getChartOptions(chartType, dataType) {
    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        backgroundColor: 'white',
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    font: {
                        size: 13
                    },
                    boxWidth: 14,
                    boxHeight: 14
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: 'white',
                bodyColor: 'white',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                    title: function(context) {
                        return context[0].label;
                    },
                    label: function(context) {
                        if (chartType === 'pie') {
                            return context.parsed + ' ' + dataType;
                        }
                        return context.parsed.y + ' ' + dataType;
                    }
                }
            }
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
        }
    };

    if (chartType === 'bar') {
        baseOptions.scales = {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#8898aa',
                    font: {
                        size: 12
                    }
                },
                display: true
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                    drawBorder: false
                },
                ticks: {
                    color: '#8898aa',
                    font: {
                        size: 12
                    },
                    stepSize: 0.5,
                    callback: function(value) {
                        return value;
                    }
                }
            }
        };
    }

    return baseOptions;
}

// Reports Functions
function generateReport(reportType) {
    switch(reportType) {
        case 'customer':
            exportCustomerReport();
            break;
        case 'call':
            exportCallReport();
            break;
        case 'performance':
            exportPerformanceReport();
            break;
    }
}

// Export Customer Report to Excel
function exportCustomerReport() {
    showNotification('info', 'Customer Report', 'Generating customer analysis report...');
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "CUSTOMER ANALYSIS REPORT\n";
    csvContent += "Generated: " + new Date().toLocaleString() + "\n\n";
    
    // Customer Status Distribution
    csvContent += "CUSTOMER STATUS DISTRIBUTION\n";
    csvContent += "Status,Count,Percentage\n";
    const statusCounts = {};
    customers.forEach(c => {
        const status = c.status || 'pending';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    const totalCustomers = customers.length;
    Object.keys(statusCounts).sort().forEach(status => {
        const count = statusCounts[status];
        const percentage = totalCustomers > 0 ? ((count / totalCustomers) * 100).toFixed(2) : '0.00';
        csvContent += `"${getStatusDisplayName(status)}",${count},${percentage}%\n`;
    });
    csvContent += `"Total",${totalCustomers},100.00%\n\n`;
    
    // Customer Details
    csvContent += "CUSTOMER DETAILS\n";
    csvContent += "Name,Phone,Email,Address,Status,Call Status,Assigned To,Comments\n";
    customers.forEach(c => {
        const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
        csvContent += `"${name}","${c.phone || ''}","${c.email || ''}","${c.address || ''}","${getStatusDisplayName(c.status || 'pending')}","${c.callStatus || 'not_called'}","${c.assignedTo || 'Unassigned'}","${(c.comments || '').replace(/"/g, '""')}"\n`;
    });
    
    downloadCSVFile(csvContent, `Customer_Report_${new Date().toISOString().split('T')[0]}.csv`);
    setTimeout(() => {
        showNotification('success', 'Report Generated', 'Customer report exported successfully!');
    }, 500);
}

// Export Call Report to Excel
function exportCallReport() {
    showNotification('info', 'Call Report', 'Generating call activity report...');
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "CALL ACTIVITY REPORT\n";
    csvContent += "Generated: " + new Date().toLocaleString() + "\n\n";
    
    // Call Status Distribution
    csvContent += "CALL STATUS DISTRIBUTION\n";
    csvContent += "Call Status,Count,Percentage\n";
    const callStatusCounts = {
        'not_called': customers.filter(c => !c.callStatus || c.callStatus === 'not_called').length,
        'called': customers.filter(c => c.callStatus === 'called').length,
        'voice_mail': customers.filter(c => c.callStatus === 'voice_mail').length,
        'new': customers.filter(c => c.callStatus === 'new').length
    };
    const total = customers.length;
    Object.keys(callStatusCounts).forEach(status => {
        const count = callStatusCounts[status];
        const percentage = total > 0 ? ((count / total) * 100).toFixed(2) : '0.00';
        const displayName = status === 'not_called' ? 'Not Called' : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
        csvContent += `"${displayName}",${count},${percentage}%\n`;
    });
    csvContent += `"Total",${total},100.00%\n\n`;
    
    // Customers by Call Status
    csvContent += "CUSTOMERS BY CALL STATUS\n";
    csvContent += "Name,Phone,Email,Call Status,Last Contact\n";
    customers.forEach(c => {
        const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
        const callStatus = c.callStatus || 'not_called';
        const displayStatus = callStatus === 'not_called' ? 'Not Called' : callStatus.charAt(0).toUpperCase() + callStatus.slice(1).replace('_', ' ');
        csvContent += `"${name}","${c.phone || ''}","${c.email || ''}","${displayStatus}","${c.lastContact || 'N/A'}"\n`;
    });
    
    downloadCSVFile(csvContent, `Call_Report_${new Date().toISOString().split('T')[0]}.csv`);
    setTimeout(() => {
        showNotification('success', 'Report Generated', 'Call report exported successfully!');
    }, 500);
}

// Export Performance Report to Excel
function exportPerformanceReport() {
    showNotification('info', 'Performance Report', 'Generating team performance report...');
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "TEAM PERFORMANCE REPORT\n";
    csvContent += "Generated: " + new Date().toLocaleString() + "\n\n";
    
    // Employee Performance
    csvContent += "EMPLOYEE PERFORMANCE\n";
    csvContent += "Employee,Assigned Customers,Completed,In Progress,Pending\n";
    
    const employeeStats = {};
    customers.forEach(c => {
        const assignedTo = c.assignedTo || 'Unassigned';
        if (!employeeStats[assignedTo]) {
            employeeStats[assignedTo] = {
                total: 0,
                completed: 0,
                inProgress: 0,
                pending: 0
            };
        }
        employeeStats[assignedTo].total++;
        const status = c.status || 'pending';
        if (status === 'w2_received' || status === 'citizen') {
            employeeStats[assignedTo].completed++;
        } else if (status === 'follow_up' || status === 'call_back' || status === 'interested') {
            employeeStats[assignedTo].inProgress++;
        } else {
            employeeStats[assignedTo].pending++;
        }
    });
    
    Object.keys(employeeStats).sort().forEach(employee => {
        const stats = employeeStats[employee];
        csvContent += `"${employee}",${stats.total},${stats.completed},${stats.inProgress},${stats.pending}\n`;
    });
    csvContent += "\n";
    
    // Overall Statistics
    csvContent += "OVERALL STATISTICS\n";
    csvContent += "Metric,Value\n";
    csvContent += `"Total Customers",${customers.length}\n`;
    csvContent += `"Total Employees",${Object.keys(employeeStats).filter(e => e !== 'Unassigned').length}\n`;
    csvContent += `"Unassigned Customers",${employeeStats['Unassigned'] ? employeeStats['Unassigned'].total : 0}\n`;
    csvContent += `"Assigned Customers",${customers.filter(c => c.assignedTo).length}\n`;
    
    downloadCSVFile(csvContent, `Performance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    setTimeout(() => {
        showNotification('success', 'Report Generated', 'Performance report exported successfully!');
    }, 500);
}

function generateQuickReport(reportType) {
    switch(reportType) {
        case 'status':
            exportStatusDistributionReport();
            break;
        case 'monthly':
            exportMonthlySummaryReport();
            break;
        case 'employee':
            exportEmployeePerformanceReport();
            break;
        case 'export':
            exportAllData();
            break;
    }
}

// Export Status Distribution Report
function exportStatusDistributionReport() {
    showNotification('info', 'Status Report', 'Generating status distribution report...');
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "STATUS DISTRIBUTION REPORT\n";
    csvContent += "Generated: " + new Date().toLocaleString() + "\n\n";
    
    csvContent += "Status,Count,Percentage\n";
    const statusCounts = {};
    customers.forEach(c => {
        const status = c.status || 'pending';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    const total = customers.length;
    Object.keys(statusCounts).sort().forEach(status => {
        const count = statusCounts[status];
        const percentage = total > 0 ? ((count / total) * 100).toFixed(2) : '0.00';
        csvContent += `"${getStatusDisplayName(status)}",${count},${percentage}%\n`;
    });
    csvContent += `"Total",${total},100.00%\n`;
    
    downloadCSVFile(csvContent, `Status_Distribution_Report_${new Date().toISOString().split('T')[0]}.csv`);
    setTimeout(() => {
        showNotification('success', 'Report Ready', 'Status distribution report exported successfully!');
    }, 500);
}

// Export Monthly Summary Report
function exportMonthlySummaryReport() {
    showNotification('info', 'Monthly Report', 'Generating monthly summary report...');
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "MONTHLY SUMMARY REPORT\n";
    csvContent += "Generated: " + new Date().toLocaleString() + "\n\n";
    
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthlyData = {};
    
    customers.forEach(c => {
        const dateField = c.createdAt || c.createdDate;
        if (dateField) {
            const date = new Date(dateField);
            if (!isNaN(date.getTime())) {
                const month = date.getMonth();
                const monthName = months[month];
                if (!monthlyData[monthName]) {
                    monthlyData[monthName] = 0;
                }
                monthlyData[monthName]++;
            }
        }
    });
    
    csvContent += "Month,Customer Count\n";
    months.forEach(month => {
        csvContent += `"${month}",${monthlyData[month] || 0}\n`;
    });
    csvContent += `"Total",${customers.length}\n`;
    
    downloadCSVFile(csvContent, `Monthly_Summary_Report_${new Date().toISOString().split('T')[0]}.csv`);
    setTimeout(() => {
        showNotification('success', 'Report Ready', 'Monthly summary report exported successfully!');
    }, 500);
}

// Export Employee Performance Report
function exportEmployeePerformanceReport() {
    showNotification('info', 'Employee Report', 'Generating employee performance report...');
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "EMPLOYEE PERFORMANCE REPORT\n";
    csvContent += "Generated: " + new Date().toLocaleString() + "\n\n";
    
    csvContent += "Employee,Total Assigned,Completed,In Progress,Pending,Completion Rate\n";
    
    const employeeStats = {};
    customers.forEach(c => {
        const assignedTo = c.assignedTo || 'Unassigned';
        if (!employeeStats[assignedTo]) {
            employeeStats[assignedTo] = {
                total: 0,
                completed: 0,
                inProgress: 0,
                pending: 0
            };
        }
        employeeStats[assignedTo].total++;
        const status = c.status || 'pending';
        if (status === 'w2_received' || status === 'citizen') {
            employeeStats[assignedTo].completed++;
        } else if (status === 'follow_up' || status === 'call_back' || status === 'interested') {
            employeeStats[assignedTo].inProgress++;
        } else {
            employeeStats[assignedTo].pending++;
        }
    });
    
    Object.keys(employeeStats).sort().forEach(employee => {
        const stats = employeeStats[employee];
        const completionRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(2) : '0.00';
        csvContent += `"${employee}",${stats.total},${stats.completed},${stats.inProgress},${stats.pending},${completionRate}%\n`;
    });
    
    downloadCSVFile(csvContent, `Employee_Performance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    setTimeout(() => {
        showNotification('success', 'Report Ready', 'Employee performance report exported successfully!');
    }, 500);
}

// Export All Data
function exportAllData() {
    showNotification('info', 'Data Export', 'Preparing data export...');
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "COMPLETE DATA EXPORT\n";
    csvContent += "Generated: " + new Date().toLocaleString() + "\n\n";
    
    csvContent += "Name,Phone,Email,Address,Status,Call Status,Assigned To,Comments,Refund Status\n";
    customers.forEach(c => {
        const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
        const refundStatusKey = `customerRefundStatus_${c.email || c.id}`;
        let refundStatus = sessionStorage.getItem(refundStatusKey);
        if (!refundStatus) {
            refundStatus = sessionStorage.getItem('customerRefundStatus');
        }
        const refundStatusDisplay = refundStatus ? getRefundStatusDisplayName(refundStatus) : '';
        csvContent += `"${name}","${c.phone || ''}","${c.email || ''}","${c.address || ''}","${getStatusDisplayName(c.status || 'pending')}","${c.callStatus || 'not_called'}","${c.assignedTo || 'Unassigned'}","${(c.comments || '').replace(/"/g, '""')}","${refundStatusDisplay}"\n`;
    });
    
    downloadCSVFile(csvContent, `Complete_Data_Export_${new Date().toISOString().split('T')[0]}.csv`);
    setTimeout(() => {
        showNotification('success', 'Export Ready', 'Complete data export completed successfully!');
    }, 500);
}

function generateCustomReport() {
    const reportsTab = document.getElementById('reportsTab');
    if (!reportsTab) return;
    
    const dateRangeSelect = reportsTab.querySelector('select');
    const formatSelect = reportsTab.querySelectorAll('select')[1];
    const includeChartsCheckbox = reportsTab.querySelector('input[type="checkbox"]');
    
    if (!dateRangeSelect || !formatSelect) {
        showNotification('error', 'Error', 'Could not find report settings.');
        return;
    }
    
    const dateRange = dateRangeSelect.value;
    const format = formatSelect.value;
    const includeCharts = includeChartsCheckbox ? includeChartsCheckbox.checked : false;
    
    showNotification('info', 'Custom Report', `Generating ${format} report for ${dateRange}...`);
    
    // Filter customers based on date range
    let filteredCustomers = [...customers];
    const now = new Date();
    
    if (dateRange !== 'Custom range') {
        const daysMap = {
            'Last 7 days': 7,
            'Last 30 days': 30,
            'Last 3 months': 90,
            'Last 6 months': 180,
            'Last year': 365
        };
        
        if (daysMap[dateRange]) {
            const daysAgo = new Date(now);
            daysAgo.setDate(daysAgo.getDate() - daysMap[dateRange]);
            filteredCustomers = customers.filter(c => {
                const dateField = c.createdAt || c.createdDate;
                if (!dateField) return false;
                const customerDate = new Date(dateField);
                return !isNaN(customerDate.getTime()) && customerDate >= daysAgo;
            });
        }
    }
    
    // Generate report based on format
    if (format === 'Excel' || format === 'CSV') {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += `CUSTOM REPORT - ${dateRange}\n`;
        csvContent += "Generated: " + new Date().toLocaleString() + "\n";
        csvContent += `Format: ${format}\n`;
        csvContent += `Include Charts: ${includeCharts ? 'Yes' : 'No'}\n\n`;
        
        // Summary Statistics
        csvContent += "SUMMARY STATISTICS\n";
        csvContent += "Metric,Value\n";
        csvContent += `"Date Range",${dateRange}\n`;
        csvContent += `"Total Customers in Range",${filteredCustomers.length}\n`;
        csvContent += `"Total Customers (All Time)",${customers.length}\n\n`;
        
        // Status Distribution
        if (includeCharts) {
            csvContent += "STATUS DISTRIBUTION\n";
            csvContent += "Status,Count,Percentage\n";
            const statusCounts = {};
            filteredCustomers.forEach(c => {
                const status = c.status || 'pending';
                statusCounts[status] = (statusCounts[status] || 0) + 1;
            });
            const total = filteredCustomers.length;
            Object.keys(statusCounts).sort().forEach(status => {
                const count = statusCounts[status];
                const percentage = total > 0 ? ((count / total) * 100).toFixed(2) : '0.00';
                csvContent += `"${getStatusDisplayName(status)}",${count},${percentage}%\n`;
            });
            csvContent += "\n";
        }
        
        // Customer Details
        csvContent += "CUSTOMER DETAILS\n";
        csvContent += "Name,Phone,Email,Address,Status,Call Status,Assigned To,Comments\n";
        filteredCustomers.forEach(c => {
            const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
            csvContent += `"${name}","${c.phone || ''}","${c.email || ''}","${c.address || ''}","${getStatusDisplayName(c.status || 'pending')}","${c.callStatus || 'not_called'}","${c.assignedTo || 'Unassigned'}","${(c.comments || '').replace(/"/g, '""')}"\n`;
        });
        
        const fileExtension = format === 'Excel' ? 'csv' : 'csv';
        downloadCSVFile(csvContent, `Custom_Report_${dateRange.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${fileExtension}`);
    } else if (format === 'PDF') {
        // For PDF, we'll create a text-based report that can be printed to PDF
        showNotification('info', 'PDF Export', 'PDF export will generate a printable report. Please use your browser\'s print function to save as PDF.');
        setTimeout(() => {
            window.print();
        }, 500);
        return;
    }
    
    setTimeout(() => {
        showNotification('success', 'Report Generated', `Custom ${format} report exported successfully!`);
    }, 500);
}

// Helper function to download CSV file
function downloadCSVFile(csvContent, filename) {
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// User Management Functions
// Switch between Customers Login and Company Logins tabs
function switchUserManagementTab(tabType) {
    loadUserManagementTable(tabType);
}

function loadUserManagementTable(activeTab = 'customers') {
    if (currentUser.role !== 'admin') return;
    
    // Filter users by role
    const customerUsers = users.filter(user => user.role === 'customer');
    const companyUsers = users.filter(user => 
        user.role === 'admin' || 
        user.role === 'employee' || 
        user.role === 'preparation'
    );
    
    // Helper function to render user row
    const renderUserRow = (user) => {
        let roleBadgeClass = 'success'; // default for employee
        if (user.role === 'admin') {
            roleBadgeClass = 'primary';
        } else if (user.role === 'preparation') {
            roleBadgeClass = 'info';
        } else if (user.role === 'customer') {
            roleBadgeClass = 'secondary';
        }
        
        return `
        <tr>
            <td>${user.username}</td>
            <td><span class="badge bg-${roleBadgeClass}">${user.role}</span></td>
            <td><span class="badge bg-${user.locked ? 'danger' : 'success'}">${user.locked ? 'Locked' : 'Active'}</span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="toggleUserLock('${user.username}')">
                    <i class="fas fa-${user.locked ? 'unlock' : 'lock'}"></i>
                </button>
                ${user.username !== currentUser.username ? `
                    <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.username}')">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </td>
        </tr>
    `;
    };
    
    // Update tab labels with counts
    const customersTab = document.getElementById('customersLoginTab');
    const companyTab = document.getElementById('companyLoginsTab');
    if (customersTab) {
        // Find or create the text span and badge
        let textSpan = customersTab.querySelector('span:not(.badge)');
        let badge = customersTab.querySelector('.badge');
        
        if (!textSpan) {
            // Create structure if it doesn't exist
            const icon = customersTab.querySelector('i') || document.createElement('i');
            icon.className = 'fas fa-users';
            customersTab.innerHTML = '';
            customersTab.appendChild(icon);
            textSpan = document.createElement('span');
            customersTab.appendChild(textSpan);
        }
        
        textSpan.textContent = 'Customers Logins ';
        
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge bg-secondary';
            textSpan.appendChild(badge);
        }
        badge.textContent = customerUsers.length;
    }
    
    if (companyTab) {
        // Find or create the text span and badge
        let textSpan = companyTab.querySelector('span:not(.badge)');
        let badge = companyTab.querySelector('.badge');
        
        if (!textSpan) {
            // Create structure if it doesn't exist
            const icon = companyTab.querySelector('i') || document.createElement('i');
            icon.className = 'fas fa-building';
            companyTab.innerHTML = '';
            companyTab.appendChild(icon);
            textSpan = document.createElement('span');
            companyTab.appendChild(textSpan);
        }
        
        textSpan.textContent = 'Company Logins ';
        
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge bg-secondary';
            textSpan.appendChild(badge);
        }
        badge.textContent = companyUsers.length;
    }
    
    // Load Customers Login table
    const customersTbody = document.getElementById('customersLoginTable');
    if (customersTbody) {
        if (customerUsers.length === 0) {
            customersTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No customer logins found</td></tr>';
        } else {
            customersTbody.innerHTML = customerUsers.map(renderUserRow).join('');
        }
    }
    
    // Load Company Logins table
    const companyTbody = document.getElementById('companyLoginsTable');
    if (companyTbody) {
        if (companyUsers.length === 0) {
            companyTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No company logins found</td></tr>';
        } else {
            companyTbody.innerHTML = companyUsers.map(renderUserRow).join('');
        }
    }
    
    // Update active tab if specified
    if (activeTab === 'company') {
        const companyTab = document.getElementById('companyLoginsTab');
        const customersTab = document.getElementById('customersLoginTab');
        if (companyTab && customersTab) {
            customersTab.classList.remove('active');
            companyTab.classList.add('active');
            document.getElementById('customersLoginContent').classList.remove('show', 'active');
            document.getElementById('companyLoginsContent').classList.add('show', 'active');
        }
    } else {
        const companyTab = document.getElementById('companyLoginsTab');
        const customersTab = document.getElementById('customersLoginTab');
        if (companyTab && customersTab) {
            companyTab.classList.remove('active');
            customersTab.classList.add('active');
            document.getElementById('companyLoginsContent').classList.remove('show', 'active');
            document.getElementById('customersLoginContent').classList.add('show', 'active');
        }
    }
}

// Store password value as user types (workaround for browser security/autofill issues)
let storedPasswordValue = '';

function showAddUserModal() {
    // Reset stored password
    storedPasswordValue = '';
    
    const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
    modal.show();
    
    // Wait for modal to be fully shown, then attach event listeners
    setTimeout(() => {
        const passwordInput = document.getElementById('newPassword');
        if (passwordInput) {
            // Remove any existing listeners by cloning and replacing (preserves all attributes)
            const newPasswordInput = passwordInput.cloneNode(true);
            passwordInput.parentNode.replaceChild(newPasswordInput, passwordInput);
            
            // Add input event listener to capture password value in real-time
            newPasswordInput.addEventListener('input', function(e) {
                storedPasswordValue = e.target.value || '';
                console.log('✅ Password input event - Value captured:', storedPasswordValue ? '***' + storedPasswordValue.length + ' chars***' : 'EMPTY');
            }, { capture: true });
            
            // Also capture on change event
            newPasswordInput.addEventListener('change', function(e) {
                storedPasswordValue = e.target.value || '';
                console.log('✅ Password change event - Value captured:', storedPasswordValue ? '***' + storedPasswordValue.length + ' chars***' : 'EMPTY');
            }, { capture: true });
            
            // Capture on keyup as well (for better compatibility)
            newPasswordInput.addEventListener('keyup', function(e) {
                storedPasswordValue = e.target.value || '';
                console.log('✅ Password keyup event - Value captured:', storedPasswordValue ? '***' + storedPasswordValue.length + ' chars***' : 'EMPTY');
            }, { capture: true });
            
            console.log('✅ Password input event listeners attached');
        } else {
            console.error('❌ Password input element not found when attaching listeners');
        }
    }, 100);
}

async function saveNewUser(event) {
    // Prevent any form submission
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const usernameInput = document.getElementById('newUsername');
    const passwordInput = document.getElementById('newPassword');
    const roleInput = document.getElementById('newUserRole');
    
    if (!usernameInput || !passwordInput || !roleInput) {
        console.error('Form elements not found:', { 
            usernameInput: !!usernameInput, 
            passwordInput: !!passwordInput, 
            roleInput: !!roleInput 
        });
        showNotification('error', 'Form Error', 'Could not find form fields. Please refresh the page.');
        return false;
    }
    
    // Small delay to ensure browser has processed the input value
    // This helps with browser autofill and timing issues
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Get values directly from inputs - read fresh values multiple times to ensure we get it
    const username = (usernameInput.value || '').trim();
    
    // Read password value - try multiple ways to ensure we get it
    // Password fields can be tricky with browser security and autofill
    let password = '';
    
    // Method 1: Use stored value from input event listener (most reliable)
    if (storedPasswordValue && storedPasswordValue.length > 0) {
        password = storedPasswordValue;
        console.log('✅ Method 1: Using stored password value from input listener -', password.length, 'chars');
    }
    
    // Method 2: Try using FormData (can sometimes bypass browser restrictions)
    if (!password || password.length === 0) {
        try {
            const form = document.getElementById('addUserForm');
            if (form) {
                const formData = new FormData(form);
                const formPassword = formData.get('newPassword') || formData.get('password') || '';
                if (formPassword && formPassword.length > 0) {
                    password = formPassword;
                    console.log('✅ Method 2: Using password from FormData -', password.length, 'chars');
                }
            }
        } catch (e) {
            console.warn('Could not read password from FormData:', e);
        }
    }
    
    // Method 3: Direct value access from input element
    if (!password || password.length === 0) {
        try {
            const directValue = passwordInput.value;
            if (directValue && directValue.length > 0) {
                password = directValue;
                console.log('✅ Method 3: Using password value from input element -', password.length, 'chars');
            }
        } catch (e) {
            console.warn('Could not read password value (method 3):', e);
        }
    }
    
    // Method 4: If still empty, try reading after a tiny delay (browser might still be processing)
    if (!password || password.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
        try {
            const delayedValue = passwordInput.value;
            if (delayedValue && delayedValue.length > 0) {
                password = delayedValue;
                console.log('✅ Method 4: Using password value after delay -', password.length, 'chars');
            }
        } catch (e) {
            console.warn('Could not read password value (method 4):', e);
        }
    }
    
    // Method 5: Try accessing the value property directly one more time
    if (!password || password.length === 0) {
        try {
            const inputValue = passwordInput.value;
            if (inputValue && typeof inputValue === 'string' && inputValue.length > 0) {
                password = inputValue;
                console.log('✅ Method 5: Using password value from direct access -', password.length, 'chars');
            }
        } catch (e) {
            console.warn('Could not read password value (method 5):', e);
        }
    }
    
    const role = roleInput.value || '';
    
    // Debug logging with detailed info
    console.log('🔍 Creating new user - Input values:', { 
        username: username,
        usernameLength: username.length,
        password: password ? '***' + password.length + ' chars***' : 'EMPTY',
        passwordLength: password ? password.length : 0,
        passwordType: typeof password,
        passwordIsString: typeof password === 'string',
        role: role,
        passwordInputExists: !!passwordInput,
        passwordInputValue: passwordInput.value ? '***' + passwordInput.value.length + ' chars***' : 'EMPTY',
        passwordInputType: passwordInput.type,
        passwordInputAttribute: passwordInput.getAttribute('value') || 'no attribute',
        storedPasswordValue: storedPasswordValue ? '***' + storedPasswordValue.length + ' chars***' : 'EMPTY',
        storedPasswordLength: storedPasswordValue ? storedPasswordValue.length : 0
    });
    
    // Additional validation: Check if password "Master@123" would be valid
    if (password && password.length > 0) {
        console.log('✅ Password found! Length:', password.length);
        console.log('✅ Password validation check:', {
            hasLength: password.length >= 6,
            hasUppercase: /[A-Z]/.test(password),
            hasLowercase: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
            isValid: password.length >= 6,
            passwordPreview: password.substring(0, 2) + '***' + password.substring(password.length - 1)
        });
        
        // If password is "Master@123", confirm it's valid
        if (password === 'Master@123') {
            console.log('✅ CONFIRMED: Password "Master@123" is VALID and has been captured successfully!');
        }
    } else {
        console.error('❌ NO PASSWORD FOUND! All methods failed to capture password value.');
        console.error('🔍 DEBUGGING INFO:', {
            passwordInputElement: passwordInput,
            passwordInputValue: passwordInput ? passwordInput.value : 'NO ELEMENT',
            passwordInputValueLength: passwordInput ? (passwordInput.value ? passwordInput.value.length : 0) : 0,
            storedPasswordValue: storedPasswordValue,
            storedPasswordLength: storedPasswordValue ? storedPasswordValue.length : 0,
            allInputsInForm: Array.from(document.querySelectorAll('#addUserForm input')).map(inp => ({
                id: inp.id,
                type: inp.type,
                value: inp.type === 'password' ? '***' : inp.value,
                valueLength: inp.value ? inp.value.length : 0
            }))
        });
    }
    
    // Enhanced validation
    if (!username || username.length === 0) {
        showNotification('error', 'Missing Information', 'Username is required!');
        usernameInput.focus();
        return false;
    }
    
    // Final password read - try one more time right before validation
    // This is the absolute last chance to get the password value
    if (!password || password.length === 0) {
        // Try reading directly from the input element one final time
        const finalRead = passwordInput.value;
        if (finalRead && finalRead.length > 0) {
            password = finalRead;
            console.log('✅ Final password read successful - got', password.length, 'characters');
        } else if (storedPasswordValue && storedPasswordValue.length > 0) {
            password = storedPasswordValue;
            console.log('✅ Using stored password value - got', password.length, 'characters');
        }
    }
    
    // Final validation - check if password exists and has content
    if (!password || typeof password !== 'string' || password.length === 0) {
        console.error('❌ Password validation failed - ALL METHODS FAILED - Details:', { 
                password: password,
                passwordValue: passwordInput.value,
                passwordLength: password ? password.length : 0,
                passwordType: typeof password,
                isNull: password === null,
                isUndefined: password === undefined,
                isEmptyString: password === '',
                storedPasswordValue: storedPasswordValue ? '***' + storedPasswordValue.length + ' chars***' : 'EMPTY',
                storedPasswordLength: storedPasswordValue ? storedPasswordValue.length : 0,
                finalPasswordAttempt: finalPasswordAttempt ? '***' + finalPasswordAttempt.length + ' chars***' : 'EMPTY',
                inputElement: passwordInput,
                inputValue: passwordInput.value,
                inputValueLength: passwordInput.value ? passwordInput.value.length : 0,
                inputElementType: passwordInput.type,
                inputElementId: passwordInput.id,
                inputElementName: passwordInput.name,
                inputElementClass: passwordInput.className,
                inputElementValue: passwordInput.value,
                inputElementValueType: typeof passwordInput.value
            });
            
            // Show a more helpful error message
            showNotification('error', 'Missing Information', 'Password is required! Please type your password in the password field and try again. If you have entered a password, please try typing it again.');
            
            // Don't clear the field - let user see what they typed
            passwordInput.focus();
            passwordInput.select();
            return false;
        }
    }
    
    // Check minimum length
    if (password.length < 6) {
        showNotification('error', 'Invalid Password', 'Password must be at least 6 characters long!');
        passwordInput.focus();
        return false;
    }
    
    if (!role) {
        showNotification('error', 'Missing Information', 'Role is required!');
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Authentication Error', 'You must be logged in to create users.');
            return;
        }
        
        // Check if username exists in current users list
        if (users.find(u => u.username === username)) {
            showNotification('error', 'Username Exists', 'Username already exists!');
            return;
        }
        
        // Create user via API
        const response = await fetch(API_BASE_URL + '/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, password, role })
        });
        
        if (response.ok) {
            const newUser = await response.json();
            // Reload users from server
            await loadUsers();
            
            // Refresh employee dropdown if the new user is employee or preparation role
            if (role === 'employee' || role === 'preparation') {
                loadEmployeeDropdown();
            }
            
            // Hide modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addUserModal'));
            modal.hide();
            
            // Reset form (but don't clear if there was an error)
            const form = document.getElementById('addUserForm');
            if (form) {
                form.reset();
            }
            
            // Reload table - switch to appropriate tab based on role
            const tabToShow = (role === 'employee' || role === 'preparation' || role === 'admin') ? 'company' : 'customers';
            loadUserManagementTable(tabToShow);
            
            showNotification('success', 'User Added', 'New user has been added successfully!');
        } else {
            const error = await response.json();
            showNotification('error', 'Failed to Create User', error.error || 'Could not create user. Please try again.');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showNotification('error', 'Connection Error', 'Could not connect to server. Please check your connection.');
    }
}

async function toggleUserLock(username) {
    try {
        const user = users.find(u => u.username === username);
        if (!user) {
            showNotification('error', 'User Not Found', 'User not found!');
            return;
        }
        
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Authentication Error', 'You must be logged in.');
            return;
        }
        
        const newLockedStatus = !user.locked;
        
        const response = await fetch(API_BASE_URL + '/users/' + user.id, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                username: user.username,
                role: user.role,
                locked: newLockedStatus
            })
        });
        
        if (response.ok) {
            await loadUsers();
            loadUserManagementTable();
            
            // Refresh employee dropdown if the user is employee or preparation role
            if (user.role === 'employee' || user.role === 'preparation') {
                loadEmployeeDropdown();
            }
            
            showNotification('success', 'User Status Changed', `User ${newLockedStatus ? 'locked' : 'unlocked'} successfully!`);
        } else {
            const error = await response.json();
            showNotification('error', 'Failed to Update', error.error || 'Could not update user status.');
        }
    } catch (error) {
        console.error('Error toggling user lock:', error);
        showNotification('error', 'Connection Error', 'Could not connect to server.');
    }
}

function deleteUser(username) {
    // Create custom confirmation modal
    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal fade';
    confirmModal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Confirm Deletion</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to delete user "<strong>${username}</strong>"?</p>
                    <p class="text-muted">This action cannot be undone.</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" onclick="confirmDeleteUser('${username}')">Delete User</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(confirmModal);
    const modal = new bootstrap.Modal(confirmModal);
    modal.show();
    
    confirmModal.addEventListener('hidden.bs.modal', function() {
        document.body.removeChild(confirmModal);
    });
}

async function confirmDeleteUser(username) {
    try {
        const user = users.find(u => u.username === username);
        if (!user) {
            showNotification('error', 'User Not Found', 'User not found!');
            return;
        }
        
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Authentication Error', 'You must be logged in.');
            return;
        }
        
        const response = await fetch(API_BASE_URL + '/users/' + user.id, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            await loadUsers();
            loadUserManagementTable();
            
            // Refresh employee dropdown if the deleted user was employee or preparation role
            if (user.role === 'employee' || user.role === 'preparation') {
                loadEmployeeDropdown();
            }
            
            // Close modal
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            });
            
            showNotification('success', 'User Deleted', 'User has been deleted successfully!');
        } else {
            const error = await response.json();
            showNotification('error', 'Failed to Delete', error.error || 'Could not delete user.');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('error', 'Connection Error', 'Could not connect to server.');
    }
}

// Helper Functions
function getCustomersByStatus(status) {
    return customers.filter(c => c.status === status);
}

function getCustomersByCallStatus(status) {
    return customers.filter(c => c.callStatus === status);
}

function getFollowUpCustomers() {
    // Customers who have been called but need follow-up (not completed with w2_received)
    return customers.filter(c => {
        return (c.callStatus === 'called' || c.callStatus === 'voice_mail') && 
               c.status !== 'w2_received';
    });
}

function getStatusBadgeColor(status) {
    const colors = {
        'pending': 'warning',
        'potential': 'info',
        'voice_mail': 'secondary',
        'w2_received': 'success',
        'follow_up': 'primary',
        'call_back': 'info',
        'not_in_service': 'danger',
        'citizen': 'success',
        'dnd': 'warning',
        'interested': 'success',
        'archived': 'secondary'
    };
    return colors[status] || 'secondary';
}

function getStatusDisplayName(status) {
    const displayNames = {
        'pending': 'Pending',
        'potential': 'Potential',
        'voice_mail': 'Voice Mail',
        'w2_received': 'W2 Received',
        'follow_up': 'Follow-Up',
        'call_back': 'Call Back',
        'not_in_service': 'Not in Service',
        'citizen': 'Citizen',
        'dnd': 'DND',
        'interested': 'Interested',
        'archived': 'Archived'
    };
    return displayNames[status] || status;
}

function getRefundStatusDisplayName(refundStatus) {
    const displayNames = {
        'in_discussions': 'In Discussions',
        'received_w2': 'Received W2',
        'preparing_quote': 'Preparing Quote',
        'quote_sent': 'Quote Sent to Customer',
        'customer_approved': 'Customer Approved for Filing Taxes',
        'taxes_filed': 'Taxes Filed'
    };
    return displayNames[refundStatus] || refundStatus;
}

function getCallStatusBadgeColor(status) {
    const colors = {
        'not_called': 'danger',
        'called': 'success',
        'voice_mail': 'warning',
        'new': 'primary'
    };
    return colors[status] || 'secondary';
}

function generateCustomerTableRows(customerList) {
    return customerList.map(customer => `
        <tr ondblclick="openUpdateStatusModal(${customer.id})" style="cursor: pointer;" title="Double-click to view details">
            <td>${customer.firstName} ${customer.lastName}</td>
            <td>${customer.phone}</td>
            <td>${customer.email}</td>
            <td>${customer.address}</td>
            <td><span class="badge bg-${getStatusBadgeColor(customer.status)}">${getStatusDisplayName(customer.status)}</span></td>
            <td><span class="badge bg-${getCallStatusBadgeColor(customer.callStatus)}">${customer.callStatus}</span></td>
            <td>${customer.comments || '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); openUpdateStatusModal(${customer.id})">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// LocalStorage Functions
// IndexedDB lightweight KV helpers
function openCrmDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('crm_db', 1);
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('kv')) {
                db.createObjectStore('kv');
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function idbSet(key, value) {
    return openCrmDb().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    }));
}

function idbGet(key) {
    return openCrmDb().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readonly');
        const req = tx.objectStore('kv').get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    }));
}

// Bulk upload customers to server (for large files - 300K+ records)
async function bulkUploadCustomers(customersData) {
    try {
        const token = sessionStorage.getItem('authToken');
        
        if (!token) {
            showNotification('error', 'Upload Failed', 'You must be logged in to upload files');
            return;
        }

        // Show progress
        const progressDiv = document.getElementById('uploadProgress');
        if (progressDiv) {
            progressDiv.classList.add('show');
        }
        
        // Format customers for API
        const formattedCustomers = customersData.map(customer => ({
            name: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
            email: customer.email || null,
            phone: customer.phone || null,
            status: customer.status || 'pending',
            assignedTo: customer.assignedTo || null,
            notes: customer.notes || customer.comments || null
        }));

        // Update progress
        if (document.getElementById('progressText')) {
            document.getElementById('progressText').textContent = `Uploading ${formattedCustomers.length} customers...`;
            document.getElementById('progressBar').style.width = '30%';
        }

        // Send to bulk upload endpoint
        const response = await fetch(API_BASE_URL + '/customers/bulk-upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                customers: formattedCustomers,
                batchSize: 1000 // Process 1000 records at a time
            })
        });

        if (response.ok) {
            const result = await response.json();
            
            // Update progress
            if (document.getElementById('progressBar')) {
                document.getElementById('progressBar').style.width = '100%';
            }
            if (document.getElementById('progressText')) {
                document.getElementById('progressText').textContent = 'Upload complete!';
            }

            // Reload customers from server
            await loadCustomers();
            
            // Show success message
            setTimeout(() => {
                if (progressDiv) {
                    progressDiv.classList.remove('show');
                }
                showNotification('success', 'Bulk Upload Complete', 
                    `Successfully uploaded ${result.importedCount} out of ${result.totalRecords} customers.${result.errorCount > 0 ? ` ${result.errorCount} failed.` : ''}`);
            }, 1000);
        } else {
            const error = await response.json();
            showNotification('error', 'Upload Failed', error.error || 'Failed to upload customers');
            if (progressDiv) {
                progressDiv.classList.remove('show');
            }
        }
    } catch (error) {
        console.error('Bulk upload error:', error);
        showNotification('error', 'Upload Failed', 'Connection error during upload');
        const progressDiv = document.getElementById('uploadProgress');
        if (progressDiv) {
            progressDiv.classList.remove('show');
        }
    }
}

/**
 * @deprecated This function is inefficient for large datasets (300k+ customers).
 * It loops through ALL customers and makes individual API calls.
 * Use direct API calls for specific operations instead:
 * - POST /customers for creating new customers
 * - PUT /customers/:id for updating specific customers
 * - POST /customers/bulk-upload for bulk operations
 * 
 * This function is kept only for backward compatibility and should NOT be used
 * in production with large datasets.
 */
async function saveCustomers() {
    console.warn('saveCustomers() is deprecated. Use direct API calls instead for better performance.');
    
    try {
        const token = sessionStorage.getItem('authToken');
        
        if (!token) {
            console.error('No authentication token');
            return;
        }
        
        // Save each customer to the server
        // WARNING: This will be VERY slow with 300k+ customers
        for (const customer of customers) {
            // Transform customer data to match database schema
            const customerData = {
                name: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
                email: customer.email || null,
                phone: customer.phone || null,
                status: customer.status || 'pending',
                assigned_to: customer.assignedTo || customer.assigned_to || null,
                notes: customer.comments || customer.notes || null
            };
            
            if (customer.id) {
                // Update existing customer
                await fetch(API_BASE_URL + '/customers/' + customer.id, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(customerData)
                });
            } else {
                // Create new customer
                const response = await fetch(API_BASE_URL + '/customers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(customerData)
                });
                
                if (response.ok) {
                    const newCustomer = await response.json();
                    // Update the customer with the ID from server
                    const index = customers.findIndex(c => c === customer);
                    if (index !== -1) {
                        customers[index] = newCustomer;
                    }
                }
            }
        }
        
        // Reload customers to get updated data from server
        await loadCustomers();
    } catch (error) {
        console.error('Error saving customers:', error);
        showNotification('error', 'Save Failed', 'Could not save to server');
    }
}

// Sample customer data for development
function getSampleCustomers() {
    return [
        {
            id: 1,
            firstName: 'John',
            lastName: 'Smith',
            name: 'John Smith',
            email: 'john.smith@email.com',
            phone: '(555) 123-4567',
            status: 'interested',
            assignedTo: 'employee1',
            comments: 'Client agreed and wants to share his W2',
            address: '123 Main St, New York, NY 10001',
            callStatus: 'called',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 2,
            firstName: 'Sarah',
            lastName: 'Johnson',
            name: 'Sarah Johnson',
            email: 'sarah.j@email.com',
            phone: '(555) 234-5678',
            status: 'follow_up',
            assignedTo: 'employee2',
            comments: 'Client asked us to call back later',
            address: '456 Oak Ave, Los Angeles, CA 90001',
            callStatus: 'called',
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 3,
            firstName: 'Michael',
            lastName: 'Williams',
            name: 'Michael Williams',
            email: 'm.williams@email.com',
            phone: '(555) 345-6789',
            status: 'call_back',
            assignedTo: 'employee1',
            comments: 'Client asked us to call back',
            address: '789 Pine Rd, Chicago, IL 60601',
            callStatus: 'called',
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 4,
            firstName: 'Emily',
            lastName: 'Brown',
            name: 'Emily Brown',
            email: 'emily.brown@email.com',
            phone: '(555) 456-7890',
            status: 'pending',
            assignedTo: '',
            comments: '',
            address: '321 Elm St, Houston, TX 77001',
            callStatus: 'not_called',
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 5,
            firstName: 'David',
            lastName: 'Jones',
            name: 'David Jones',
            email: 'david.jones@email.com',
            phone: '(555) 567-8901',
            status: 'voice_mail',
            assignedTo: 'employee2',
            comments: 'Reached Voice Mail',
            address: '654 Maple Dr, Phoenix, AZ 85001',
            callStatus: 'called',
            createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 6,
            firstName: 'Jessica',
            lastName: 'Garcia',
            name: 'Jessica Garcia',
            email: 'j.garcia@email.com',
            phone: '(555) 678-9012',
            status: 'not_in_service',
            assignedTo: 'employee1',
            comments: 'Number not in Service',
            address: '987 Cedar Ln, Philadelphia, PA 19101',
            callStatus: 'called',
            createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 7,
            firstName: 'Robert',
            lastName: 'Miller',
            name: 'Robert Miller',
            email: 'robert.m@email.com',
            phone: '(555) 789-0123',
            status: 'citizen',
            assignedTo: 'employee2',
            comments: 'Call reached Citizen',
            address: '147 Birch Way, San Antonio, TX 78201',
            callStatus: 'called',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 8,
            firstName: 'Amanda',
            lastName: 'Davis',
            name: 'Amanda Davis',
            email: 'amanda.davis@email.com',
            phone: '(555) 890-1234',
            status: 'dnd',
            assignedTo: 'employee1',
            comments: 'Customer wants us not to disturb',
            address: '258 Spruce St, San Diego, CA 92101',
            callStatus: 'called',
            createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 9,
            firstName: 'Christopher',
            lastName: 'Rodriguez',
            name: 'Christopher Rodriguez',
            email: 'chris.r@email.com',
            phone: '(555) 901-2345',
            status: 'pending',
            assignedTo: '',
            comments: '',
            address: '369 Willow Ave, Dallas, TX 75201',
            callStatus: 'not_called',
            createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 10,
            firstName: 'Lisa',
            lastName: 'Martinez',
            name: 'Lisa Martinez',
            email: 'lisa.martinez@email.com',
            phone: '(555) 012-3456',
            status: 'interested',
            assignedTo: 'employee2',
            comments: 'Client Agreed and wants to share his W2',
            address: '741 Ash Blvd, San Jose, CA 95101',
            callStatus: 'called',
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 11,
            firstName: 'James',
            lastName: 'Wilson',
            name: 'James Wilson',
            email: 'james.wilson@email.com',
            phone: '(555) 123-4568',
            status: 'follow_up',
            assignedTo: 'employee1',
            comments: 'Client and asked us to call back later.',
            address: '852 Poplar Ct, Austin, TX 78701',
            callStatus: 'called',
            createdAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 12,
            firstName: 'Michelle',
            lastName: 'Anderson',
            name: 'Michelle Anderson',
            email: 'michelle.a@email.com',
            phone: '(555) 234-5679',
            status: 'call_back',
            assignedTo: 'employee2',
            comments: 'Client asked us to call back',
            address: '963 Hickory Dr, Jacksonville, FL 32201',
            callStatus: 'called',
            createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 13,
            firstName: 'Daniel',
            lastName: 'Taylor',
            name: 'Daniel Taylor',
            email: 'daniel.taylor@email.com',
            phone: '(555) 345-6780',
            status: 'voice_mail',
            assignedTo: 'employee1',
            comments: 'Reached Voice Mail',
            address: '159 Cherry St, Fort Worth, TX 76101',
            callStatus: 'called',
            createdAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 14,
            firstName: 'Ashley',
            lastName: 'Thomas',
            name: 'Ashley Thomas',
            email: 'ashley.thomas@email.com',
            phone: '(555) 456-7891',
            status: 'pending',
            assignedTo: '',
            comments: '',
            address: '357 Walnut Ave, Columbus, OH 43201',
            callStatus: 'not_called',
            createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 15,
            firstName: 'Matthew',
            lastName: 'Hernandez',
            name: 'Matthew Hernandez',
            email: 'matthew.h@email.com',
            phone: '(555) 567-8902',
            status: 'not_in_service',
            assignedTo: 'employee2',
            comments: 'Number not in Service',
            address: '468 Magnolia Ln, Charlotte, NC 28201',
            callStatus: 'called',
            createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        }
    ];
}

async function loadCustomers() {
    try {
        const token = sessionStorage.getItem('authToken');
        
        if (!token) {
            // No token means user not logged in
            customers = [];
            return;
        }
        
        // Check if token is a dev token (development mode)
        const isDevMode = token && token.startsWith('dev-token-');
        
        // In development mode, use sample data
        if (isDevMode) {
            console.log('Development mode: Loading sample customer data');
            customers = getSampleCustomers();
            
            // Refresh the dashboard if it's currently displayed
            if (document.getElementById('dashboardPage').style.display !== 'none') {
                loadDashboard();
            }
            return;
        }
        
        // Fetch customers from server
        const response = await fetch(API_BASE_URL + '/customers', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Handle paginated response (new API format)
            const customersData = data.customers || data;
            
            // Transform database records to match frontend expectations
            // Database has 'name' field, but frontend expects 'firstName' and 'lastName'
            customers = customersData.map(customer => {
                // Split name into firstName and lastName if not already split
                let firstName = customer.firstName || '';
                let lastName = customer.lastName || '';
                
                // If name exists but firstName/lastName don't, split the name
                if (!firstName && !lastName && customer.name) {
                    const nameParts = customer.name.trim().split(/\s+/);
                    firstName = nameParts[0] || '';
                    lastName = nameParts.slice(1).join(' ') || '';
                }
                
                // Also handle other field mappings
                return {
                    ...customer,
                    id: customer.id || customer.id,
                    firstName: firstName,
                    lastName: lastName,
                    name: customer.name || `${firstName} ${lastName}`.trim(),
                    phone: customer.phone || '',
                    email: customer.email || '',
                    address: customer.address || customer.notes || '',
                    status: customer.status || 'pending',
                    callStatus: customer.callStatus || 'not_called',
                    comments: customer.comments || customer.notes || '',
                    assignedTo: customer.assignedTo || customer.assigned_to || '',
                    createdAt: customer.created_at || customer.createdAt || new Date().toISOString()
                };
            });
            
            // Refresh the dashboard if it's currently displayed
            if (document.getElementById('dashboardPage').style.display !== 'none') {
                loadDashboard();
            }
        } else {
            console.error('Failed to load customers');
            // Fallback to sample data in development
            if (token && token.startsWith('dev-token-')) {
                customers = getSampleCustomers();
            } else {
                customers = [];
            }
        }
    } catch (error) {
        console.error('Error loading customers:', error);
        // Fallback to sample data in development mode
        const token = sessionStorage.getItem('authToken');
        if (token && token.startsWith('dev-token-')) {
            console.log('Using sample data due to connection error');
            customers = getSampleCustomers();
            
            // Refresh the dashboard if it's currently displayed
            if (document.getElementById('dashboardPage').style.display !== 'none') {
                loadDashboard();
            }
        } else {
            customers = [];
        }
    }
}

async function reloadSampleData() {
    const sampleCustomers = getSampleCustomers();
    // Format for bulk upload API
    const formattedCustomers = sampleCustomers.map(customer => ({
        name: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
        email: customer.email || null,
        phone: customer.phone || null,
        status: customer.status || 'pending',
        assignedTo: customer.assignedTo || null,
        notes: customer.comments || customer.notes || null
    }));
    
    // Use bulk upload API for efficiency
    await bulkUploadCustomers(formattedCustomers);
    customers = sampleCustomers; // Update local array
    loadDashboard();
    showNotification('success', 'Data Reloaded', 'Sample data has been reloaded with data across multiple months');
}

// Removed saveUsers() - users are stored in database, not localStorage

async function loadUsers() {
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            // If not logged in, use empty array
            users = [];
            return;
        }
        
        const response = await fetch(API_BASE_URL + '/users', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            users = await response.json();
        } else {
            console.error('Failed to load users');
            users = [];
        }
    } catch (error) {
        console.error('Error loading users:', error);
        users = [];
    }
}

function loadUserProfiles() {
    // User profiles are now stored in sessionStorage (clears when browser closes)
    const saved = sessionStorage.getItem('crm_user_profiles');
    if (saved) {
        userProfiles = JSON.parse(saved);
    } else {
        // Initialize with default profiles
        userProfiles = [
            { 
                username: 'admin', 
                firstName: 'Admin', 
                lastName: 'User', 
                phone: '', 
                address: '', 
                photo: '' 
            },
            { 
                username: 'employee', 
                firstName: 'Employee', 
                lastName: 'User', 
                phone: '', 
                address: '', 
                photo: '' 
            }
        ];
        saveUserProfiles();
    }
}

function saveUserProfiles() {
    // Store in sessionStorage instead of localStorage (clears when browser closes)
    sessionStorage.setItem('crm_user_profiles', JSON.stringify(userProfiles));
}

function showMyProfileModal() {
    const userProfile = userProfiles.find(p => p.username === currentUser.username) || {
        username: currentUser.username,
        firstName: '',
        lastName: '',
        phone: '',
        address: '',
        photo: ''
    };
    
    // Populate form fields
    document.getElementById('profileFirstName').value = userProfile.firstName;
    document.getElementById('profileLastName').value = userProfile.lastName;
    document.getElementById('profilePhone').value = userProfile.phone;
    document.getElementById('profileAddress').value = userProfile.address;
    
    // Clear password fields
    document.getElementById('profileCurrentPassword').value = '';
    document.getElementById('profileNewPassword').value = '';
    document.getElementById('profileConfirmPassword').value = '';
    
    // Show/hide photo preview
    if (userProfile.photo) {
        document.getElementById('profilePhotoPreview').src = userProfile.photo;
        document.getElementById('profilePhotoPreview').style.display = 'block';
        document.getElementById('profilePhotoPlaceholder').style.display = 'none';
    } else {
        document.getElementById('profilePhotoPreview').style.display = 'none';
        document.getElementById('profilePhotoPlaceholder').style.display = 'flex';
    }
    
    const modal = new bootstrap.Modal(document.getElementById('myProfileModal'));
    modal.show();
}

function previewProfilePhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profilePhotoPreview').src = e.target.result;
            document.getElementById('profilePhotoPreview').style.display = 'block';
            document.getElementById('profilePhotoPlaceholder').style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function saveMyProfile() {
    const firstName = document.getElementById('profileFirstName').value;
    const lastName = document.getElementById('profileLastName').value;
    const phone = document.getElementById('profilePhone').value;
    const address = document.getElementById('profileAddress').value;
    const photoFile = document.getElementById('profilePhotoInput').files[0];
    const currentPassword = document.getElementById('profileCurrentPassword').value;
    const newPassword = document.getElementById('profileNewPassword').value;
    const confirmPassword = document.getElementById('profileConfirmPassword').value;
    
    if (!firstName || !lastName) {
        showNotification('error', 'Validation Error', 'First Name and Last Name are required!');
        return;
    }
    
    // Handle password change if new password is provided
    if (newPassword) {
        if (!currentPassword) {
            showNotification('error', 'Validation Error', 'Please enter your current password to change it.');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showNotification('error', 'Validation Error', 'New password and confirm password do not match.');
            return;
        }
        
        if (newPassword.length < 6) {
            showNotification('error', 'Validation Error', 'New password must be at least 6 characters long.');
            return;
        }
        
        // Verify current password and update password
        try {
            const token = sessionStorage.getItem('authToken');
            if (!token) {
                showNotification('error', 'Authentication Error', 'Please log in again.');
                return;
            }
            
            // First verify current password by attempting login
            const verifyResponse = await fetch(API_BASE_URL + '/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username, password: currentPassword })
            });
            
            if (!verifyResponse.ok) {
                showNotification('error', 'Invalid Password', 'Current password is incorrect.');
                return;
            }
            
            // Update password via API
            const updateResponse = await fetch(API_BASE_URL + '/users/' + currentUser.id, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    username: currentUser.username,
                    password: newPassword,
                    role: currentUser.role,
                    locked: false
                })
            });
            
            if (!updateResponse.ok) {
                const error = await updateResponse.json();
                showNotification('error', 'Password Update Failed', error.error || 'Failed to update password.');
                return;
            }
            
            showNotification('success', 'Password Changed', 'Your password has been changed successfully!');
            
            // Clear password fields
            document.getElementById('profileCurrentPassword').value = '';
            document.getElementById('profileNewPassword').value = '';
            document.getElementById('profileConfirmPassword').value = '';
            
        } catch (error) {
            console.error('Password update error:', error);
            showNotification('error', 'Password Update Failed', 'Failed to update password. Please try again.');
            return;
        }
    }
    
    // Find existing profile or create new one
    let userProfile = userProfiles.find(p => p.username === currentUser.username);
    if (!userProfile) {
        userProfile = { username: currentUser.username };
        userProfiles.push(userProfile);
    }
    
    // Update profile data
    userProfile.firstName = firstName;
    userProfile.lastName = lastName;
    userProfile.phone = phone;
    userProfile.address = address;
    
    // Handle photo upload
    if (photoFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            userProfile.photo = e.target.result;
            saveUserProfiles();
            updateUserDisplay();
            
            // Hide modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('myProfileModal'));
            modal.hide();
            
            showNotification('success', 'Profile Updated', 'Your profile has been updated successfully!');
        };
        reader.readAsDataURL(photoFile);
    } else {
        saveUserProfiles();
        updateUserDisplay();
        
        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('myProfileModal'));
        modal.hide();
        
        showNotification('success', 'Profile Updated', 'Your profile has been updated successfully!');
    }
}

function getSampleCustomers() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    // Helper to create date in specific month (0-11) with random day
    const dateInMonth = (monthOffset) => {
        // monthOffset: 0 = current month, 1 = last month, etc.
        const targetMonth = currentMonth - monthOffset;
        const year = targetMonth < 0 ? currentYear - 1 : currentYear;
        const month = targetMonth < 0 ? targetMonth + 12 : targetMonth;
        const day = Math.floor(Math.random() * 28) + 1; // Days 1-28 to avoid month overflow
        return new Date(year, month, day, 12, 0, 0).toISOString();
    };
    
    return [
        {
            id: 1,
            firstName: 'John',
            lastName: 'Smith',
            phone: '555-0101',
            email: 'john.smith@email.com',
            address: '123 Main St, New York, NY 10001',
            status: 'pending',
            callStatus: 'not_called',
            comments: '',
            createdAt: dateInMonth(0), // Current month
            assignedTo: ''
        },
        {
            id: 2,
            firstName: 'Sarah',
            lastName: 'Johnson',
            phone: '555-0102',
            email: 'sarah.j@email.com',
            address: '456 Oak Ave, Los Angeles, CA 90001',
            status: 'interested',
            callStatus: 'called',
            comments: 'Interested in our services',
            createdAt: dateInMonth(1), // 1 month ago
            assignedTo: ''
        },
        {
            id: 3,
            firstName: 'Michael',
            lastName: 'Brown',
            phone: '555-0103',
            email: 'm.brown@email.com',
            address: '789 Elm Dr, Chicago, IL 60601',
            status: 'voice_mail',
            callStatus: 'voice_mail',
            comments: 'Left voicemail',
            createdAt: dateInMonth(2), // 2 months ago
            assignedTo: ''
        },
        {
            id: 4,
            firstName: 'Emily',
            lastName: 'Davis',
            phone: '555-0104',
            email: 'emily.davis@email.com',
            address: '321 Pine Rd, Houston, TX 77001',
            status: 'w2_received',
            callStatus: 'called',
            comments: 'W2 document received',
            createdAt: dateInMonth(0), // Current month
            assignedTo: ''
        },
        {
            id: 5,
            firstName: 'David',
            lastName: 'Wilson',
            phone: '555-0105',
            email: 'd.wilson@email.com',
            address: '654 Maple St, Phoenix, AZ 85001',
            status: 'pending',
            callStatus: 'new',
            comments: '',
            createdAt: dateInMonth(3), // 3 months ago
            assignedTo: ''
        },
        {
            id: 6,
            firstName: 'Jessica',
            lastName: 'Martinez',
            phone: '555-0106',
            email: 'j.martinez@email.com',
            address: '987 Cedar Ln, Philadelphia, PA 19101',
            status: 'potential',
            callStatus: 'called',
            comments: 'Follow up scheduled',
            createdAt: new Date().toISOString(),
            assignedTo: ''
        },
        {
            id: 7,
            firstName: 'Robert',
            lastName: 'Taylor',
            phone: '555-0107',
            email: 'r.taylor@email.com',
            address: '147 Birch Ave, San Antonio, TX 78201',
            status: 'not_in_service',
            callStatus: 'called',
            comments: 'Phone number not in service',
            createdAt: dateInMonth(1), // 1 month ago
            assignedTo: ''
        },
        {
            id: 8,
            firstName: 'Lisa',
            lastName: 'Anderson',
            phone: '555-0108',
            email: 'l.anderson@email.com',
            address: '258 Walnut Blvd, San Diego, CA 92101',
            status: 'voice_mail',
            callStatus: 'voice_mail',
            comments: 'No answer',
            createdAt: dateInMonth(2), // 2 months ago
            assignedTo: ''
        },
        {
            id: 9,
            firstName: 'William',
            lastName: 'Garcia',
            phone: '555-0109',
            email: 'w.garcia@email.com',
            address: '369 Oak St, Seattle, WA 98101',
            status: 'potential',
            callStatus: 'called',
            comments: 'Tax consultation needed',
            createdAt: dateInMonth(5), // 5 months ago
            assignedTo: ''
        },
        {
            id: 10,
            firstName: 'Jennifer',
            lastName: 'Lee',
            phone: '555-0110',
            email: 'j.lee@email.com',
            address: '741 Pine Ave, Miami, FL 33101',
            status: 'pending',
            callStatus: 'not_called',
            comments: '',
            createdAt: dateInMonth(6), // 6 months ago
            assignedTo: ''
        },
        {
            id: 11,
            firstName: 'Christopher',
            lastName: 'White',
            phone: '555-0111',
            email: 'c.white@email.com',
            address: '852 Elm St, Denver, CO 80201',
            status: 'voice_mail',
            callStatus: 'voice_mail',
            comments: 'Business tax filing',
            createdAt: dateInMonth(3), // 3 months ago
            assignedTo: ''
        },
        {
            id: 12,
            firstName: 'Amanda',
            lastName: 'Harris',
            phone: '555-0112',
            email: 'a.harris@email.com',
            address: '963 Maple Dr, Boston, MA 02101',
            status: 'w2_received',
            callStatus: 'called',
            comments: 'W2 processed successfully',
            createdAt: dateInMonth(1), // 1 month ago
            assignedTo: ''
        },
        // Add more customers with default statuses spread across months
        {
            id: 13,
            firstName: 'Daniel',
            lastName: 'Moore',
            phone: '555-0116',
            email: 'd.moore@email.com',
            address: '159 Cherry St, Dallas, TX 75201',
            status: 'not_in_service',
            callStatus: 'called',
            comments: 'Number disconnected',
            createdAt: dateInMonth(0), // Current month
            assignedTo: ''
        },
        {
            id: 14,
            firstName: 'Michelle',
            lastName: 'Jackson',
            phone: '555-0117',
            email: 'm.jackson@email.com',
            address: '357 Willow Ln, Austin, TX 78701',
            status: 'interested',
            callStatus: 'called',
            comments: 'Very interested',
            createdAt: dateInMonth(4), // 4 months ago
            assignedTo: ''
        },
        {
            id: 15,
            firstName: 'Thomas',
            lastName: 'Chen',
            phone: '555-0118',
            email: 't.chen@email.com',
            address: '741 Ash Ave, Portland, OR 97201',
            status: 'voice_mail',
            callStatus: 'voice_mail',
            comments: 'Left message',
            createdAt: dateInMonth(5), // 5 months ago
            assignedTo: ''
        },
        {
            id: 16,
            firstName: 'Laura',
            lastName: 'Martinez',
            phone: '555-0119',
            email: 'l.martinez@email.com',
            address: '852 Oak Blvd, Nashville, TN 37201',
            status: 'w2_received',
            callStatus: 'called',
            comments: 'W2 submitted',
            createdAt: dateInMonth(6), // 6 months ago
            assignedTo: ''
        },
        {
            id: 17,
            firstName: 'Kevin',
            lastName: 'Brown',
            phone: '555-0120',
            email: 'k.brown@email.com',
            address: '963 Pine Dr, Detroit, MI 48201',
            status: 'not_in_service',
            callStatus: 'called',
            comments: 'Phone not working',
            createdAt: dateInMonth(7), // 7 months ago
            assignedTo: ''
        },
        {
            id: 18,
            firstName: 'Rachel',
            lastName: 'Taylor',
            phone: '555-0121',
            email: 'r.taylor@email.com',
            address: '147 Elm Ave, Charlotte, NC 28201',
            status: 'interested',
            callStatus: 'called',
            comments: 'Wants to proceed',
            createdAt: dateInMonth(8), // 8 months ago
            assignedTo: ''
        },
        {
            id: 19,
            firstName: 'Anthony',
            lastName: 'Williams',
            phone: '555-0122',
            email: 'a.williams@email.com',
            address: '258 Maple St, Indianapolis, IN 46201',
            status: 'voice_mail',
            callStatus: 'voice_mail',
            comments: 'No response',
            createdAt: dateInMonth(9), // 9 months ago
            assignedTo: ''
        },
        {
            id: 20,
            firstName: 'Melissa',
            lastName: 'Jones',
            phone: '555-0123',
            email: 'm.jones@email.com',
            address: '369 Cedar Ln, San Francisco, CA 94101',
            status: 'w2_received',
            callStatus: 'called',
            comments: 'Documents received',
            createdAt: dateInMonth(10), // 10 months ago
            assignedTo: ''
        },
        {
            id: 21,
            firstName: 'James',
            lastName: 'Garcia',
            phone: '555-0124',
            email: 'j.garcia@email.com',
            address: '741 Birch Rd, Columbus, OH 43201',
            status: 'not_in_service',
            callStatus: 'called',
            comments: 'Line disconnected',
            createdAt: dateInMonth(11), // 11 months ago
            assignedTo: ''
        },
        {
            id: 22,
            firstName: 'Nicole',
            lastName: 'Rodriguez',
            phone: '555-0125',
            email: 'n.rodriguez@email.com',
            address: '852 Walnut Ave, Fort Worth, TX 76101',
            status: 'interested',
            callStatus: 'called',
            comments: 'Ready to start',
            createdAt: dateInMonth(0), // Current month
            assignedTo: ''
        },
        {
            id: 23,
            firstName: 'Ryan',
            lastName: 'Lewis',
            phone: '555-0126',
            email: 'r.lewis@email.com',
            address: '963 Ash St, Seattle, WA 98101',
            status: 'voice_mail',
            callStatus: 'voice_mail',
            comments: 'Called back',
            createdAt: dateInMonth(1), // 1 month ago
            assignedTo: ''
        },
        {
            id: 24,
            firstName: 'Stephanie',
            lastName: 'Walker',
            phone: '555-0127',
            email: 's.walker@email.com',
            address: '147 Pine Blvd, Denver, CO 80201',
            status: 'w2_received',
            callStatus: 'called',
            comments: 'All documents submitted',
            createdAt: dateInMonth(2), // 2 months ago
            assignedTo: ''
        }
    ];
}

/**
 * Show a specific customer dashboard section
 */
function showCustomerSection(sectionName) {
    console.log(`🔍 showCustomerSection called with: ${sectionName}`);
    
    // Hide all sections
    const sections = document.querySelectorAll('.customer-section');
    console.log(`📦 Found ${sections.length} customer sections`);
    sections.forEach(section => {
        section.style.display = 'none';
    });
    
    // Remove active class from all nav items
    const navItems = document.querySelectorAll('.customer-nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Show the selected section
    const targetSectionId = `customer-section-${sectionName}`;
    const targetSection = document.getElementById(targetSectionId);
    console.log(`🎯 Looking for section with ID: ${targetSectionId}`);
    console.log(`✅ Section found:`, targetSection);
    
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.style.visibility = 'visible';
        targetSection.style.opacity = '1';
        console.log(`✅ Section ${targetSectionId} is now visible`);
        
        // Force visibility of child elements
        const childCards = targetSection.querySelectorAll('.card');
        childCards.forEach(card => {
            card.style.display = 'block';
            card.style.visibility = 'visible';
            card.style.opacity = '1';
            card.style.position = 'relative';
            card.style.zIndex = '1';
        });
        
        // Force visibility of all form elements
        const formElements = targetSection.querySelectorAll('input, select, button, label');
        formElements.forEach(element => {
            element.style.display = '';
            element.style.visibility = 'visible';
            element.style.opacity = '1';
        });
        
        console.log(`📦 Section has ${childCards.length} card(s) inside`);
        console.log(`📦 Section innerHTML length: ${targetSection.innerHTML.length}`);
        console.log(`📦 Section computed style display:`, window.getComputedStyle(targetSection).display);
        console.log(`📦 Section computed style visibility:`, window.getComputedStyle(targetSection).visibility);
        console.log(`📦 Section offsetHeight:`, targetSection.offsetHeight);
        console.log(`📦 Section offsetWidth:`, targetSection.offsetWidth);
        console.log(`📦 Section parent:`, targetSection.parentElement);
        console.log(`📦 Section parent display:`, targetSection.parentElement ? window.getComputedStyle(targetSection.parentElement).display : 'N/A');
        console.log(`📦 First card computed style display:`, childCards.length > 0 ? window.getComputedStyle(childCards[0]).display : 'N/A');
        console.log(`📦 First card offsetHeight:`, childCards.length > 0 ? childCards[0].offsetHeight : 'N/A');
        
        // If it's bank-info, also populate the dropdown and load bank info
        if (sectionName === 'bank-info') {
            console.log(`🏦 Bank Info section opened, populating tax payer dropdown...`);
            // Get customer info from sessionStorage or fetch it
            const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
            if (currentUser && currentUser.role === 'customer') {
                // Fetch customer data to populate dropdown
                const token = sessionStorage.getItem('authToken');
                if (token) {
                    fetch(API_BASE_URL + '/customers/me', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                    .then(response => response.json())
                    .then(customer => {
                        console.log(`👤 Customer data loaded:`, customer);
                        populateTaxPayerDropdown(customer);
                        // Load bank information if available
                        loadBankInformation(customer.id);
                    })
                    .catch(error => {
                        console.error('❌ Error loading customer data:', error);
                    });
                }
            }
        }
    } else {
        console.error(`❌ Section ${targetSectionId} NOT FOUND!`);
    }
    
    // Add active class to clicked nav item
    const navItemsArray = Array.from(navItems);
    const clickedIndex = navItemsArray.findIndex(item => {
        const onclick = item.getAttribute('onclick');
        return onclick && onclick.includes(`'${sectionName}'`);
    });
    
    if (clickedIndex !== -1) {
        navItems[clickedIndex].classList.add('active');
    }
    
    // Scroll to top of content
    const mainContent = document.querySelector('#customerDashboardPage .main-content');
    if (mainContent) {
        mainContent.scrollTop = 0;
    }
}

/**
 * Populate Tax Payer dropdown with customer name and dependents
 */
function populateTaxPayerDropdown(customer) {
    const taxPayerSelect = document.getElementById('taxBankTaxPayer');
    if (!taxPayerSelect) return;
    
    // Clear existing options except the first one
    taxPayerSelect.innerHTML = '<option value="">Select Tax Payer</option>';
    
    // Add main customer
    const customerName = customer.name || 'Main Customer';
    const mainOption = document.createElement('option');
    mainOption.value = 'main';
    mainOption.textContent = customerName;
    taxPayerSelect.appendChild(mainOption);
    
    // Add dependents if they exist in tax info
    // We'll update this when tax info is loaded
    updateTaxPayerDropdownWithDependents();
}

/**
 * Update Tax Payer dropdown with dependents from tax information
 */
function updateTaxPayerDropdownWithDependents() {
    const taxPayerSelect = document.getElementById('taxBankTaxPayer');
    if (!taxPayerSelect) return;
    
    // Get dependents from the dependents container
    const dependentsContainer = document.getElementById('dependentsContainer');
    if (!dependentsContainer) return;
    
    // Remove existing dependent options (keep "Select Tax Payer" and "Main Customer")
    const options = Array.from(taxPayerSelect.options);
    options.forEach((option, index) => {
        if (index > 1) { // Keep first two options (Select and Main)
            taxPayerSelect.removeChild(option);
        }
    });
    
    // Find all dependent entries
    const dependentEntries = dependentsContainer.querySelectorAll('.dependent-entry');
    dependentEntries.forEach((entry, index) => {
        const nameInput = entry.querySelector('.dependent-name');
        if (nameInput && nameInput.value.trim()) {
            const dependentOption = document.createElement('option');
            dependentOption.value = `dependent_${index}`;
            dependentOption.textContent = nameInput.value.trim();
            taxPayerSelect.appendChild(dependentOption);
        }
    });
}

/**
 * Load Bank Information from tax info
 */
async function loadBankInformation(customerId) {
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) return;

        const taxYear = document.getElementById('taxYear')?.value || '2024';

        // Fetch tax information
        const response = await fetch(API_BASE_URL + `/customers/tax-info/${customerId}?tax_year=${taxYear}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const taxInfo = await response.json();
            
            // Check if taxInfo exists and has bank information
            if (taxInfo && typeof taxInfo === 'object') {
                // Populate bank fields
                if (taxInfo.bank_tax_payer && document.getElementById('taxBankTaxPayer')) {
                    document.getElementById('taxBankTaxPayer').value = taxInfo.bank_tax_payer;
                }
                if (taxInfo.bank_name && document.getElementById('taxBankName')) {
                    document.getElementById('taxBankName').value = taxInfo.bank_name;
                }
                if (taxInfo.bank_account_number && document.getElementById('taxBankAccountNumber')) {
                    document.getElementById('taxBankAccountNumber').value = taxInfo.bank_account_number;
                }
                if (taxInfo.bank_routing_number && document.getElementById('taxBankRoutingNumber')) {
                    document.getElementById('taxBankRoutingNumber').value = taxInfo.bank_routing_number;
                }
                if (taxInfo.bank_account_type && document.getElementById('taxBankAccountType')) {
                    document.getElementById('taxBankAccountType').value = taxInfo.bank_account_type;
                }
            }
        }
    } catch (error) {
        console.error('Error loading bank information:', error);
    }
}

// Add event listener to update dropdown when dependents are added/removed
document.addEventListener('DOMContentLoaded', function() {
    // Monitor dependents container for changes
    const dependentsContainer = document.getElementById('dependentsContainer');
    if (dependentsContainer) {
        // Use MutationObserver to detect when dependents are added/removed
        const observer = new MutationObserver(function(mutations) {
            updateTaxPayerDropdownWithDependents();
            // Also update SSN/ITIN name dropdowns
            const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
            if (currentUser && currentUser.role === 'customer') {
                fetch(API_BASE_URL + '/customers/me', {
                    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` }
                })
                .then(res => res.json())
                .then(customer => {
                    updateAllIdentificationNameDropdowns(customer);
                })
                .catch(err => console.error('Error fetching customer:', err));
            }
        });
        
        observer.observe(dependentsContainer, {
            childList: true,
            subtree: true
        });
        
        // Also listen for input changes on dependent names
        dependentsContainer.addEventListener('input', function(e) {
            if (e.target.classList.contains('dependent-name')) {
                updateTaxPayerDropdownWithDependents();
                // Update SSN/ITIN name dropdowns
                const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
                if (currentUser && currentUser.role === 'customer') {
                    fetch(API_BASE_URL + '/customers/me', {
                        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` }
                    })
                    .then(res => res.json())
                    .then(customer => {
                        updateAllIdentificationNameDropdowns(customer);
                    })
                    .catch(err => console.error('Error fetching customer:', err));
                }
            }
        });
    }
    
    // Add event listener for Country of Citizenship change
    const countrySelect = document.getElementById('personalCountryOfCitizenship');
    if (countrySelect) {
        countrySelect.addEventListener('change', handleCountryOfCitizenshipChange);
    }
});

/**
 * Save Personal Information
 */
async function savePersonalInformation() {
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Authentication Error', 'You are not logged in. Please log in again.');
            return;
        }

        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!currentUser || currentUser.role !== 'customer') {
            showNotification('error', 'Error', 'Customer information not found.');
            return;
        }

        const meResponse = await fetch(API_BASE_URL + '/customers/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!meResponse.ok) {
            throw new Error('Failed to fetch customer information');
        }

        const customer = await meResponse.json();
        const customerId = customer.id;

        const personalData = {
            filing_years: document.getElementById('personalFilingYears')?.value || '',
            first_name: document.getElementById('personalFirstName')?.value.trim() || '',
            middle_name: document.getElementById('personalMiddleName')?.value.trim() || '',
            last_name: document.getElementById('personalLastName')?.value.trim() || '',
            date_of_birth: document.getElementById('personalDateOfBirthHidden')?.value || '',
            gender: document.getElementById('personalGender')?.value || '',
            marital_status: document.getElementById('personalMaritalStatus')?.value || '',
            alternate_mobile_no: document.getElementById('personalAlternateMobile')?.value.trim() || '',
            country_of_citizenship: document.getElementById('personalCountryOfCitizenship')?.value || ''
        };

        // Save to backend via tax-info endpoint (personal info is stored in customer_tax_info table)
        const taxYear = document.getElementById('taxYear')?.value || document.getElementById('taxYearSelector')?.value || '2024';
        const response = await fetch(API_BASE_URL + `/customers/tax-info`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                customer_id: customerId,
                tax_year: parseInt(taxYear),
                ...personalData
            })
        });

        if (response.ok) {
            showNotification('success', 'Personal Information Saved', 'Your personal information has been saved successfully!');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save personal information');
        }
    } catch (error) {
        console.error('Error saving personal information:', error);
        showNotification('error', 'Save Failed', error.message || 'Failed to save personal information. Please try again.');
    }
}

/**
 * Save All Personal Info (combines all Personal Info sections)
 */
async function saveAllPersonalInfo() {
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Authentication Error', 'You are not logged in. Please log in again.');
            return;
        }

        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!currentUser || currentUser.role !== 'customer') {
            showNotification('error', 'Error', 'Customer information not found.');
            return;
        }

        const meResponse = await fetch(API_BASE_URL + '/customers/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!meResponse.ok) {
            throw new Error('Failed to fetch customer information');
        }

        const customer = await meResponse.json();
        const customerId = customer.id;
        const taxYear = document.getElementById('taxYear')?.value || '2024';

        // Collect all personal information
        const personalData = {
            filing_years: document.getElementById('personalFilingYears')?.value || '',
            first_name: document.getElementById('personalFirstName')?.value.trim() || '',
            middle_name: document.getElementById('personalMiddleName')?.value.trim() || '',
            last_name: document.getElementById('personalLastName')?.value.trim() || '',
            date_of_birth: document.getElementById('personalDateOfBirthHidden')?.value || '',
            gender: document.getElementById('personalGender')?.value || '',
            marital_status: document.getElementById('personalMaritalStatus')?.value || '',
            alternate_mobile_no: document.getElementById('personalAlternateMobile')?.value.trim() || '',
            country_of_citizenship: document.getElementById('personalCountryOfCitizenship')?.value || ''
        };

        // Collect address information
        const addressData = {
            address1: document.getElementById('addressInfoAddress1')?.value.trim() || '',
            address2: document.getElementById('addressInfoAddress2')?.value.trim() || '',
            city: document.getElementById('addressInfoCity')?.value.trim() || '',
            state: document.getElementById('addressInfoState')?.value || '',
            zip_code: document.getElementById('addressInfoZipCode')?.value.trim() || '',
            apartment_number: document.getElementById('addressInfoApartmentNumber')?.value.trim() || ''
        };

        // Collect identification details
        const countrySelect = document.getElementById('personalCountryOfCitizenship');
        const selectedCountry = countrySelect?.value || '';
        const identificationData = {};

        if (selectedCountry === 'US') {
            // Collect SSN/ITIN entries for US
            const container = document.getElementById('identificationSsnContainer');
            const ssnEntries = [];
            
            if (container) {
                const entries = container.querySelectorAll('.identification-ssn-entry');
                entries.forEach(entry => {
                    const nameSelect = entry.querySelector('.identification-name-select');
                    const ssnInput = entry.querySelector('.identification-ssn-input');
                    
                    if (nameSelect && ssnInput && nameSelect.value && ssnInput.value.trim()) {
                        ssnEntries.push({
                            name: nameSelect.value,
                            nameDisplay: nameSelect.options[nameSelect.selectedIndex]?.text || '',
                            ssn_itin: ssnInput.value.trim()
                        });
                    }
                });
            }
            
            identificationData.ssn_itin_entries = ssnEntries;
        } else if (selectedCountry && selectedCountry !== '') {
            // Collect Visa information for non-US countries
            const visaType = document.getElementById('identificationVisaType')?.value || '';
            const latestVisaChange = document.getElementById('identificationLatestVisaChange')?.value || '';
            const primaryPortOfEntry = document.getElementById('identificationPrimaryPortOfEntry')?.value || '';
            const totalMonthsStayed = document.getElementById('identificationTotalMonthsUS')?.value || '';
            
            identificationData.visa_type = visaType;
            identificationData.latest_visa_change = latestVisaChange;
            identificationData.primary_port_of_entry = primaryPortOfEntry;
            identificationData.total_months_stayed_us = totalMonthsStayed ? parseFloat(totalMonthsStayed) : null;
        }

        // Combine all data and save via tax-info endpoint
        const allData = {
            customer_id: customerId,
            tax_year: parseInt(taxYear),
            ...personalData,
            ...addressData,
            ...identificationData
        };

        // Save tax info
        const response = await fetch(API_BASE_URL + `/customers/tax-info`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(allData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save personal information');
        }

        // Also update the main customer record with name and phone if provided
        const customerUpdateData = {
            name: personalData.first_name && personalData.last_name 
                ? `${personalData.first_name} ${personalData.middle_name ? personalData.middle_name + ' ' : ''}${personalData.last_name}`.trim()
                : customer.name,
            phone: personalData.alternate_mobile_no || customer.phone || null,
            updated_at: customer.updated_at // For optimistic locking
        };

        // Only update if we have new data
        if (customerUpdateData.name !== customer.name || customerUpdateData.phone !== customer.phone) {
            const updateResponse = await fetch(API_BASE_URL + `/customers/${customerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(customerUpdateData)
            });

            if (!updateResponse.ok) {
                console.warn('Failed to update customer record, but tax info was saved');
                // Don't throw error - tax info was saved successfully
            }
        }

        // Clear tempPassword flag from sessionStorage after successful save
        // This ensures that on next load, all fields will be populated normally
        if (currentUser && (currentUser.tempPassword || currentUser.temp_password)) {
            currentUser.tempPassword = false;
            currentUser.temp_password = false;
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            window.currentUser = currentUser;
            console.log('✅ Cleared tempPassword flag after successful save');
        }
        
        showNotification('success', 'All Information Saved', 'All your personal information has been saved successfully!');
    } catch (error) {
        console.error('Error saving all personal information:', error);
        showNotification('error', 'Save Failed', error.message || 'Failed to save personal information. Please try again.');
    }
}

/**
 * Save Address Information
 */
async function saveAddressInformation() {
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Authentication Error', 'You are not logged in. Please log in again.');
            return;
        }

        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!currentUser || currentUser.role !== 'customer') {
            showNotification('error', 'Error', 'Customer information not found.');
            return;
        }

        const meResponse = await fetch(API_BASE_URL + '/customers/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!meResponse.ok) {
            throw new Error('Failed to fetch customer information');
        }

        const customer = await meResponse.json();
        const customerId = customer.id;

        const addressData = {
            address1: document.getElementById('addressInfoAddress1')?.value.trim() || '',
            address2: document.getElementById('addressInfoAddress2')?.value.trim() || '',
            city: document.getElementById('addressInfoCity')?.value.trim() || '',
            state: document.getElementById('addressInfoState')?.value || '',
            zip_code: document.getElementById('addressInfoZipCode')?.value.trim() || '',
            apartment_number: document.getElementById('addressInfoApartmentNumber')?.value.trim() || ''
        };

        // Save to backend
        const response = await fetch(API_BASE_URL + `/customers/${customerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(addressData)
        });

        if (response.ok) {
            showNotification('success', 'Address Information Saved', 'Your address information has been saved successfully!');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save address information');
        }
    } catch (error) {
        console.error('Error saving address information:', error);
        showNotification('error', 'Save Failed', error.message || 'Failed to save address information. Please try again.');
    }
}

/**
 * Save Identification Details
 */
/**
 * Handle Country of Citizenship change - show/hide SSN/ITIN or Visa section
 */
function handleCountryOfCitizenshipChange() {
    const countrySelect = document.getElementById('personalCountryOfCitizenship');
    const ssnSection = document.getElementById('identificationSsnSection');
    const visaSection = document.getElementById('identificationVisaSection');
    const noSelectionMessage = document.getElementById('identificationNoSelectionMessage');
    
    if (!countrySelect) return;
    
    const selectedCountry = countrySelect.value;
    
    // Hide all sections first
    if (ssnSection) ssnSection.style.display = 'none';
    if (visaSection) visaSection.style.display = 'none';
    if (noSelectionMessage) noSelectionMessage.style.display = 'none';
    
    if (selectedCountry === 'US') {
        // Show SSN/ITIN section for US
        if (ssnSection) {
            ssnSection.style.display = 'block';
            
            // If no entries exist, add the first one
            const container = document.getElementById('identificationSsnContainer');
            if (container && container.children.length === 0) {
                addIdentificationSsnEntry();
            }
        }
    } else if (selectedCountry && selectedCountry !== '') {
        // Show Visa section for non-US countries
        if (visaSection) {
            visaSection.style.display = 'block';
        }
    } else {
        // No country selected
        if (noSelectionMessage) {
            noSelectionMessage.style.display = 'block';
        }
    }
}

/**
 * Populate Name dropdown for SSN/ITIN entries
 */
function populateIdentificationNameDropdown(selectElement, customer) {
    if (!selectElement) return;
    
    // Clear existing options except the first one
    selectElement.innerHTML = '<option value="">Select Name</option>';
    
    // Add main customer
    const customerName = customer?.name || 'Main Customer';
    const mainOption = document.createElement('option');
    mainOption.value = 'main';
    mainOption.textContent = customerName;
    selectElement.appendChild(mainOption);
    
    // Add dependents if they exist
    const dependentsContainer = document.getElementById('dependentsContainer');
    if (dependentsContainer) {
        const dependentEntries = dependentsContainer.querySelectorAll('.dependent-entry');
        dependentEntries.forEach((entry, index) => {
            const nameInput = entry.querySelector('.dependent-name');
            if (nameInput && nameInput.value.trim()) {
                const dependentOption = document.createElement('option');
                dependentOption.value = `dependent_${index}`;
                dependentOption.textContent = nameInput.value.trim();
                selectElement.appendChild(dependentOption);
            }
        });
    }
}

/**
 * Add a new SSN/ITIN entry
 */
function addIdentificationSsnEntry() {
    const container = document.getElementById('identificationSsnContainer');
    if (!container) return;
    
    // Get current customer data
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    let customer = null;
    
    // Try to get customer from session or fetch it
    if (currentUser && currentUser.role === 'customer') {
        // We'll populate the dropdown after fetching customer data
        fetch(API_BASE_URL + '/customers/me', {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` }
        })
        .then(res => res.json())
        .then(cust => {
            customer = cust;
            updateAllIdentificationNameDropdowns(customer);
        })
        .catch(err => console.error('Error fetching customer:', err));
    }
    
    const entryIndex = container.children.length;
    const entryDiv = document.createElement('div');
    entryDiv.className = 'identification-ssn-entry mb-3 p-3';
    entryDiv.style.border = '1px solid var(--border-color)';
    entryDiv.style.borderRadius = '8px';
    entryDiv.style.background = 'var(--card-bg)';
    entryDiv.innerHTML = `
        <div class="row">
            <div class="col-md-5 mb-2">
                <label class="form-label" style="color: var(--text-color); font-weight: 600;">Name <span class="text-danger">*</span></label>
                <select class="form-control identification-name-select" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-color);">
                    <option value="">Select Name</option>
                </select>
            </div>
            <div class="col-md-5 mb-2">
                <label class="form-label" style="color: var(--text-color); font-weight: 600;">SSN / ITIN <span class="text-danger">*</span></label>
                <input type="text" class="form-control identification-ssn-input" placeholder="XXX-XX-XXXX" maxlength="11" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-color);">
            </div>
            <div class="col-md-2 mb-2 d-flex align-items-end">
                <button type="button" class="btn btn-sm btn-danger w-100" onclick="removeIdentificationSsnEntry(this)">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        </div>
    `;
    
    container.appendChild(entryDiv);
    
    // Populate the dropdown for this new entry
    const nameSelect = entryDiv.querySelector('.identification-name-select');
    if (customer) {
        populateIdentificationNameDropdown(nameSelect, customer);
    } else {
        // Wait a bit and try again
        setTimeout(() => {
            fetch(API_BASE_URL + '/customers/me', {
                headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` }
            })
            .then(res => res.json())
            .then(cust => {
                populateIdentificationNameDropdown(nameSelect, cust);
            })
            .catch(err => console.error('Error fetching customer:', err));
        }, 500);
    }
    
    // Add input formatting for SSN/ITIN
    const ssnInput = entryDiv.querySelector('.identification-ssn-input');
    ssnInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
        if (value.length > 3) {
            value = value.substring(0, 3) + '-' + value.substring(3);
        }
        if (value.length > 6) {
            value = value.substring(0, 6) + '-' + value.substring(6, 10);
        }
        e.target.value = value;
    });
}

/**
 * Remove an SSN/ITIN entry
 */
function removeIdentificationSsnEntry(button) {
    const container = document.getElementById('identificationSsnContainer');
    if (!container) return;
    
    button.closest('.identification-ssn-entry').remove();
    
    if (container.children.length === 0) {
        container.innerHTML = '<p class="text-muted">No SSN/ITIN entries added yet.</p>';
    }
}

/**
 * Update all Name dropdowns in SSN/ITIN entries
 */
function updateAllIdentificationNameDropdowns(customer) {
    const container = document.getElementById('identificationSsnContainer');
    if (!container) return;
    
    const nameSelects = container.querySelectorAll('.identification-name-select');
    nameSelects.forEach(select => {
        populateIdentificationNameDropdown(select, customer);
    });
}

/**
 * Save Identification Details (SSN/ITIN or Visa information)
 */
async function saveIdentificationDetails() {
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('error', 'Authentication Error', 'You are not logged in. Please log in again.');
            return;
        }

        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!currentUser || currentUser.role !== 'customer') {
            showNotification('error', 'Error', 'Customer information not found.');
            return;
        }

        const meResponse = await fetch(API_BASE_URL + '/customers/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!meResponse.ok) {
            throw new Error('Failed to fetch customer information');
        }

        const customer = await meResponse.json();
        const customerId = customer.id;
        const countrySelect = document.getElementById('personalCountryOfCitizenship');
        const selectedCountry = countrySelect?.value || '';

        const identificationData = {};

        if (selectedCountry === 'US') {
            // Collect SSN/ITIN entries for US
            const container = document.getElementById('identificationSsnContainer');
            const ssnEntries = [];
            
            if (container) {
                const entries = container.querySelectorAll('.identification-ssn-entry');
                entries.forEach(entry => {
                    const nameSelect = entry.querySelector('.identification-name-select');
                    const ssnInput = entry.querySelector('.identification-ssn-input');
                    
                    if (nameSelect && ssnInput && nameSelect.value && ssnInput.value.trim()) {
                        ssnEntries.push({
                            name: nameSelect.value,
                            nameDisplay: nameSelect.options[nameSelect.selectedIndex]?.text || '',
                            ssn_itin: ssnInput.value.trim()
                        });
                    }
                });
            }
            
            identificationData.ssn_itin_entries = ssnEntries;
        } else if (selectedCountry && selectedCountry !== '') {
            // Collect Visa information for non-US countries
            const visaType = document.getElementById('identificationVisaType')?.value || '';
            const latestVisaChange = document.getElementById('identificationLatestVisaChange')?.value || '';
            const primaryPortOfEntry = document.getElementById('identificationPrimaryPortOfEntry')?.value || '';
            const totalMonthsUS = document.getElementById('identificationTotalMonthsUS')?.value || '';
            
            identificationData.visa_type = visaType;
            identificationData.latest_visa_change = latestVisaChange;
            identificationData.primary_port_of_entry = primaryPortOfEntry;
            identificationData.total_months_stayed_us = totalMonthsUS ? parseFloat(totalMonthsUS) : null;
        }

        // Save to backend via tax-info endpoint (since it's related to tax filing)
        const taxYear = document.getElementById('taxYearSelector')?.value || new Date().getFullYear();
        const response = await fetch(API_BASE_URL + `/customers/tax-info`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                customer_id: customerId,
                tax_year: parseInt(taxYear),
                ...identificationData
            })
        });

        if (response.ok) {
            const message = selectedCountry === 'US' 
                ? 'Your SSN/ITIN information has been saved successfully!'
                : 'Your visa information has been saved successfully!';
            showNotification('success', 'Identification Details Saved', message);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save identification details');
        }
    } catch (error) {
        console.error('Error saving identification details:', error);
        showNotification('error', 'Save Failed', error.message || 'Failed to save identification details. Please try again.');
    }
}

/**
 * Customer logout function
 */
function customerLogout() {
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    showLogin();
    showNotification('success', 'Logged Out', 'You have been successfully logged out.');
}

// ============================================
// Microsoft OS Style Date Picker for DOB
// ============================================

// DOB Date Picker Variables
let currentDobCalendarDate = new Date();
let selectedDobCalendarDate = null;
let currentDobView = 'calendar'; // 'calendar', 'month', 'year'
let currentDobFieldId = null; // Track which field is being edited

function openDobDatePicker(fieldId) {
    currentDobFieldId = fieldId;
    selectedDobCalendarDate = null;
    currentDobView = 'calendar';
    
    // Hide month/year panel
    const monthYearPanel = document.getElementById('dobMonthYearPanel');
    if (monthYearPanel) {
        monthYearPanel.style.display = 'none';
    }
    
    // Set current date to existing value or today
    const field = document.getElementById(fieldId);
    const hiddenField = document.getElementById(fieldId + 'Hidden');
    let existingDate = null;
    
    if (hiddenField && hiddenField.value) {
        existingDate = hiddenField.value;
    } else if (field && field.value) {
        // Try to parse existing display value
        existingDate = field.value;
    }
    
    if (existingDate) {
        currentDobCalendarDate = new Date(existingDate);
    } else {
        currentDobCalendarDate = new Date();
    }
    
    renderDobCalendar();
    
    const modal = new bootstrap.Modal(document.getElementById('dobDatePickerModal'));
    modal.show();
}

function renderDobCalendar() {
    const calendarContainer = document.getElementById('dobDatePickerCalendar');
    if (!calendarContainer) return;
    
    const year = currentDobCalendarDate.getFullYear();
    const month = currentDobCalendarDate.getMonth();
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Month names
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Weekday names
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    let html = `
        <div class="ms-calendar-container">
            <div class="ms-calendar-header">
                <button class="ms-calendar-nav-btn" onclick="changeDobMonth(-1)">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div class="ms-calendar-month-year" onclick="showDobMonthYearPanel()">${monthNames[month]} ${year}</div>
                <button class="ms-calendar-nav-btn" onclick="changeDobMonth(1)">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="ms-calendar-weekdays">
    `;
    
    // Weekday headers
    weekdays.forEach(day => {
        html += `<div class="ms-calendar-weekday">${day}</div>`;
    });
    
    html += `</div><div class="ms-calendar-days">`;
    
    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
        html += `<div class="ms-calendar-day other-month"></div>`;
    }
    
    // Today's date
    const today = new Date();
    const isTodayMonth = today.getMonth() === month && today.getFullYear() === year;
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isToday = isTodayMonth && day === today.getDate();
        const isSelected = selectedDobCalendarDate && 
                          date.getDate() === selectedDobCalendarDate.getDate() &&
                          date.getMonth() === selectedDobCalendarDate.getMonth() &&
                          date.getFullYear() === selectedDobCalendarDate.getFullYear();
        
        let classes = 'ms-calendar-day';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';
        
        html += `<div class="${classes}" onclick="selectDobDate(${year}, ${month}, ${day})">${day}</div>`;
    }
    
    html += `</div></div>`;
    
    calendarContainer.innerHTML = html;
}

function changeDobMonth(direction) {
    currentDobCalendarDate.setMonth(currentDobCalendarDate.getMonth() + direction);
    renderDobCalendar();
}

function selectDobDate(year, month, day) {
    selectedDobCalendarDate = new Date(year, month, day);
    renderDobCalendar();
}

function confirmDobDateSelection() {
    if (selectedDobCalendarDate && currentDobFieldId) {
        const year = selectedDobCalendarDate.getFullYear();
        const month = String(selectedDobCalendarDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDobCalendarDate.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        
        // Format for display (e.g., "January 15, 2024")
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const displayDate = `${monthNames[selectedDobCalendarDate.getMonth()]} ${day}, ${year}`;
        
        // Update visible field and hidden field
        const field = document.getElementById(currentDobFieldId);
        const hiddenField = document.getElementById(currentDobFieldId + 'Hidden');
        
        if (field) {
            field.value = displayDate;
        }
        if (hiddenField) {
            hiddenField.value = formattedDate;
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('dobDatePickerModal'));
        if (modal) {
            modal.hide();
        }
    }
}

function showDobMonthYearPanel() {
    currentDobView = 'month';
    const monthYearPanel = document.getElementById('dobMonthYearPanel');
    if (monthYearPanel) {
        monthYearPanel.style.display = 'flex';
    }
    const panelTitle = document.getElementById('dobPanelTitle');
    if (panelTitle) {
        panelTitle.textContent = 'Select Month';
    }
    renderDobMonthSelection();
}

function renderDobMonthSelection() {
    const panelContent = document.getElementById('dobMonthYearPanelContent');
    if (!panelContent) return;
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonth = currentDobCalendarDate.getMonth();
    
    let html = `
        <div style="margin-bottom: 8px;">
            <div class="ms-year-item" style="font-weight: 600; padding: 12px 16px; border-bottom: 1px solid #d1d1d1; margin-bottom: 8px; cursor: pointer;" onclick="showDobYearSelection()">
                ${currentDobCalendarDate.getFullYear()} <i class="fas fa-chevron-right" style="float: right; font-size: 12px; margin-top: 2px;"></i>
            </div>
        </div>
        <div class="ms-month-grid">
    `;
    
    monthNames.forEach((monthName, index) => {
        const isCurrentMonth = index === currentMonth;
        const classes = isCurrentMonth ? 'ms-month-item current-month' : 'ms-month-item';
        html += `<div class="${classes}" onclick="selectDobMonth(${index})">${monthName.substring(0, 3)}</div>`;
    });
    
    html += `</div>`;
    panelContent.innerHTML = html;
}

function selectDobMonth(monthIndex) {
    currentDobCalendarDate.setMonth(monthIndex);
    currentDobView = 'calendar';
    const monthYearPanel = document.getElementById('dobMonthYearPanel');
    if (monthYearPanel) {
        monthYearPanel.style.display = 'none';
    }
    renderDobCalendar();
}

function showDobYearSelection() {
    currentDobView = 'year';
    const panelTitle = document.getElementById('dobPanelTitle');
    if (panelTitle) {
        panelTitle.textContent = 'Select Year';
    }
    // Calculate which page contains the current year
    const currentYear = currentDobCalendarDate.getFullYear();
    const today = new Date();
    const currentYearToday = today.getFullYear();
    const startYear = currentYearToday - 100;
    const yearsPerPage = 15;
    
    // Find which page contains the current year
    for (let page = 0; page < 10; page++) {
        const pageStartYear = startYear + (page * yearsPerPage);
        const pageEndYear = Math.min(startYear + ((page + 1) * yearsPerPage) - 1, currentYearToday + 10);
        if (currentYear >= pageStartYear && currentYear <= pageEndYear) {
            currentDobYearPage = page;
            break;
        }
    }
    renderDobYearSelection();
}

function renderDobYearSelection() {
    const panelContent = document.getElementById('dobMonthYearPanelContent');
    if (!panelContent) return;
    
    const currentYear = currentDobCalendarDate.getFullYear();
    const today = new Date();
    const currentYearToday = today.getFullYear();
    
    // For DOB, show years from 100 years ago to 10 years in the future
    const startYear = currentYearToday - 100;
    const endYear = currentYearToday + 10;
    
    // Calculate which page of years we're on (15 years per page)
    const yearsPerPage = 15;
    const totalYears = endYear - startYear + 1;
    const totalPages = Math.ceil(totalYears / yearsPerPage);
    
    // Calculate the page range to show based on currentDobYearPage
    const pageStartYear = startYear + (currentDobYearPage * yearsPerPage);
    const pageEndYear = Math.min(startYear + ((currentDobYearPage + 1) * yearsPerPage) - 1, endYear);
    
    let html = `<div class="ms-year-grid" style="max-height: 300px; overflow-y: auto;">`;
    
    // Add navigation button for previous page if not on first page
    if (currentDobYearPage > 0) {
        html += `<div class="ms-year-item" style="grid-column: 1 / -1; font-weight: 600; padding: 8px; text-align: center; cursor: pointer; background: #f3f3f3; border-radius: 2px; margin-bottom: 4px;" onclick="navigateDobYearPage(${currentDobYearPage - 1})">
            <i class="fas fa-chevron-up"></i> Previous Years
        </div>`;
    }
    
    for (let year = pageStartYear; year <= pageEndYear; year++) {
        const isCurrentYear = year === currentYear;
        const classes = isCurrentYear ? 'ms-year-item current-year' : 'ms-year-item';
        html += `<div class="${classes}" onclick="selectDobYear(${year})">${year}</div>`;
    }
    
    html += `</div>`;
    panelContent.innerHTML = html;
    
    // Scroll to current year if it's in the visible range
    setTimeout(() => {
        const currentYearElement = panelContent.querySelector(`.ms-year-item.current-year`);
        if (currentYearElement) {
            currentYearElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

// Store current year page for navigation
let currentDobYearPage = 0;

function navigateDobYearPage(page) {
    currentDobYearPage = page;
    renderDobYearSelection();
}

function selectDobYear(year) {
    currentDobCalendarDate.setFullYear(year);
    showDobMonthYearPanel(); // Go back to month selection
}

function goBackToDobCalendar() {
    currentDobView = 'calendar';
    const monthYearPanel = document.getElementById('dobMonthYearPanel');
    if (monthYearPanel) {
        monthYearPanel.style.display = 'none';
    }
    renderDobCalendar();
}



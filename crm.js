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
    
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="${icons[type]}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="closeNotification(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
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
    // Load users from database
    loadUsers();
    // Load customers from database
    loadCustomers();
    // Load user profiles from sessionStorage
    loadUserProfiles();
    
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
    
    // Always show login page - require authentication on each page load
    showLogin();
    
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
}

// Authentication Functions
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
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
        
        const response = await fetch(API_BASE_URL + '/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: usernameLower, password }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        if (response.ok) {
            // Login successful - save token and user info
            sessionStorage.setItem('authToken', data.token);
            sessionStorage.setItem('currentUser', JSON.stringify(data.user));
            currentUser = data.user;
            showDashboard();
            showNotification('success', 'Login Successful', 'Welcome back!');
        } else {
            // Login failed
            showNotification('error', 'Login Failed', data.error || 'Invalid credentials');
        }
    } catch (error) {
        console.error('Login error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            apiUrl: API_BASE_URL + '/auth/login'
        });
        
        // Provide detailed error message
        let errorMessage = 'Connection error. ';
        
        if (error.name === 'AbortError') {
            errorMessage += 'Request timed out. The server may be slow or unreachable.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage += `Cannot reach server at ${API_BASE_URL}. `;
            errorMessage += 'Please check: 1) Is Railway backend deployed? 2) Is the URL correct? 3) Check browser console for CORS errors.';
        } else if (error.message.includes('CORS')) {
            errorMessage += 'CORS error. Backend may not be configured correctly.';
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
    // Check if employee is trying to access restricted tabs
    if (currentUser.role !== 'admin' && ['upload', 'assignWork', 'progress', 'userManagement'].includes(tabName)) {
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
            if (currentUser.role !== 'admin') {
                document.getElementById('assignedWorkTab').style.display = 'block';
                loadAssignedWorkTable();
            }
            break;
        case 'upload':
            if (currentUser.role === 'admin') {
                document.getElementById('uploadTab').style.display = 'block';
            }
            break;
        case 'assignWork':
            if (currentUser.role === 'admin') {
                document.getElementById('assignWorkTab').style.display = 'block';
                loadAssignWorkTable();
            }
            break;
        case 'progress':
            if (currentUser.role === 'admin') {
                document.getElementById('progressTab').style.display = 'block';
                loadProgressCharts();
            }
            break;
        case 'reports':
            if (currentUser.role === 'admin') {
                document.getElementById('reportsTab').style.display = 'block';
            }
            break;
        case 'userManagement':
            if (currentUser.role === 'admin') {
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
    } else {
        loadEmployeeDashboard();
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
                <div class="stats-card" onclick="filterByStatus('follow_up')">
                    <div class="stats-icon" style="background: #ffa500;">
                        <i class="fas fa-redo"></i>
                    </div>
                    <div class="stats-number">${stats.followUpCount || 0}</div>
                    <div class="stats-label">Follow-up</div>
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
                <div class="stats-card" onclick="filterByStatus('follow_up')">
                    <div class="stats-icon" style="background: #ffa500;">
                        <i class="fas fa-redo"></i>
                    </div>
                    <div class="stats-number">${getFollowUpCustomers().length}</div>
                    <div class="stats-label">Follow-up</div>
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
    const tbody = document.getElementById('assignedWorkTable');
    
    tbody.innerHTML = assignedCustomers.map(customer => `
        <tr>
            <td><strong>${customer.firstName} ${customer.lastName}</strong></td>
            <td><a href="tel:${customer.phone}" class="text-decoration-none">${customer.phone}</a></td>
            <td><a href="mailto:${customer.email}" class="text-decoration-none">${customer.email}</a></td>
            <td><small class="text-muted">${customer.address}</small></td>
            <td><span class="badge bg-${getStatusBadgeColor(customer.status)}">${getStatusDisplayName(customer.status)}</span></td>
            <td><span class="badge bg-${getCallStatusBadgeColor(customer.callStatus)}">${customer.callStatus}</span></td>
            <td><small>${customer.comments || '-'}</small></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openUpdateStatusModal(${customer.id})" title="Edit">
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
    
    // Store filter status globally to use in loadAssignWorkTable
    if (!window.currentFilter) {
        window.currentFilter = null;
    }
    
    if (status === 'follow_up') {
        // Filter for follow-up customers
        const followUpCustomers = getFollowUpCustomers();
        loadAssignWorkTableWithFilter(followUpCustomers);
    } else if (status === 'all') {
        // Show all customers
        window.currentFilter = null;
        loadAssignWorkTable();
    } else {
        // Filter by status
        window.currentFilter = status;
        loadAssignWorkTable();
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
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
                                            <td><a href="tel:${customer.phone}" class="text-decoration-none">${customer.phone}</a></td>
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
        <tr>
            <td><input type="checkbox" class="archive-customer-checkbox" data-id="${customer.id}"></td>
            <td><strong>${customer.firstName} ${customer.lastName}</strong></td>
            <td><a href="tel:${customer.phone || ''}" class="text-decoration-none">${customer.phone || ''}</a></td>
            <td><a href="mailto:${customer.email || ''}" class="text-decoration-none">${customer.email || ''}</a></td>
            <td><small class="text-muted">${customer.address || ''}</small></td>
            <td style="text-align:center;"><span class="badge bg-${getStatusBadgeColor(statusForDisplay)}">${getStatusDisplayName(statusForDisplay)}</span></td>
            <td><small>${customer.comments || '-'}</small></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openUpdateStatusModal(${customer.id})" title="Edit">
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
    const archiveBtn = document.getElementById('archiveSelectedBtn');
    if (!archiveBtn) return;
    const isAdmin = currentUser && currentUser.role === 'admin';
    // Archive button is always visible for admin in Assign Work (archived customers are in modal only)
    archiveBtn.style.display = isAdmin ? 'inline-flex' : 'none';
}

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
        const pagination = data.pagination || { totalRecords: customersData.length, totalPages: 1 };
        
        // Debug logging - CRITICAL for troubleshooting
        console.log('=== ASSIGN WORK PAGE DEBUG ===');
        console.log('API Response:', {
            customersCount: customersData.length,
            pagination: pagination,
            currentPage: page,
            pageSize: size,
            totalRecords: pagination.totalRecords,
            totalPages: pagination.totalPages
        });
        console.log('Full API Response:', data);
        
        // Transform database records to match frontend expectations
        const slice = customersData.map(customer => {
            let firstName = customer.firstName || '';
            let lastName = customer.lastName || '';
            
            if (!firstName && !lastName && customer.name) {
                const nameParts = customer.name.trim().split(/\s+/);
                firstName = nameParts[0] || '';
                lastName = nameParts.slice(1).join(' ') || '';
            }
            
            return {
                ...customer,
                id: customer.id,
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
        
        // Use pagination info from API - CRITICAL: Use totalRecords from API, not filteredSlice.length
        // filteredSlice.length is only the current page's data (e.g., 100), not the total
        // If API doesn't provide totalRecords, we need to fetch it separately
        let total = pagination.totalRecords || 0;
        let pages = pagination.totalPages || Math.max(1, Math.ceil(total / size));
        
        // If total is 0 but we have data, it means API didn't return pagination info
        // This shouldn't happen, but let's handle it gracefully
        if (total === 0 && customersData.length > 0) {
            console.warn('API did not return totalRecords. Fetching total count...');
            // Try to get total from a separate count query
            try {
                const countResponse = await fetch(API_BASE_URL + '/customers?limit=1&page=1', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (countResponse.ok) {
                    const countData = await countResponse.json();
                    if (countData.pagination && countData.pagination.totalRecords) {
                        total = countData.pagination.totalRecords;
                        pages = Math.max(1, Math.ceil(total / size));
                    }
                }
            } catch (e) {
                console.error('Failed to fetch total count:', e);
            }
        }
        
        console.log('Pagination calculation:', {
            total: total,
            pages: pages,
            currentPage: page,
            pageSize: size,
            filteredSliceLength: filteredSlice.length,
            apiPagination: pagination
        });
        
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
            <tr>
                <td><input type="checkbox" class="customer-checkbox" data-id="${customer.id}"></td>
                <td><strong>${customer.firstName} ${customer.lastName}</strong></td>
                <td><a href="tel:${customer.phone || ''}" class="text-decoration-none">${customer.phone || ''}</a></td>
                <td><a href="mailto:${customer.email || ''}" class="text-decoration-none">${customer.email || ''}</a></td>
                <td><small class="text-muted">${customer.address || ''}</small></td>
                <td><span class="badge bg-${getStatusBadgeColor(statusForDisplay)}">${getStatusDisplayName(statusForDisplay)}</span></td>
                <td>${assignedToDisplay}</td>
                ${refundStatusDisplay}
                <td><small>${customer.comments || '-'}</small></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="openUpdateStatusModal(${customer.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>`;
        }
        if (tbody) tbody.innerHTML = html;
        
        // Initialize column reordering for assigned work table
        initColumnReordering('assignedWorkTable');

        // CRITICAL: Re-fetch pagination element (it might have been created earlier)
        pager = document.getElementById('assignPagination');
        
        // Always show pagination - ensure element exists and is visible
        if (!pager) {
            console.warn('Pagination element not found! Creating it...');
            const assignWorkTab = document.getElementById('assignWorkTab');
            if (assignWorkTab) {
                // Create pagination element INSIDE assignWorkTab
                const newPager = document.createElement('div');
                newPager.id = 'assignPagination';
                newPager.className = 'd-flex justify-content-between align-items-center mt-3 mb-3 px-3';
                newPager.style.cssText = 'display: flex !important; visibility: visible !important; background-color: #f8f9fa; border-top: 1px solid #dee2e6; padding: 15px !important;';
                assignWorkTab.appendChild(newPager);
                pager = newPager;
                console.log('Created pagination element inside assignWorkTab');
            } else {
                console.error('assignWorkTab element not found!');
            }
        }
        
        // Ensure pagination is always visible
        if (pager) {
            const pagesText = Math.max(1, pages);
            const displayStart = total === 0 ? 0 : (page - 1) * size + 1;
            const displayEnd = total === 0 ? 0 : Math.min(page * size, total);
            
            // Show warning if total is 0 but we have data
            let totalDisplay = total.toLocaleString();
            if (total === 0 && displaySlice.length > 0) {
                totalDisplay = `${displaySlice.length}+ (exact count unavailable)`;
            }
            
            // Pagination controls - centered at bottom as marked in red circle
            const paginationHTML = `
                <div style="display: flex; justify-content: center; align-items: center; gap: 15px; flex-wrap: wrap; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button class="btn btn-sm btn-outline-primary" ${page===1?'disabled':''} onclick="window.assignCurrentPage=1; renderAssignWorkPage()" style="padding: 6px 12px; min-width: 70px;">
                            <i class="fas fa-angle-double-left"></i> First
                        </button>
                        <button class="btn btn-sm btn-outline-primary" ${page===1?'disabled':''} onclick="window.assignCurrentPage=Math.max(1, window.assignCurrentPage-1); renderAssignWorkPage()" style="padding: 6px 12px; min-width: 70px;">
                            <i class="fas fa-angle-left"></i> Prev
                        </button>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; padding: 0 15px;">
                        <span style="color: #333; font-size: 14px; font-weight: 500;">Page</span>
                        <span style="color: #007bff; font-size: 16px; font-weight: bold; min-width: 30px; text-align: center;">${page}</span>
                        <span style="color: #666; font-size: 14px;">of</span>
                        <span style="color: #333; font-size: 14px; font-weight: 500; min-width: 50px; text-align: center;">${pagesText}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="margin: 0; color: #333; font-size: 14px; font-weight: 500; white-space: nowrap;">Show:</label>
                        <select class="form-select form-select-sm" style="width: 90px !important; padding: 6px 10px !important; font-size: 14px !important; border: 2px solid #007bff !important; border-radius: 4px !important; font-weight: 500 !important;" onchange="window.assignPageSize=parseInt(this.value); window.assignCurrentPage=1; renderAssignWorkPage()">
                            <option ${size===100?'selected':''} value="100">100</option>
                            <option ${size===200?'selected':''} value="200">200</option>
                            <option ${size===300?'selected':''} value="300">300</option>
                            <option ${size===400?'selected':''} value="400">400</option>
                            <option ${size===500?'selected':''} value="500">500</option>
                        </select>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button class="btn btn-sm btn-outline-primary" ${page>=pagesText?'disabled':''} onclick="window.assignCurrentPage=Math.min(${pagesText}, window.assignCurrentPage+1); renderAssignWorkPage()" style="padding: 6px 12px; min-width: 70px;">
                            Next <i class="fas fa-angle-right"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary" ${page>=pagesText?'disabled':''} onclick="window.assignCurrentPage=${pagesText}; renderAssignWorkPage()" style="padding: 6px 12px; min-width: 70px;">
                            Last <i class="fas fa-angle-double-right"></i>
                        </button>
                    </div>
                    <div style="margin-left: 20px; padding-left: 20px; border-left: 1px solid #ddd;">
                        <span style="color: #666; font-size: 13px;">
                            Showing <strong style="color: #333;">${displayStart.toLocaleString()}-${displayEnd.toLocaleString()}</strong> of <strong style="color: #007bff;">${totalDisplay}</strong> customers
                        </span>
                    </div>
                </div>
            `;
            
            // Clear any existing content and set new HTML
            pager.innerHTML = '';
            pager.innerHTML = paginationHTML;
            
            // FORCE VISIBILITY - Centered at bottom, always visible
            pager.style.cssText = 'display: flex !important; justify-content: center !important; align-items: center !important; visibility: visible !important; opacity: 1 !important; position: relative !important; padding: 15px 20px !important; margin-top: 20px !important; border-top: 2px solid #007bff !important; background: #f8f9fa !important; width: 100% !important; min-height: 70px !important; box-shadow: 0 -2px 8px rgba(0,0,0,0.1) !important;';
            
            // Verify it was set
            const actualHTML = pager.innerHTML;
            console.log('✅ PAGINATION RENDERED!', {
                element: pager,
                elementVisible: pager.offsetHeight > 0,
                elementDisplay: window.getComputedStyle(pager).display,
                elementVisibility: window.getComputedStyle(pager).visibility,
                innerHTMLLength: actualHTML.length,
                innerHTMLPreview: actualHTML.substring(0, 200),
                total: total,
                page: page,
                pages: pagesText,
                size: size,
                hasSelect: actualHTML.includes('<select'),
                hasShowLabel: actualHTML.includes('Show:')
            });
            
            // If HTML wasn't set, try again
            if (!actualHTML || actualHTML.length < 50) {
                console.error('❌ Pagination HTML not set! Trying again...');
                pager.innerHTML = paginationHTML;
            }
            
            // Force scroll to make it visible
            setTimeout(() => {
                pager.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 300);
        } else {
            console.error('Could not find or create pagination element!');
        }

        // Initialize column resizing once per render
        initAssignWorkColumnResize();
        updateAssignArchiveButtonsVisibility();
    } catch (error) {
        console.error('Error loading assign work table:', error);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Error loading customers. Please refresh the page.</td></tr>';
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
    const employees = users.filter(u => u.role === 'employee' && !u.locked);
    
    employeeList.innerHTML = employees.map(employee => `
        <li><a class="dropdown-item" href="#" onclick="assignToEmployee('${employee.username}')">
            <i class="fas fa-user"></i> ${employee.username}
        </a></li>
    `).join('');
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
    
    const modal = new bootstrap.Modal(document.getElementById('updateStatusModal'));
    modal.show();
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
        customer.address = addressParts.join(', ') || '';
        
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
        
        // Save refund status if preparation role updated it
        const isPreparation = currentUser && currentUser.role === 'preparation';
        if (isPreparation) {
            const refundStatusField = document.getElementById('updateCustomerRefundStatus');
            if (refundStatusField) {
                const refundStatus = refundStatusField.value || '';
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
        
        const customerData = {
            name: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
            email: customer.email || null,
            phone: customer.phone || null,
            status: status,
            assigned_to: customer.assignedTo || customer.assigned_to || null,
            notes: comments || customer.notes || null
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
                    customers[index] = { ...customers[index], ...updated, status, comments: comments };
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
function loadUserManagementTable() {
    if (currentUser.role !== 'admin') return;
    
    const tbody = document.getElementById('userManagementTable');
    
    tbody.innerHTML = users.map(user => {
        let roleBadgeClass = 'success'; // default for employee
        if (user.role === 'admin') {
            roleBadgeClass = 'primary';
        } else if (user.role === 'preparation') {
            roleBadgeClass = 'info';
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
    }).join('');
}

function showAddUserModal() {
    const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
    modal.show();
}

async function saveNewUser() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newUserRole').value;
    
    if (!username || !password) {
        showNotification('error', 'Missing Information', 'Username and password are required!');
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
            
            // Hide modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addUserModal'));
            modal.hide();
            
            // Reset form
            document.getElementById('addUserForm').reset();
            
            // Reload table
            loadUserManagementTable();
            
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
        <tr>
            <td>${customer.firstName} ${customer.lastName}</td>
            <td>${customer.phone}</td>
            <td>${customer.email}</td>
            <td>${customer.address}</td>
            <td><span class="badge bg-${getStatusBadgeColor(customer.status)}">${getStatusDisplayName(customer.status)}</span></td>
            <td><span class="badge bg-${getCallStatusBadgeColor(customer.callStatus)}">${customer.callStatus}</span></td>
            <td>${customer.comments || '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openUpdateStatusModal(${customer.id})">
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


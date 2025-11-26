/**
 * Clean URLs Handler for Railway Hosting
 * Removes .html extension from URLs in the address bar while maintaining functionality
 */

(function() {
    'use strict';

    // Function to get clean URL path
    function getCleanPath(href) {
        // If it's a full URL, extract the path
        if (href.startsWith('http://') || href.startsWith('https://')) {
            const url = new URL(href);
            let path = url.pathname;
            
            // Remove .html extension
            if (path.endsWith('.html')) {
                path = path.slice(0, -5);
            }
            
            // Handle index.html -> /
            if (path === '/index' || path === '/index.html' || path === '') {
                path = '/';
            }
            
            return path + (url.search || '') + (url.hash || '');
        }
        
        // Handle relative paths
        let path = href;
        
        // Remove .html extension
        if (path.endsWith('.html')) {
            path = path.slice(0, -5);
        }
        
        // Handle index.html -> /
        if (path === 'index' || path === 'index.html' || path === './index.html') {
            path = '/';
        } else if (path.startsWith('./')) {
            path = path.slice(2);
        }
        
        // Ensure path starts with / for absolute paths
        if (!path.startsWith('/') && !path.startsWith('#') && !path.startsWith('?')) {
            // Get current directory
            const currentPath = window.location.pathname;
            const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
            path = currentDir + path;
        }
        
        return path;
    }

    // Function to get actual file path (with .html)
    function getActualFilePath(cleanPath) {
        // Remove leading slash for relative path
        let filePath = cleanPath.replace(/^\//, '');
        
        // Handle root/index
        if (filePath === '' || filePath === '/') {
            return 'index.html';
        }
        
        // Remove trailing slash
        filePath = filePath.replace(/\/$/, '');
        
        // Remove query string and hash for file path
        const pathOnly = filePath.split('?')[0].split('#')[0];
        
        // Add .html if not already present
        if (!pathOnly.endsWith('.html')) {
            return pathOnly + '.html';
        }
        
        return pathOnly;
    }
    
    // Function to check if a path is an internal HTML page
    function isInternalHtmlLink(href) {
        // Skip external links, mailto, tel, javascript:, anchors, and CRM links
        if (href.startsWith('http://') || 
            href.startsWith('https://') || 
            href.startsWith('mailto:') || 
            href.startsWith('tel:') || 
            href.startsWith('javascript:') || 
            href.startsWith('#') ||
            href.startsWith('/crm') ||
            href.includes('://')) {
            return false;
        }
        
        // Check if it's an HTML link (ends with .html, is index, or is a clean path)
        return href.endsWith('.html') || 
               href === 'index.html' || 
               href === '/' ||
               href === '/index' ||
               (!href.includes('.') && !href.startsWith('?') && !href.startsWith('#'));
    }

    // Initialize clean URLs on page load
    function initCleanUrls() {
        // Update current URL if it has .html
        const currentPath = window.location.pathname;
        if (currentPath.endsWith('.html') || currentPath === '/index.html') {
            const cleanPath = getCleanPath(currentPath);
            if (cleanPath !== currentPath) {
                // Update URL without reload
                window.history.replaceState({}, '', cleanPath + window.location.search + window.location.hash);
            }
        }
    }

    // Handle link clicks
    function handleLinkClick(e) {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Check if it's an internal HTML link
        if (!isInternalHtmlLink(href)) {
            return;
        }

        // Process the link
        {
            e.preventDefault();
            
            // Get clean path
            const cleanPath = getCleanPath(href);
            
            // Get actual file path
            const actualPath = getActualFilePath(cleanPath);
            
            // Update URL to clean path
            window.history.pushState({ path: actualPath }, '', cleanPath);
            
            // Load the actual file
            window.location.href = actualPath;
        }
    }

    // Handle browser back/forward buttons
    function handlePopState(e) {
        const path = window.location.pathname;
        const actualPath = getActualFilePath(path);
        
        // Load the actual file
        window.location.href = actualPath;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initCleanUrls();
            document.addEventListener('click', handleLinkClick);
            window.addEventListener('popstate', handlePopState);
        });
    } else {
        // DOM already loaded
        initCleanUrls();
        document.addEventListener('click', handleLinkClick);
        window.addEventListener('popstate', handlePopState);
    }

    // Also handle immediate execution for scripts loaded after DOM
    initCleanUrls();
})();


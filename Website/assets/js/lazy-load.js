/**
 * Global Lazy Loading Utility
 * Automatically lazy loads images across all pages
 */

(function() {
    'use strict';

    // Initialize lazy loading when DOM is ready
    function initLazyLoading() {
        // Find all images that should be lazy loaded
        const images = document.querySelectorAll('img[data-src], img:not([loading])');
        
        // Skip images that are already in viewport or critical (logo, icons)
        const criticalSelectors = [
            'img[src*="logo"]',
            'img[src*="icon"]',
            'img[src*="favicon"]',
            '.preloader img',
            '.logo-icon'
        ];
        
        const lazyImages = Array.from(images).filter(img => {
            // Skip critical images
            for (let selector of criticalSelectors) {
                if (img.matches(selector)) return false;
            }
            // Skip if already has loading attribute
            if (img.hasAttribute('loading')) return false;
            // Skip if already has data-src (already set up)
            if (img.hasAttribute('data-src')) return true;
            // Skip if src is a data URI or SVG
            if (img.src && (img.src.startsWith('data:') || img.src.endsWith('.svg'))) return false;
            return true;
        });

        if (lazyImages.length === 0) return;

        // Set up lazy loading for images without data-src
        lazyImages.forEach(img => {
            if (!img.hasAttribute('data-src')) {
                const originalSrc = img.src;
                // Create placeholder
                img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect fill="%23f0f0f0" width="1" height="1"/%3E%3C/svg%3E';
                img.setAttribute('data-src', originalSrc);
                img.style.opacity = '0';
                img.style.transition = 'opacity 0.3s ease';
            }
        });

        // Use Intersection Observer for modern browsers
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        const dataSrc = img.getAttribute('data-src');
                        
                        if (dataSrc) {
                            // Load the image
                            img.src = dataSrc;
                            img.removeAttribute('data-src');
                            
                            // Fade in when loaded
                            img.onload = function() {
                                img.style.opacity = '1';
                                img.classList.add('loaded');
                            };
                            
                            // Handle errors
                            img.onerror = function() {
                                img.style.opacity = '1';
                                img.classList.add('error');
                            };
                            
                            observer.unobserve(img);
                        }
                    }
                });
            }, {
                rootMargin: '50px', // Start loading 50px before entering viewport
                threshold: 0.01
            });

            // Observe all lazy images
            lazyImages.forEach(img => {
                if (img.hasAttribute('data-src')) {
                    imageObserver.observe(img);
                }
            });
        } else {
            // Fallback for older browsers - load all images immediately
            lazyImages.forEach(img => {
                const dataSrc = img.getAttribute('data-src');
                if (dataSrc) {
                    img.src = dataSrc;
                    img.removeAttribute('data-src');
                    img.style.opacity = '1';
                    img.classList.add('loaded');
                }
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLazyLoading);
    } else {
        initLazyLoading();
    }

    // Re-initialize for dynamically added content
    window.initLazyLoading = initLazyLoading;
})();


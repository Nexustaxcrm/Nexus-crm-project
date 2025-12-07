/**
 * STANDALONE HAMBURGER MENU FIX
 * This is a completely independent solution that will work regardless of other code
 */

(function() {
  'use strict';
  
  console.log("=== HAMBURGER FIX SCRIPT LOADED ===");
  
  // Wait for DOM to be ready
  function initHamburgerMenu() {
    console.log("Initializing hamburger menu...");
    
    // Find elements
    var hamburger = document.querySelector('.ak-munu_toggle');
    var menu = document.querySelector('.ak-nav_list');
    
    if (!hamburger) {
      console.error("Hamburger button not found!");
      return;
    }
    
    if (!menu) {
      console.error("Menu list not found!");
      return;
    }
    
    console.log("Found hamburger:", hamburger);
    console.log("Found menu:", menu);
    
    // Function to open menu
    function openMenu() {
      console.log("OPENING MENU");
      menu.classList.add('active', 'show');
      menu.style.cssText = 
        'display: flex !important; ' +
        'visibility: visible !important; ' +
        'opacity: 1 !important; ' +
        'position: fixed !important; ' +
        'left: 0 !important; ' +
        'top: 0 !important; ' +
        'width: 100vw !important; ' +
        'height: 100vh !important; ' +
        'z-index: 99999999 !important; ' +
        'background-color: #ffffff !important; ' +
        'flex-direction: column !important; ' +
        'align-items: flex-start !important; ' +
        'justify-content: flex-start !important; ' +
        'padding: 80px 0 0 0 !important; ' +
        'overflow-y: auto !important; ' +
        'margin: 0 !important;';
      hamburger.classList.add('ak-toggle_active');
      document.body.classList.add('menu-open');
      console.log("Menu opened!");
    }
    
    // Function to close menu
    function closeMenu() {
      console.log("CLOSING MENU");
      menu.classList.remove('active', 'show');
      menu.style.cssText = 'display: none !important; visibility: hidden; opacity: 0;';
      hamburger.classList.remove('ak-toggle_active');
      document.body.classList.remove('menu-open');
      console.log("Menu closed!");
    }
    
    // Function to toggle menu
    function toggleMenu() {
      console.log("TOGGLE MENU CALLED");
      var isOpen = menu.classList.contains('active') || menu.classList.contains('show');
      console.log("Menu is open:", isOpen);
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    }
    
    // Remove any existing event listeners by cloning
    var newHamburger = hamburger.cloneNode(true);
    hamburger.parentNode.replaceChild(newHamburger, hamburger);
    hamburger = newHamburger;
    
    // Add click event - use capture phase to catch it first
    hamburger.addEventListener('click', function(e) {
      console.log("HAMBURGER CLICKED!");
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      toggleMenu();
      return false;
    }, true);
    
    // Also listen on the span inside
    var span = hamburger.querySelector('span');
    if (span) {
      span.addEventListener('click', function(e) {
        console.log("HAMBURGER SPAN CLICKED!");
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toggleMenu();
        return false;
      }, true);
    }
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!hamburger.contains(e.target) && !menu.contains(e.target)) {
        if (menu.classList.contains('active') || menu.classList.contains('show')) {
          closeMenu();
        }
      }
    });
    
    // Close menu on ESC key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        if (menu.classList.contains('active') || menu.classList.contains('show')) {
          closeMenu();
        }
      }
    });
    
    console.log("Hamburger menu initialized successfully!");
  }
  
  // Try multiple times to ensure it works
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHamburgerMenu);
  } else {
    initHamburgerMenu();
  }
  
  // Also try after delays
  setTimeout(initHamburgerMenu, 100);
  setTimeout(initHamburgerMenu, 500);
  setTimeout(initHamburgerMenu, 1000);
  setTimeout(initHamburgerMenu, 2000);
  
})();


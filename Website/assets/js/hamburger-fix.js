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
    
    // DISABLE any jQuery handlers that might conflict
    if (typeof $ !== 'undefined') {
      try {
        $(document).off("click touchstart", ".ak-munu_toggle");
        $(".ak-munu_toggle").off("click touchstart");
        $(".ak-munu_toggle span").off("click touchstart");
        console.log("Disabled jQuery handlers");
      } catch(e) {
        console.log("jQuery not available or error disabling handlers:", e);
      }
    }
    
    // Find elements
    var hamburger = document.querySelector('.ak-munu_toggle');
    var menu = document.querySelector('.ak-nav_list');
    
    if (!hamburger) {
      console.error("Hamburger button not found! Searching again...");
      // Try again after a delay
      setTimeout(function() {
        hamburger = document.querySelector('.ak-munu_toggle');
        if (hamburger) {
          console.log("Found hamburger on retry!");
          initHamburgerMenu();
        }
      }, 500);
      return;
    }
    
    if (!menu) {
      console.error("Menu list not found! Searching again...");
      setTimeout(function() {
        menu = document.querySelector('.ak-nav_list');
        if (menu) {
          console.log("Found menu on retry!");
          initHamburgerMenu();
        }
      }, 500);
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
    
    // Make hamburger clickable - ensure it's not blocked
    hamburger.style.pointerEvents = 'auto';
    hamburger.style.cursor = 'pointer';
    hamburger.style.zIndex = '99999999';
    hamburger.style.position = 'relative';
    
    // Remove any existing event listeners by cloning
    var newHamburger = hamburger.cloneNode(true);
    newHamburger.style.pointerEvents = 'auto';
    newHamburger.style.cursor = 'pointer';
    newHamburger.style.zIndex = '99999999';
    newHamburger.style.position = 'relative';
    hamburger.parentNode.replaceChild(newHamburger, hamburger);
    hamburger = newHamburger;
    
    // Add multiple event types to ensure it works
    var clickHandler = function(e) {
      console.log("HAMBURGER CLICKED! Event type:", e.type);
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      toggleMenu();
      return false;
    };
    
    // Add click event - use capture phase to catch it first
    hamburger.addEventListener('click', clickHandler, true);
    hamburger.addEventListener('touchstart', clickHandler, true);
    hamburger.addEventListener('touchend', function(e) {
      e.preventDefault();
      clickHandler(e);
    }, true);
    
    // Also listen on the span inside
    var span = hamburger.querySelector('span');
    if (span) {
      span.style.pointerEvents = 'auto';
      span.style.cursor = 'pointer';
      span.addEventListener('click', clickHandler, true);
      span.addEventListener('touchstart', clickHandler, true);
    }
    
    // Also add to the parent container
    var parent = hamburger.parentElement;
    if (parent && parent.classList.contains('ak-main-header-right')) {
      parent.style.pointerEvents = 'auto';
      parent.style.zIndex = '99999999';
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
  function tryInit() {
    var hamburger = document.querySelector('.ak-munu_toggle');
    var menu = document.querySelector('.ak-nav_list');
    if (hamburger && menu) {
      console.log("Elements found, initializing...");
      initHamburgerMenu();
      return true;
    } else {
      console.log("Elements not found yet, retrying...");
      return false;
    }
  }
  
  // Try immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      if (!tryInit()) {
        setTimeout(tryInit, 100);
        setTimeout(tryInit, 500);
        setTimeout(tryInit, 1000);
        setTimeout(tryInit, 2000);
      }
    });
  } else {
    if (!tryInit()) {
      setTimeout(tryInit, 100);
      setTimeout(tryInit, 500);
      setTimeout(tryInit, 1000);
      setTimeout(tryInit, 2000);
    }
  }
  
  // Also try after window load
  window.addEventListener('load', function() {
    setTimeout(tryInit, 100);
  });
  
})();


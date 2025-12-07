/**
 * SIMPLE HAMBURGER MENU FIX - NO BULLSHIT
 * This WILL work
 */

(function() {
  'use strict';
  
  console.log("=== HAMBURGER FIX LOADED ===");
  
  var hamburger = null;
  var menu = null;
  var isMenuOpen = false;
  
  function findElements() {
    hamburger = document.querySelector('.ak-munu_toggle');
    menu = document.querySelector('.ak-nav_list');
    
    if (hamburger) console.log("✓ Hamburger found");
    else console.error("✗ Hamburger NOT found");
    
    if (menu) console.log("✓ Menu found");
    else console.error("✗ Menu NOT found");
    
    return hamburger && menu;
  }
  
  function openMenu() {
    if (!menu) return;
    console.log("OPENING MENU");
    isMenuOpen = true;
    
    // Add classes
    menu.classList.add('active', 'show');
    if (hamburger) hamburger.classList.add('ak-toggle_active');
    document.body.classList.add('menu-open');
    
    // Force display with inline style
    menu.setAttribute('style', 
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
      'margin: 0 !important;'
    );
    
    // Show all menu items
    var items = menu.querySelectorAll('li');
    items.forEach(function(item) {
      item.style.display = 'block';
      item.style.visibility = 'visible';
      item.style.opacity = '1';
    });
    
    console.log("Menu opened!");
  }
  
  function closeMenu() {
    if (!menu) return;
    console.log("CLOSING MENU");
    isMenuOpen = false;
    
    menu.classList.remove('active', 'show');
    if (hamburger) hamburger.classList.remove('ak-toggle_active');
    document.body.classList.remove('menu-open');
    
    menu.setAttribute('style', 'display: none !important; visibility: hidden; opacity: 0;');
    
    console.log("Menu closed!");
  }
  
  function toggleMenu() {
    console.log("TOGGLE CALLED, isOpen:", isMenuOpen);
    if (isMenuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }
  
  function attachClickHandler() {
    if (!hamburger) {
      console.error("Cannot attach - hamburger not found");
      return;
    }
    
    console.log("Attaching click handler to hamburger");
    
    // Remove all existing listeners by cloning
    var newHamburger = hamburger.cloneNode(true);
    hamburger.parentNode.replaceChild(newHamburger, hamburger);
    hamburger = newHamburger;
    
    // Make absolutely sure it's clickable
    hamburger.style.cssText = 
      'pointer-events: auto !important; ' +
      'cursor: pointer !important; ' +
      'z-index: 99999999 !important; ' +
      'position: relative !important; ' +
      'display: inline-block !important; ' +
      'visibility: visible !important; ' +
      'opacity: 1 !important;';
    
    // Simple click handler
    hamburger.onclick = function(e) {
      console.log("CLICK DETECTED!");
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
      return false;
    };
    
    // Also handle span
    var span = hamburger.querySelector('span');
    if (span) {
      span.onclick = function(e) {
        console.log("SPAN CLICK DETECTED!");
        e.preventDefault();
        e.stopPropagation();
        toggleMenu();
        return false;
      };
    }
    
    console.log("Click handler attached!");
  }
  
  function init() {
    console.log("Initializing...");
    
    if (findElements()) {
      attachClickHandler();
      console.log("✓ INITIALIZATION COMPLETE");
    } else {
      console.log("Retrying in 100ms...");
      setTimeout(init, 100);
    }
  }
  
  // Start immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Also try after delays
  setTimeout(init, 100);
  setTimeout(init, 500);
  setTimeout(init, 1000);
  setTimeout(init, 2000);
  
  // Close on outside click
  document.addEventListener('click', function(e) {
    if (isMenuOpen && hamburger && menu) {
      if (!hamburger.contains(e.target) && !menu.contains(e.target)) {
        closeMenu();
      }
    }
  });
  
  // Close on ESC
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isMenuOpen) {
      closeMenu();
    }
  });
  
})();

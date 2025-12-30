(function ($) {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | Template Name: Fingcon
  | Author: Thememarch
  | Version: 1.1
  |--------------------------------------------------------------------------
  |--------------------------------------------------------------------------
  | TABLE OF CONTENTS:
  |--------------------------------------------------------------------------
  | 1. Preloader  
  | 2. Mobile Menu
  | 3. Sticky Header
  | 4. Dynamic Background
  | 5. Swiper Slider Initialization
  | 6. Modal Video
  | 7. Scroll Up
  | 8. Accordion
  | 9. Countdown Timer
  | 10. Title Animation
  | 11. Text Animation FadeUp 
  | 12. Scroll Image Animation
  | 13. Strategic Card Vertical 
  | 14. Video Section ParallaxBg
  | 15. Hover Blog Card Animation
  | 16. Atd Circle 
  | 17. Hover Price Package
  | 18. Container Around
  | 19. Comming Soon Count down
  | 20. Skill Bar
  | 21. Fixed Footer

  */

  /*--------------------------------------------------------------
    Scripts initialization
  --------------------------------------------------------------*/
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, SplitText);

  // Utility function to check element existence
  $.exists = function (selector) {
    return $(selector).length > 0;
  };

  $(function () {
    mainNav();
    stickyHeader();
    dynamicBackground();
    initSwiper();
    modalVideo();
    scrollUp();
    strategicCardContent();
    strategicCardContentHomeTwo()
    textAnimationFadeUp();
    hoverImagesShow();
    funFactCounter();
    scrollTransform();
    parallaxBg();
    initAccordion();
    skillBar();
    packageContent();
    containerAround();
    startCountdown();
    initKineticTypography();
  });

  $(window).on("scroll", function () {
    showScrollUp();
  });

  // Initialize preloader immediately (it will check if page is loaded)
  initPreloader();
  initPageTransitionLoader();

  $(window).on("load", function () {
    titleAnimation();
    fixedFooter();
    atdCircle();
    atdCircletypeTwo();
    scrollToContactForm();
  });

  let previousWidth = $(window).width();
  $(window).on("resize", function () {
    let currentWidth = $(window).width();
    if (currentWidth === previousWidth) return;
    titleAnimation();
    fixedFooter();
    previousWidth = currentWidth;
  });

  /*--------------------------------------------------------------
    Scroll to Contact Form
  --------------------------------------------------------------*/
  function scrollToContactForm() {
    // Check if URL has #contactForm hash (normalize hash)
    const hash = window.location.hash;
    const normalizedHash = hash ? hash.toLowerCase() : '';
    
    if (normalizedHash === '#contactform' || normalizedHash === 'contactform') {
      console.log('📋 Contact form hash detected, scrolling to form...');
      
      // Function to perform the scroll and focus
      function performScroll(attempts) {
        attempts = attempts || 0;
        const maxAttempts = 30; // Try for up to 3 seconds (30 * 100ms)
        
        const form = document.getElementById('contactForm');
        if (form) {
          console.log('✅ Form found, scrolling...');
          
          // Scroll to top first to ensure accurate positioning
          window.scrollTo(0, 0);
          
          // Wait a moment for scroll to reset, then scroll to form
          setTimeout(function() {
            // Get the form's position relative to document
            const formRect = form.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const formPosition = formRect.top + scrollTop;
            const offset = 120; // Offset from top of page (accounting for header)
            
            console.log('📍 Scrolling to form position:', formPosition - offset);
            
            // Scroll to form with smooth behavior
            window.scrollTo({
              top: formPosition - offset,
              behavior: 'smooth'
            });
            
            // Focus on first input field (Your Name) after scroll completes
            setTimeout(function() {
              const nameInput = form.querySelector('#fullname');
              if (nameInput) {
                nameInput.focus();
                console.log('✅ Focused on name input field');
                // Ensure input is visible
                nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 1000);
          }, 200);
        } else if (attempts < maxAttempts) {
          // If form not found yet, try again after a short delay
          if (attempts % 5 === 0) {
            console.log('⏳ Waiting for form to load... attempt', attempts + 1);
          }
          setTimeout(function() {
            performScroll(attempts + 1);
          }, 100);
        } else {
          console.error('❌ Form not found after', maxAttempts, 'attempts');
        }
      }
      
      // Start scrolling - try multiple times to handle page load delays
      performScroll(0);
    } else {
      // Debug: log if hash is present but doesn't match
      if (hash) {
        console.log('ℹ️ Hash present but not contactForm:', hash);
      }
    }
  }

  // Handle hash on page load - multiple triggers to catch all scenarios
  function initContactFormScroll() {
    scrollToContactForm();
  }

  // Run immediately if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactFormScroll);
  } else {
    // DOM is already loaded
    initContactFormScroll();
  }

  // Also run after window load (when all resources are loaded)
  $(window).on('load', function() {
    setTimeout(initContactFormScroll, 200);
  });

  // Handle hash change (if user clicks link while on same page)
  $(window).on('hashchange', function() {
    scrollToContactForm();
  });
  
  // Also check on page visibility change (handles browser back/forward)
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      setTimeout(scrollToContactForm, 300);
    }
  });

  /*--------------------------------------------------------------
    1. Preloader  
  --------------------------------------------------------------*/
  function initPreloader() {
    if ($.exists(".preloader")) {
      const logoImg = document.querySelector(".preloader-text .logo-icon");
      const preloader = document.getElementById("preloader");

      // Function to hide preloader
      function hidePreloader() {
        setTimeout(function () {
          gsap.to(preloader, {
            duration: 1,
            ease: "expo.out",
            transform: "translateY(-100%)",
            opacity: 0,
            onComplete: function () {
              preloader.style.display = "none";
            },
          });
        }, 500); // Small delay to show spinner
      }

      // Check if page is already loaded
      if (document.readyState === "complete") {
        // Page already loaded, hide preloader immediately
        hidePreloader();
      } else {
        // Wait for page to load, then hide preloader
        window.addEventListener("load", function () {
          hidePreloader();
        });
      }

      // Logo rotates with 3D flip animation (handled by GSAP)
      gsap.fromTo(
        logoImg,
        { rotationY: 0 },
        {
          rotationY: 180,
          duration: 1,
          ease: "linear",
          repeat: -1,
          yoyo: true,
          transformOrigin: "50% 50%",
        }
      );
    }
  }

  /*--------------------------------------------------------------
    1.5. Page Transition Loader  
  --------------------------------------------------------------*/
  function initPageTransitionLoader() {
    const pageLoader = document.getElementById("pageLoader");
    if (!pageLoader) return;

    // Show loader when clicking on internal links
    document.addEventListener("click", function (e) {
      const link = e.target.closest("a");
      if (link && link.href) {
        const href = link.getAttribute("href");
        const currentHost = window.location.hostname;
        const linkHost = link.hostname;

        // Only handle internal links (same domain)
        if (
          href &&
          !href.startsWith("#") &&
          !href.startsWith("javascript:") &&
          !href.startsWith("mailto:") &&
          !href.startsWith("tel:") &&
          (linkHost === "" || linkHost === currentHost) &&
          !link.hasAttribute("target")
        ) {
          // Show loader
          pageLoader.classList.add("active");
        }
      }
    });

    // Hide loader when page is fully loaded
    window.addEventListener("load", function () {
      pageLoader.classList.remove("active");
    });

    // Also hide loader if page is already loaded (for back/forward navigation)
    if (document.readyState === "complete") {
      pageLoader.classList.remove("active");
    }
  }

  /*--------------------------------------------------------------
    2. Mobile Menu  
  --------------------------------------------------------------*/
  function mainNav() {
    // Don't append hamburger if it already exists in HTML
    if ($(".ak-main-header-right .ak-munu_toggle").length === 0) {
    $(".ak-nav").append('<span class="ak-munu_toggle"><span></span></span>');
    }
    $(".menu-item-has-children").append(
      '<span class="ak-munu_dropdown_toggle"></span>'
    );

    // Function to toggle menu - SIMPLIFIED AND BULLETPROOF
    function toggleMobileMenu() {
      console.log("=== TOGGLE MENU CALLED ===");
      
      // Check if cloned menu exists (menu is open)
      var $clonedMenu = $("#mobile-menu-clone");
      var $toggle = $(".ak-munu_toggle").first();
      
      if ($clonedMenu.length > 0) {
        // CLOSE MENU
        console.log("CLOSING MENU");
        $clonedMenu.remove();
        $('.mobile-menu-close-btn').remove(); // Remove close button
        $toggle.removeClass("ak-toggle_active");
        $("body").removeClass("menu-open");
        $("body").css('overflow', '');
        return;
      }
      
      // OPEN MENU
      console.log("OPENING MENU");
      
      // Find original menu
      var $originalMenu = $(".ak-nav_list").first();
      
      if ($originalMenu.length === 0) {
        console.error("ERROR: Menu list not found!");
        return;
      }
      
      // ALWAYS clone to body (parent is always hidden on mobile)
      var $menu = $originalMenu.clone(true, true); // Clone with data and events
      $menu.attr('id', 'mobile-menu-clone');
      $menu.addClass('active show');
      
      // Remove any existing clone first
      $("#mobile-menu-clone").remove();
      
      // CRITICAL: Hide ALL submenus by default (Services dropdown collapsed)
      $menu.find('.menu-item-has-children > ul').each(function() {
        var $submenu = $(this);
        $submenu.css({
          'display': 'none',
          'visibility': 'hidden',
          'opacity': '0',
          'max-height': '0',
          'overflow': 'hidden',
          'padding': '0',
          'margin': '0'
        });
        // Also set via attr for extra enforcement
        $submenu.attr('style', 'display: none !important; visibility: hidden !important; opacity: 0 !important; max-height: 0 !important; overflow: hidden !important; padding: 0 !important; margin: 0 !important;');
      });
      
      // Append to body
      $('body').append($menu);
      
      // Remove any existing close button first
      $('.mobile-menu-close-btn').remove();
      
      // Add close button (X) at top right - FORCE IT TO BE VISIBLE
      var $closeBtn = $('<button class="mobile-menu-close-btn" type="button">×</button>');
      $closeBtn.attr('aria-label', 'Close menu');
      
      // Apply styles using both css() and attr() for maximum compatibility
      $closeBtn.css({
        'position': 'fixed',
        'top': '20px',
        'right': '20px',
        'width': '45px',
        'height': '45px',
        'z-index': '999999999',
        'background': '#063232',
        'color': '#ffffff',
        'border': 'none',
        'border-radius': '50%',
        'font-size': '32px',
        'font-weight': 'bold',
        'cursor': 'pointer',
        'display': 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'box-shadow': '0 2px 10px rgba(0, 0, 0, 0.2)',
        'transition': 'all 0.3s ease',
        'line-height': '1',
        'padding': '0',
        'margin': '0',
        'outline': 'none'
      });
      
      // Force visibility with inline style attribute
      $closeBtn.attr('style', $closeBtn.attr('style') + ' position: fixed !important; top: 20px !important; right: 20px !important; width: 45px !important; height: 45px !important; z-index: 999999999 !important; background: #063232 !important; color: #ffffff !important; border: none !important; border-radius: 50% !important; font-size: 32px !important; font-weight: bold !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2) !important; transition: all 0.3s ease !important; line-height: 1 !important; padding: 0 !important; margin: 0 !important; outline: none !important; visibility: visible !important; opacity: 1 !important;');
      
      $closeBtn.on('mouseenter', function() {
        $(this).css({
          'background': '#030917',
          'transform': 'scale(1.1)'
        });
      });
      
      $closeBtn.on('mouseleave', function() {
        $(this).css({
          'background': '#063232',
          'transform': 'scale(1)'
        });
      });
      
      $closeBtn.on('click touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log("Close button clicked!");
        toggleMobileMenu();
        return false;
      });
      
      // Append to body AFTER menu to ensure it's on top
      $('body').append($closeBtn);
      
      console.log("Close button added to DOM");
      
      // Style menu container - CENTERED with attractive gradient matching website colors
      $menu.css({
        'display': 'flex !important',
        'visibility': 'visible !important',
        'opacity': '1 !important',
        'position': 'fixed !important',
        'left': '0 !important',
        'top': '0 !important',
        'width': '100vw !important',
        'height': '100vh !important',
        'z-index': '99999999 !important',
        'background': 'linear-gradient(135deg, #fdfbf7 0%, #f4ffff 100%) !important',
        'flex-direction': 'column !important',
        'align-items': 'center !important',
        'justify-content': 'center !important',
        'padding': '100px 20px 30px 20px !important',
        'overflow-y': 'auto !important',
        'margin': '0 !important',
        'list-style': 'none !important',
        'box-shadow': '-5px 0 30px rgba(3, 9, 23, 0.1) !important',
        'text-align': 'center !important'
      });
      
      // Style all main menu items
      $menu.find('> li').each(function() {
        var $item = $(this);
        var isParent = $item.hasClass('menu-item-has-children');
        
        $item.css({
          'display': 'block !important',
          'visibility': 'visible !important',
          'opacity': '1 !important',
          'width': '100% !important',
          'max-width': '600px !important',
          'padding': '0 !important',
          'margin-left': 'auto !important',
          'margin-right': 'auto !important',
          'margin-bottom': '0 !important',
          'border-bottom': '1px solid rgba(6, 50, 50, 0.08) !important',
          'background': 'transparent !important',
          'text-align': 'center !important'
        });
        
        // Force center alignment with inline style
        $item.attr('style', $item.attr('style') + ' margin-left: auto !important; margin-right: auto !important; text-align: center !important;');
        
        // Style main menu links - MATCH MAIN WEBSITE FONT STYLE - CENTERED
        var $link = $item.find('> a').first();
        if ($link.length > 0) {
          // Check if it's Services (has children)
          var isServices = $item.hasClass('menu-item-has-children');
          
          // For Services, wrap text in a span so arrow can be next to it
          if (isServices) {
            var linkHTML = $link.html();
            if (!linkHTML.includes('<span class="menu-link-text">')) {
              $link.html('<span class="menu-link-text">' + $link.text().trim() + '</span>');
            }
          }
          
          $link.css({
            'display': 'inline-flex !important',
            'align-items': 'center !important',
            'justify-content': 'center !important',
            'color': '#063232 !important',
            'text-decoration': 'none !important',
            'font-size': '18px !important',
            'font-weight': '600 !important',
            'font-family': "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif !important",
            'letter-spacing': '0.2px !important',
            'text-transform': 'capitalize !important',
            'padding': '20px 30px !important',
            'min-height': '56px !important',
            'border-radius': '0 !important',
            'transition': 'all 0.3s ease !important',
            'background': 'transparent !important',
            'cursor': 'pointer !important',
            'width': '100% !important',
            'text-align': 'center !important',
            '-webkit-text-fill-color': '#063232 !important',
            'position': 'relative !important',
            'margin': '0 auto !important'
          });
          
          // Style the menu link text span
          $link.find('.menu-link-text').css({
            'display': 'inline-block !important',
            'text-align': 'center !important'
          });
          
          // Add hover effect matching main website
          $link.on('mouseenter', function() {
            if (!$item.hasClass('active')) {
              $(this).css({
                'color': '#f9d67c !important',
                '-webkit-text-fill-color': '#f9d67c !important',
                'text-shadow': '0 0 8px rgba(0, 0, 0, 0.8), 0 0 12px rgba(0, 0, 0, 0.6) !important',
                'transform': 'translateY(-1px) !important',
                'word-spacing': '2px !important'
              });
            }
          });
          
          $link.on('mouseleave', function() {
            if (!$item.hasClass('active')) {
              $(this).css({
                'color': '#063232 !important',
                '-webkit-text-fill-color': '#063232 !important',
                'text-shadow': 'none !important',
                'transform': 'translateY(0) !important',
                'word-spacing': 'normal !important'
              });
            }
          });
        }
        
        // Style submenu (Services dropdown)
        var $submenu = $item.find('> ul').first();
        if ($submenu.length > 0) {
          $submenu.css({
            'display': 'none !important',
            'visibility': 'hidden !important',
            'opacity': '0 !important',
            'max-height': '0 !important',
            'overflow': 'hidden !important',
            'padding': '0 !important',
            'margin': '0 !important',
            'list-style': 'none !important',
            'background': 'rgba(249, 214, 124, 0.05) !important',
            'width': '100% !important'
          });
          
          // Style submenu items
          $submenu.find('> li').each(function() {
            $(this).css({
              'display': 'block !important',
              'width': '100% !important',
              'padding': '0 !important',
              'margin': '0 !important',
              'border-bottom': '1px solid rgba(6, 50, 50, 0.05) !important',
              'list-style': 'none !important'
            });
            
            var $subLink = $(this).find('a').first();
            if ($subLink.length > 0) {
              // Make submenu items CLEARLY SMALLER than main menu
              // Main menu: 18px font, 20px padding
              // Submenu: 13px font, 8px padding - CLEARLY SMALLER
              $subLink.css({
                'display': 'block !important',
                'color': '#063232 !important',
                'text-decoration': 'none !important',
                'font-size': '13px !important',
                'font-weight': '500 !important',
                'font-family': "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif !important",
                'letter-spacing': '0.15px !important',
                'padding': '8px 30px !important',
                'border-radius': '0 !important',
                'transition': 'all 0.2s ease !important',
                'background': 'transparent !important',
                'cursor': 'pointer !important',
                'text-align': 'center !important',
                '-webkit-text-fill-color': '#063232 !important',
                'line-height': '1.4 !important',
                'min-height': 'auto !important'
              });
              
              // Force smaller size with inline style - OVERRIDE ANY CSS
              var existingStyle = $subLink.attr('style') || '';
              $subLink.attr('style', existingStyle + ' font-size: 13px !important; padding: 8px 30px !important; font-weight: 500 !important; line-height: 1.4 !important; min-height: auto !important;');
              
              // Submenu hover effect matching main website
              $subLink.on('mouseenter', function() {
                $(this).css({
                  'background-color': 'rgba(249, 214, 124, 0.1) !important',
                  'color': '#f9d67c !important',
                  '-webkit-text-fill-color': '#f9d67c !important',
                  'text-shadow': '0 0 8px rgba(0, 0, 0, 0.8), 0 0 12px rgba(0, 0, 0, 0.6) !important',
                  'transform': 'translateX(3px) !important',
                  'padding-left': '35px !important'
                });
              });
              
              $subLink.on('mouseleave', function() {
                $(this).css({
                  'background-color': 'transparent !important',
                  'color': '#063232 !important',
                  '-webkit-text-fill-color': '#063232 !important',
                  'text-shadow': 'none !important',
                  'transform': 'translateX(0) !important',
                  'padding-left': '30px !important'
                });
              });
            }
          });
        }
      });
      
      // ADD ARROW ICON NEXT TO SERVICES - FORCE IT TO BE VISIBLE
      $menu.find(".menu-item-has-children").each(function() {
        var $parent = $(this);
        var $link = $parent.find('> a').first();
        
        if ($link.length === 0) {
          console.error("Services link not found!");
          return;
        }
        
        // Remove any existing toggle first
        $link.find('.ak-munu_dropdown_toggle').remove();
        $link.find('span.ak-munu_dropdown_toggle').remove();
        
        // Get the link text for debugging
        var linkText = $link.text().trim();
        
        // Create attractive down arrow icon - ALWAYS POINTS DOWN - MATCHES WEBSITE DESIGN
        var $arrow = $('<span class="ak-munu_dropdown_toggle">▼</span>');
        
        // Style the arrow to match website - attractive design
        $arrow.css({
          'display': 'inline-flex',
          'align-items': 'center',
          'justify-content': 'center',
          'visibility': 'visible',
          'opacity': '1',
          'margin-left': '10px',
          'font-size': '16px',
          'color': '#f9d67c',
          'background': 'rgba(249, 214, 124, 0.15)',
          'width': '28px',
          'height': '28px',
          'border-radius': '50%',
          'transition': 'all 0.3s ease',
          'vertical-align': 'middle',
          'line-height': '1',
          'font-weight': 'bold',
          'position': 'relative',
          'z-index': '10',
          'flex-shrink': '0'
        });
        
        // Force with inline style
        $arrow.attr('style', 'display: inline-flex !important; align-items: center !important; justify-content: center !important; visibility: visible !important; opacity: 1 !important; margin-left: 10px !important; font-size: 16px !important; color: #f9d67c !important; background: rgba(249, 214, 124, 0.15) !important; width: 28px !important; height: 28px !important; border-radius: 50% !important; transition: all 0.3s ease !important; vertical-align: middle !important; line-height: 1 !important; font-weight: bold !important; position: relative !important; z-index: 10 !important; flex-shrink: 0 !important;');
        
        // Add hover effect
        $arrow.on('mouseenter', function() {
          $(this).css({
            'background': '#f9d67c',
            'color': '#030917',
            'transform': 'scale(1.1)'
          });
        });
        
        $arrow.on('mouseleave', function() {
          $(this).css({
            'background': 'rgba(249, 214, 124, 0.15)',
            'color': '#f9d67c',
            'transform': 'scale(1)'
          });
        });
        
        // If link has menu-link-text span, add arrow after it, otherwise append to link
        var $textSpan = $link.find('.menu-link-text');
        if ($textSpan.length > 0) {
          $textSpan.after($arrow);
        } else {
          $link.append($arrow);
        }
        
        console.log("✓ Attractive arrow added to Services link:", linkText);
      });
      
      // Make Services link toggle dropdown instead of navigating - BULLETPROOF VERSION
      $menu.find(".menu-item-has-children > a").off("click touchstart").on("click touchstart", function (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        console.log("Services link clicked!");
        
        var $link = $(this);
        var $parent = $link.closest('li.menu-item-has-children');
        var $submenu = $parent.find('> ul').first();
        var $toggle = $link.find('.ak-munu_dropdown_toggle');
        
        if ($submenu.length === 0) {
          console.error("Submenu not found!");
          return false;
        }
        
        // Check if expanded by looking at display and visibility
        var currentDisplay = $submenu.css('display');
        var currentVisibility = $submenu.css('visibility');
        var isExpanded = (currentDisplay !== 'none' && currentDisplay !== '') || 
                         (currentVisibility === 'visible') ||
                         $submenu.is(':visible');
        
        console.log("Submenu state - display:", currentDisplay, "visibility:", currentVisibility, "isExpanded:", isExpanded);
        
        if (isExpanded) {
          // COLLAPSE
          console.log("Collapsing Services dropdown");
          $submenu.slideUp(300, function() {
            $submenu.css({
              'display': 'none',
              'visibility': 'hidden',
              'opacity': '0',
              'max-height': '0',
              'overflow': 'hidden'
            });
            $submenu.attr('style', 'display: none !important; visibility: hidden !important; opacity: 0 !important; max-height: 0 !important; overflow: hidden !important;');
          });
          // Arrow always points down - just change background color when active
          $toggle.css({
            'background': 'rgba(249, 214, 124, 0.15)',
            'color': '#f9d67c',
            'display': 'inline-flex',
            'visibility': 'visible',
            'opacity': '1',
            'transform': 'scale(1)'
          });
          $toggle.html('▼');
          $toggle.attr('style', 'display: inline-flex !important; align-items: center !important; justify-content: center !important; visibility: visible !important; opacity: 1 !important; margin-left: 10px !important; font-size: 16px !important; color: #f9d67c !important; background: rgba(249, 214, 124, 0.15) !important; width: 28px !important; height: 28px !important; border-radius: 50% !important; transition: all 0.3s ease !important; vertical-align: middle !important; line-height: 1 !important; font-weight: bold !important; position: relative !important; z-index: 10 !important; flex-shrink: 0 !important; transform: scale(1) !important;');
          $parent.removeClass('active');
        } else {
          // EXPAND
          console.log("Expanding Services dropdown");
          $submenu.css({
            'display': 'block',
            'visibility': 'visible',
            'opacity': '1',
            'max-height': '2000px',
            'overflow': 'visible'
          });
          $submenu.slideDown(300, function() {
            $submenu.css({
              'display': 'block',
              'visibility': 'visible',
              'opacity': '1'
            });
            $submenu.attr('style', 'display: block !important; visibility: visible !important; opacity: 1 !important; max-height: 2000px !important; overflow: visible !important;');
          });
          // Arrow always points down - change to active state (golden background)
          $toggle.css({
            'background': '#f9d67c',
            'color': '#030917',
            'display': 'inline-flex',
            'visibility': 'visible',
            'opacity': '1',
            'transform': 'scale(1.05)'
          });
          $toggle.html('▼');
          $toggle.attr('style', 'display: inline-flex !important; align-items: center !important; justify-content: center !important; visibility: visible !important; opacity: 1 !important; margin-left: 10px !important; font-size: 16px !important; color: #030917 !important; background: #f9d67c !important; width: 28px !important; height: 28px !important; border-radius: 50% !important; transition: all 0.3s ease !important; vertical-align: middle !important; line-height: 1 !important; font-weight: bold !important; position: relative !important; z-index: 10 !important; flex-shrink: 0 !important; transform: scale(1.05) !important;');
          $parent.addClass('active');
        }
        
        return false;
      });
      
      // Also handle clicks on dropdown toggle arrow
      $menu.find(".ak-munu_dropdown_toggle").off("click touchstart").on("click touchstart", function (e) {
        e.preventDefault();
        e.stopPropagation();
        
        var $toggle = $(this);
        var $link = $toggle.closest('li').find('> a').first();
        $link.trigger('click');
        
        return false;
      });
      
      $toggle.addClass("ak-toggle_active");
      $("body").addClass("menu-open");
      $("body").css('overflow', 'hidden');
      
      console.log("Menu opened successfully!");
    }

    // Attach click handler - SIMPLIFIED AND BULLETPROOF
    function attachHamburgerHandler() {
      console.log("Attaching hamburger handler...");
      
      // Remove ALL existing handlers first
      $(".ak-munu_toggle").off("click touchstart mousedown");
      $(".ak-munu_toggle *").off("click touchstart mousedown");
      $(document).off("click touchstart mousedown", ".ak-munu_toggle, .ak-munu_toggle *");
      
      // Simple direct click handler - works on both click and touch
      $(".ak-munu_toggle").on("click touchstart", function (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log("Hamburger CLICKED!");
        toggleMobileMenu();
        return false;
      });
      
      // Also handle clicks on the span inside
      $(".ak-munu_toggle span").on("click touchstart", function (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log("Hamburger span CLICKED!");
        toggleMobileMenu();
        return false;
      });
      
      // Event delegation as backup
      $(document).on("click touchstart", ".ak-munu_toggle, .ak-munu_toggle *", function (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log("Hamburger clicked via delegation!");
        toggleMobileMenu();
        return false;
      });
      
      console.log("✓ Hamburger handlers attached. Found", $(".ak-munu_toggle").length, "hamburger buttons");
    }
    
    // Attach immediately when DOM is ready
    if (document.readyState === 'loading') {
      $(document).ready(function() {
        attachHamburgerHandler();
      });
    } else {
      attachHamburgerHandler();
    }
    
    // Also attach after delays to ensure it works
    setTimeout(attachHamburgerHandler, 100);
    setTimeout(attachHamburgerHandler, 500);
    setTimeout(attachHamburgerHandler, 1000);
    
    // NATIVE JAVASCRIPT FALLBACK - in case jQuery fails
    setTimeout(function() {
      var hamburger = document.querySelector('.ak-munu_toggle');
      if (hamburger) {
        console.log("Native JS: Found hamburger button");
        
        // Remove old listeners by cloning
        var newHamburger = hamburger.cloneNode(true);
        hamburger.parentNode.replaceChild(newHamburger, hamburger);
        hamburger = newHamburger;
        
        // Add click handler
        hamburger.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          console.log("Native JS: Hamburger clicked!");
          toggleMobileMenu();
          return false;
        }, true);
        
        hamburger.addEventListener('touchstart', function(e) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          console.log("Native JS: Hamburger touched!");
          toggleMobileMenu();
          return false;
        }, true);
        
        // Also listen on the span
        var hamburgerSpan = hamburger.querySelector('span');
        if (hamburgerSpan) {
          hamburgerSpan.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log("Native JS: Hamburger span clicked!");
            toggleMobileMenu();
            return false;
          }, true);
          
          hamburgerSpan.addEventListener('touchstart', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log("Native JS: Hamburger span touched!");
            toggleMobileMenu();
            return false;
          }, true);
        }
      } else {
        console.error("Native JS: Hamburger button NOT found!");
      }
    }, 500);
    
    // Close menu when clicking outside (with delay to avoid conflicts)
    setTimeout(function() {
      $(document).off("click", ".close-menu-outside");
      $(document).on("click", function(e) {
        // Don't close if clicking on hamburger or menu
        if ($(e.target).closest(".ak-munu_toggle, .ak-nav_list, .ak-nav").length) {
          return;
        }
        
        var $clonedMenu = $("#mobile-menu-clone");
        if ($clonedMenu.length > 0) {
          console.log("Closing menu - clicked outside");
          $clonedMenu.remove();
          $('.mobile-menu-close-btn').remove(); // Remove close button
          $(".ak-munu_toggle").removeClass("ak-toggle_active");
          $("body").removeClass("menu-open");
          $("body").css('overflow', '');
        }
      });
    }, 200);
    
    // Close menu when pressing ESC key
    $(document).on("keydown", function(e) {
      if (e.key === "Escape" || e.keyCode === 27) {
        var $clonedMenu = $("#mobile-menu-clone");
        if ($clonedMenu.length > 0) {
          console.log("Closing menu - ESC pressed");
          $clonedMenu.remove();
          $('.mobile-menu-close-btn').remove(); // Remove close button
          $(".ak-munu_toggle").removeClass("ak-toggle_active");
          $("body").removeClass("menu-open");
          $("body").css('overflow', '');
        }
      }
    });

    $(".ak-munu_dropdown_toggle").on("click", function () {
      $(this)
        .toggleClass("active")
        .siblings("ul")
        .slideToggle()
        .parent()
        .toggleClass("active");
    });

    $(".menu-item-has-black-section").append(
      '<span class="ak-munu_dropdown_toggle_1"></span>'
    );

    $(".ak-munu_dropdown_toggle_1").on("click", function () {
      $(this)
        .toggleClass("active")
        .siblings("ul")
        .slideToggle()
        .parent()
        .toggleClass("active");
    });

    $(".ak-mode_btn").on("click", function () {
      $(this).toggleClass("active");
      $("body").toggleClass("ak-dark");
    });

    // Side Nav
    $(".ak-icon_btn").on("click", function () {
      $(".ak-side_header").addClass("active");
    });

    $(".ak-close, .ak-side_header_overlay").on("click", function () {
      $(".ak-side_header").removeClass("active");
    });

    // Menu Text Split
    $(".ak-animo_links > li > a").each(function () {
      const letters = $(this).html().split("").join("</span><span>");
      $(this).html(
        `<span class="ak-animo_text"><span>${letters}</span></span>`
      );
    });
  }

  /*--------------------------------------------------------------
    3. Sticky Header
  --------------------------------------------------------------*/
  function stickyHeader() {
    if ($.exists(".ak-site_header")) {
      var $window = $(window);
      var lastScrollTop = 0;
      var $header = $(".ak-sticky_header");
      var $topBar = $(".ak-top-bar");
      var scrollThreshold = 10; // Small threshold to start hide/show behavior
      var ticking = false;
      var isMobile = $(window).width() <= 1199;

      function updateHeader() {
        var windowTop = $window.scrollTop();

        // On mobile, always show navbar (don't hide/show on scroll)
        if (isMobile) {
          $header.removeClass("ak-gescout_sticky");
          $header.removeClass("ak-gescout_show");
          // On mobile, hide top bar when scrolling down
          if (windowTop > scrollThreshold && windowTop > lastScrollTop) {
            $topBar.addClass("ak-top-bar-hidden");
          } else {
            $topBar.removeClass("ak-top-bar-hidden");
          }
          lastScrollTop = windowTop;
          return;
        }

        // Desktop: Always keep navbar visible, only hide/show top bar
        if (windowTop >= scrollThreshold) {
          // Make navbar sticky and always visible
          $header.addClass("ak-gescout_sticky");
          $header.addClass("ak-gescout_show"); // Always show navbar
          
          // Hide/show top bar based on scroll direction
          if (windowTop < lastScrollTop) {
            // Scrolling up - show top bar
            $topBar.removeClass("ak-top-bar-hidden");
          } else if (windowTop > lastScrollTop && windowTop > scrollThreshold) {
            // Scrolling down - hide top bar
            $topBar.addClass("ak-top-bar-hidden");
          }
        } else {
          // At top of page - show both navbar and top bar
          $header.removeClass("ak-gescout_sticky");
          $header.removeClass("ak-gescout_show");
          $topBar.removeClass("ak-top-bar-hidden");
        }

        lastScrollTop = windowTop;
        ticking = false;
      }

      $(window).on("scroll", function () {
        if (!ticking) {
          window.requestAnimationFrame(updateHeader);
          ticking = true;
        }
      });

      // Handle window resize to update mobile detection
      $(window).on("resize", function () {
        isMobile = $(window).width() <= 1199;
        if (isMobile && $window.scrollTop() <= scrollThreshold) {
          $topBar.removeClass("ak-top-bar-hidden");
        }
      });
    }
  }

  /*--------------------------------------------------------------
    4. Dynamic Background
  --------------------------------------------------------------*/
  function dynamicBackground() {
    $("[data-src]").each(function () {
      const src = $(this).attr("data-src");
      $(this).css("background-image", `url(${src})`);
    });
  }

  /*--------------------------------------------------------------
    5. Swiper Slider Initialization
  --------------------------------------------------------------*/
  function initSwiper() {
    if ($.exists(".ak-slider-hero-1")) {
      const swiper = new Swiper(".ak-slider-hero-1", {
        loop: true,
        speed: 1500,
        autoplay: false,
        slidesPerView: 1,
        effect: "fade",
        runCallbacksOnInit: true,
        zoom: {
          maxRatio: 1.2,
          minRation: 1,
        },
      });
    }
    if ($.exists(".ak-slider-hero-2")) {
      const swiper = new Swiper(".ak-slider-hero-2", {
        loop: true,
        speed: 1500,
        autoplay: false,
        slidesPerView: 1,
        runCallbacksOnInit: true,
        parallax: true,
        zoom: {
          maxRatio: 1.2,
          minRation: 1,
        },
        navigation: {
          nextEl: ".hero-two-next-btn",
          prevEl: ".hero-two-prev-btn",
        },
      });
    }
    if ($.exists(".ak-slider-hero-3")) {
      const swiper = new Swiper(".ak-slider-hero-3", {
        loop: true,
        speed: 1500,
        autoplay: false,
        slidesPerView: 1,
        runCallbacksOnInit: true,
        effect: "fade",
        zoom: {
          maxRatio: 2, // Zoom effect
        },
        on: {
          slideChange: function () {
            gsap.fromTo('.swiper-slide-active .ak-hero-bg',
              { autoAlpha: 0, y: 200 },
              { autoAlpha: 1, y: 0, duration: 1, ease: 'power2.out', stagger: 0.2 }
            );
          }
        }
      });
      gsap.fromTo('.swiper-slide-active .ak-hero-bg',
        { autoAlpha: 0, y: 200 },
        { autoAlpha: 1, y: 0, duration: 1, ease: 'power2.out', stagger: 0.2 }
      );
    }
    if ($.exists(".ak-slider-service")) {
      const swiper = new Swiper(".ak-slider-service", {
        loop: true,
        speed: 500,
        autoplay: false,
        spaceBetween: 15,
        slidesPerView: "auto",
        pagination: {
          clickable: true,
        },
        navigation: {
          nextEl: ".service-next-btn",
          prevEl: ".service-prev-btn",
        },
      });
    }
    if ($.exists(".ak-team-slider")) {
      const swiper = new Swiper(".ak-team-slider", {
        loop: true,
        speed: 500,
        autoplay: false,
        spaceBetween: 15,
        slidesPerView: "auto",
        pagination: {
          clickable: true,
        },
        navigation: {
          nextEl: ".service-next-btn",
          prevEl: ".service-prev-btn",
        },
      });
    }
    if ($.exists(".ak-projects-slider.home-two")) {
      const swiper = new Swiper(".ak-projects-slider.home-two", {
        loop: true,
        speed: 500,
        autoplay: false,
        spaceBetween: 15,
        slidesPerView: "auto",
        pagination: {
          clickable: true,
        },
        navigation: {
          nextEl: ".project-next-btn",
          prevEl: ".project-prev-btn",
        },
      });
    }
    if ($.exists(".ak-projects-slider.home-three")) {
      const swiper = new Swiper(".ak-projects-slider.home-three", {
        loop: true,
        speed: 500,
        autoplay: false,
        spaceBetween: 15,
        slidesPerView: "auto",
        pagination: {
          clickable: true,
        },
        navigation: {
          nextEl: ".project-next-btn",
          prevEl: ".project-prev-btn",
        },
      });
    }
    if ($.exists(".ht-testimonial-slider")) {
      const swiper = new Swiper(".ht-testimonial-slider", {
        loop: true,
        speed: 500,
        autoplay: false,
        spaceBetween: 15,
        slidesPerView: 1,
        pagination: {
          clickable: true,
        },
        navigation: {
          nextEl: ".tc-home-two",
          prevEl: ".tc-home-two.prev",
        },
      });
    }
    if ($.exists(".ak-slider-testmonial")) {
      const swiper = new Swiper(".ak-slider-testmonial", {
        loop: true,
        speed: 700,
        autoplay: false,
        parallax: true,
        effect: "creative",
        slidesPerView: "auto",
        creativeEffect: {
          prev: {
            shadow: false,
            translate: [0, 0, -200],
          },
          next: {
            translate: [0, 0, 100],
          },
        },
        pagination: {
          clickable: true,
        },
        navigation: {
          nextEl: ".testmonial-next-btn",
          prevEl: ".testmonial-prev-btn",
        },
      });
    }
    if ($.exists(".img-previews-slider")) {
      const swiper = new Swiper(".img-previews-slider", {
        loop: true,
        autoplay: true,
        speed: 1000,
        slidesPerView: "auto",
        grabCursor: true,
        effect: "creative",
        creativeEffect: {
          prev: {
            shadow: true,
            translate: ["-20%", 0, -1],
          },
          next: {
            translate: ["100%", 0, 1],
          },
        },
      });
    }
    if ($.exists(".strategic-slider")) {
      const swiper = new Swiper(".strategic-slider", {
        loop: true,
        speed: 700,
        autoplay: false,
        parallax: true,
        effect: "creative",
        creativeEffect: {
          prev: {
            opacity: 0,
            shadow: false,
            translate: [0, 0, -200],
          },
          next: {
            translate: [0, 0, 200],
            opacity: 0,
          },
          current: {
            translate: [0, 0, 0],
            opacity: 1,
          },
        },
        slidesPerView: "auto",
        pagination: {
          clickable: true,
        },
        navigation: {
          nextEl: ".strategic-next-btn",
          prevEl: ".strategic-prev-btn",
        },
        on: {
          init: function () {
            document.querySelector(".strategic-total-slides").textContent =
              this.slides.length - this.loopedSlides * 2;
            document.querySelector(".strategic-current-slide").textContent =
              this.realIndex + 1;
          },
          slideChange: function () {
            document.querySelector(".strategic-current-slide").textContent =
              this.realIndex + 1;
          },
        },
      });
    }
    if ($.exists(".ak-slider-client-logo")) {
      const swiper = new Swiper(".ak-slider-client-logo", {
        loop: true,
        speed: 1000,
        autoplay: true,
        slidesPerView: "auto",
      });
    }
  }

  /*--------------------------------------------------------------
    6. Modal Video
  --------------------------------------------------------------*/
  function modalVideo() {
    $(".ak-video-section").on("click", ".ak-video-open", function (e) {
      e.preventDefault();
      const videoId = $(this).attr("href").split("?v=")[1].trim();
      $(".ak-video-popup-container iframe").attr(
        "src",
        `https://www.youtube.com/embed/${videoId}`
      );
      $(".ak-video-popup").addClass("active");
    });

    $(".ak-video-popup-close, .ak-video-popup-layer").on("click", function (e) {
      e.preventDefault();
      $(".ak-video-popup").removeClass("active");
      $("html").removeClass("overflow-hidden");
      $(".ak-video-popup-container iframe").attr("src", "about:blank");
    });
  }

  /*--------------------------------------------------------------
    7. Scroll Up
  --------------------------------------------------------------*/
  function scrollUp() {
    $(".ak-scrollup").on("click", function (e) {
      e.preventDefault();
      $("html, body").animate({ scrollTop: 0 }, 0);
    });
  }

  function showScrollUp() {
    let scroll = $(window).scrollTop();
    if (scroll >= 350) {
      $(".ak-scrollup").addClass("ak-scrollup-show");
    } else {
      $(".ak-scrollup").removeClass("ak-scrollup-show");
    }
  }

  /*--------------------------------------------------------------
    8. Accordion
  --------------------------------------------------------------*/
  function initAccordion() {
    if ($.exists(".ak-accordion-item")) {
      $(".ak-accordion-title-content").on("click", function () {
        $(this).toggleClass("active");
        $(this)
          .next(".ak-accordion-tab")
          .slideToggle()
          .parent()
          .siblings()
          .find(".ak-accordion-tab")
          .slideUp()
          .prev()
          .removeClass("active");
      });
    }
  }

  /*--------------------------------------------------------------
    9. Countdown Timer
  --------------------------------------------------------------*/
  function funFactCounter() {
    if ($.exists(".funfact.style1")) {
      const count_number = gsap.utils.toArray(".funfact.style1");
      const count_id = gsap.utils.toArray(".counter");
      count_id.forEach((num) => {
        gsap.from(num, {
          scrollTrigger: {
            trigger: count_number,
            start: "top center+=200",
            markers: false,
          },
          delay: 0.3,
          innerText: 0,
          duration: 3,
          snap: {
            innerText: 1,
          },
        });
      });

      gsap.from(count_number, {
        scrollTrigger: {
          trigger: count_number,
          start: "top center+=200",
          markers: false,
        },
        scale: 0.5,
        opacity: 0,
        stagger: 0.2,
        duration: 2,
        ease: "elastic",
        force3D: true,
      });
    }
  }

  /*--------------------------------------------------------------
    10. Title Animation
  --------------------------------------------------------------*/
  function titleAnimation() {
    if ($.exists(".animation-title")) {
      const quotes = gsap.utils.toArray(".animation-title");
      if (quotes.length > 0) {
        quotes.forEach((quote) => {
          if (quote.animation) {
            quote.animation.progress(1).kill();
            quote.split.revert();
          }

          quote.split = new SplitText(quote, {
            type: "lines,words,chars",
            linesClass: "split-line",
          });

          gsap.set(quote, { perspective: 400 });

          // Responsive settings
          const baseDuration = window.innerWidth > 768 ? 1 : 0.8;
          const baseStagger = window.innerWidth > 768 ? 0.02 : 0.04;

          // Set up the from and to states with ScrollTrigger
          quote.animation = gsap.fromTo(
            quote.split.chars,
            {
              opacity: 0,
              x: "50",
            },
            {
              opacity: 1,
              x: "0",
              duration: baseDuration,
              ease: "back.out(1.7)",
              stagger: baseStagger,
              scrollTrigger: {
                trigger: quote,
                start: "top 80%",
                end: "top 50%",
                scrub: false,
                markers: false,
              },
            }
          );
        });
      }
    }
  }

  /*--------------------------------------------------------------
  11. Text Animation FadeUp 
--------------------------------------------------------------*/
  function textAnimationFadeUp() {
    if ($.exists(".title-anim")) {
      const quotes = gsap.utils.toArray(".title-anim");
      quotes.forEach((quote) => {
        if (quote.animation) {
          quote.animation.progress(1).kill();
          quote.split.revert();
        }

        quote.split = new SplitText(quote, {
          type: "lines,words,chars",
        });

        gsap.set(quote, { overflow: "hidden" });

        quote.animation = gsap.from(quote.split.lines, {
          scrollTrigger: {
            trigger: quote,
            markers: false,
            start: "top 80%",
          },
          duration: 0.5,
          y: 100,
          autoAlpha: 0,
          stagger: {
            from: "start",
            amount: 0.2,
            ease: Quint.easeOut,
          },
        });
      });
    }
  }

  /*--------------------------------------------------------------
  12. Scroll Image Animation
--------------------------------------------------------------*/
  function scrollTransform() {
    if ($.exists(".image-content")) {
      const images = gsap.utils.toArray(".about-img-1");
      const imagesTwo = gsap.utils.toArray(".about-img-2");

      if (images.length === 0 && imagesTwo.length === 0) return;

      const scrollTriggerConfig = {
        trigger: ".image-content",
        start: "top 80%",
        end: "bottom 0%",
        markers: false,
        scrub: 1,
        toggleActions: "play reverse play reverse",
      };

      function aboutImganim(dets) {
        const direction = dets.deltaY > 0 ? 1 : -1;

        gsap.to(images, {
          scrollTrigger: scrollTriggerConfig,
          y: direction > 0 ? 15 : 0,
          duration: 1.5,
          ease: "power1.out",
        });

        gsap.to(imagesTwo, {
          scrollTrigger: scrollTriggerConfig,
          y: direction > 0 ? -15 : 0,
          x: direction > 0 ? -15 : 0,
          duration: 1.5,
          ease: "power1.out",
        });
      }
      document.addEventListener("wheel", aboutImganim, { passive: true });
    }
  }

  /*--------------------------------------------------------------
  13. Strategic Card Vertical 
--------------------------------------------------------------*/
  function strategicCardContent() {
    if ($.exists(".strategic-card-content")) {
      ScrollTrigger.matchMedia({
        "(min-width: 991px)": function () {
          let pbmitpanels = gsap.utils.toArray(
            ".strategic-card-content .strategic"
          );
          if (pbmitpanels.length === 0) return;
          const spacer = 0;
          let pbmitheight = pbmitpanels[0].offsetHeight + 125;
          pbmitpanels.forEach((pbmitpanel) => {
            ScrollTrigger.create({
              trigger: pbmitpanel,
              start: () => "top 125px",
              endTrigger: ".strategic-card-content",
              end: `bottom top+=${pbmitheight + pbmitpanels.length * spacer}`,
              pin: true,
              pinSpacing: false,
              onEnter: () => gsap.to(pbmitpanel, { scale: 1, duration: 0.5 }),
              onLeaveBack: () =>
                gsap.to(pbmitpanel, { scale: 0.95, duration: 0.5 }),
            });
          });
          let lastPanel = pbmitpanels[pbmitpanels.length - 1];
          lastPanel.classList.add("spacer128");
        },
        "(max-width:991px)": function () {
          ScrollTrigger.getAll().forEach((pbmitpanels) =>
            pbmitpanels.kill(true)
          );
        },
      });
    }
  }

  function strategicCardContentHomeTwo() {
    if ($.exists(".strategic-card-content-home-two")) {
      ScrollTrigger.matchMedia({
        "(min-width: 991px)": function () {
          let pbmitpanels = gsap.utils.toArray(
            ".strategic-card-content-home-two .strategic-anim"
          );
          if (pbmitpanels.length === 0) return;
          const spacer = 0;
          let pbmitheight = pbmitpanels[0].offsetHeight + 125;
          pbmitpanels.forEach((pbmitpanel) => {
            ScrollTrigger.create({
              trigger: pbmitpanel,
              start: () => "top 125px",
              endTrigger: ".strategic-card-content-home-two",
              end: `bottom top+=${pbmitheight + pbmitpanels.length * spacer}`,
              pin: true,
              pinSpacing: false,
              onEnter: () => gsap.to(pbmitpanel, { scale: 1, duration: 0.5 }),
              onLeaveBack: () =>
                gsap.to(pbmitpanel, { scale: 1, duration: 0.5 }),
            });
          });
          let lastPanel = pbmitpanels[pbmitpanels.length - 1];
          lastPanel.classList.add("spacer128");
        },
        "(max-width:991px)": function () {
          ScrollTrigger.getAll().forEach((pbmitpanels) =>
            pbmitpanels.kill(true)
          );
        },
      });
    }
  }

  /*--------------------------------------------------------------
  14. Video Section ParallaxBg
--------------------------------------------------------------*/
  function parallaxBg() {
    if ($.exists(".video-home")) {
      ScrollTrigger.matchMedia({
        "(min-width: 991px)": function () {
          const parallaxBg = gsap.utils.toArray(".parallax-bg");
          if (parallaxBg.length === 0) return;
          parallaxBg.forEach((bg) => {
            let tl = gsap.timeline({
              scrollTrigger: {
                trigger: ".video-home",
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            });
            tl.to(bg, { y: -25 }).to(bg, { y: 25 });
          });
        },
      });
    }
  }

  /*--------------------------------------------------------------
  15. Hover Blog Card Animation
--------------------------------------------------------------*/
  function hoverImagesShow() {
    if ($.exists(".blog-card.style-1")) {
      const allElement = gsap.utils.toArray(".blog-card.style-1");

      allElement.forEach((elem) => {
        const imgElem = elem.querySelector("img");
        if (imgElem.length === 0) return;

        if (elem.animation) {
          elem.animation.progress(1).kill();
        }

        elem.addEventListener(
          "mouseenter",
          () =>
          (elem.animation = gsap.to(imgElem, {
            scale: 1,
            opacity: 1,
            ease: "power3.out",
          }))
        );

        elem.addEventListener(
          "mouseleave",
          () =>
          (elem.animation = gsap.to(imgElem, {
            scale: 0.5,
            opacity: 0,
            x: 0,
            y: 0,
            ease: "power3.out",
          }))
        );

        elem.addEventListener("mousemove", (e) => {
          const rect = elem.getBoundingClientRect();
          const x = (e.clientX - rect.left - rect.width / 2) / 5;
          const y = (e.clientY - rect.top - rect.height / 2) / 5;

          elem.animation = gsap.to(imgElem, {
            x,
            y,
            ease: "power3.out",
          });
        });
      });
    }
  }

  /*--------------------------------------------------------------
  16. Atd Circle 
--------------------------------------------------------------*/
  function atdCircle() {
    if ($.exists(".atd-circle")) {
      const skills = document.querySelectorAll(".atd-circle");
      skills.forEach((skill) => {
        const percentage = skill.getAttribute("data-percentage");
        const degree = percentage * 3.6;
        skill.style.background = `conic-gradient(#F9D67C 0deg, #e0e0e09a 0deg 360deg)`;
        gsap.to(skill, {
          background: `conic-gradient(#F9D67C ${degree}deg, #e0e0e09a ${degree}deg 360deg)`,
          scrollTrigger: {
            trigger: skill,
            start: "top 90%",
            end: "top 10%",
          },
          delay: 0.5,
          duration: 1,
        });
      });
    }
  }

  function atdCircletypeTwo() {
    if ($.exists(".atd-circle.type-2")) {
      const skills = document.querySelectorAll(".atd-circle.type-2");
      skills.forEach((skill) => {
        const percentage = skill.getAttribute("data-percentage");
        const degree = percentage * 3.6;
        skill.style.background = `conic-gradient(#9FE970 0deg, #e0e0e09a 0deg 360deg)`;
        gsap.to(skill, {
          background: `conic-gradient(#9FE970 ${degree}deg, #e0e0e09a ${degree}deg 360deg)`,
          scrollTrigger: {
            trigger: skill,
            start: "top 90%",
            end: "top 10%",
          },
          delay: 0.5,
          duration: 1,
        });
      });
    }
  }

  /*--------------------------------------------------------------
  17. Hover Price Package
--------------------------------------------------------------*/
  function packageContent() {
    if ($.exists(".package-content")) {
      const packageItems = document.querySelectorAll(
        ".package-content .style2"
      );
      packageItems.forEach((item) => {
        item.addEventListener("mouseenter", function () {
          packageItems.forEach((item) => {
            item.classList.remove("active");
          });
          this.classList.add("active");
        });
        item.addEventListener("mouseleave", function () {
          packageItems.forEach((item) => {
            console.log(item.className);
            item.classList.remove("active");
          });
          packageItems[1].classList.add("active");
        });
      });
    }
  }

  /*--------------------------------------------------------------
  18. Container Around
--------------------------------------------------------------*/
  function containerAround() {
    if ($.exists("#containerAround")) {
      ScrollTrigger.matchMedia({
        "(min-width: 991px)": function () {
          let pinpontsection = document.getElementById("infoProduto");
          let galeria = document.getElementById("scrollGaleria");
          let section = document.getElementById("containerAround");

          ScrollTrigger.create({
            trigger: section,
            pin: pinpontsection,
            start: "top top+=10",
            end: "bottom top+=" + pinpontsection.clientHeight,
            endTrigger: galeria,
            pinSpacing: false,
          });
        },
      });
    }
  }

  /*--------------------------------------------------------------
  19. Comming Soon Count down
--------------------------------------------------------------*/
  function startCountdown() {
    if ($.exists("#comming-section")) {
      const countdownElements = {
        months: document.getElementById("months"),
        days: document.getElementById("days"),
        hours: document.getElementById("hours"),
        minutes: document.getElementById("minutes"),
        seconds: document.getElementById("secound"),
      };

      const targetDate = new Date("2025-08-31T00:00:00").getTime();

      const updateCountdown = () => {
        const timeRemaining = targetDate - new Date().getTime();

        if (timeRemaining <= 0) {
          clearInterval(interval);
          Object.values(countdownElements).forEach((el) => {
            gsap.to(el, {
              textContent: "0",
              duration: 0.5,
              ease: "none",
              snap: { textContent: 1 },
            });
          });
          return;
        }

        const units = {
          months: Math.floor(timeRemaining / (1000 * 60 * 60 * 24 * 30.44)),
          days: Math.floor(
            (timeRemaining % (1000 * 60 * 60 * 24 * 30.44)) /
            (1000 * 60 * 60 * 24)
          ),
          hours: Math.floor(
            (timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
          ),
          minutes: Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((timeRemaining % (1000 * 60)) / 1000),
        };

        Object.keys(units).forEach((key) => {
          gsap.to(countdownElements[key], {
            textContent: units[key],
            duration: 0.5,
            ease: "none",
            snap: { textContent: 1 },
          });
        });
      };

      const interval = setInterval(updateCountdown, 1000);
      updateCountdown(); // Initial call
    }
  }

  /*--------------------------------------------------------------
  20. Skill Bar
--------------------------------------------------------------*/
  function skillBar() {
    if ($.exists(".ak-skill-fill")) {
      const skillBars = document.querySelectorAll(".ak-skill-fill");
      skillBars.forEach((skillBar) => {
        const percentage = skillBar.dataset.percentage;

        gsap.to(skillBar, {
          width: `${percentage}%`,
          duration: 2,
          ease: "power4.out",
          scrollTrigger: {
            trigger: skillBar,
            start: "top 80%",
          },
        });
      });
    }
  }
  /*--------------------------------------------------------------
  21. Fixed Footer
--------------------------------------------------------------*/
  function fixedFooter() {
    if ($.exists(".ak-footer")) {
      let winWidth = $(window).width() > 1199,
        checkFooter = $(".ak-footer").hasClass("fixed-footer"),
        footerHeight = $(".ak-footer").height();

      if (winWidth && checkFooter) {
        $(".ak-footer").css({
          position: "fixed",
          left: 0,
          bottom: 0,
          right: 0,
          width: 100 + "%",
          "z-index": -2,
        });
        $("body").css("margin-bottom", footerHeight);
      } else {
        $(".ak-footer").removeAttr("style");
        $("body").css("margin-bottom", "");
      }
    }
  }


  if ($.exists("#contactForm")) {
    // Phone number validation - only allow numbers and common phone formatting characters
    $("#contactForm #YourPhone").on("input", function() {
      var value = $(this).val();
      // Remove any non-numeric characters except +, -, (, ), spaces
      var cleaned = value.replace(/[^\d\+\-\(\)\s]/g, '');
      if (value !== cleaned) {
        $(this).val(cleaned);
      }
    });

    // Prevent paste of invalid characters
    $("#contactForm #YourPhone").on("paste", function(e) {
      var paste = (e.originalEvent || e).clipboardData.getData('text');
      // Only allow numbers and common phone formatting characters
      var cleaned = paste.replace(/[^\d\+\-\(\)\s]/g, '');
      if (paste !== cleaned) {
        e.preventDefault();
        $(this).val($(this).val() + cleaned);
      }
    });

    $("#contactForm #submit").on("click", function (event) {
      event.preventDefault();

      // Get and trim values of all input fields
      var name = $.trim($("#contactForm #fullname").val());
      var phone = $.trim($("#contactForm #YourPhone").val());
      var email = $.trim($("#contactForm #emailInput").val());
      var username = $.trim($("#contactForm #usernameInput").val());
      var password = $("#contactForm #passwordInput").val();
      var description = $.trim($("#contactForm #textareaInput").val());

      // Validate required fields
      if (!name || !phone || !email || !username || !password) {
        alert("Please fill in all required fields (Name, Phone, Email, Username, and Password).");
        return;
      }

      // Validate phone number - only numbers allowed (remove formatting for validation)
      var phoneDigits = phone.replace(/[^\d]/g, '');
      if (phoneDigits.length < 10) {
        alert("Please enter a valid phone number with at least 10 digits.");
        return;
      }
      if (!/^\d{10,15}$/.test(phoneDigits)) {
        alert("Please enter a valid phone number (10-15 digits).");
        return;
      }

      // Validate email format
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert("Please enter a valid email address.");
        return;
      }

      // Validate username (alphanumeric and underscore, 3-30 characters)
      var usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(username)) {
        alert("Username must be 3-30 characters and contain only letters, numbers, and underscores.");
        return;
      }

      // Validate password (minimum 6 characters)
      if (password.length < 6) {
        alert("Password must be at least 6 characters long.");
        return;
      }

      // Disable submit button to prevent double submission
      var submitBtn = $("#contactForm #submit");
      submitBtn.prop("disabled", true);
      submitBtn.html('<span>Sending...</span><span><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none"><g clip-path="url(#clip0_201_978343789)"><path d="M1.42236 6.99728H13.089M13.089 6.99728L7.48903 1.39728M13.089 6.99728L7.48903 12.5973" stroke="#030917" stroke-linecap="round" stroke-linejoin="round"/></g></svg></span>');

      // Create an object to send data
      var values = {
        fullname: name,
        phone: phone,
        email: email,
        username: username,
        password: password,
        description: description || ""
      };

      // Get API base URL (works with both custom domain and Railway domain)
      var apiBaseUrl = window.location.origin + '/api';
      var contactUrl = apiBaseUrl + "/contact";
      
      console.log('📧 Submitting contact form to:', contactUrl);
      console.log('📧 Form data:', values);

      $.ajax({
        type: "POST",
        url: contactUrl,
        contentType: "application/json",
        data: JSON.stringify(values),
        success: function (response) {
          console.log('✅ Contact form response:', response);
          if (response.success) {
            // Show custom success modal
            showRegistrationSuccessModal();
            // Reset form
            $("#contactForm")[0].reset();
          } else {
            alert(response.message || "An error occurred. Please try again.");
          }
          // Re-enable submit button
          submitBtn.prop("disabled", false);
          submitBtn.html('<span>Send Message</span><span><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none"><g clip-path="url(#clip0_201_978343789)"><path d="M1.42236 6.99728H13.089M13.089 6.99728L7.48903 1.39728M13.089 6.99728L7.48903 12.5973" stroke="#030917" stroke-linecap="round" stroke-linejoin="round"/></g></svg></span>');
        },
        error: function (xhr, status, error) {
          console.error('❌ Contact form error:', {
            status: xhr.status,
            statusText: xhr.statusText,
            responseText: xhr.responseText,
            error: error,
            url: contactUrl
          });
          var errorMessage = "An error occurred. Please try again later.";
          if (xhr.responseJSON && xhr.responseJSON.message) {
            errorMessage = xhr.responseJSON.message;
          }
          alert(errorMessage);
          // Re-enable submit button
          submitBtn.prop("disabled", false);
          submitBtn.html('<span>Send Message</span><span><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none"><g clip-path="url(#clip0_201_978343789)"><path d="M1.42236 6.99728H13.089M13.089 6.99728L7.48903 1.39728M13.089 6.99728L7.48903 12.5973" stroke="#030917" stroke-linecap="round" stroke-linejoin="round"/></g></svg></span>');
        },
      });

    });

  }


  if ($.exists("#CommentsForm")) {

    $("#CommentsForm #submit").on("click", function (event) {
      event.preventDefault();

      // Get and trim values of all input fields
      var name = $.trim($("#fullname").val());
      var email = $.trim($("#emailInput").val());
      var description = $.trim($("#textareaInput").val());

      // Create an object to send data
      var values = {
        fullname: name,
        email: email,
        description: description
      };
      console.log(values);

      $.ajax({
        type: "POST",
        url: "assets/php/comments.php",
        data: values,
        success: function (response) {
          alert(response);
        },
        error: function () {
          alert("An error occurred. Please try again.");
        },
      });

    });


  }


  if ($.exists("#ContactThompsonForm")) {
    $("#ContactThompsonForm #submit").on("click", function (event) {
      event.preventDefault();

      // Get and trim values of all input fields
      var name = $.trim($("#fullname").val());
      var phone = $.trim($("#YourPhone").val());
      var email = $.trim($("#emailInput").val());
      var description = $.trim($("#textareaInput").val());

      // Create an object to send data
      var values = {
        fullname: name,
        phone: phone,
        email: email,
        description: description
      };
      console.log(values);

      $.ajax({
        type: "POST",
        url: "assets/php/contactThompsonForm.php",
        data: values,
        success: function (response) {
          alert(response);
        },
        error: function () {
          alert("An error occurred. Please try again.");
        },
      });

    });

  }


  /*--------------------------------------------------------------
    Registration Success Modal Functions
  --------------------------------------------------------------*/
  function showRegistrationSuccessModal() {
    const modal = document.getElementById('registrationSuccessModal');
    if (modal) {
      modal.style.display = 'flex';
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
  }
  
  function closeRegistrationModal() {
    const modal = document.getElementById('registrationSuccessModal');
    if (modal) {
      modal.style.display = 'none';
      // Restore body scroll
      document.body.style.overflow = '';
    }
  }
  
  // Close modal when clicking overlay
  $(document).on('click', '.registration-modal-overlay', function() {
    closeRegistrationModal();
  });
  
  // Close modal with Escape key
  $(document).on('keydown', function(e) {
    if (e.key === 'Escape') {
      closeRegistrationModal();
    }
  });
  
  // Make function globally available
  window.closeRegistrationModal = closeRegistrationModal;

  if ($.exists("#FooterForm")) {
    $("#FooterForm #submit").on("click", function (event) {
      event.preventDefault();
      var email = $.trim($("#emailInput").val());

      // Create an object to send data
      var values = {
        email: email,
      };

      $.ajax({
        type: "POST",
        url: "assets/php/footeremail.php",
        data: values,
        success: function (response) {
          alert(response);
        },
        error: function () {
          alert("An error occurred. Please try again.");
        },
      });

    });

  }

  /*--------------------------------------------------------------
    Dynamic Text Color Based on Video Background
  --------------------------------------------------------------*/
  // Store cleanup functions
  let videoDetectionCleanup = null;

  function initVideoTextColorDetection() {
    // Check for active video (check all three videos)
    const primaryVideo = document.querySelector('.ak-slider-hero-1 .swiper-slide-active .hero-video-primary');
    const secondaryVideo = document.querySelector('.ak-slider-hero-1 .swiper-slide-active .hero-video-secondary');
    const tertiaryVideo = document.querySelector('.ak-slider-hero-1 .swiper-slide-active .hero-video-tertiary');
    
    // Use the video that is currently visible/playing (check in order: tertiary, secondary, primary)
    let heroVideo = null;
    if (tertiaryVideo && tertiaryVideo.classList.contains('fading-in')) {
      heroVideo = tertiaryVideo;
    } else if (secondaryVideo && secondaryVideo.classList.contains('fading-in')) {
      heroVideo = secondaryVideo;
    } else if (primaryVideo && !primaryVideo.classList.contains('fading-out')) {
      heroVideo = primaryVideo;
    } else {
      // Fallback to any available video (check in order)
      heroVideo = tertiaryVideo || secondaryVideo || primaryVideo;
    }
    const heroTitle = document.querySelector('.ak-slider-hero-1 .swiper-slide-active .hero-main-title');
    const heroSubtitle = document.querySelector('.ak-slider-hero-1 .swiper-slide-active .hero-main-title-1.style-2');
    const miniTitle = document.querySelector('.ak-slider-hero-1 .swiper-slide-active .mini-title');
    const mainDesp = document.querySelector('.ak-slider-hero-1 .swiper-slide-active .main-desp');
    const heroSliderInfo = document.querySelector('.ak-slider-hero-1 .swiper-slide-active .hero-slider-info');

    if (!heroVideo || !heroTitle || !heroSliderInfo) return;

    // Create canvas for video frame analysis
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let animationFrameId = null;

    function checkVideoBackground() {
      if (!heroVideo || heroVideo.readyState < 2) return;

      try {
        // Set canvas size to match video
        canvas.width = heroVideo.videoWidth || heroVideo.clientWidth;
        canvas.height = heroVideo.videoHeight || heroVideo.clientHeight;

        // Draw current video frame to canvas
        ctx.drawImage(heroVideo, 0, 0, canvas.width, canvas.height);

        // Get the position of the text element relative to the video
        const textRect = heroSliderInfo.getBoundingClientRect();
        const videoRect = heroVideo.getBoundingClientRect();

        // Calculate the position on the video where the text is
        const x = Math.floor((textRect.left - videoRect.left) * (canvas.width / videoRect.width));
        const y = Math.floor((textRect.top - videoRect.top) * (canvas.height / videoRect.height));

        // Sample a region around the text (sample multiple points for better accuracy)
        const sampleSize = 50;
        const samples = [];
        
        for (let i = 0; i < 5; i++) {
          const sampleX = Math.max(0, Math.min(canvas.width - 1, x + (Math.random() - 0.5) * sampleSize));
          const sampleY = Math.max(0, Math.min(canvas.height - 1, y + (Math.random() - 0.5) * sampleSize));
          const pixelData = ctx.getImageData(sampleX, sampleY, 1, 1).data;
          samples.push(pixelData);
        }

        // Calculate average brightness
        let totalBrightness = 0;
        samples.forEach(pixel => {
          // Use luminance formula: 0.299*R + 0.587*G + 0.114*B
          const brightness = (pixel[0] * 0.299 + pixel[1] * 0.587 + pixel[2] * 0.114);
          totalBrightness += brightness;
        });
        
        const avgBrightness = totalBrightness / samples.length;
        
        // Threshold: if brightness is below 128 (midpoint), consider it dark
        const isDark = avgBrightness < 128;

        // Toggle white text class based on background darkness
        if (isDark) {
          heroTitle?.classList.add('text-white');
          heroSubtitle?.classList.add('text-white');
          miniTitle?.classList.add('text-white');
          mainDesp?.classList.add('text-white');
        } else {
          heroTitle?.classList.remove('text-white');
          heroSubtitle?.classList.remove('text-white');
          miniTitle?.classList.remove('text-white');
          mainDesp?.classList.remove('text-white');
        }
      } catch (e) {
        // Silently handle errors (video might not be ready or CORS issues)
        console.log('Video analysis:', e.message);
      }
    }

    // Start checking when video is ready
    function startDetection() {
      if (heroVideo.readyState >= 2) {
        checkVideoBackground();
        animationFrameId = requestAnimationFrame(function animate() {
          checkVideoBackground();
          animationFrameId = requestAnimationFrame(animate);
        });
      }
    }

    // Wait for video to be ready
    if (heroVideo.readyState >= 2) {
      startDetection();
    } else {
      heroVideo.addEventListener('loadeddata', startDetection, { once: true });
    }

    // Re-initialize when slide changes (for Swiper)
    const swiperElement = document.querySelector('.ak-slider-hero-1');
    if (swiperElement) {
      // Try to get Swiper instance from jQuery or DOM
      const swiperInstance = swiperElement.swiper || $(swiperElement).data('swiper');
      if (swiperInstance) {
        swiperInstance.on('slideChange', function() {
          // Small delay to ensure new slide is active
          setTimeout(() => {
            // Clean up previous detection
            if (videoDetectionCleanup) {
              videoDetectionCleanup();
            }
            // Re-initialize for new slide
            videoDetectionCleanup = initVideoTextColorDetection();
          }, 100);
        });
      } else {
        // Fallback: use MutationObserver to detect slide changes
        const observer = new MutationObserver(function(mutations) {
          const activeSlide = document.querySelector('.ak-slider-hero-1 .swiper-slide-active');
          if (activeSlide) {
            setTimeout(() => {
              if (videoDetectionCleanup) {
                videoDetectionCleanup();
              }
              videoDetectionCleanup = initVideoTextColorDetection();
            }, 100);
          }
        });
        observer.observe(swiperElement, { childList: true, subtree: true });
      }
    }

    // Return cleanup function
    return function cleanup() {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };
  }

  // Initialize video transition handler
  function initHeroVideoTransition() {
    const heroSection = document.querySelector('.ak-slider-hero-1');
    if (!heroSection) return;

    const primaryVideo = heroSection.querySelector('.hero-video-primary');
    const secondaryVideo = heroSection.querySelector('.hero-video-secondary');
    const tertiaryVideo = heroSection.querySelector('.hero-video-tertiary');

    if (!primaryVideo || !secondaryVideo || !tertiaryVideo) return;

    // Preload all videos for smooth transitions
    secondaryVideo.load();
    secondaryVideo.preload = 'auto';
    tertiaryVideo.load();
    tertiaryVideo.preload = 'auto';

    // Helper function to transition between videos
    function transitionVideos(fromVideo, toVideo) {
      // Reset and start playing the next video
      toVideo.currentTime = 0;
      
      // Ensure the video will loop if needed (though we handle looping manually)
      toVideo.loop = false; // We handle looping manually through transitions
      
      // Play the next video
      toVideo.play().catch(function(error) {
        console.log('Error playing video:', error);
      });

      // Apply smooth fade transition
      fromVideo.classList.add('fading-out');
      toVideo.classList.add('fading-in');
      
      // Remove fading-in class from previous video if it exists
      fromVideo.classList.remove('fading-in');

      // Update video detection to use the new active video
      setTimeout(function() {
        if (videoDetectionCleanup) {
          videoDetectionCleanup();
        }
        // Update the video reference for text color detection
        videoDetectionCleanup = initVideoTextColorDetection();
      }, 600); // Wait for transition to complete

      // Clean up previous video after transition
      setTimeout(function() {
        fromVideo.pause();
        fromVideo.currentTime = 0; // Reset previous video for next cycle
        fromVideo.classList.remove('fading-out');
        fromVideo.classList.remove('fading-in');
        // Reset z-index for proper layering
        if (fromVideo === primaryVideo) {
          fromVideo.style.zIndex = '-1';
        } else if (fromVideo === secondaryVideo) {
          fromVideo.style.zIndex = '-2';
        } else if (fromVideo === tertiaryVideo) {
          fromVideo.style.zIndex = '-3';
        }
      }, 1200);
    }
    
    // Function to update text based on which video is currently playing
    function updateTextForCurrentVideo(video) {
      if (video === primaryVideo) {
        restoreHeroTextForFirstVideo();
      } else if (video === secondaryVideo) {
        updateHeroTextForSecondVideo();
      } else if (video === tertiaryVideo) {
        updateHeroTextForThirdVideo();
      }
    }

    // Handle transition from primary (hero-video) to secondary (hero-video1)
    function handlePrimaryToSecondary() {
      if (primaryVideo.ended || primaryVideo.currentTime >= primaryVideo.duration - 0.5) {
        // Update text BEFORE transition to ensure it's ready
        updateHeroTextForSecondVideo();
        transitionVideos(primaryVideo, secondaryVideo);
      }
    }
    
    // Function to update hero text for second video
    function updateHeroTextForSecondVideo() {
      const heroTitle = document.getElementById('hero-main-title');
      const heroDescription = document.getElementById('hero-description');
      
      if (heroTitle && heroDescription) {
        // Update title - just "FREE TAX QUOTE" in large size
        heroTitle.innerHTML = 'FREE TAX QUOTE';
        // Update description - combine both lines in same size (smaller)
        heroDescription.innerHTML = 'Want to know your tax refund?<br>We\'ll provide you a free quote — No fees • No commitment • No obligation';
      }
    }
    
    // Function to restore original hero text for first video
    function restoreHeroTextForFirstVideo() {
      const heroTitle = document.getElementById('hero-main-title');
      const heroDescription = document.getElementById('hero-description');
      
      if (heroTitle && heroDescription) {
        // Restore original title with span structure
        heroTitle.innerHTML = 'Accurate and Efficient Tax Returns <span class="hero-main-title-1 style-2" id="hero-subtitle">for Individuals & Businesses</span>';
        
        heroDescription.textContent = 'Get your taxes done right with our certified professionals. Maximize deductions, ensure compliance, and receive your refund faster.';
      }
    }

    // Handle transition from secondary (hero-video1) to tertiary (hero-video2)
    function handleSecondaryToTertiary() {
      if (secondaryVideo.ended || secondaryVideo.currentTime >= secondaryVideo.duration - 0.5) {
        // Update text BEFORE transition to ensure it's ready
        updateHeroTextForThirdVideo();
        transitionVideos(secondaryVideo, tertiaryVideo);
      }
    }
    
    // Function to update hero text for third video
    function updateHeroTextForThirdVideo() {
      const heroTitle = document.getElementById('hero-main-title');
      const heroDescription = document.getElementById('hero-description');
      
      if (heroTitle && heroDescription) {
        // Update title - "Refer a Friend" in large size
        heroTitle.innerHTML = 'Refer a Friend';
        // Update description - exact format as requested
        heroDescription.innerHTML = 'For every friend you refer,<br>you get $10 – and your friend gets $10 too.';
      }
    }

    // Handle transition from tertiary (hero-video2) back to primary (hero-video) - cycle restart
    function handleTertiaryToPrimary() {
      if (tertiaryVideo.ended || tertiaryVideo.currentTime >= tertiaryVideo.duration - 0.5) {
        // Restore original text BEFORE transition to ensure it's ready
        restoreHeroTextForFirstVideo();
        // Reset primary video to start from beginning for continuous loop
        primaryVideo.currentTime = 0;
        transitionVideos(tertiaryVideo, primaryVideo);
      }
    }

    // Listen for video end events
    primaryVideo.addEventListener('ended', handlePrimaryToSecondary, { once: false });
    secondaryVideo.addEventListener('ended', handleSecondaryToTertiary, { once: false });
    tertiaryVideo.addEventListener('ended', handleTertiaryToPrimary, { once: false });
    
    // Also check periodically in case events don't fire
    const checkInterval = setInterval(function() {
      // Check primary to secondary transition
      if (primaryVideo.ended && !secondaryVideo.classList.contains('fading-in') && !secondaryVideo.classList.contains('fading-out')) {
        handlePrimaryToSecondary();
      }
      // Check secondary to tertiary transition
      else if (secondaryVideo.ended && !tertiaryVideo.classList.contains('fading-in') && !tertiaryVideo.classList.contains('fading-out')) {
        handleSecondaryToTertiary();
      }
      // Check tertiary to primary transition (cycle restart)
      else if (tertiaryVideo.ended && !primaryVideo.classList.contains('fading-in') && !primaryVideo.classList.contains('fading-out')) {
        handleTertiaryToPrimary();
      }
      
      // Also ensure text is correct based on currently playing video
      if (primaryVideo.paused === false && primaryVideo.ended === false && !primaryVideo.classList.contains('fading-out')) {
        // Primary video is playing
        if (document.getElementById('hero-main-title') && document.getElementById('hero-main-title').textContent.includes('FREE TAX QUOTE')) {
          restoreHeroTextForFirstVideo();
        }
      } else if (secondaryVideo.paused === false && secondaryVideo.ended === false && !secondaryVideo.classList.contains('fading-out')) {
        // Secondary video is playing
        if (document.getElementById('hero-main-title') && !document.getElementById('hero-main-title').textContent.includes('FREE TAX QUOTE')) {
          updateHeroTextForSecondVideo();
        }
      } else if (tertiaryVideo.paused === false && tertiaryVideo.ended === false && !tertiaryVideo.classList.contains('fading-out')) {
        // Tertiary video is playing
        if (document.getElementById('hero-main-title') && !document.getElementById('hero-main-title').textContent.includes('Refer a Friend')) {
          updateHeroTextForThirdVideo();
        }
      }
    }, 100);

    // Ensure all videos are ready
    secondaryVideo.addEventListener('loadeddata', function() {
      // Video is ready for smooth transition
    }, { once: true });
    
    tertiaryVideo.addEventListener('loadeddata', function() {
      // Video is ready for smooth transition
    }, { once: true });
    
    // Add event listeners to ensure text is correct when videos start playing
    // This ensures text is always aligned with the currently playing video for continuous loop
    primaryVideo.addEventListener('play', function() {
      // When primary video starts, ensure original text is shown (1st video = 1st text)
      setTimeout(function() {
        if (!primaryVideo.ended && !primaryVideo.paused && !primaryVideo.classList.contains('fading-out')) {
          restoreHeroTextForFirstVideo();
        }
      }, 50);
    });
    
    secondaryVideo.addEventListener('play', function() {
      // When secondary video starts, ensure second video text is shown (2nd video = 2nd text)
      setTimeout(function() {
        if (!secondaryVideo.ended && !secondaryVideo.paused && !secondaryVideo.classList.contains('fading-out')) {
          updateHeroTextForSecondVideo();
        }
      }, 50);
    });
    
    tertiaryVideo.addEventListener('play', function() {
      // When tertiary video starts, ensure third video text is shown (3rd video = 3rd text)
      setTimeout(function() {
        if (!tertiaryVideo.ended && !tertiaryVideo.paused && !tertiaryVideo.classList.contains('fading-out')) {
          updateHeroTextForThirdVideo();
        }
      }, 50);
    });
    
    // Ensure videos don't loop individually - we handle looping through transitions
    // This ensures continuous loop: 1 → 2 → 3 → 1 → 2 → 3 → ...
    primaryVideo.loop = false;
    secondaryVideo.loop = false;
    tertiaryVideo.loop = false;
  }

  // Initialize on page load
  $(window).on('load', function() {
    setTimeout(function() {
      if (videoDetectionCleanup) {
        videoDetectionCleanup();
      }
      videoDetectionCleanup = initVideoTextColorDetection();
      initHeroVideoTransition();
    }, 500);
  });

  // Re-initialize when Swiper is ready
  $(document).ready(function() {
    setTimeout(function() {
      if (videoDetectionCleanup) {
        videoDetectionCleanup();
      }
      videoDetectionCleanup = initVideoTextColorDetection();
    }, 1000);
  });

  /*--------------------------------------------------------------
  Kinetic Typography Animation
  --------------------------------------------------------------*/
  function initKineticTypography() {
    // Create Intersection Observer for scroll-triggered animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          
          // Add animated class based on data attribute or default
          const animationType = element.getAttribute('data-animation') || 'fadeInUp';
          
          if (animationType === 'fadeInLeft') {
            element.classList.add('fade-in-left');
          } else if (animationType === 'fadeInRight') {
            element.classList.add('fade-in-right');
          } else if (animationType === 'scaleIn') {
            element.classList.add('scale-in');
          } else if (animationType === 'bounceIn') {
            element.classList.add('bounce-in');
          } else {
            element.classList.add('animated');
          }
          
          // Stop observing once animated
          observer.unobserve(element);
        }
      });
    }, observerOptions);

    // Observe elements with animate-on-scroll class
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      observer.observe(el);
    });

    // Add kinetic typography to hero titles on load
    if ($.exists('.hero-main-title')) {
      $('.hero-main-title').each(function(index) {
        $(this).css({
          'animation-delay': (0.3 + index * 0.2) + 's'
        });
      });
    }

    // Add letter-by-letter animation to important headlines
    if ($.exists('.kinetic-letter-animate')) {
      $('.kinetic-letter-animate').each(function() {
        const $this = $(this);
        const text = $this.text();
        const letters = text.split('');
        $this.empty();
        
        letters.forEach((letter, index) => {
          const $span = $('<span>').text(letter === ' ' ? '\u00A0' : letter);
          $span.css({
            'display': 'inline-block',
            'opacity': '0',
            'animation': 'fadeInUp 0.5s ease-out forwards',
            'animation-delay': (index * 0.05) + 's'
          });
          $this.append($span);
        });
      });
    }

    // Add gradient animation to special text
    if ($.exists('.kinetic-gradient-text')) {
      $('.kinetic-gradient-text').addClass('kinetic-gradient-text');
    }

    // Enhanced animation for section titles
    if ($.exists('.ak-section-title')) {
      $('.ak-section-title').not('.animation-title').each(function(index) {
        $(this).addClass('animate-on-scroll');
        $(this).attr('data-animation', 'scaleIn');
        $(this).css('animation-delay', (index * 0.1) + 's');
      });
    }

    // Add bounce animation to feature titles
    if ($.exists('.feature-title')) {
      $('.feature-title').each(function(index) {
        $(this).addClass('animate-on-scroll');
        $(this).attr('data-animation', 'bounceIn');
        $(this).css('animation-delay', (index * 0.15) + 's');
      });
    }
  }

})(jQuery);


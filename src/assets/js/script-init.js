/**
 * script-init.js - Library initialization support script
 * 
 * NOTE: All library initializations are now handled in main.js
 * This script only serves as a fallback if main.js fails to initialize the libraries
 * Singleton pattern is used to prevent multiple initializations
 */

// Use a self-invoking function to avoid polluting the global namespace
(function() {
  // Create a global registry for our initialized libraries to prevent duplication
  if (!window.libraryInstances) {
    window.libraryInstances = {
      glightbox: false,
      aos: false,
      isotope: {}, // Object to store multiple isotope instances by container ID
      swiper: []   // Array to store multiple swiper instances
    };
  }

  // Wait until libraries are loaded and DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    // We've now removed the GLightbox initialization from here since main.js handles it
    
    // Check if AOS has been initialized after 1 second, and initialize if not
    setTimeout(function() {
      if (typeof AOS !== 'undefined' && !window.libraryInstances.aos) {
        AOS.init({
          duration: 1000,
          easing: 'ease-in-out',
          once: true,
          mirror: false
        });
        window.libraryInstances.aos = true;
        console.log('[script-init] AOS initialized as fallback');
      }
    }, 1000);
  });
});

(function() {
  "use strict";

  /**
   * Apply .scrolled class to the body when scrolling
   */
  function toggleScrolled() {
    const selectBody = document.querySelector('body');
    const selectHeader = document.querySelector('#header');
    if (!selectHeader || (!selectHeader.classList.contains('scroll-up-sticky') && 
        !selectHeader.classList.contains('sticky-top') && !selectHeader.classList.contains('fixed-top'))) return;

    window.scrollY > 100 ? selectBody.classList.add('scrolled') : selectBody.classList.remove('scrolled');
  }

  document.addEventListener('scroll', toggleScrolled);
  window.addEventListener('load', toggleScrolled);

  /**
   * Mobile nav toggle
   */
  const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');
  if (mobileNavToggleBtn) {
    mobileNavToggleBtn.addEventListener('click', function() {
      document.body.classList.toggle('mobile-nav-active');
      this.classList.toggle('bi-list');
      this.classList.toggle('bi-x');
    });
  }

  /**
   * Hide mobile nav on same-page/hash links
   */
  document.addEventListener("DOMContentLoaded", function () {
    let carouselElement = document.querySelector("#carouselExample");
    if (carouselElement) {
      new bootstrap.Carousel(carouselElement);
    }

    document.querySelectorAll('#navmenu a').forEach(link => {
      link.addEventListener('click', function() {
        document.body.classList.remove('mobile-nav-active');
      });
    });
  });

  /**
   * Toggle mobile nav dropdowns
   */
  document.querySelectorAll('.navmenu .toggle-dropdown').forEach(navmenu => {
    navmenu.addEventListener('click', function(e) {
      e.preventDefault();
      this.parentNode.classList.toggle('active');
      if (this.parentNode.nextElementSibling) {
        this.parentNode.nextElementSibling.classList.toggle('dropdown-active');
      }
      e.stopPropagation();
    });
  });

  /**
   * Preloader
   */
  const preloader = document.querySelector('#preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      preloader.remove();
    });
  }

  /**
   * Scroll top button
   */
  const scrollTop = document.querySelector('.scroll-top');
  function toggleScrollTop() {
    if (scrollTop) {
      window.scrollY > 100 ? scrollTop.classList.add('active') : scrollTop.classList.remove('active');
    }
  }

  if (scrollTop) {
    scrollTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  window.addEventListener('load', toggleScrollTop);
  document.addEventListener('scroll', toggleScrollTop);

  /**
   * Animation on scroll function and init (singleton pattern)
   */
  function aosInit() {
    // Only initialize AOS if it's not already initialized
    if (typeof AOS !== 'undefined' && (!window.libraryInstances || !window.libraryInstances.aos)) {
      // Initialize library instances tracking object if it doesn't exist
      if (!window.libraryInstances) {
        window.libraryInstances = {};
      }
      
      AOS.init({
        duration: 600,
        easing: 'ease-in-out',
        once: true,
        mirror: false
      });
      
      // Mark AOS as initialized
      window.libraryInstances.aos = true;
      console.log('AOS initialized successfully (main.js)');
    }
  }
  window.addEventListener('load', aosInit);

  /**
   * Auto-generate carousel indicators
   */
  document.querySelectorAll('.carousel-indicators').forEach(carouselIndicator => {
    const carousel = carouselIndicator.closest('.carousel');
    if (carousel) {
      carousel.querySelectorAll('.carousel-item').forEach((item, index) => {
        let indicator = document.createElement('li');
        indicator.setAttribute('data-bs-target', `#${carousel.id}`);
        indicator.setAttribute('data-bs-slide-to', index);
        if (index === 0) indicator.classList.add('active');
        carouselIndicator.appendChild(indicator);
      });
    }
  });

  /**
   * Initiate GLightbox (singleton pattern)
   */
  function initGLightbox() {
    // Check if GLightbox is already initialized to prevent multiple instances
    if (typeof GLightbox !== 'undefined' && !window.glightboxInstance) {
      // Create a singleton instance and store it globally
      window.glightboxInstance = GLightbox({
        selector: '.glightbox'
      });
      console.log('GLightbox initialized successfully');
    } else if (typeof GLightbox === 'undefined') {
      // If GLightbox is not yet available, try again in 100ms
      setTimeout(initGLightbox, 100);
    }
    // If window.glightboxInstance already exists, do nothing
  }
  
  // Initialize GLightbox when the window loads
  window.addEventListener('load', initGLightbox);

  /**
   * Init isotope layout and filters (singleton pattern)
   */
  function initIsotopeLayouts() {
    // Ensure we have a libraryInstances object to track initializations
    if (!window.libraryInstances) {
      window.libraryInstances = {
        isotope: {}
      };
    } else if (!window.libraryInstances.isotope) {
      window.libraryInstances.isotope = {};
    }

    // Check if Isotope is available
    if (typeof Isotope === 'undefined' || typeof imagesLoaded === 'undefined') {
      // If libraries are not loaded yet, try again in 100ms
      setTimeout(initIsotopeLayouts, 100);
      return;
    }

    document.querySelectorAll('.isotope-layout').forEach(isotopeItem => {
      let layout = isotopeItem.getAttribute('data-layout') || 'masonry';
      let filter = isotopeItem.getAttribute('data-default-filter') || '*';
      let sort = isotopeItem.getAttribute('data-sort') || 'original-order';
      
      // Only initialize if container exists
      const container = isotopeItem.querySelector('.isotope-container');
      if (!container) return;
      
      // Create a unique ID for this container based on its position in the DOM
      const containerId = container.id || `isotope-container-${Array.from(document.querySelectorAll('.isotope-container')).indexOf(container)}`;
      
      // Skip if this container is already initialized
      if (window.libraryInstances.isotope[containerId]) {
        return;
      }
      
      let initIsotope;
      try {
        imagesLoaded(container, function() {
          // Create the Isotope instance
          initIsotope = new Isotope(container, {
            itemSelector: '.isotope-item',
            layoutMode: layout,
            filter: filter,
            sortBy: sort
          });
          
          // Store the instance in our singleton registry
          window.libraryInstances.isotope[containerId] = initIsotope;
          console.log(`Isotope initialized successfully for ${containerId}`);
        });

        isotopeItem.querySelectorAll('.isotope-filters li').forEach(filterItem => {
          filterItem.addEventListener('click', function() {
            let activeFilter = isotopeItem.querySelector('.isotope-filters .filter-active');
            if (activeFilter) activeFilter.classList.remove('filter-active');
            this.classList.add('filter-active');
            
            // Get the Isotope instance from our registry
            const isotopeInstance = window.libraryInstances.isotope[containerId];
            if (isotopeInstance) {
              isotopeInstance.arrange({ filter: this.getAttribute('data-filter') });
              if (typeof aosInit === 'function') aosInit();
            }
          });
        });
      } catch (error) {
        console.error(`Error initializing Isotope for ${containerId}:`, error);
      }
    });
  }
  
  // Initialize Isotope when the window loads
  window.addEventListener('load', initIsotopeLayouts);

  /**
   * Animate the skills items on reveal
   */
  document.querySelectorAll('.skills-animation').forEach(item => {
    new Waypoint({
      element: item,
      offset: '80%',
      handler: function() {
        item.querySelectorAll('.progress .progress-bar').forEach(el => {
          el.style.width = el.getAttribute('aria-valuenow') + '%';
        });
      }
    });
  });

  /**
   * Init swiper sliders
   */
  function initSwiper() {
    document.querySelectorAll(".init-swiper").forEach(swiperElement => {
      let configElement = swiperElement.querySelector(".swiper-config");
      if (configElement) {
        let config = JSON.parse(configElement.innerHTML.trim());
        if (swiperElement.classList.contains("swiper-tab")) {
          initSwiperWithCustomPagination(swiperElement, config);
        } else {
          new Swiper(swiperElement, config);
        }
      }
    });
  }
  window.addEventListener("load", initSwiper);

})();

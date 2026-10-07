import { soundEngine } from './audio-controller.js';

/**
 * NavigationController
 * Manages responsive header navigation, mobile hamburger menu state,
 * luxury transitions, and accessibility.
 */
export class NavigationController {
  constructor() {
    this.isMobileMenuOpen = false;
    this.header = document.querySelector('#site-global-header');
    this.navHeader = document.querySelector('#site-header');
    this.toggleBtn = document.querySelector('#mobile-menu-toggle');
    this.dropdown = document.querySelector('#mobile-nav-dropdown');
    this.hamburgerIcon = this.toggleBtn?.querySelector('.hamburger-three-lines-icon, .hamburger-two-lines-icon');
    this.closeIcon = this.toggleBtn?.querySelector('.close-x-icon');
    this.navLinks = document.querySelectorAll('.mobile-nav-link, .nav-link');

    this.init();
  }

  init() {
    if (!this.toggleBtn || !this.dropdown) {
      console.warn('NavigationController: Mobile menu toggle or dropdown element not found.');
      return;
    }

    // Toggle button click handler
    this.toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Close when clicking any navigation link
    this.navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (this.isMobileMenuOpen) {
          this.setIsMobileMenuOpen(false);
        }
      });
    });

    // Close when clicking outside of the dropdown and header
    document.addEventListener('click', (e) => {
      if (
        this.isMobileMenuOpen &&
        this.dropdown &&
        !this.dropdown.contains(e.target) &&
        !this.toggleBtn.contains(e.target)
      ) {
        this.setIsMobileMenuOpen(false);
      }
    });

    // Close on Escape key press
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isMobileMenuOpen) {
        this.setIsMobileMenuOpen(false);
      }
    });

    // Close on window resize if viewport crosses above mobile breakpoint (> 768px)
    window.addEventListener(
      'resize',
      () => {
        if (window.innerWidth > 768 && this.isMobileMenuOpen) {
          this.setIsMobileMenuOpen(false);
        }
      },
      { passive: true }
    );
  }

  /**
   * Set mobile menu open state (similar to React's setIsMobileMenuOpen)
   * @param {boolean} isOpen
   */
  setIsMobileMenuOpen(isOpen) {
    this.isMobileMenuOpen = Boolean(isOpen);
    this.render();
  }

  /**
   * Toggle mobile menu state
   */
  toggle() {
    this.setIsMobileMenuOpen(!this.isMobileMenuOpen);
  }

  /**
   * Render state updates to DOM elements
   */
  render() {
    if (!this.toggleBtn || !this.dropdown) return;

    // Play tactile sound
    try {
      if (soundEngine && typeof soundEngine.playClick === 'function') {
        soundEngine.playClick();
      }
    } catch {
      // Ignore if sound not initialized yet
    }

    if (this.isMobileMenuOpen) {
      // Menu is OPEN
      this.dropdown.classList.add('is-open');
      this.dropdown.setAttribute('aria-hidden', 'false');
      this.toggleBtn.classList.add('is-active');
      this.toggleBtn.setAttribute('aria-expanded', 'true');
      this.toggleBtn.setAttribute('aria-label', 'Close navigation menu');

      // Toggle icons: Hide 2-line hamburger, show Close (X) icon
      if (this.hamburgerIcon) this.hamburgerIcon.style.display = 'none';
      if (this.closeIcon) this.closeIcon.style.display = 'block';

      // Keep header solid/glass while open
      if (this.header) this.header.classList.add('mobile-nav-expanded');
    } else {
      // Menu is CLOSED
      this.dropdown.classList.remove('is-open');
      this.dropdown.setAttribute('aria-hidden', 'true');
      this.toggleBtn.classList.remove('is-active');
      this.toggleBtn.setAttribute('aria-expanded', 'false');
      this.toggleBtn.setAttribute('aria-label', 'Open navigation menu');

      // Toggle icons: Show 2-line hamburger, hide Close (X) icon
      if (this.hamburgerIcon) this.hamburgerIcon.style.display = 'block';
      if (this.closeIcon) this.closeIcon.style.display = 'none';

      if (this.header) this.header.classList.remove('mobile-nav-expanded');
    }
  }
}

export let navigationController = null;

export function initNavigation() {
  if (!navigationController) {
    navigationController = new NavigationController();
  }
  return navigationController;
}

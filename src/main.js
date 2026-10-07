import { properties, loadProperties } from './data/properties.js';
import { themeController } from './components/theme-controller.js';
import { soundEngine } from './components/audio-controller.js';
import { ThreeBackground } from './components/three-background.js';
import { HeroScrollEngine } from './components/hero-scroll.js';
import { PropertyModal } from './components/property-modal.js';
import { PropertyShowcase } from './components/property-showcase.js';
import { InteractiveMap } from './components/interactive-map.js';
import { CertificationModal } from './components/certification-modal.js';
import { LeadCaptureEngine } from './components/lead-capture.js';
import { initStatsCounter, initViewingScheduler } from './components/stats-counter.js';
import { statusToast } from './components/status-toast.js';
import { initNavigation } from './components/navigation.js';
import { initI18n } from './i18n/i18n.js';

const initApp = async () => {
  // 0. Initialize Global Native Bilingual System (i18n)
  initI18n();

  // 1. Initialize Theme Engine (Dark Mode / Light Mode)
  const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
  themeToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      soundEngine.playClick();
      themeController.toggle();
    });
  });

  // 1b. Initialize Responsive Navigation & Mobile Menu Controller
  const navigation = initNavigation();

  // 2. Fixed Header Scroll Blur & Tint Adjustment
  const globalHeader = document.querySelector('#site-global-header');
  if (globalHeader) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 80) {
        globalHeader.classList.add('scrolled');
      } else {
        globalHeader.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // 3. Tactile acoustic clicks and active state on buttons and links
  document.addEventListener('click', (e) => {
    const navLink = e.target.closest('.nav-link');
    if (navLink) {
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      navLink.classList.add('active');
    }
    const clickable = e.target.closest('button, a, .category-filter-pill, .milestone-btn, .district-chip, .district-select-trigger, .district-option-item, .district-clear-btn, .gallery-tab-btn, .contact-pref-pill, .inq-method-btn');
    if (clickable) {
      soundEngine.playClick();
    }
  });

  // 4. Initialize Ambient Three.js Particle Background
  const ambientContainer = document.querySelector('#three-ambient-container');
  if (ambientContainer) {
    new ThreeBackground(ambientContainer);
  }

  // 5. Initialize Hero 3D Canvas Scroll Engine
  const heroEngine = new HeroScrollEngine();

  // 5b. Fetch Dynamic Properties & Slider Images from Supabase
  await loadProperties();

  // 6. Initialize Property Inspection Modal & Gallery
  const propertyModal = new PropertyModal();

  // 7. Initialize Lead Capture Engine & Inquiries Registry
  const leadCapture = new LeadCaptureEngine();

  // 8. Initialize Property Showcase & Smart Filters (wired with Lead Capture)
  const propertyShowcase = new PropertyShowcase(propertyModal, leadCapture);

  // 9. Initialize Interactive Riyadh Luxury Map
  const interactiveMap = new InteractiveMap(propertyModal);

  // 10. Initialize General Real Estate Authority Certification Modal
  const certModal = new CertificationModal();

  // 11. Initialize Statistics Counter & Viewing Scheduler
  initStatsCounter();
  initViewingScheduler();

  // 12. Global VIP Consultation Triggers
  const vipConsultBtns = document.querySelectorAll('#header-vip-btn, .trigger-schedule-modal, a[href="#schedule-viewing-modal"]');
  const schedulerModal = document.querySelector('#schedule-viewing-modal');
  vipConsultBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      soundEngine.playSwoosh();
      if (schedulerModal) {
        schedulerModal.dataset.propertyId = '';
        schedulerModal.querySelector('#schedule-prop-name').textContent = 'General VIP Private Acquisition Advisory';
        schedulerModal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  // 13. Masterpiece Dossier inspection trigger in 3D bottom bar
  const triggerMasterpiece = document.querySelector('.trigger-property-detail');
  if (triggerMasterpiece) {
    triggerMasterpiece.addEventListener('click', () => {
      const propId = triggerMasterpiece.dataset.propertyId;
      if (propId) propertyModal.open(propId);
    });
  }

  // 14. Lead Capture Modal triggers (from 3D bottom bar, cards, or hero buttons)
  const leadBtns = document.querySelectorAll('.trigger-lead-form-prop');
  leadBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const propId = btn.dataset.propertyId;
      const prop = properties.find(p => p.id === propId) || properties[0];
      propertyModal.openInquiryModal(prop);
    });
  });

  // 15. Live Update Toast — Strictly verify current database status on initial load
  // Ensures old historical 'Reserved' events are NOT displayed if property was reverted back to 'Available'
  const currentlyReservedProp = properties.find(p => (p.status === 'Reserved' || p.status === 'reserved'));
  if (currentlyReservedProp) {
    statusToast.notifyPropertyStatus(currentlyReservedProp, 'reserved');
  }

  console.log('%c RETHA REAL ESTATE ', 'background: #D4AF37; color: #000; font-weight: bold; font-size: 14px; padding: 4px 8px; border-radius: 4px;');
  console.log('General Real Estate Authority Certified • FAL #1200033904');
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

import { soundEngine } from './audio-controller.js';

export class CertificationModal {
  constructor() {
    this.certModal = document.querySelector('#certification-modal');
    this.privacyModal = document.querySelector('#privacy-policy-modal');
    this.modal = this.certModal; // backward compatibility
    this.syncOuterCard();
    this.init();
  }

  syncOuterCard() {
    const certDetails = document.querySelector('.cert-details-block');
    if (certDetails) {
      const crVal = certDetails.querySelector('.cert-cr-val');
      const unifiedVal = certDetails.querySelector('.cert-unified-val');
      if (crVal && !crVal.textContent.trim()) crVal.textContent = '1009185358';
      if (unifiedVal && !unifiedVal.textContent.trim()) unifiedVal.textContent = '7043643878';
    }
  }

  init() {
    // 1. Certification / License Verification Modal
    if (this.certModal) {
      const closeBtns = this.certModal.querySelectorAll('.cert-modal-close');
      closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.closeCert();
        });
      });

      this.certModal.addEventListener('click', (e) => {
        if (e.target === this.certModal) this.closeCert();
      });

      const certTriggers = document.querySelectorAll('.trigger-cert-modal');
      certTriggers.forEach(t => {
        t.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openCert();
        });
      });
    }

    // 2. Privacy Policy & Client Confidentiality Modal
    if (this.privacyModal) {
      const closeBtns = this.privacyModal.querySelectorAll('.privacy-modal-close');
      closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.closePrivacy();
        });
      });

      this.privacyModal.addEventListener('click', (e) => {
        if (e.target === this.privacyModal) this.closePrivacy();
      });

      const privacyTriggers = document.querySelectorAll('.trigger-privacy-modal');
      privacyTriggers.forEach(t => {
        t.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openPrivacy();
        });
      });
    }

    // Keyboard support: Escape closes any active legal modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.certModal && this.certModal.classList.contains('active')) {
          this.closeCert();
        }
        if (this.privacyModal && this.privacyModal.classList.contains('active')) {
          this.closePrivacy();
        }
      }
    });
  }

  openCert() {
    soundEngine.playSwoosh();
    if (this.certModal) {
      this.certModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  closeCert() {
    soundEngine.playClick();
    if (this.certModal) {
      this.certModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  openPrivacy() {
    soundEngine.playSwoosh();
    if (this.privacyModal) {
      this.privacyModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  closePrivacy() {
    soundEngine.playClick();
    if (this.privacyModal) {
      this.privacyModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Backward compatibility aliases
  open() {
    this.openCert();
  }

  close() {
    this.closeCert();
  }
}


export function initStatsCounter() {
  const statsElements = document.querySelectorAll('.stat-number-animated');
  let animated = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !animated) {
        animated = true;
        statsElements.forEach(el => {
          const target = parseFloat(el.dataset.target || 0);
          const prefix = el.dataset.prefix || '';
          const suffix = el.dataset.suffix || '';
          const decimals = parseInt(el.dataset.decimals || 0, 10);
          const duration = 2000;
          const startTime = performance.now();

          const updateCount = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentVal = target * easeOut;

            el.textContent = `${prefix}${currentVal.toFixed(decimals)}${suffix}`;

            if (progress < 1) {
              requestAnimationFrame(updateCount);
            } else {
              el.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
            }
          };

          requestAnimationFrame(updateCount);
        });
      }
    });
  }, { threshold: 0.3 });

  const statsSection = document.querySelector('#statistics-section');
  if (statsSection) observer.observe(statsSection);
}

import { 
  validateName, 
  validatePhone, 
  validateEmail,
  sanitizeHtml, 
  sanitizePlainText,
  leadRateLimiter 
} from '../utils/security.js';
import { supabase } from '../utils/supabase.js';
import { soundEngine } from './audio-controller.js';
import { properties } from '../data/properties.js';

export function initViewingScheduler() {
  const schedulerModal = document.querySelector('#schedule-viewing-modal');
  if (!schedulerModal) return;

  const form = schedulerModal.querySelector('#schedule-viewing-form');
  const successBox = schedulerModal.querySelector('#schedule-success-box');

  const methodPills = schedulerModal.querySelectorAll('#viewing-contact-pills .contact-pref-pill');
  const methodInput = schedulerModal.querySelector('#viewing-contact-method');

  methodPills.forEach(pill => {
    pill.addEventListener('click', () => {
      soundEngine.playClick();
      methodPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (methodInput) {
        methodInput.value = pill.dataset.method || 'phone';
      }
    });
  });

  const resetSchedulerView = () => {
    schedulerModal.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
      schedulerModal.dataset.propertyId = '';
      if (form) {
        form.style.display = 'flex';
        form.reset();
        if (methodInput) methodInput.value = 'phone';
        methodPills.forEach((p, idx) => {
          p.classList.toggle('active', idx === 0);
        });
        const dateInput = form.querySelector('#viewing-date');
        if (dateInput) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          dateInput.value = tomorrow.toISOString().split('T')[0];
        }
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Confirm VIP Viewing Request</span><span class="btn-arrow">→</span>`;
        }
      }
      if (successBox) successBox.style.display = 'none';
    }, 300);
  };

  const closeBtns = schedulerModal.querySelectorAll('.scheduler-close-btn');
  closeBtns.forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault();
    soundEngine.playClick();
    resetSchedulerView();
  }));

  schedulerModal.addEventListener('click', (e) => {
    if (e.target === schedulerModal) {
      soundEngine.playClick();
      resetSchedulerView();
    }
  });

  // Pre-fill sensible default date (tomorrow) with minimum set to today
  if (form) {
    const dateInput = form.querySelector('#viewing-date');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.min = today;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (!dateInput.value) {
        dateInput.value = tomorrow.toISOString().split('T')[0];
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // 1. API Resilience: Rate limiting check
      const rateCheck = leadRateLimiter.check('scheduler_submit');
      if (!rateCheck.allowed) {
        alert(`Too many requests. Please wait ${rateCheck.retryAfterSeconds} seconds before scheduling again.`);
        return;
      }

      // 2. Input Defense: Field validation & sanitization
      const rawName = form.querySelector('#viewing-name')?.value;
      const nameCheck = validateName(rawName);
      if (!nameCheck.valid) {
        alert(nameCheck.error || 'Please enter a valid client name.');
        return;
      }

      const rawPhone = form.querySelector('#viewing-phone')?.value;
      const phoneCheck = validatePhone(rawPhone);
      if (!phoneCheck.valid) {
        alert(phoneCheck.error || 'Please enter a valid phone number.');
        return;
      }

      const rawEmail = form.querySelector('#viewing-email')?.value?.trim();
      let email = null;
      if (rawEmail) {
        const emailCheck = validateEmail(rawEmail);
        if (!emailCheck.valid) {
          alert(emailCheck.error || 'Please enter a valid email address.');
          return;
        }
        email = emailCheck.sanitized;
      }

      // Read dynamic preferred contact method
      const rawMethod = form.querySelector('#viewing-contact-method')?.value || 'phone';
      const cleanMethod = rawMethod.toLowerCase().trim();
      const validMethods = ['phone', 'whatsapp', 'email'];
      const chosenMethod = validMethods.includes(cleanMethod) ? cleanMethod : 'phone';

      if (chosenMethod === 'email' && !email) {
        alert('Please provide your email address for confidential email communication.');
        return;
      }

      const methodLabels = {
        phone: 'Direct Phone Call / اتصال هاتفي',
        whatsapp: 'WhatsApp / واتساب',
        email: 'Confidential Email / بريد إلكتروني سري'
      };
      const displayMethodLabel = methodLabels[chosenMethod] || chosenMethod;

      const rawDate = form.querySelector('#viewing-date')?.value;
      const rawTime = form.querySelector('#viewing-time')?.value;
      const rawNotes = form.querySelector('#viewing-notes')?.value;

      const cleanDate = sanitizePlainText(rawDate);
      const cleanTime = sanitizePlainText(rawTime);
      const cleanNotes = sanitizePlainText(rawNotes);
      const rawPropTitle = schedulerModal.querySelector('#schedule-prop-name')?.textContent || 'General VIP Private Acquisition Advisory';
      const cleanPropTitle = sanitizePlainText(rawPropTitle);

      // Combine special fields into notes/message column with required VIP prefix
      const combinedMessage = [
        '[URGENT: VIP ADVISORY REQUEST]',
        `Preferred Contact Method: ${displayMethodLabel}`,
        `Site Inspection Target: ${cleanPropTitle}`,
        `Preferred Inspection Date: ${cleanDate || 'Flexible / Next Available'}`,
        `Preferred Time Window: ${cleanTime || 'Sunset / Golden Hour (4:30 PM - 6:30 PM)'}`,
        cleanNotes ? `Security & Chauffeur Requirements: ${cleanNotes}` : 'Security & Chauffeur Requirements: None specified'
      ].join('\n');

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Transmitting Secure Request...</span>`;
      }

      soundEngine.playClick();
      const leadRef = 'VIP-' + Math.floor(100000 + Math.random() * 900000);

      // Determine property UUID if modal was opened from a specific property
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let propertyUuid = null;
      const targetPropId = schedulerModal.dataset.propertyId;
      if (targetPropId) {
        if (isUuid.test(targetPropId)) {
          propertyUuid = targetPropId;
        } else {
          const match = properties.find(p => p.id === targetPropId || p.slug === targetPropId || p.dbId === targetPropId);
          if (match) {
            propertyUuid = match.dbId || (isUuid.test(match.id) ? match.id : null);
          }
        }
      }

      // 1. Supabase Integration: Save to leads table (triggers notify-new-lead for Telegram alert)
      try {
        const { error: dbErr } = await supabase.from('leads').insert({
          full_name: nameCheck.sanitized,
          phone: phoneCheck.sanitized,
          email: email,
          property_id: propertyUuid,
          preferred_contact_method: chosenMethod,
          budget_range: 'VIP Site Inspection',
          message: combinedMessage,
          status: 'new'
        });

        if (dbErr) {
          console.error('Supabase leads insert error for VIP Advisory:', dbErr);
        }
      } catch (err) {
        console.error('Failed to save VIP Advisory request to Supabase:', err);
      }

      // Update local storage and agency drawer badge
      try {
        const localLead = {
          ref: leadRef,
          timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }),
          name: nameCheck.sanitized,
          phone: phoneCheck.sanitized,
          email: email || 'Not Provided',
          propertyId: targetPropId || null,
          propertyName: cleanPropTitle,
          propertyStatus: 'VIP Advisory',
          leadType: 'VIP_ADVISORY',
          budget: 'VIP Site Inspection',
          preferredContactMethod: displayMethodLabel,
          notes: combinedMessage,
          status: 'NEW'
        };
        const raw = localStorage.getItem('retha_client_inquiries');
        const list = raw ? JSON.parse(raw) : [];
        list.unshift(localLead);
        localStorage.setItem('retha_client_inquiries', JSON.stringify(list));

        const badge = document.querySelector('#agency-leads-count-badge');
        if (badge) {
          badge.textContent = list.length;
          badge.style.display = 'inline-block';
        }
      } catch (e) {
        console.warn('Local storage error:', e);
      }

      // 3. Success UX: Show a luxurious, discreet success message
      form.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Confirm VIP Viewing Request</span><span class="btn-arrow">→</span>`;
      }

      if (successBox) {
        successBox.style.display = 'block';
        successBox.innerHTML = `
          <div class="success-icon">✓</div>
          <h4>Confidential Request Received</h4>
          <div class="ref-badge" style="display: inline-block; margin-bottom: 14px; padding: 4px 12px; background: rgba(212, 175, 55, 0.12); border: 1px solid var(--border-gold); border-radius: 4px; font-size: 0.8rem; color: var(--gold-light); font-family: monospace;">Ref: <span>${leadRef}</span></div>
          <p style="font-size: 1.05rem; color: #fff; font-weight: 500; margin-bottom: 12px; line-height: 1.5;">
            Your confidential request has been securely received. A senior advisor will contact you shortly.
          </p>
          <p class="scheduled-details" style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;">
            Dear <strong>${sanitizeHtml(nameCheck.sanitized)}</strong>, your confidential site inspection for <strong>${sanitizeHtml(cleanPropTitle)}</strong> on <strong>${sanitizeHtml(cleanDate)} (${sanitizeHtml(cleanTime)})</strong> has been logged directly with the certified RETHA private advisory desk.
          </p>
          <button type="button" class="btn-secondary-luxury scheduler-close-btn" style="min-width: 140px;">Done</button>
        `;

        const doneBtn = successBox.querySelector('.scheduler-close-btn');
        if (doneBtn) {
          doneBtn.addEventListener('click', (e) => {
            e.preventDefault();
            soundEngine.playClick();
            resetSchedulerView();
          });
        }
      }

      try {
        soundEngine.playChime();
      } catch {}
    });
  }
}

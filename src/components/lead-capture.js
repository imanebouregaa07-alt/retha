// Lead Capture & Agency Inquiry Management Engine
import { soundEngine } from './audio-controller.js';
import { properties, renderStatusBadgeHtml, generateDynamicBudgetRanges } from '../data/properties.js';
import { statusToast } from './status-toast.js';
import { 
  sanitizeHtml, 
  validateName, 
  validatePhone, 
  validateEmail, 
  validateNotes, 
  leadRateLimiter 
} from '../utils/security.js';
import { supabase } from '../utils/supabase.js';

export class LeadCaptureEngine {
  constructor() {
    this.leadsKey = 'retha_client_inquiries';
    this.modalEl = document.querySelector('#lead-capture-modal');
    this.drawerEl = document.querySelector('#agency-leads-drawer');
    this.init();
  }

  init() {
    this.bindModalEvents();
    this.bindDrawerEvents();
  }

  bindModalEvents() {
    if (!this.modalEl) return;

    const closeBtns = this.modalEl.querySelectorAll('.lead-modal-close');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.closeModal();
    });

    const form = this.modalEl.querySelector('#property-lead-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit(form);
      });
    }

    // Contact method pill toggles inside modal
    const methodPills = this.modalEl.querySelectorAll('.contact-pref-pill');
    methodPills.forEach(pill => {
      pill.addEventListener('click', () => {
        soundEngine.playClick();
        methodPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const input = this.modalEl.querySelector('#lead-contact-method');
        if (input) input.value = pill.dataset.method;
      });
    });
  }

  bindDrawerEvents() {
    // Agency Owner Lead Viewer triggers
    const triggers = document.querySelectorAll('.trigger-leads-drawer');
    triggers.forEach(t => {
      t.addEventListener('click', (e) => {
        e.preventDefault();
        this.openDrawer();
      });
    });

    if (this.drawerEl) {
      const closeBtn = this.drawerEl.querySelector('.drawer-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', () => this.closeDrawer());

      const backdrop = this.drawerEl.querySelector('.drawer-backdrop');
      if (backdrop) backdrop.addEventListener('click', () => this.closeDrawer());

      const exportBtn = this.drawerEl.querySelector('#export-leads-csv');
      if (exportBtn) exportBtn.addEventListener('click', () => this.exportCSV());

      const clearBtn = this.drawerEl.querySelector('#clear-leads-btn');
      if (clearBtn) clearBtn.addEventListener('click', () => this.clearLeads());

      // WebSocket / Real-time Status simulator buttons
      const simReservedBtn = this.drawerEl.querySelector('#btn-sim-reserved');
      if (simReservedBtn) {
        simReservedBtn.addEventListener('click', () => {
          soundEngine.playClick();
          // Pick a currently available property and simulate reserving it
          const prop = properties.find(p => p.status === 'available') || properties[0];
          statusToast.simulate(prop.id, 'reserved');
        });
      }

      const simSoldBtn = this.drawerEl.querySelector('#btn-sim-sold');
      if (simSoldBtn) {
        simSoldBtn.addEventListener('click', () => {
          soundEngine.playClick();
          // Pick a reserved property and simulate selling it
          const prop = properties.find(p => p.status === 'reserved') || properties[1];
          statusToast.simulate(prop.id, 'sold');
        });
      }

      const simAvailableBtn = this.drawerEl.querySelector('#btn-sim-available');
      if (simAvailableBtn) {
        simAvailableBtn.addEventListener('click', () => {
          soundEngine.playClick();
          // Pick a sold or reserved property and simulate making it available
          const prop = properties.find(p => p.status === 'sold' || p.status === 'reserved') || properties[2];
          statusToast.simulate(prop.id, 'available');
        });
      }
    }
  }

  openForProperty(property, mode = 'inquire') {
    if (!this.modalEl) return;
    soundEngine.playSwoosh();

    const isWaitlist = mode === 'waitlist' || property.status === 'reserved';
    const titleEl = this.modalEl.querySelector('#lead-target-property-title');
    const inputProp = this.modalEl.querySelector('#lead-property-id');
    const inputPropName = this.modalEl.querySelector('#lead-property-name');
    const priceEl = this.modalEl.querySelector('#lead-target-price');
    const headerTitle = this.modalEl.querySelector('#lead-modal-heading');
    const kickerBadge = this.modalEl.querySelector('#lead-modal-kicker-badge');
    const waitlistBanner = this.modalEl.querySelector('#lead-waitlist-banner');
    const budgetRow = this.modalEl.querySelector('#lead-budget-row');
    const submitBtn = this.modalEl.querySelector('#lead-submit-btn');
    const notesLabel = this.modalEl.querySelector('#lead-notes-label');
    const notesInput = this.modalEl.querySelector('#lead-notes');

    if (titleEl) titleEl.textContent = property.title;
    if (inputProp) inputProp.value = property.id;
    if (inputPropName) inputPropName.value = property.title;
    if (priceEl) priceEl.textContent = property.priceFormattedSAR;

    // Adapt for Waitlist vs Acquisition Dossier
    if (isWaitlist) {
      if (headerTitle) headerTitle.textContent = 'JOIN PRIORITY WAITLIST';
      if (kickerBadge) {
        kickerBadge.innerHTML = `
          <span class="luxury-badge gold">✦ Priority Waitlist</span>
          ${renderStatusBadgeHtml('reserved')}
        `;
      }
      if (waitlistBanner) {
        waitlistBanner.style.display = 'flex';
        waitlistBanner.innerHTML = `
          <span class="waitlist-banner-ico">⏳</span>
          <div class="waitlist-banner-body">
            <strong>Active Client Reservation in Effect</strong>
            <p>A formal reservation deposit has been placed on this asset. Join the waitlist with priority 1st right of refusal if the agreement lapses.</p>
          </div>
        `;
      }
      if (budgetRow) budgetRow.style.display = 'none'; // Simplified form for waitlist
      if (submitBtn) {
        submitBtn.innerHTML = `<span>Join Priority Waitlist</span><span class="btn-arrow">→</span>`;
        submitBtn.classList.add('btn-waitlist-accent');
      }
      if (notesLabel) notesLabel.textContent = 'Waitlist Notes / Acquisition Readiness (Optional)';
      if (notesInput) notesInput.placeholder = 'e.g. Pre-approved for cash acquisition, ready for expedited settlement...';
    } else {
      if (headerTitle) headerTitle.textContent = 'REQUEST ACQUISITION DOSSIER';
      if (kickerBadge) {
        kickerBadge.innerHTML = `
          <span class="luxury-badge gold">✦ Confidential Client Inquiries</span>
          ${renderStatusBadgeHtml('available')}
        `;
      }
      if (waitlistBanner) waitlistBanner.style.display = 'none';

      const rawPrice = property?.priceSAR ?? property?.price;
      const priceNum = (rawPrice !== null && rawPrice !== undefined && Number(rawPrice) > 0) ? Number(rawPrice) : 0;
      const formattedSARStr = (property?.priceFormattedSAR || '').toLowerCase();
      const isContactUs = !formattedSARStr || formattedSARStr.includes('تواصل معنا') || formattedSARStr.includes('اتصل بنا') || formattedSARStr.includes('contact') || formattedSARStr.includes('poa') || formattedSARStr.includes('application');
      const hasSpecificPrice = priceNum > 0 && !isContactUs;

      if (budgetRow) {
        budgetRow.style.display = 'grid';
        if (!hasSpecificPrice) {
          budgetRow.classList.add('single-col');
        } else {
          budgetRow.classList.remove('single-col');
        }
      }
      const budgetField = this.modalEl.querySelector('#lead-budget-field');
      if (budgetField) {
        budgetField.style.display = hasSpecificPrice ? '' : 'none';
      }

      const budgetSelect = this.modalEl.querySelector('#lead-budget');
      if (budgetSelect && hasSpecificPrice) {
        const ranges = generateDynamicBudgetRanges(priceNum);
        if (ranges.length > 0) {
          budgetSelect.innerHTML = ranges.map(r => `
            <option value="${r.value}" ${r.selected ? 'selected' : ''}>${r.label}</option>
          `).join('');
        }
      }

      if (submitBtn) {
        submitBtn.innerHTML = `<span>Submit Acquisition Inquiry</span><span class="btn-arrow">→</span>`;
        submitBtn.classList.remove('btn-waitlist-accent');
      }
      if (notesLabel) notesLabel.textContent = 'Specific Acquisition Criteria or Inquiries';
      if (notesInput) notesInput.placeholder = 'e.g. Requesting electronic title deed verification, building license inspection, or private chauffeur site visit...';
    }

    // Reset form view
    const form = this.modalEl.querySelector('#property-lead-form');
    const successBox = this.modalEl.querySelector('#lead-success-card');
    if (form) form.style.display = 'flex';
    if (successBox) successBox.style.display = 'none';

    this.modalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('active');
    document.body.style.overflow = '';
  }

  handleFormSubmit(form) {
    soundEngine.playClick();

    // 1. API Resilience: Rate limiting enforcement
    const rateCheck = leadRateLimiter.check('lead_submission');
    if (!rateCheck.allowed) {
      statusToast.show({
        title: 'RATE LIMIT ACTIVE',
        message: `Too many submissions. Please wait ${rateCheck.retryAfterSeconds} seconds.`,
        status: 'reserved'
      });
      return;
    }

    // 2. Comprehensive Input Defense: Field-by-field validation & sanitization
    const rawName = form.querySelector('#lead-name')?.value;
    const nameCheck = validateName(rawName);
    if (!nameCheck.valid) {
      alert(nameCheck.error || 'Please enter a valid client name.');
      return;
    }

    const rawPhone = form.querySelector('#lead-phone')?.value;
    const phoneCheck = validatePhone(rawPhone);
    if (!phoneCheck.valid) {
      alert(phoneCheck.error || 'Please enter a valid phone number.');
      return;
    }

    const rawEmail = form.querySelector('#lead-email')?.value?.trim();
    let email = 'Not Provided';
    if (rawEmail) {
      const emailCheck = validateEmail(rawEmail);
      if (!emailCheck.valid) {
        alert(emailCheck.error || 'Please enter a valid email address.');
        return;
      }
      email = emailCheck.sanitized;
    }

    const name = nameCheck.sanitized;
    const phone = phoneCheck.sanitized;
    const propertyId = form.querySelector('#lead-property-id')?.value;
    const propertyName = form.querySelector('#lead-property-name')?.value;
    const budget = form.querySelector('#lead-budget')?.value;
    const method = form.querySelector('#lead-contact-method')?.value || 'Phone';
    const rawNotes = form.querySelector('#lead-notes')?.value || 'No additional notes';
    const notes = validateNotes(rawNotes);

    const leadRef = 'RE-' + Math.floor(100000 + Math.random() * 900000);
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Riyadh',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const targetProp = properties.find(p => p.id === propertyId);
    const isWaitlist = targetProp?.status === 'reserved';

    const rawPrice = targetProp?.priceSAR ?? targetProp?.price;
    const priceNum = (rawPrice !== null && rawPrice !== undefined && Number(rawPrice) > 0) ? Number(rawPrice) : 0;
    const formattedSARStr = (targetProp?.priceFormattedSAR || '').toLowerCase();
    const isContactUs = !formattedSARStr || formattedSARStr.includes('تواصل معنا') || formattedSARStr.includes('اتصل بنا') || formattedSARStr.includes('contact') || formattedSARStr.includes('poa') || formattedSARStr.includes('application');
    const hasSpecificPrice = priceNum > 0 && !isContactUs;

    let leadBudget = 'POA / Contact Us';
    if (isWaitlist) {
      leadBudget = 'Waitlist Priority Queue';
    } else if (hasSpecificPrice) {
      const defaultRange = generateDynamicBudgetRanges(priceNum).find(r => r.selected)?.value;
      leadBudget = budget || defaultRange || targetProp?.priceFormattedSAR || 'Listing Target';
    }

    const leadData = {
      ref: leadRef,
      timestamp,
      name,
      phone,
      email,
      propertyId,
      propertyName,
      propertyStatus: targetProp?.status || 'available',
      budget: leadBudget,
      preferredContactMethod: method,
      notes,
      status: isWaitlist ? 'WAITLIST' : 'NEW'
    };

    // Save lead to persistent storage
    this.saveLead(leadData);

    // Show luxury success response with sanitized output rendering
    form.style.display = 'none';
    const successBox = this.modalEl.querySelector('#lead-success-card');
    if (successBox) {
      successBox.style.display = 'block';
      const refEl = successBox.querySelector('.success-ref-code');
      const detailsEl = successBox.querySelector('.success-lead-summary');

      if (refEl) refEl.textContent = leadRef;
      if (detailsEl) {
        const safeName = sanitizeHtml(name);
        const safeProp = sanitizeHtml(propertyName);
        const safeMethod = sanitizeHtml(method);
        const safePhone = sanitizeHtml(phone);

        if (isWaitlist) {
          detailsEl.innerHTML = `
            Dear <strong>${safeName}</strong>, you have been registered on the <strong>Priority Waitlist</strong> for <strong>${safeProp}</strong>. Waitlist position logged. If this reservation agreement lapses, our accredited advisory team will contact you immediately via <strong>${safeMethod}</strong> at <strong>${safePhone}</strong>.
          `;
        } else {
          detailsEl.innerHTML = `
            Dear <strong>${safeName}</strong>, your formal inquiry for <strong>${safeProp}</strong> has been logged in the RETHA confidential registry. Our accredited advisory team will contact you via <strong>${safeMethod}</strong> at <strong>${safePhone}</strong>.
          `;
        }
      }
    }
  }

  saveLead(lead) {
    const existing = this.getLeads();
    existing.unshift(lead);
    localStorage.setItem(this.leadsKey, JSON.stringify(existing));

    // Update leads counter badge if present
    this.updateBadge();

    // Persist to Supabase database so Postgres trigger fires notify-new-lead
    this.persistLeadToSupabase(lead);
  }

  async persistLeadToSupabase(lead) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let propertyUuid = null;
      if (lead.propertyId) {
        if (isUuid.test(lead.propertyId)) {
          propertyUuid = lead.propertyId;
        } else {
          const match = properties.find(p => p.id === lead.propertyId || p.slug === lead.propertyId || p.dbId === lead.propertyId);
          if (match) {
            propertyUuid = match.dbId || (isUuid.test(match.id) ? match.id : null);
          }
        }
      }

      let methodCode = 'phone';
      const m = (lead.preferredContactMethod || '').toLowerCase();
      if (m.includes('whatsapp') || m.includes('واتساب')) {
        methodCode = 'whatsapp';
      } else if (m.includes('email') || m.includes('إيميل') || m.includes('بريد')) {
        methodCode = 'email';
      }

      const { error } = await supabase.from('leads').insert({
        full_name: lead.name,
        phone: lead.phone,
        email: lead.email && lead.email !== 'Not Provided' ? lead.email : null,
        property_id: propertyUuid,
        preferred_contact_method: methodCode,
        budget_range: (lead.budget && lead.budget !== 'POA / Contact Us' && lead.budget !== 'Waitlist Priority Queue') ? lead.budget : null,
        message: lead.notes || null,
        status: 'new'
      });

      if (error) {
        console.error('Supabase leads insert error:', error);
      }
    } catch (err) {
      console.error('Failed to save lead to Supabase:', err);
    }
  }

  getLeads() {
    try {
      const data = localStorage.getItem(this.leadsKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  updateBadge() {
    const badge = document.querySelector('#agency-leads-count-badge');
    if (badge) {
      const count = this.getLeads().length;
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  }

  openDrawer() {
    if (!this.drawerEl) return;
    this.renderLeadsTable();
    this.drawerEl.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeDrawer() {
    if (!this.drawerEl) return;
    this.drawerEl.classList.remove('active');
    document.body.style.overflow = '';
  }

  renderLeadsTable() {
    const tableBody = this.drawerEl.querySelector('#leads-table-body');
    const emptyState = this.drawerEl.querySelector('#leads-empty-state');
    if (!tableBody) return;

    const leads = this.getLeads();
    this.updateBadge();

    if (leads.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tableBody.innerHTML = leads.map(l => {
      const isWait = l.status === 'WAITLIST' || l.leadType === 'WAITLIST';
      const safeRef = sanitizeHtml(l.ref);
      const safeTime = sanitizeHtml(l.timestamp);
      const safeName = sanitizeHtml(l.name);
      const safePhone = sanitizeHtml(l.phone);
      const safeProp = sanitizeHtml(l.propertyName);
      const safeMethod = sanitizeHtml(l.preferredContactMethod || 'Phone');
      const safeBudget = sanitizeHtml(l.budget || 'N/A');
      const safeNotes = sanitizeHtml(l.notes || '');

      return `
        <tr class="lead-row ${isWait ? 'row-waitlist' : ''}">
          <td><strong class="gold-text">${safeRef}</strong></td>
          <td>${safeTime}</td>
          <td><strong>${safeName}</strong><br/><small class="text-muted">${safePhone}</small></td>
          <td>
            ${safeProp}
            ${isWait ? '<span class="status-mini-tag waitlist">WAITLIST</span>' : ''}
          </td>
          <td><span class="method-tag ${safeMethod.toLowerCase()}">${safeMethod}</span></td>
          <td>${safeBudget}</td>
          <td><small>${safeNotes}</small></td>
        </tr>
      `;
    }).join('');
  }

  exportCSV() {
    const leads = this.getLeads();
    if (leads.length === 0) {
      alert('No leads recorded yet.');
      return;
    }

    const headers = ['Reference', 'Date/Time', 'Client Name', 'Phone', 'Email', 'Property', 'Budget', 'Preferred Contact Method', 'Notes'];
    const rows = leads.map(l => [
      l.ref,
      `"${l.timestamp}"`,
      `"${l.name}"`,
      `"${l.phone}"`,
      `"${l.email}"`,
      `"${l.propertyName}"`,
      `"${l.budget}"`,
      `"${l.preferredContactMethod}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `retha_inquiries_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  clearLeads() {
    if (confirm('Are you sure you want to clear all recorded inquiries from this browser?')) {
      localStorage.removeItem(this.leadsKey);
      this.renderLeadsTable();
    }
  }
}

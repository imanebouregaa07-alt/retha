import { properties, getStatusConfig } from '../data/properties.js';
import { soundEngine } from './audio-controller.js';
import { supabase } from '../utils/supabase.js';

export class StatusToastManager {
  constructor() {
    this.container = null;
    this.activeToasts = new Set();
    this.realtimeChannel = null;
    this.init();
  }

  init() {
    let container = document.querySelector('#retha-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'retha-toast-container';
      container.className = 'luxury-toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', 'Real-time Property Notifications');
      document.body.appendChild(container);
    }
    this.container = container;

    // Initialize Supabase Realtime listener for live property status changes
    this.setupRealtimeListener();

    // Listen for custom real-time events (ready for WebSocket / Backend / Telegram bot)
    window.addEventListener('retha:property-status-update', (e) => {
      const { propertyId, status, message, payload } = e.detail || {};
      this.handleIncomingStatusUpdate(propertyId, status, message, payload);
    });
  }

  /**
   * Main toast display method
   */
  show({
    title = 'Portfolio Status Alert',
    message = 'Property status updated.',
    subtext = '',
    status = 'available',
    property = null,
    duration = 5500,
    actionText = null,
    onAction = null
  } = {}) {
    if (!this.container) return;

    // Strict validation: Only allow 'reserved' toast if property is strictly reserved
    if (status === 'reserved' && property) {
      const currentPropStatus = (property.status || '').toLowerCase();
      if (currentPropStatus !== 'reserved') {
        return null;
      }
    }

    const statusConfig = getStatusConfig(status);
    const toastId = 'toast-' + Math.random().toString(36).substring(2, 9);

    const toastEl = document.createElement('div');
    toastEl.id = toastId;
    toastEl.className = `luxury-toast-card toast-${status}`;
    toastEl.setAttribute('role', 'alert');

    const imageHtml = property?.mainImage
      ? `<div class="toast-media-thumb">
           <img src="${property.mainImage}" alt="${property.title || 'Property'}" class="${status === 'sold' ? 'image-sold-dimmed' : ''}" />
         </div>`
      : '';

    const actionHtml = actionText
      ? `<button class="toast-action-btn" data-action="true">${actionText}</button>`
      : '';

    toastEl.innerHTML = `
      <div class="toast-inner">
        <div class="toast-header-row">
          <div class="toast-status-chip status-${status}">
            <span class="status-badge-dot"></span>
            <span class="status-badge-icon">${statusConfig.icon}</span>
            <span class="status-chip-text">${statusConfig.label.toUpperCase()}</span>
          </div>
          <span class="toast-kicker">${title}</span>
          <button class="toast-close-btn" aria-label="Dismiss notification">&times;</button>
        </div>

        <div class="toast-body-row">
          ${imageHtml}
          <div class="toast-content-col">
            <h4 class="toast-headline">${message}</h4>
            ${subtext ? `<p class="toast-subtext">${subtext}</p>` : ''}
          </div>
        </div>

        ${actionHtml ? `<div class="toast-footer-row">${actionHtml}</div>` : ''}

        <div class="toast-progress-track">
          <div class="toast-progress-bar"></div>
        </div>
      </div>
    `;

    this.container.appendChild(toastEl);
    this.activeToasts.add(toastId);

    // Audio acoustic feedback
    try {
      soundEngine.playChime();
    } catch (e) {}

    // Animation entrance
    requestAnimationFrame(() => {
      toastEl.classList.add('visible');
    });

    // Setup auto-dismiss timer and hover pause
    let remaining = duration;
    let startTime = Date.now();
    let dismissTimeout = null;

    const progressBar = toastEl.querySelector('.toast-progress-bar');
    if (progressBar) {
      progressBar.style.transition = `width ${duration}ms linear`;
      requestAnimationFrame(() => {
        progressBar.style.width = '0%';
      });
    }

    const startTimer = (ms) => {
      startTime = Date.now();
      dismissTimeout = setTimeout(() => {
        this.dismiss(toastEl, toastId);
      }, ms);
    };

    const pauseTimer = () => {
      if (dismissTimeout) {
        clearTimeout(dismissTimeout);
        dismissTimeout = null;
        remaining -= Date.now() - startTime;
        if (progressBar) {
          const computedWidth = window.getComputedStyle(progressBar).width;
          progressBar.style.transition = 'none';
          progressBar.style.width = computedWidth;
        }
      }
    };

    const resumeTimer = () => {
      if (remaining > 0 && !dismissTimeout) {
        if (progressBar) {
          progressBar.style.transition = `width ${remaining}ms linear`;
          progressBar.style.width = '0%';
        }
        startTimer(remaining);
      }
    };

    toastEl.addEventListener('mouseenter', pauseTimer);
    toastEl.addEventListener('mouseleave', resumeTimer);

    // Close button
    const closeBtn = toastEl.querySelector('.toast-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismiss(toastEl, toastId);
      });
    }

    // Action button
    const actionBtn = toastEl.querySelector('.toast-action-btn');
    if (actionBtn && onAction) {
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onAction(property);
        this.dismiss(toastEl, toastId);
      });
    }

    // Start initial countdown
    startTimer(duration);

    return toastId;
  }

  dismiss(toastEl, toastId) {
    if (!toastEl) return;
    toastEl.classList.remove('visible');
    toastEl.classList.add('exiting');
    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
      this.activeToasts.delete(toastId);
    }, 400);
  }

  /**
   * Helper method formatted specifically for property status transitions
   */
  notifyPropertyStatus(property, newStatus, customMessage = null) {
    if (!property) return;

    const normalizedStatus = (newStatus || '').toLowerCase();
    const currentPropStatus = (property.status || '').toLowerCase();

    // Strict validation: ONLY trigger/display if property is currently strictly 'reserved'
    if (normalizedStatus === 'reserved' && currentPropStatus !== 'reserved') {
      return null;
    }

    let message = customMessage;
    let actionText = null;
    let onAction = null;

    if (normalizedStatus === 'reserved') {
      message = message || `This property has just been reserved`;
      actionText = 'Reserved – Join Waitlist ↗';
      onAction = (prop) => {
        window.dispatchEvent(new CustomEvent('retha:open-waitlist', { detail: { property: prop } }));
      };
    } else if (normalizedStatus === 'sold') {
      message = message || `This property has just been sold`;
      actionText = 'View Similar Properties ↗';
      onAction = (prop) => {
        window.dispatchEvent(new CustomEvent('retha:view-similar', { detail: { property: prop } }));
      };
    } else {
      message = message || `This property is now available`;
      actionText = 'Request Acquisition Info ↗';
      onAction = (prop) => {
        window.dispatchEvent(new CustomEvent('retha:open-property', { detail: { id: prop.id } }));
      };
    }

    return this.show({
      title: 'LIVE REGA REGISTRY UPDATE',
      message: message,
      subtext: `Asset: ${property.title} (${property.district})`,
      status: normalizedStatus,
      property: property,
      duration: 6000,
      actionText: actionText,
      onAction: onAction
    });
  }

  /**
   * Supabase Realtime channel listener for live property status changes
   */
  setupRealtimeListener() {
    if (!supabase) return;

    try {
      if (this.realtimeChannel) {
        supabase.removeChannel(this.realtimeChannel);
      }

      this.realtimeChannel = supabase
        .channel('realtime:properties-status-updates')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'properties' },
          (payload) => {
            if (!payload || !payload.new) return;

            const newRow = payload.new;
            const rawStatus = newRow.status;
            const normalizedStatus = (rawStatus || '').toLowerCase();

            // Find matching property in memory (by id, slug, or dbId)
            const prop = properties.find(p => p.dbId === newRow.id || p.id === newRow.id || p.slug === newRow.slug || p.id === newRow.slug);
            if (!prop) return;

            const previousStatus = prop.status;
            prop.status = normalizedStatus;

            // Dispatch global event for reactive UI updates across all components
            window.dispatchEvent(new CustomEvent('retha:properties-changed', {
              detail: { propertyId: prop.id, previousStatus, newStatus: normalizedStatus, property: prop }
            }));

            // Strict check: ONLY fire toast if payload.new.status === 'Reserved' (or mapped lowercase 'reserved')
            if (rawStatus === 'Reserved' || normalizedStatus === 'reserved') {
              this.notifyPropertyStatus(prop, 'reserved');
            } else if (rawStatus === 'Sold' || normalizedStatus === 'sold') {
              this.notifyPropertyStatus(prop, 'sold');
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[RETHA Toast] Realtime property status listener connected.');
          }
        });
    } catch (err) {
      console.warn('[RETHA Toast] Realtime subscription error:', err);
    }
  }

  /**
   * Handle incoming simulated or backend event
   */
  handleIncomingStatusUpdate(propertyId, newStatus, customMsg, payload = null) {
    const prop = properties.find(p => p.id === propertyId || p.dbId === propertyId);
    if (!prop) return;

    // Check payload.new.status if payload is passed, fallback to newStatus
    const rawStatus = payload?.new?.status ?? newStatus;
    const normalizedStatus = (rawStatus || '').toLowerCase();

    // Update in-memory property data model
    const previousStatus = prop.status;
    prop.status = normalizedStatus;

    // Dispatch UI re-render event
    window.dispatchEvent(new CustomEvent('retha:properties-changed', {
      detail: { propertyId, previousStatus, newStatus: normalizedStatus, property: prop }
    }));

    // Strict check: ONLY fire toast if payload.new.status === 'Reserved' (or mapped lowercase 'reserved')
    if (rawStatus === 'Reserved' || normalizedStatus === 'reserved') {
      this.notifyPropertyStatus(prop, 'reserved', customMsg);
    } else if (rawStatus === 'Sold' || normalizedStatus === 'sold') {
      this.notifyPropertyStatus(prop, 'sold', customMsg);
    }
  }

  /**
   * Placeholder / Mock event trigger method (for testing & development)
   */
  simulate(propertyId, newStatus) {
    const targetProp = properties.find(p => p.id === propertyId) || properties[1];
    if (!targetProp) return;
    const targetStatus = newStatus || (targetProp.status === 'reserved' ? 'sold' : 'reserved');
    
    window.dispatchEvent(new CustomEvent('retha:property-status-update', {
      detail: {
        propertyId: targetProp.id,
        status: targetStatus,
        payload: {
          new: {
            id: targetProp.dbId || targetProp.id,
            status: targetStatus
          }
        },
        message: targetStatus === 'reserved' 
          ? 'This property has just been reserved' 
          : targetStatus === 'sold'
          ? 'This property has just been sold'
          : 'This property is now available'
      }
    }));
  }
}

// Singleton instance
export const statusToast = new StatusToastManager();

// Global access for testing, console inspection, or future WebSocket integration
if (typeof window !== 'undefined') {
  window.rethaToast = statusToast;
  window.simulatePropertyStatusUpdate = (propertyId, status) => {
    statusToast.simulate(propertyId, status);
  };
}

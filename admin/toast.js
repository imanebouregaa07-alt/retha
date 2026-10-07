/**
 * RETHA Admin Panel — Toast Notification Service
 * Completely isolated from public frontend
 */
export class AdminToast {
  constructor() {
    this.container = null;
    this.ensureContainer();
  }

  ensureContainer() {
    if (!this.container) {
      let el = document.getElementById('admin-toast-container');
      if (!el) {
        el = document.createElement('div');
        el.id = 'admin-toast-container';
        el.className = 'admin-toast-container';
        document.body.appendChild(el);
      }
      this.container = el;
    }
  }

  show(message, type = 'info', duration = 4000) {
    this.ensureContainer();
    const toast = document.createElement('div');
    toast.className = `admin-toast admin-toast-${type}`;

    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `
      <span class="admin-toast-icon">${icon}</span>
      <div class="admin-toast-message">${this.escapeHtml(message)}</div>
      <button class="admin-toast-close" aria-label="Close">&times;</button>
    `;

    toast.querySelector('.admin-toast-close').addEventListener('click', () => {
      this.dismiss(toast);
    });

    this.container.appendChild(toast);

    setTimeout(() => {
      this.dismiss(toast);
    }, duration);
  }

  success(msg, duration) {
    this.show(msg, 'success', duration);
  }

  error(msg, duration) {
    this.show(msg, 'error', duration || 5000);
  }

  info(msg, duration) {
    this.show(msg, 'info', duration);
  }

  dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('admin-toast-exiting');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const adminToast = new AdminToast();

/**
 * RETHA Admin Panel — Core Application Controller & Router
 * Completely isolated from public frontend
 */
import { AdminAuth } from './auth.js';
import { AdminProperties } from './properties.js';
import { AdminLeads } from './leads.js';
import { AdminTelegram } from './telegram.js';
import { adminToast } from './toast.js';
import { initAdminI18n, getAdminLanguage, toggleAdminLanguage, tAdmin } from './i18n.js';

export class AdminApp {
  constructor() {
    this.root = document.getElementById('admin-app');
    this.currentUser = null;
    this.currentRoute = 'properties';

    initAdminI18n();

    this.auth = new AdminAuth({
      onLoginSuccess: (user) => this.handleAuthSuccess(user),
      onLogoutSuccess: () => this.handleAuthRequired()
    });

    this.properties = new AdminProperties(this);
    this.leads = new AdminLeads(this);
    this.telegram = new AdminTelegram(this);
  }

  async init() {
    this.auth.initSessionListener();

    // Check if current user is logged in
    const user = await this.auth.checkSession();
    if (user) {
      this.handleAuthSuccess(user);
    } else {
      this.handleAuthRequired();
    }

    // Hash router listener with strict auth gate
    window.addEventListener('hashchange', () => {
      if (this.currentUser) {
        this.routeFromHash();
      } else {
        this.handleAuthRequired();
      }
    });
  }

  handleAuthRequired() {
    this.currentUser = null;
    // Wipe any existing layout/content completely to prevent backend UI leakage
    this.root.innerHTML = '';

    // Clear any protected route hash so unauthorized visitors are redirected to #login
    if (window.location.hash && window.location.hash !== '#login') {
      window.history.replaceState(null, '', window.location.pathname + '#login');
    }

    const loginContainer = document.createElement('div');
    loginContainer.id = 'admin-login-container';
    this.root.appendChild(loginContainer);
    this.auth.renderLoginForm(loginContainer);
  }

  handleAuthSuccess(user) {
    this.currentUser = user;
    this.renderDashboardLayout();
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (!hash || hash === 'login') {
      this.navigate('properties');
    } else {
      this.routeFromHash();
    }
  }

  renderDashboardLayout() {
    this.root.innerHTML = `
      <div class="admin-layout" id="admin-main-layout">
        <!-- SIDEBAR -->
        <aside class="admin-sidebar" id="admin-sidebar">
          <div class="sidebar-header">
            <div class="sidebar-brand">
              <span class="brand-monogram">R</span>
              <div class="brand-text">
                <span class="brand-name">${tAdmin('brand_name')}</span>
                <span class="brand-sub">${tAdmin('brand_sub')}</span>
              </div>
            </div>
            <button type="button" class="sidebar-close-btn" id="sidebar-close-btn" aria-label="Close sidebar">✕</button>
          </div>

          <nav class="sidebar-nav">
            <div class="nav-section-label">${tAdmin('nav_management')}</div>
            <a href="#properties" class="sidebar-nav-item" data-route="properties">
              <span class="nav-icon">🏢</span>
              <span class="nav-label">${tAdmin('nav_properties')}</span>
            </a>
            <a href="#properties/new" class="sidebar-nav-item" data-route="properties/new">
              <span class="nav-icon">➕</span>
              <span class="nav-label">${tAdmin('nav_add_property')}</span>
            </a>
            <a href="#leads" class="sidebar-nav-item" data-route="leads">
              <span class="nav-icon">📬</span>
              <span class="nav-label">${tAdmin('nav_leads')}</span>
            </a>
            <a href="#telegram" class="sidebar-nav-item" data-route="telegram">
              <span class="nav-icon">✈️</span>
              <span class="nav-label">${tAdmin('nav_telegram')}</span>
            </a>

            <div class="nav-section-label mt-4">${tAdmin('nav_external')}</div>
            <a href="/" target="_blank" rel="noopener noreferrer" class="sidebar-nav-item external-link">
              <span class="nav-icon">🌐</span>
              <span class="nav-label">${tAdmin('nav_view_live')}</span>
              <span class="nav-ext-arrow">↗</span>
            </a>
            <a href="https://eservices.rega.gov.sa" target="_blank" rel="noopener noreferrer" class="sidebar-nav-item external-link">
              <span class="nav-icon">🛡️</span>
              <span class="nav-label">${tAdmin('nav_rega_portal')}</span>
              <span class="nav-ext-arrow">↗</span>
            </a>
          </nav>

          <div class="sidebar-footer">
            <div class="admin-user-info">
              <div class="user-avatar">👤</div>
              <div class="user-meta">
                <span class="user-email" title="${this.currentUser?.email || ''}">${this.currentUser?.email || 'Administrator'}</span>
                <span class="user-role">${tAdmin('auth_admin')}</span>
              </div>
            </div>
            <button type="button" class="admin-btn admin-btn-secondary admin-btn-block btn-logout" id="btn-sidebar-logout">
              <span>${tAdmin('sign_out')}</span>
              <span class="logout-icon">⏻</span>
            </button>
          </div>
        </aside>

        <!-- BACKDROP FOR MOBILE SIDEBAR -->
        <div class="sidebar-backdrop" id="sidebar-backdrop"></div>

        <!-- MAIN CONTENT WRAPPER -->
        <div class="admin-main-wrapper">
          <!-- TOPBAR -->
          <header class="admin-topbar">
            <div class="topbar-left">
              <button type="button" class="mobile-toggle-btn" id="btn-mobile-sidebar-toggle" aria-label="Toggle sidebar menu">
                ☰
              </button>
              <div class="topbar-breadcrumb" id="topbar-breadcrumb">
                <span class="crumb-root">${tAdmin('admin_crumb')}</span>
                <span class="crumb-sep">/</span>
                <span class="crumb-current" id="crumb-current">${tAdmin('crumb_properties')}</span>
              </div>
            </div>

            <div class="topbar-right">
              <button type="button" class="admin-lang-toggle-btn" id="btn-admin-lang-toggle" title="Switch Language (العربية / English)">
                <span class="lang-icon">🌐</span>
                <span class="admin-lang-label" id="admin-lang-label">${getAdminLanguage() === 'ar' ? 'English' : 'العربية'}</span>
              </button>
              <div class="topbar-badge-auth">
                <span class="status-indicator-dot"></span>
                <span class="auth-email">${this.currentUser?.email || 'admin@retha.sa'}</span>
              </div>
              <a href="/" target="_blank" rel="noopener noreferrer" class="topbar-btn-link" title="Open Public Site in New Tab">
                <span>${tAdmin('live_site')}</span>
              </a>
              <button type="button" class="admin-btn admin-btn-xs admin-btn-secondary" id="btn-topbar-logout">
                ${tAdmin('sign_out')}
              </button>
            </div>
          </header>

          <!-- MAIN CONTENT VIEW CONTAINER -->
          <main class="admin-content-area" id="admin-content"></main>
        </div>
      </div>
    `;

    // Bind sidebar toggles & logout
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const mobileToggle = document.getElementById('btn-mobile-sidebar-toggle');
    const closeBtn = document.getElementById('sidebar-close-btn');

    const toggleSidebar = (open) => {
      if (open) {
        sidebar.classList.add('is-open');
        backdrop.classList.add('is-open');
      } else {
        sidebar.classList.remove('is-open');
        backdrop.classList.remove('is-open');
      }
    };

    if (mobileToggle) mobileToggle.addEventListener('click', () => toggleSidebar(true));
    if (closeBtn) closeBtn.addEventListener('click', () => toggleSidebar(false));
    if (backdrop) backdrop.addEventListener('click', () => toggleSidebar(false));

    // Language switcher toggle button
    const langBtn = document.getElementById('btn-admin-lang-toggle');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        toggleAdminLanguage();
        this.renderDashboardLayout();
        this.routeFromHash();
      });
    }

    // Logout buttons
    const handleLogoutClick = () => {
      if (confirm('Are you sure you want to sign out of the Admin Dashboard?')) {
        this.auth.logout();
      }
    };
    const sideLogout = document.getElementById('btn-sidebar-logout');
    const topLogout = document.getElementById('btn-topbar-logout');
    if (sideLogout) sideLogout.addEventListener('click', handleLogoutClick);
    if (topLogout) topLogout.addEventListener('click', handleLogoutClick);
  }

  navigate(route) {
    window.location.hash = `#${route}`;
  }

  routeFromHash() {
    // STRICT AUTH GUARD: Unauthorized users are immediately redirected away and cannot view backend interface
    if (!this.currentUser) {
      this.handleAuthRequired();
      return;
    }

    const hash = window.location.hash.replace(/^#\/?/, '') || 'properties';
    if (hash === 'login') {
      this.navigate('properties');
      return;
    }

    this.currentRoute = hash;

    // Update active state in sidebar
    document.querySelectorAll('.sidebar-nav-item').forEach((item) => {
      const r = item.dataset.route;
      if (r && (hash === r || hash.startsWith(r + '/'))) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Close mobile sidebar on navigation
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-open');

    // Route dispatch
    const content = document.getElementById('admin-content');
    const crumbCurrent = document.getElementById('crumb-current');

    if (!content) return;

    if (hash === 'properties' || hash === '') {
      if (crumbCurrent) crumbCurrent.textContent = tAdmin('crumb_properties');
      this.properties.renderList(content);
    } else if (hash === 'properties/new') {
      if (crumbCurrent) crumbCurrent.textContent = tAdmin('crumb_new_prop');
      this.properties.renderAddForm(content);
    } else if (hash.startsWith('properties/edit/')) {
      const propertyId = hash.replace('properties/edit/', '');
      if (crumbCurrent) crumbCurrent.textContent = tAdmin('crumb_edit_prop');
      this.properties.renderEditForm(content, propertyId);
    } else if (hash === 'leads') {
      if (crumbCurrent) crumbCurrent.textContent = tAdmin('crumb_leads');
      this.leads.render(content);
    } else if (hash === 'telegram') {
      if (crumbCurrent) crumbCurrent.textContent = tAdmin('crumb_telegram');
      this.telegram.render(content);
    } else {
      // Default to properties
      this.navigate('properties');
    }
  }
}

// Instantiate and initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AdminApp();
  app.init();
});

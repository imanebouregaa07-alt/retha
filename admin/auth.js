/**
 * RETHA Admin Panel — Authentication Controller
 * Handles Supabase Auth session, login UI, logout, and route guarding.
 */
import { adminApi } from './api.js';
import { adminToast } from './toast.js';

export class AdminAuth {
  constructor(options = {}) {
    this.currentUser = null;
    this.onLoginSuccess = options.onLoginSuccess || (() => {});
    this.onLogoutSuccess = options.onLogoutSuccess || (() => {});
  }

  async checkSession() {
    try {
      const session = await adminApi.getSession();
      if (session && session.user) {
        this.currentUser = session.user;
        return this.currentUser;
      }
      this.currentUser = null;
      return null;
    } catch (err) {
      console.error('Session check failed:', err);
      this.currentUser = null;
      return null;
    }
  }

  initSessionListener() {
    adminApi.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        this.currentUser = session.user;
        this.onLoginSuccess(this.currentUser);
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.onLogoutSuccess();
      }
    });
  }

  async login(email, password) {
    try {
      const data = await adminApi.signIn(email, password);
      this.currentUser = data.user;
      adminToast.success(`Welcome back, ${data.user.email}!`);
      this.onLoginSuccess(this.currentUser);
      return data;
    } catch (err) {
      const msg = err.message || 'Login failed. Please check your credentials.';
      adminToast.error(msg);
      throw err;
    }
  }

  async logout() {
    try {
      await adminApi.signOut();
      this.currentUser = null;
      adminToast.info('Logged out successfully.');
      this.onLogoutSuccess();
    } catch (err) {
      adminToast.error(err.message || 'Error logging out.');
    }
  }

  renderLoginForm(container) {
    if (!container) return;

    container.innerHTML = `
      <div class="admin-login-wrapper">
        <div class="admin-login-card">
          <div class="admin-login-header">
            <div class="admin-brand-monogram">R</div>
            <h2>RETHA REAL ESTATE</h2>
            <p class="admin-subtitle">Executive Administrative Portal</p>
          </div>

          <div id="login-error-alert" class="admin-alert admin-alert-danger" style="display: none;"></div>

          <form id="admin-login-form" class="admin-form" autocomplete="on">
            <div class="form-group">
              <label for="admin-email">Administrator Email</label>
              <div class="input-icon-wrapper">
                <span class="input-icon">✉</span>
                <input
                  type="email"
                  id="admin-email"
                  name="email"
                  placeholder="admin.retha@gmail.com"
                  required
                  autocomplete="username"
                  class="admin-input"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="admin-password">Password</label>
              <div class="input-icon-wrapper">
                <span class="input-icon">🔒</span>
                <input
                  type="password"
                  id="admin-password"
                  name="password"
                  placeholder="••••••••••••"
                  required
                  autocomplete="current-password"
                  class="admin-input"
                />
              </div>
            </div>

            <button type="submit" id="btn-admin-login" class="admin-btn admin-btn-primary admin-btn-block">
              <span>Sign In to Dashboard</span>
              <span class="btn-arrow">→</span>
            </button>
          </form>

          <div class="admin-login-footer">
            <a href="/" target="_blank" rel="noopener noreferrer" class="link-back-live">
              ← Return to Public Website
            </a>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    const form = container.querySelector('#admin-login-form');
    const emailInput = container.querySelector('#admin-email');
    const passwordInput = container.querySelector('#admin-password');
    const submitBtn = container.querySelector('#btn-admin-login');
    const errorAlert = container.querySelector('#login-error-alert');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorAlert.style.display = 'none';
        errorAlert.textContent = '';
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Verifying credentials...</span>';

        try {
          await this.login(emailInput.value, passwordInput.value);
        } catch (err) {
          errorAlert.textContent = err.message || 'Authentication failed. Please verify credentials.';
          errorAlert.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Sign In to Dashboard</span> <span class="btn-arrow">→</span>';
        }
      });
    }
  }
}

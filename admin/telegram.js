/**
 * RETHA Admin Panel — Telegram Team Management Controller
 * Displays team members receiving Telegram notifications from 'telegram_recipients' table.
 * Supports Adding, Editing, Deleting, and Toggling active status for team recipients.
 */
import { adminApi } from './api.js';
import { adminToast } from './toast.js';

export class AdminTelegram {
  constructor(router) {
    this.router = router;
    this.recipients = [];
    this.filterActive = 'all';
    this.searchQuery = '';
    this.editingRecipient = null;
  }

  escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  getInitials(name) {
    if (!name) return 'TG';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  async render(container) {
    if (!this.router.currentUser) {
      if (container) container.innerHTML = '';
      this.router.handleAuthRequired();
      return;
    }

    container.innerHTML = `
      <div class="admin-view-header">
        <div class="view-header-title">
          <h2>Telegram Team Management</h2>
          <p class="view-header-desc">
            Manage agency team members and advisors receiving instant Telegram notifications when clients submit inquiries.
          </p>
        </div>
        <div class="view-header-actions">
          <button type="button" id="btn-add-recipient" class="admin-btn admin-btn-primary">
            <span>+ Add Team Member</span>
          </button>
        </div>
      </div>

      <!-- METRIC STATS -->
      <div class="admin-stats-grid" id="telegram-stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Recipients</div>
          <div class="stat-value" id="stat-total-recipients">-</div>
        </div>
        <div class="stat-card stat-available">
          <div class="stat-label">Active Alert Receivers (مفعل)</div>
          <div class="stat-value" id="stat-active-recipients">-</div>
        </div>
        <div class="stat-card stat-sold">
          <div class="stat-label">Paused / Inactive (متوقف)</div>
          <div class="stat-value" id="stat-paused-recipients">-</div>
        </div>
        <div class="stat-card stat-reserved">
          <div class="stat-label">Bot Integration Status</div>
          <div class="stat-value" style="font-size: 1.15rem; color: #34d399;">
            <span class="status-indicator-dot" style="display: inline-block; margin-right: 6px;"></span>
            Active & Connected
          </div>
        </div>
      </div>

      <!-- QUICK GUIDE CARD -->
      <div class="admin-card telegram-guide-card mb-4" style="margin-bottom: 20px; border-left: 4px solid var(--admin-accent);">
        <div style="display: flex; align-items: flex-start; gap: 14px;">
          <span style="font-size: 1.6rem; line-height: 1;">💡</span>
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 4px;">
              How to add a new team member to Telegram alerts:
            </h4>
            <p style="font-size: 0.825rem; color: var(--admin-text-muted); line-height: 1.5;">
              1. Ask the advisor/member to open Telegram and search for <code>@userinfobot</code> or <code>@RawDataBot</code> to get their numerical <strong>Telegram Chat ID</strong> (e.g. <code>6915367320</code>).<br />
              2. Have them send <code>/start</code> to the agency bot (<strong>@retha_realestate_bot</strong>) so the bot has permission to message them.<br />
              3. Click <strong>"+ Add Team Member"</strong> above and paste their name and Chat ID. They will automatically receive all future leads!
            </p>
          </div>
        </div>
      </div>

      <!-- FILTER & SEARCH BAR -->
      <div class="admin-filter-bar">
        <div class="filter-search-box">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            id="telegram-search-input"
            class="admin-input"
            placeholder="Search by team member name or Chat ID..."
            value="${this.escapeHtml(this.searchQuery)}"
          />
        </div>

        <div class="filter-controls-group">
          <div class="form-group-inline">
            <label for="filter-telegram-active">Alert Status:</label>
            <select id="filter-telegram-active" class="admin-select">
              <option value="all" ${this.filterActive === 'all' ? 'selected' : ''}>All Members</option>
              <option value="true" ${this.filterActive === 'true' ? 'selected' : ''}>Active Only (مفعل)</option>
              <option value="false" ${this.filterActive === 'false' ? 'selected' : ''}>Paused Only (متوقف)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- TABLE CONTAINER -->
      <div class="admin-table-container">
        <div id="telegram-table-loading" class="table-loading-spinner">
          Loading team recipients from Supabase...
        </div>
        <div id="telegram-table-wrapper" style="display: none;"></div>
      </div>

      <!-- MODAL CONTAINER (FOR ADD / EDIT / DELETE) -->
      <div id="telegram-modal-container"></div>
    `;

    // Bind Add button
    const addBtn = container.querySelector('#btn-add-recipient');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.openAddEditModal(container);
      });
    }

    // Bind Search input
    const searchInput = container.querySelector('#telegram-search-input');
    let debounceTimer;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchQuery = e.target.value;
          this.loadAndRenderTable(container);
        }, 250);
      });
    }

    // Bind Status filter
    const statusSelect = container.querySelector('#filter-telegram-active');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.filterActive = e.target.value;
        this.loadAndRenderTable(container);
      });
    }

    // Initial load
    await this.loadAndRenderTable(container);
  }

  async loadAndRenderTable(container) {
    const loadingEl = container.querySelector('#telegram-table-loading');
    const tableWrapper = container.querySelector('#telegram-table-wrapper');

    if (loadingEl) loadingEl.style.display = 'block';
    if (tableWrapper) tableWrapper.style.display = 'none';

    try {
      this.recipients = await adminApi.getTelegramRecipients({
        search: this.searchQuery,
        active: this.filterActive
      });

      // Update metrics
      const allRecipients = await adminApi.getTelegramRecipients();
      const total = allRecipients.length;
      const countActive = allRecipients.filter((r) => r.active).length;
      const countPaused = allRecipients.filter((r) => !r.active).length;

      const setStat = (id, val) => {
        const el = container.querySelector(id);
        if (el) el.textContent = val;
      };
      setStat('#stat-total-recipients', total);
      setStat('#stat-active-recipients', countActive);
      setStat('#stat-paused-recipients', countPaused);

      if (loadingEl) loadingEl.style.display = 'none';
      if (tableWrapper) {
        tableWrapper.style.display = 'block';

        if (this.recipients.length === 0) {
          tableWrapper.innerHTML = `
            <div class="admin-empty-state" style="padding: 48px; text-align: center;">
              <span class="empty-icon" style="font-size: 2.5rem; display: block; margin-bottom: 12px;">✈️</span>
              <p style="color: var(--admin-text-muted); font-size: 0.95rem; margin-bottom: 16px;">
                ${this.searchQuery || this.filterActive !== 'all' ? 'No team members match your filter criteria.' : 'No Telegram recipients added yet.'}
              </p>
              ${
                this.searchQuery || this.filterActive !== 'all'
                  ? `<button type="button" class="admin-btn admin-btn-sm admin-btn-secondary" id="btn-reset-telegram-filter">Reset Filters</button>`
                  : `<button type="button" class="admin-btn admin-btn-sm admin-btn-primary" id="btn-empty-add-recipient">+ Add First Team Member</button>`
              }
            </div>
          `;

          const resetBtn = tableWrapper.querySelector('#btn-reset-telegram-filter');
          if (resetBtn) {
            resetBtn.addEventListener('click', () => {
              this.searchQuery = '';
              this.filterActive = 'all';
              this.render(container);
            });
          }

          const emptyAddBtn = tableWrapper.querySelector('#btn-empty-add-recipient');
          if (emptyAddBtn) {
            emptyAddBtn.addEventListener('click', () => {
              this.openAddEditModal(container);
            });
          }

          return;
        }

        tableWrapper.innerHTML = `
          <table class="admin-table">
            <thead>
              <tr>
                <th>Team Member</th>
                <th>Telegram Chat ID</th>
                <th>Alert Status</th>
                <th>Added Date</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.recipients
                .map((r) => {
                  const dateStr = r.created_at
                    ? new Date(r.created_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '-';
                  const initials = this.getInitials(r.name || 'Member');
                  const isActive = Boolean(r.active);

                  return `
                    <tr data-recipient-id="${r.id}">
                      <td>
                        <div style="display: flex; align-items: center; gap: 12px;">
                          <div style="
                            width: 38px;
                            height: 38px;
                            border-radius: 8px;
                            background: rgba(212, 175, 55, 0.12);
                            border: 1px solid var(--admin-accent);
                            color: var(--admin-accent);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-weight: 700;
                            font-size: 0.85rem;
                            flex-shrink: 0;
                          ">
                            ${initials}
                          </div>
                          <div>
                            <strong style="color: #fff; font-size: 0.9rem; display: block;">${this.escapeHtml(r.name || 'Unnamed Recipient')}</strong>
                            <span style="font-size: 0.725rem; color: var(--admin-text-muted);">RETHA Agency Team</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <code style="
                            background: rgba(255, 255, 255, 0.06);
                            border: 1px solid var(--admin-border);
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-family: var(--admin-font-mono);
                            font-size: 0.85rem;
                            color: #cbd5e1;
                          ">${this.escapeHtml(r.chat_id)}</code>
                          <button
                            type="button"
                            class="admin-btn admin-btn-xs admin-btn-secondary btn-copy-chatid"
                            data-chatid="${this.escapeHtml(r.chat_id)}"
                            title="Copy Chat ID"
                            style="padding: 3px 6px;"
                          >
                            📋
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          class="admin-btn admin-btn-xs ${isActive ? 'btn-status-toggle-active' : 'btn-status-toggle-paused'}"
                          data-id="${r.id}"
                          data-active="${isActive}"
                          title="Click to toggle active alert status"
                          style="
                            border-radius: 12px;
                            font-size: 0.725rem;
                            padding: 3px 10px;
                            cursor: pointer;
                            background: ${isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
                            color: ${isActive ? '#34d399' : '#f87171'};
                            border: 1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
                          "
                        >
                          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${isActive ? '#10b981' : '#ef4444'}; margin-right: 4px;"></span>
                          ${isActive ? 'Active (مفعل)' : 'Paused (متوقف)'}
                        </button>
                      </td>
                      <td>
                        <span class="date-text">${dateStr}</span>
                      </td>
                      <td class="text-right">
                        <div class="table-actions-group" style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                          <button
                            type="button"
                            class="admin-btn admin-btn-xs admin-btn-secondary btn-edit-recipient"
                            data-id="${r.id}"
                            title="Edit Recipient"
                          >
                            ✎ Edit
                          </button>
                          <button
                            type="button"
                            class="admin-btn admin-btn-xs admin-btn-danger btn-delete-recipient"
                            data-id="${r.id}"
                            data-name="${this.escapeHtml(r.name || r.chat_id)}"
                            title="Delete Recipient"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        `;

        // Bind copy buttons
        tableWrapper.querySelectorAll('.btn-copy-chatid').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const chatId = btn.dataset.chatid;
            try {
              await navigator.clipboard.writeText(chatId);
              adminToast.info(`Copied Chat ID: ${chatId}`);
            } catch (err) {
              adminToast.error('Could not copy to clipboard.');
            }
          });
        });

        // Bind active status toggle button
        tableWrapper.querySelectorAll('.btn-status-toggle-active, .btn-status-toggle-paused').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const currentActive = btn.dataset.active === 'true';
            const nextActive = !currentActive;
            btn.disabled = true;

            try {
              await adminApi.updateTelegramRecipient(id, { active: nextActive });
              adminToast.success(nextActive ? 'Alerts activated for member!' : 'Alerts paused for member.');
              await this.loadAndRenderTable(container);
            } catch (err) {
              adminToast.error('Failed to update status: ' + err.message);
              btn.disabled = false;
            }
          });
        });

        // Bind Edit buttons
        tableWrapper.querySelectorAll('.btn-edit-recipient').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const item = this.recipients.find((r) => r.id === id);
            if (item) {
              this.openAddEditModal(container, item);
            }
          });
        });

        // Bind Delete buttons
        tableWrapper.querySelectorAll('.btn-delete-recipient').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const name = btn.dataset.name;
            this.openDeleteConfirmModal(container, id, name);
          });
        });
      }
    } catch (err) {
      console.error('Error loading telegram recipients:', err);
      if (loadingEl) {
        loadingEl.innerHTML = `
          <div style="color: var(--admin-danger); padding: 24px;">
            ⚠️ Failed to load telegram recipients: ${this.escapeHtml(err.message)}
          </div>
        `;
      }
      adminToast.error('Error loading Telegram recipients: ' + err.message);
    }
  }

  openAddEditModal(container, recipient = null) {
    const isEdit = Boolean(recipient);
    const modalContainer = container.querySelector('#telegram-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="admin-modal-backdrop" id="telegram-form-modal">
        <div class="admin-modal-dialog" style="max-width: 500px;">
          <div class="admin-modal-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.4rem;">${isEdit ? '✎' : '➕'}</span>
              <h3 style="font-size: 1.15rem; font-weight: 700; color: #fff; margin: 0;">
                ${isEdit ? 'Edit Team Recipient' : 'Add Team Recipient'}
              </h3>
            </div>
            <button type="button" class="btn-modal-close" style="background: none; border: none; color: var(--admin-text-muted); font-size: 1.25rem; cursor: pointer;">✕</button>
          </div>

          <form id="telegram-recipient-form">
            <div class="admin-modal-body" style="margin-bottom: 20px;">
              <div class="form-group">
                <label for="recipient-name">
                  Team Member Name <span class="required">*</span>
                </label>
                <input
                  type="text"
                  id="recipient-name"
                  class="admin-input"
                  placeholder="e.g. Khalid Al-Mansoor - Senior Advisor"
                  value="${isEdit ? this.escapeHtml(recipient.name || '') : ''}"
                  required
                />
                <span class="form-hint">Used for identifying team members in administrative audit logs.</span>
              </div>

              <div class="form-group" style="margin-top: 14px;">
                <label for="recipient-chat-id">
                  Telegram Chat ID <span class="required">*</span>
                </label>
                <input
                  type="text"
                  id="recipient-chat-id"
                  class="admin-input"
                  placeholder="e.g. 6915367320"
                  value="${isEdit ? this.escapeHtml(recipient.chat_id || '') : ''}"
                  required
                />
                <span class="form-hint">Numerical Telegram Chat ID. The user must send /start to @retha_realestate_bot.</span>
              </div>

              <div class="form-group" style="margin-top: 16px; padding: 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--admin-border); border-radius: var(--admin-radius);">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin: 0;">
                  <input
                    type="checkbox"
                    id="recipient-active"
                    style="width: 18px; height: 18px; accent-color: var(--admin-accent); cursor: pointer;"
                    ${!isEdit || recipient.active ? 'checked' : ''}
                  />
                  <div>
                    <span style="font-weight: 600; color: #fff; display: block; font-size: 0.85rem;">Active Notification Receiver</span>
                    <span style="font-size: 0.75rem; color: var(--admin-text-muted);">Uncheck to temporarily pause notifications for this member (e.g. vacation or leave).</span>
                  </div>
                </label>
              </div>
            </div>

            <div class="admin-modal-footer">
              <button type="button" class="admin-btn admin-btn-secondary btn-modal-cancel">Cancel</button>
              <button type="submit" class="admin-btn admin-btn-primary" id="btn-save-recipient">
                <span>${isEdit ? 'Save Changes' : 'Add Recipient'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    const modalBackdrop = modalContainer.querySelector('#telegram-form-modal');
    const closeBtn = modalContainer.querySelector('.btn-modal-close');
    const cancelBtn = modalContainer.querySelector('.btn-modal-cancel');
    const form = modalContainer.querySelector('#telegram-recipient-form');

    const closeModal = () => {
      modalContainer.innerHTML = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('#btn-save-recipient');
        const nameInput = form.querySelector('#recipient-name');
        const chatIdInput = form.querySelector('#recipient-chat-id');
        const activeInput = form.querySelector('#recipient-active');

        const name = nameInput.value.trim();
        const chatId = chatIdInput.value.trim();
        const active = activeInput.checked;

        if (!chatId) {
          adminToast.error('Telegram Chat ID is required.');
          chatIdInput.focus();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Saving...</span>`;

        try {
          if (isEdit) {
            await adminApi.updateTelegramRecipient(recipient.id, {
              name,
              chat_id: chatId,
              active
            });
            adminToast.success(`Recipient "${name || chatId}" updated successfully!`);
          } else {
            await adminApi.createTelegramRecipient({
              name,
              chat_id: chatId,
              active
            });
            adminToast.success(`Team member "${name || chatId}" added to Telegram notifications!`);
          }

          closeModal();
          await this.loadAndRenderTable(container);
        } catch (err) {
          console.error('Error saving telegram recipient:', err);
          let errMsg = err.message || 'Failed to save recipient';
          if (errMsg.includes('unique') || errMsg.includes('duplicate')) {
            errMsg = `Chat ID ${chatId} is already registered to another team member.`;
          }
          adminToast.error(errMsg);
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>${isEdit ? 'Save Changes' : 'Add Recipient'}</span>`;
        }
      });
    }
  }

  openDeleteConfirmModal(container, id, name) {
    const modalContainer = container.querySelector('#telegram-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="admin-modal-backdrop" id="telegram-delete-modal">
        <div class="admin-modal-dialog">
          <div class="admin-modal-header">
            <span class="modal-warning-icon">⚠️</span>
            <h3>Confirm Recipient Deletion</h3>
          </div>
          <div class="admin-modal-body">
            <p>
              Are you sure you want to remove <strong>${this.escapeHtml(name)}</strong> from receiving Telegram lead alerts?
            </p>
            <p class="modal-warning-text">
              They will permanently stop receiving instant notifications for new client inquiries until added again.
            </p>
          </div>
          <div class="admin-modal-footer">
            <button type="button" class="admin-btn admin-btn-secondary btn-cancel-delete">Cancel</button>
            <button type="button" class="admin-btn admin-btn-danger btn-confirm-delete" id="btn-confirm-delete-recipient">
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    `;

    const modalBackdrop = modalContainer.querySelector('#telegram-delete-modal');
    const cancelBtn = modalContainer.querySelector('.btn-cancel-delete');
    const confirmBtn = modalContainer.querySelector('#btn-confirm-delete-recipient');

    const closeModal = () => {
      modalContainer.innerHTML = '';
    };

    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting...';

        try {
          await adminApi.deleteTelegramRecipient(id);
          adminToast.success(`Recipient "${name}" removed successfully.`);
          closeModal();
          await this.loadAndRenderTable(container);
        } catch (err) {
          adminToast.error('Failed to delete recipient: ' + err.message);
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm Delete';
        }
      });
    }
  }
}

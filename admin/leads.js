/**
 * RETHA Admin Panel — Leads & Inquiries Management Controller
 * Displays customer leads from 'leads' table, sorted newest first,
 * with live inline status dropdown (new / contacted / closed),
 * search by name/phone, filtering by status and property, and quick outreach actions.
 */
import { adminApi } from './api.js';
import { adminToast } from './toast.js';

export class AdminLeads {
  constructor(router) {
    this.router = router;
    this.leads = [];
    this.properties = [];
    this.filterStatus = 'all';
    this.filterProperty = 'all';
    this.searchQuery = '';
  }

  normalizeStatus(status) {
    if (!status) return 'new';
    const s = String(status).toLowerCase().trim();
    if (s === 'reserved' || s === 'pending') return 'reserved';
    if (s === 'sold' || s === 'notified_sold') return 'sold';
    if (s === 'contacted') return 'contacted';
    if (s === 'closed') return 'closed';
    if (s === 'new') return 'new';
    return s;
  }

  formatStatus(status) {
    const s = this.normalizeStatus(status);
    if (s === 'reserved') return 'Reserved (تم الحجز)';
    if (s === 'sold') return 'Sold (تم البيع)';
    if (s === 'contacted') return 'Contacted (تم التواصل)';
    if (s === 'closed') return 'Closed (مغلق)';
    return 'New (جديد)';
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
          <h2>Client Inquiries & Private Leads</h2>
          <p class="view-header-desc">
            Review VIP private acquisition advisory requests, customer contacts, and update acquisition pipeline status.
          </p>
        </div>
        <div class="view-header-actions">
          <button type="button" id="btn-create-test-lead" class="admin-btn admin-btn-sm admin-btn-secondary" title="Insert a sample VIP lead to test the workflow">
            ⚡ Seed Sample Lead
          </button>
        </div>
      </div>

      <!-- METRIC STATS -->
      <div class="admin-stats-grid" id="leads-stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Inquiries</div>
          <div class="stat-value" id="stat-total-leads">-</div>
        </div>
        <div class="stat-card stat-new">
          <div class="stat-label">New / Action Required (جديد)</div>
          <div class="stat-value" id="stat-new-leads">-</div>
        </div>
        <div class="stat-card stat-contacted">
          <div class="stat-label">Contacted / In Progress (تم التواصل)</div>
          <div class="stat-value" id="stat-contacted-leads">-</div>
        </div>
        <div class="stat-card stat-reserved">
          <div class="stat-label">Reserved (تم الحجز)</div>
          <div class="stat-value" id="stat-reserved-leads">-</div>
        </div>
        <div class="stat-card stat-sold">
          <div class="stat-label">Sold (تم البيع)</div>
          <div class="stat-value" id="stat-sold-leads">-</div>
        </div>
        <div class="stat-card stat-closed">
          <div class="stat-label">Closed / Completed (مغلق)</div>
          <div class="stat-value" id="stat-closed-leads">-</div>
        </div>
      </div>

      <!-- FILTER & SEARCH BAR -->
      <div class="admin-filter-bar">
        <div class="filter-search-box">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            id="leads-search-input"
            class="admin-input"
            placeholder="Search by client name, phone number, email..."
            value="${this.escapeHtml(this.searchQuery)}"
          />
        </div>

        <div class="filter-controls-group">
          <div class="form-group-inline">
            <label for="filter-lead-status">Pipeline Status:</label>
            <select id="filter-lead-status" class="admin-select">
              <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>All Statuses</option>
              <option value="new" ${this.filterStatus === 'new' ? 'selected' : ''}>New (جديد)</option>
              <option value="contacted" ${this.filterStatus === 'contacted' ? 'selected' : ''}>Contacted (تم التواصل)</option>
              <option value="reserved" ${this.filterStatus === 'reserved' || this.filterStatus === 'pending' ? 'selected' : ''}>Reserved (تم الحجز)</option>
              <option value="sold" ${this.filterStatus === 'sold' ? 'selected' : ''}>Sold (تم البيع)</option>
              <option value="closed" ${this.filterStatus === 'closed' ? 'selected' : ''}>Closed (مغلق)</option>
            </select>
          </div>

          <div class="form-group-inline">
            <label for="filter-lead-property">Target Asset:</label>
            <select id="filter-lead-property" class="admin-select">
              <option value="all">All Properties</option>
            </select>
          </div>
        </div>
      </div>

      <!-- LEADS TABLE CONTAINER -->
      <div class="admin-table-container">
        <div id="leads-table-loading" class="table-loading-spinner">
          Loading inquiries from database...
        </div>
        <div id="leads-table-wrapper" style="display: none;"></div>
      </div>
    `;

    // Load properties list for the filter dropdown
    try {
      this.properties = await adminApi.getProperties();
      const propSelect = container.querySelector('#filter-lead-property');
      if (propSelect) {
        this.properties.forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = `${p.title} (${p.reference_code || p.city || 'Asset'})`;
          if (this.filterProperty === p.id) opt.selected = true;
          propSelect.appendChild(opt);
        });
      }
    } catch (e) {
      console.warn('Could not populate properties filter in leads:', e);
    }

    // Bind filters & search
    const searchInput = container.querySelector('#leads-search-input');
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchQuery = e.target.value;
        this.loadAndRenderTable(container);
      }, 250);
    });

    container.querySelector('#filter-lead-status').addEventListener('change', (e) => {
      this.filterStatus = e.target.value;
      this.loadAndRenderTable(container);
    });

    container.querySelector('#filter-lead-property').addEventListener('change', (e) => {
      this.filterProperty = e.target.value;
      this.loadAndRenderTable(container);
    });

    const seedBtn = container.querySelector('#btn-create-test-lead');
    if (seedBtn) {
      seedBtn.addEventListener('click', async () => {
        seedBtn.disabled = true;
        seedBtn.textContent = 'Creating...';
        try {
          const sampleProp = this.properties[0];
          await adminApi.supabase.from('leads').insert([
            {
              property_id: sampleProp?.id || null,
              full_name: 'H.E. Faisal Al-Hokair',
              phone: '+966502125573',
              email: 'faisal.alhokair@investment.sa',
              budget_range: 'SAR 15,000,000 - 30,000,000',
              preferred_contact_method: 'whatsapp',
              message: 'Requesting private confidential viewing for family estate acquisition in North Riyadh.',
              status: 'new'
            }
          ]);
          adminToast.success('Sample VIP inquiry created!');
          await this.loadAndRenderTable(container);
        } catch (err) {
          adminToast.error('Failed to create sample lead: ' + err.message);
        } finally {
          seedBtn.disabled = false;
          seedBtn.textContent = '⚡ Seed Sample Lead';
        }
      });
    }

    await this.loadAndRenderTable(container);
  }

  async loadAndRenderTable(container) {
    const loadingEl = container.querySelector('#leads-table-loading');
    const tableWrapper = container.querySelector('#leads-table-wrapper');

    if (loadingEl) loadingEl.style.display = 'block';
    if (tableWrapper) tableWrapper.style.display = 'none';

    try {
      this.leads = await adminApi.getLeads({
        status: this.filterStatus,
        propertyId: this.filterProperty,
        search: this.searchQuery
      });

      // Update metric cards
      const allLeads = await adminApi.getLeads();
      const total = allLeads.length;
      const countNew = allLeads.filter((l) => this.normalizeStatus(l.status) === 'new').length;
      const countContacted = allLeads.filter((l) => this.normalizeStatus(l.status) === 'contacted').length;
      const countReserved = allLeads.filter((l) => this.normalizeStatus(l.status) === 'reserved').length;
      const countSold = allLeads.filter((l) => this.normalizeStatus(l.status) === 'sold').length;
      const countClosed = allLeads.filter((l) => this.normalizeStatus(l.status) === 'closed').length;

      const setStat = (id, val) => {
        const el = container.querySelector(id);
        if (el) el.textContent = val;
      };
      setStat('#stat-total-leads', total);
      setStat('#stat-new-leads', countNew);
      setStat('#stat-contacted-leads', countContacted);
      setStat('#stat-reserved-leads', countReserved);
      setStat('#stat-sold-leads', countSold);
      setStat('#stat-closed-leads', countClosed);

      if (loadingEl) loadingEl.style.display = 'none';
      if (tableWrapper) {
        tableWrapper.style.display = 'block';

        if (this.leads.length === 0) {
          tableWrapper.innerHTML = `
            <div class="admin-empty-state">
              <span class="empty-icon">📬</span>
              <p>No leads found matching current filters.</p>
              <button type="button" class="admin-btn admin-btn-sm admin-btn-secondary" id="btn-reset-leads-filter">
                Reset Filters
              </button>
            </div>
          `;
          const resetBtn = tableWrapper.querySelector('#btn-reset-leads-filter');
          if (resetBtn) {
            resetBtn.addEventListener('click', () => {
              this.searchQuery = '';
              this.filterStatus = 'all';
              this.filterProperty = 'all';
              this.render(container);
            });
          }
          return;
        }

        tableWrapper.innerHTML = `
          <table class="admin-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Phone / Outreach</th>
                <th>Email</th>
                <th>Target Asset</th>
                <th>Budget / Method</th>
                <th class="status-cell">Pipeline Status (Live)</th>
                <th>Message</th>
                <th>Date Received</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.leads
                .map((lead) => {
                  const dateStr = lead.created_at
                    ? new Date(lead.created_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '-';
                  const cleanPhone = (lead.phone || '').replace(/[^0-9+]/g, '');
                  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}` : '#';
                  const propName = lead.properties?.title || 'General Advisory';
                  const propRef = lead.properties?.reference_code || '';

                  const currentStatus = this.normalizeStatus(lead.status);

                  return `
                  <tr data-lead-id="${lead.id}">
                    <td>
                      <div class="client-name-cell">
                        <strong class="client-name">${this.escapeHtml(lead.full_name)}</strong>
                      </div>
                    </td>
                    <td>
                      <div class="phone-cell">
                        <a href="tel:${cleanPhone}" class="phone-link" title="Call directly">
                          ✆ ${this.escapeHtml(lead.phone)}
                        </a>
                        ${
                          cleanPhone
                            ? `
                          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="badge-wa" title="Open WhatsApp chat">
                            WhatsApp ↗
                          </a>
                        `
                            : ''
                        }
                      </div>
                    </td>
                    <td>
                      ${
                        lead.email
                          ? `<a href="mailto:${this.escapeHtml(lead.email)}" class="email-link">${this.escapeHtml(lead.email)}</a>`
                          : '<span class="text-muted">-</span>'
                      }
                    </td>
                    <td>
                      <div class="prop-target-cell">
                        <span class="prop-target-title">${this.escapeHtml(propName)}</span>
                        ${propRef ? `<code class="prop-target-ref">${this.escapeHtml(propRef)}</code>` : ''}
                      </div>
                    </td>
                    <td>
                      <div class="budget-method-cell">
                        <span class="budget-tag">${this.escapeHtml(lead.budget_range || 'Not specified')}</span>
                        <span class="method-tag method-${lead.preferred_contact_method || 'phone'}">
                          via ${this.escapeHtml(lead.preferred_contact_method || 'phone')}
                        </span>
                      </div>
                    </td>
                    <td class="status-cell">
                      <select class="admin-select admin-select-sm lead-status-select select-status-${currentStatus}" data-lead-id="${lead.id}">
                        <option value="new" ${currentStatus === 'new' ? 'selected' : ''}>New (جديد)</option>
                        <option value="contacted" ${currentStatus === 'contacted' ? 'selected' : ''}>Contacted (تم التواصل)</option>
                        <option value="reserved" ${currentStatus === 'reserved' ? 'selected' : ''}>Reserved (تم الحجز)</option>
                        <option value="sold" ${currentStatus === 'sold' ? 'selected' : ''}>Sold (تم البيع)</option>
                        <option value="closed" ${currentStatus === 'closed' ? 'selected' : ''}>Closed (مغلق)</option>
                      </select>
                    </td>
                    <td>
                      <div class="lead-msg-cell" title="${this.escapeHtml(lead.message || 'No additional note')}">
                        ${this.escapeHtml(lead.message || '-')}
                      </div>
                    </td>
                    <td>
                      <span class="date-text">${dateStr}</span>
                    </td>
                    <td class="text-right">
                      <button
                        type="button"
                        class="admin-btn admin-btn-xs admin-btn-danger btn-delete-lead"
                        data-id="${lead.id}"
                        data-name="${this.escapeHtml(lead.full_name)}"
                        title="Delete Inquiry"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        `;

        // Bind inline status change directly updating the database
        tableWrapper.querySelectorAll('.lead-status-select').forEach((select) => {
          select.addEventListener('change', async (e) => {
            const leadId = select.dataset.leadId;
            const newStatus = select.value;
            select.disabled = true;

            try {
              await adminApi.updateLeadStatus(leadId, newStatus);
              adminToast.success(`Lead status updated to "${newStatus}"!`);
              // Update style class
              const normalizedStatus = this.normalizeStatus(newStatus);
              select.className = `admin-select admin-select-sm lead-status-select select-status-${normalizedStatus}`;
              // Update local state and stats
              const item = this.leads.find((l) => l.id === leadId);
              if (item) item.status = newStatus;
              this.loadAndRenderTable(container);
            } catch (err) {
              console.error('Failed to update lead status:', err);
              adminToast.error('Could not update status: ' + err.message);
              select.disabled = false;
            }
          });
        });

        // Bind delete lead buttons
        tableWrapper.querySelectorAll('.btn-delete-lead').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const leadId = btn.dataset.id;
            const clientName = btn.dataset.name;
            if (confirm(`Are you sure you want to delete inquiry from "${clientName}"?`)) {
              btn.disabled = true;
              btn.textContent = '...';
              try {
                await adminApi.deleteLead(leadId);
                adminToast.success(`Inquiry from "${clientName}" removed.`);
                await this.loadAndRenderTable(container);
              } catch (err) {
                adminToast.error('Delete failed: ' + err.message);
                btn.disabled = false;
                btn.textContent = '🗑';
              }
            }
          });
        });
      }
    } catch (err) {
      console.error('Failed to load leads:', err);
      adminToast.error('Failed to load inquiries.');
      if (loadingEl) {
        loadingEl.innerHTML = `<span class="text-danger">Error: ${this.escapeHtml(err.message)}</span>`;
      }
    }
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

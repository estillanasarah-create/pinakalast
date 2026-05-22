

document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication check (client-side guard) ---
    if (!localStorage.getItem('loggedIn') || localStorage.getItem('loggedIn') !== 'true') {
        // Not authenticated — send user back to `log-in.html`
        window.location.href = 'log-in.html';
        return;
    }

    // --- Logout handler: clears local session and navigates to login ---
    window.handleLogout = function(event) {
        event.preventDefault();
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('username');
        window.location.href = 'log-in.html';
    };

    // --- Navigation links and other UI initialization ---
    const navLinks = document.querySelectorAll('.nav-link');
    const addItemButton = document.querySelector('[data-action="open-add-item"]');
    const addSupplierButton = document.querySelector('[data-action="open-add-supplier"]');
    const itemModal = document.getElementById('item-modal');
    const supplierModal = document.getElementById('supplier-modal');
    const closeButtons = document.querySelectorAll('.modal-close');

    navLinks.forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            const targetSection = link.dataset.section || link.getAttribute('href')?.slice(1);
            if (targetSection) showSection(targetSection, link);
        });
    });

    if (addItemButton) addItemButton.addEventListener('click', () => openModal(itemModal));
    if (addSupplierButton) addSupplierButton.addEventListener('click', () => openModal(supplierModal));

    closeButtons.forEach(button => {
        button.addEventListener('click', event => {
            const modal = event.target.closest('.modal-overlay');
            closeModal(modal);
        });
    });

    [itemModal, supplierModal].forEach(modal => {
        modal?.addEventListener('click', event => {
            if (event.target === modal) closeModal(modal);
        });
    });

    const itemForm = document.getElementById('add-item-form');
    const supplierForm = document.getElementById('add-supplier-form');

    if (itemForm) itemForm.addEventListener('submit', event => { event.preventDefault(); addItem(); });
    if (supplierForm) supplierForm.addEventListener('submit', event => { event.preventDefault(); addSupplier(); });

    document.addEventListener('click', (e) => {
        const panel = document.getElementById('notif-panel');
        const bell = document.getElementById('notif-bell');
        if (panel && bell && !panel.contains(e.target) && !bell.contains(e.target)) {
            panel.style.display = 'none';
        }
    });

    const searchItemInput = document.getElementById('search-item');
    const suggestions = document.getElementById('item-suggestions');
    if (searchItemInput && suggestions) {
        searchItemInput.addEventListener('input', () => {
            renderItemSuggestions(searchItemInput.value);
        });
        searchItemInput.addEventListener('focus', () => {
            if (searchItemInput.value.length > 0 || inventory.length > 0) {
                renderItemSuggestions(searchItemInput.value);
                if (suggestions.querySelectorAll('button').length > 0) {
                    suggestions.classList.add('open');
                }
            }
        });
        // Keyboard navigation
        searchItemInput.addEventListener('keydown', (e) => {
            const buttons = suggestions.querySelectorAll('button:not(:disabled)');
            if (buttons.length === 0) return;
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                buttons[0].focus();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (buttons.length > 0) {
                    buttons[0].click();
                }
            }
        });
    }

    document.addEventListener('click', (e) => {
        const panel = document.getElementById('notif-panel');
        const bell = document.getElementById('notif-bell');
        if (panel && bell && !panel.contains(e.target) && !bell.contains(e.target)) {
            panel.style.display = 'none';
        }
        if (suggestions && !suggestions.contains(e.target) && e.target !== searchItemInput) {
            suggestions.classList.remove('open');
        }
    });

    // Global Search Container
    const globalSearchInput = document.getElementById('global-search');
    const searchResultsDropdown = document.getElementById('search-results');
    if (globalSearchInput && searchResultsDropdown) {
        globalSearchInput.addEventListener('input', () => performGlobalSearch(globalSearchInput.value));
        globalSearchInput.addEventListener('focus', () => {
            if (globalSearchInput.value.length > 0) {
                searchResultsDropdown.classList.add('active');
            }
        });
        document.addEventListener('click', (e) => {
            if (!globalSearchInput.contains(e.target) && !searchResultsDropdown.contains(e.target)) {
                searchResultsDropdown.classList.remove('active');
            }
        });
    }

    const initialSection = window.location.hash ? window.location.hash.slice(1) : 'dashboard';
    const initialLink = Array.from(navLinks).find(link =>
        (link.dataset.section || link.getAttribute('href')?.slice(1)) === initialSection
    );
    loadSettings();
    applySettings();
    showSection(initialSection, initialLink);
    loadCustomers();
    loadReturnRequests();
    renderCreditCart();
    renderCreditAdminPanel();
    syncCreditProductOptions();
    updateUI();
    // Ensure dashboard is enabled and visible
    if (typeof enableDashboard === 'function') enableDashboard();
});

/* ─── Credit Customers (storage + UI) ─────────────────────── */
let customers = [];

function loadCustomers() {
    try {
        const saved = localStorage.getItem('creditCustomers');
        if (saved) customers = JSON.parse(saved);
    } catch (e) {
        customers = [];
    }
    renderCustomersList();
}

function saveCustomers() {
    try { localStorage.setItem('creditCustomers', JSON.stringify(customers)); } catch (e) { console.warn(e); }
}

function renderCustomersList() {
    const container = document.getElementById('customers-list');
    if (!container) return;
    if (!customers || customers.length === 0) {
        container.innerHTML = '<div class="credit-cart-empty">No saved customers. Use "Save Customer".</div>';
        return;
    }
    container.innerHTML = customers.map((c, idx) => {
        const details = [];
        if (c.phone) details.push(escapeHtml(c.phone));
        if (c.address) details.push(escapeHtml(c.address));
        if (c.email) details.push(escapeHtml(c.email));
        if (c.lastDueDate) details.push('Due: ' + escapeHtml(c.lastDueDate));
        return '<div class="customer-item">' +
            '<div>' +
                '<strong>' + escapeHtml(c.name) + '</strong>' +
                '<div class="customer-meta">' + details.join(' • ') + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:8px">' +
                '<button class="action-btn" onclick="selectCustomer(' + idx + ')">Use</button>' +
                '<button class="action-btn" onclick="removeCustomer(' + idx + ')">Remove</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

function addCustomerToList() {
    const nameEl = document.getElementById('customerName');
    const phoneEl = document.getElementById('customerPhone');
    const addressEl = document.getElementById('customerAddress');
    const emailEl = document.getElementById('customerEmail');
    const dueDateEl = document.getElementById('creditDueDate');
    if (!nameEl || !phoneEl || !addressEl || !emailEl || !dueDateEl) return;
    const name = nameEl.value.trim();
    const phone = phoneEl.value.trim();
    const address = addressEl.value.trim();
    const email = emailEl.value.trim();
    const dueDate = dueDateEl.value;
    if (!name || !phone) return alert('Please enter both name and phone to save.');

    customers.push({
        name: name,
        phone: phone,
        address: address,
        email: email,
        lastDueDate: dueDate || ''
    });
    saveCustomers();
    renderCustomersList();
    showAlertBanner('Saved customer: ' + name, 'success');
}

function selectCustomer(index) {
    const c = customers[index];
    if (!c) return;
    const nameEl = document.getElementById('customerName');
    const phoneEl = document.getElementById('customerPhone');
    const addressEl = document.getElementById('customerAddress');
    const emailEl = document.getElementById('customerEmail');
    const dueDateEl = document.getElementById('creditDueDate');
    if (nameEl) nameEl.value = c.name || '';
    if (phoneEl) phoneEl.value = c.phone || '';
    if (addressEl) addressEl.value = c.address || '';
    if (emailEl) emailEl.value = c.email || '';
    if (dueDateEl) dueDateEl.value = c.lastDueDate || '';
    showAlertBanner('Selected ' + c.name + ' for this sale.', 'success');
}

function removeCustomer(index) {
    if (index < 0 || index >= customers.length) return;
    if (!confirm('Remove this customer from saved list?')) return;
    const removed = customers.splice(index, 1)[0];
    saveCustomers();
    renderCustomersList();
    showAlertBanner('Removed ' + removed.name, 'warning');
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (s) {
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[s];
    });
}

function renderItemSuggestions(query) {
    const suggestions = document.getElementById('item-suggestions');
    if (!suggestions) return;
    
    const normalized = (query || '').trim().toLowerCase();
    let matches = [];
    
    if (normalized.length === 0) {
        // Show all items when empty
        matches = inventory.slice(0, 10);
    } else {
        // Filter by name, code, or category
        matches = inventory.filter(item => 
            item.name.toLowerCase().includes(normalized) || 
            item.code.toLowerCase().includes(normalized) || 
            item.category.toLowerCase().includes(normalized)
        ).slice(0, 10);
    }
    
    if (matches.length === 0) {
        suggestions.innerHTML = '<button type="button" disabled style="padding: 16px; text-align: center; color: #999;">No matching products found</button>';
        suggestions.classList.add('open');
        return;
    }
    
    suggestions.innerHTML = matches.map(item => {
        const statusClass = item.stock > item.minLevel ? 'in-stock' : item.stock > 0 ? 'low-stock' : 'out-of-stock';
        const statusText = item.stock > item.minLevel ? 'In Stock' : item.stock > 0 ? 'Low' : 'Out of Stock';
        return '<button type="button" onclick="selectItemSuggestion(' + item.id + ')" title="' + item.name + '">' +
            '<strong>' + item.name + '</strong>' +
            '<span style="float:right;color:#999;font-size:0.85rem;">' + item.code + '</span><br>' +
            '<small>' + item.category + ' • <span class="badge ' + statusClass + '">' + statusText + '</span> • ' + item.stock + ' ' + item.unit + ' available</small>' +
        '</button>';
    }).join('');
    suggestions.classList.add('open');
}

function selectItemSuggestion(itemId) {
    const item = inventory.find(i => i.id === itemId);
    const searchItemInput = document.getElementById('search-item');
    const suggestions = document.getElementById('item-suggestions');
    const qtyInput = document.getElementById('search-item-qty');
    
    if (!item || !searchItemInput || !suggestions) return;
    
    searchItemInput.value = item.name;
    if (qtyInput) {
        qtyInput.value = 1;
        qtyInput.focus();
    }
    suggestions.classList.remove('open');
    
    // Store selected item data for easy access
    window.selectedItem = item;
}

function performGlobalSearch(query) {
    const results = document.getElementById('search-results');
    if (!results) return;

    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) {
        results.classList.remove('active');
        return;
    }

    let searchResults = [];

    // Search in inventory
    inventory.forEach(item => {
        if (item.name.toLowerCase().includes(normalized) || item.code.toLowerCase().includes(normalized)) {
            searchResults.push({
                type: 'item',
                title: item.name,
                text: 'Stock: ' + item.stock + ' ' + item.unit + ' | Code: ' + item.code,
                action: () => navigateToSearch('stock-list', 'item', item.id)
            });
        }
    });

    // Search in sections
    const sections = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'stock-list', label: 'Stock List' },
        { id: 'reports', label: 'Reports' },
        { id: 'suppliers', label: 'Suppliers' },
        { id: 'POS', label: 'Sales & POS' },
        { id: 'credit-sales', label: 'Credit Sales' },
        { id: 'inventory', label: 'Stock Inquiry & Damage' },
        { id: 'returns', label: 'Returns' },
        { id: 'receiving', label: 'Receiving' },
        { id: 'settings', label: 'Settings' }
    ];

    sections.forEach(section => {
        if (section.label.toLowerCase().includes(normalized)) {
            searchResults.push({
                type: 'section',
                title: section.label,
                text: 'Navigate to section',
                action: () => navigateToSection(section.id)
            });
        }
    });

    if (searchResults.length === 0) {
        results.innerHTML = '<div style="padding: 16px; text-align: center; color: #999;">No results found</div>';
        results.classList.add('active');
        return;
    }

    results.innerHTML = searchResults.map((result, index) =>
        '<div class="search-result-item" onclick="' + 
        (result.action.toString().startsWith('function') ? 'performAction(' + index + ')' : 'handleSearchClick(' + index + ')') + 
        '">' +
            '<div class="search-result-title">' + result.title + '</div>' +
            '<div class="search-result-text">' + result.text + '</div>' +
        '</div>'
    ).join('');

    // Store results globally for access
    window.currentSearchResults = searchResults;
    results.classList.add('active');
}

function navigateToSection(sectionId) {
    const link = document.querySelector('[data-section="' + sectionId + '"]');
    if (link) {
        link.click();
    }
    document.getElementById('search-results').classList.remove('active');
    document.getElementById('global-search').value = '';
}

function navigateToSearch(sectionId, type, itemId) {
    navigateToSection(sectionId);
    document.getElementById('search-results').classList.remove('active');
    document.getElementById('global-search').value = '';
}

function handleSearchClick(index) {
    if (window.currentSearchResults && window.currentSearchResults[index]) {
        const result = window.currentSearchResults[index];
        if (result.type === 'section') {
            navigateToSection(result.title.toLowerCase().replace(/ /g, '-'));
        }
    }
}

function showSection(sectionId, clickedLink) {
    const targetSection = document.getElementById(sectionId);
    if (!targetSection) return;
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.toggle('active', section.id === sectionId);
    });
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link === clickedLink);
    });
    if (clickedLink) history.replaceState(null, '', '#' + sectionId);
}

// Make sure dashboard section is visible and marked active
function enableDashboard() {
    const dash = document.getElementById('dashboard');
    if (!dash) return;
    // remove any inline hidden styles
    dash.style.display = '';
    // make dashboard the active page
    const link = document.querySelector('[data-section="dashboard"]');
    showSection('dashboard', link || null);
}

function openModal(modal) {
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
}

// Ensure Save Profile button has spacing matching Update Password
document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) saveBtn.classList.add('settings-action-spacing');
    if (saveBtn) saveBtn.classList.add('settings-action-gap');
    
    // Match Cancel button and modal text to Save Item button in Add Item modal
    const itemModal = document.getElementById('item-modal');
    if (itemModal) {
        const modalCard = itemModal.querySelector('.modal-card');
        const modalActions = itemModal.querySelector('.modal-actions');
        if (modalActions) {
            const saveBtnItem = modalActions.querySelector('button[type="submit"]');
            const cancelBtn = modalActions.querySelector('button[type="button"]');
            if (saveBtnItem && cancelBtn) {
                saveBtnItem.classList.add('action-btn');
                cancelBtn.classList.add('action-btn');
                try {
                    const cs = window.getComputedStyle(saveBtnItem);
                    const fontSize = cs.fontSize || '1rem';
                    const lineHeight = cs.lineHeight || '1.2';
                    cancelBtn.style.fontSize = fontSize;
                    cancelBtn.style.lineHeight = lineHeight;
                    cancelBtn.style.padding = cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft;
                    if (modalCard) modalCard.style.fontSize = fontSize;
                } catch (e) {
                    // ignore failures copying computed styles
                }
            }
        }
    }
    
    // Match Save/Cancel and modal text in Supplier modal to Save Supplier button
    const supplierModal = document.getElementById('supplier-modal');
    if (supplierModal) {
        const sModalCard = supplierModal.querySelector('.modal-card');
        const sActions = supplierModal.querySelector('.modal-actions');
        if (sActions) {
            const saveBtnSupplier = sActions.querySelector('button[type="submit"]');
            const cancelBtnSupplier = sActions.querySelector('button[type="button"]');
            if (saveBtnSupplier && cancelBtnSupplier) {
                saveBtnSupplier.classList.add('action-btn');
                cancelBtnSupplier.classList.add('action-btn');
                try {
                    const cs2 = window.getComputedStyle(saveBtnSupplier);
                    const fontSize2 = cs2.fontSize || '1rem';
                    const lineHeight2 = cs2.lineHeight || '1.2';
                    cancelBtnSupplier.style.fontSize = fontSize2;
                    cancelBtnSupplier.style.lineHeight = lineHeight2;
                    cancelBtnSupplier.style.padding = cs2.paddingTop + ' ' + cs2.paddingRight + ' ' + cs2.paddingBottom + ' ' + cs2.paddingLeft;
                    if (sModalCard) sModalCard.style.fontSize = fontSize2;
                } catch (e) {
                    // ignore failures copying computed styles
                }
            }
        }
    }
});

function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
}

/* ─── Data ────────────────────────────────────────────────── */

let inventory = [
    { id: 1, code: "CM-100", name: "Cement (Portland)",   category: "Masonry",  stock: 100, price: 240, cost: 210, unit: "Bag",  minLevel: 20 },
    { id: 2, code: "DB-010", name: "Deformed Bar 10mm",   category: "Steel",    stock: 50,  price: 185, cost: 160, unit: "Pc",   minLevel: 15 },
    { id: 3, code: "PK-200", name: "Pako 2 inches",       category: "Hardware", stock: 10,  price: 80,  cost: 60,  unit: "Kg",   minLevel: 15 },
    { id: 4, code: "LP-001", name: "Latex Paint (white)", category: "Paint",    stock: 25,  price: 650, cost: 580, unit: "Pail", minLevel: 5  },
];

let salesLog  = [];
let damageLog = [];
let poList    = [];
let totalAR   = 0;
let poCounter = 1001;

let appSettings = {
    currency: '₱',
    dateFormat: 'MM/DD/YYYY',
    perPage: 25,
    minStock: 15,
    autoPO: true,
    notifLowStock: true,
    notifOutOfStock: true,
    notifDamage: true,
    notifDailySummary: false,
    notifWeeklyReport: true,
    notifPoReminder: true,
    notifEmail: '',
    notifCc: '',
    profile: {
        firstName: 'Admin',
        lastName: 'Name',
        email: 'admin@glowberry.com'
    }
};

function loadSettings() {
    const saved = localStorage.getItem('inventoryAppSettings');
    if (saved) {
        try {
            const stored = JSON.parse(saved);
            appSettings = Object.assign(appSettings, stored);
        } catch (err) {
            console.warn('Unable to parse saved settings:', err);
        }
    }

    const profile = appSettings.profile || {};
    document.getElementById('s-first-name').value = profile.firstName || 'Admin';
    document.getElementById('s-last-name').value = profile.lastName || 'Name';
    document.getElementById('s-email').value = profile.email || 'admin@glowberry.com';
    const savedName = (profile.firstName || 'Admin') + ' ' + (profile.lastName || 'Name');
    document.getElementById('settings-display-name').textContent = savedName;
    const topAdminName = document.getElementById('admin-display-name');
    if (topAdminName) {
        const loggedInUser = localStorage.getItem('username');
        topAdminName.textContent = loggedInUser || savedName;
    }

    document.getElementById('notif-low-stock').checked = !!appSettings.notifLowStock;
    document.getElementById('notif-out-of-stock').checked = !!appSettings.notifOutOfStock;
    document.getElementById('notif-damage').checked = !!appSettings.notifDamage;
    document.getElementById('notif-daily-summary').checked = !!appSettings.notifDailySummary;
    document.getElementById('notif-weekly-report').checked = !!appSettings.notifWeeklyReport;
    document.getElementById('notif-po-reminder').checked = !!appSettings.notifPoReminder;
    document.getElementById('notif-email').value = appSettings.notifEmail || '';
    document.getElementById('notif-cc').value = appSettings.notifCc || '';

    document.getElementById('pref-currency').value = appSettings.currency;
    document.getElementById('pref-date-format').value = appSettings.dateFormat;
    document.getElementById('pref-per-page').value = appSettings.perPage;
    document.getElementById('pref-min-stock').value = appSettings.minStock;
    document.getElementById('pref-auto-po').checked = !!appSettings.autoPO;
}

function saveSettings() {
    localStorage.setItem('inventoryAppSettings', JSON.stringify(appSettings));
}

function applySettings() {
    
}

function formatCurrency(amount) {
    return (appSettings.currency || '₱') + Number(amount || 0).toLocaleString();
}

function formatDate(value) {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (!(date instanceof Date) || isNaN(date.getTime())) return value;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    switch (appSettings.dateFormat) {
        case 'DD/MM/YYYY': return day + '/' + month + '/' + year;
        case 'YYYY-MM-DD': return year + '-' + month + '-' + day;
        default: return month + '/' + day + '/' + year;
    }
}

/* ─── Alert Engine ────────────────────────────────────────── */

function runAlertChecks() {
    const lowItems = inventory.filter(i => i.stock <= i.minLevel);

    const statLow  = document.getElementById('stat-low-stock');
    const statCard = document.getElementById('stat-low-stock-card');
    if (statLow)  statLow.textContent = lowItems.length;
    if (statCard) statCard.classList.toggle('pulse-danger', lowItems.length > 0);

    const statTotal = document.getElementById('stat-total-stock');
    if (statTotal) statTotal.textContent = inventory.reduce((s, i) => s + i.stock, 0).toLocaleString();

    const dashAlert = document.getElementById('dashboard-alert');
    if (dashAlert) {
        if (lowItems.length > 0 && appSettings.notifLowStock) {
            dashAlert.style.display = 'block';
            dashAlert.innerHTML =
                '<div class="da-icon"><i class="fas fa-exclamation-triangle"></i></div>' +
                '<div class="da-body">' +
                    '<strong>' + lowItems.length + ' item' + (lowItems.length > 1 ? 's' : '') + ' running low on stock!</strong>' +
                    '<span>' + lowItems.map(i => i.name + ' (' + i.stock + ' ' + i.unit + ' left)').join(' · ') + '</span>' +
                '</div>' +
                '<a href="#inventory" onclick="goInventory()" class="da-link">View Inventory →</a>';
        } else {
            dashAlert.style.display = 'none';
        }
    }

    // Show return alerts on dashboard
    const pendingReturns = returnRequests.filter(r => r.status === 'Pending');
    const dashReturnsAlert = document.getElementById('dashboard-returns-alert');
    if (dashReturnsAlert) {
        if (pendingReturns.length > 0) {
            dashReturnsAlert.style.display = 'block';
            dashReturnsAlert.innerHTML =
                '<div class="da-icon"><i class="fas fa-undo-alt"></i></div>' +
                '<div class="da-body">' +
                    '<strong>' + pendingReturns.length + ' pending return' + (pendingReturns.length > 1 ? 's' : '') + ' awaiting approval!</strong>' +
                    '<span>' + pendingReturns.map(r => r.orderId + ' (' + r.reason + ')').join(' · ') + '</span>' +
                '</div>' +
                '<a href="#returns" onclick="goReturns()" class="da-link">Review Returns →</a>';
        } else {
            dashReturnsAlert.style.display = 'none';
        }
    }

    refreshNotifBell();
}

function refreshNotifBell() {
    const badge = document.getElementById('notif-badge');
    const list  = document.getElementById('notif-list');

    const lowNotifs = appSettings.notifLowStock ? inventory.filter(i => i.stock <= i.minLevel).map(i => ({
        type: 'low',
        message: i.name + ' — only ' + i.stock + ' ' + i.unit + ' left (min: ' + i.minLevel + ')',
        time: null
    })) : [];

    const dmgNotifs = appSettings.notifDamage ? damageLog.map(d => ({
        type: 'damage',
        message: 'Damage: ' + d.qty + ' ' + d.unit + ' of ' + d.name + ' reported',
        time: d.time
    })) : [];

    const all = dmgNotifs.concat(lowNotifs);

    if (badge) {
        badge.textContent = all.length;
        badge.style.display = all.length > 0 ? 'flex' : 'none';
    }

    if (list) {
        if (all.length === 0) {
            list.innerHTML = '<li class="notif-empty">No alerts right now 🎉</li>';
        } else {
            list.innerHTML = all.map(n =>
                '<li class="notif-item notif-' + n.type + '">' +
                    '<i class="fas ' + (n.type === 'damage' ? 'fa-tools' : 'fa-exclamation-triangle') + '"></i>' +
                    '<span>' + n.message + '</span>' +
                    (n.time ? '<small>' + formatTime(n.time) + '</small>' : '') +
                '</li>'
            ).join('');
        }
    }
}

function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function clearAllNotifs() {
    damageLog = [];
    document.getElementById('notif-panel').style.display = 'none';
    updateUI();
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function goInventory() {
    const link = document.querySelector('[data-section="inventory"]');
    if (link) link.click();
}

function goReturns() {
    const link = document.querySelector('[data-section="returns"]');
    if (link) link.click();
}

/* ─── Alert Banner ────────────────────────────────────────── */

function showAlertBanner(message, type) {
    type = type || 'warning';
    const container = document.getElementById('alert-banner-container');
    if (!container) return;
    const id = 'banner-' + Date.now();
    const icon = type === 'damage' ? 'fa-tools' : 'fa-exclamation-triangle';
    const banner = document.createElement('div');
    banner.id = id;
    banner.className = 'alert-banner alert-banner-' + type;
    banner.innerHTML =
        '<i class="fas ' + icon + '"></i>' +
        '<span>' + message + '</span>' +
        '<button class="alert-dismiss" onclick="dismissBanner(\'' + id + '\')">' +
            '<i class="fas fa-times"></i>' +
        '</button>';
    container.appendChild(banner);
    setTimeout(function() { dismissBanner(id); }, 6000);
}

function dismissBanner(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('alert-banner-exit');
    setTimeout(function() { el.remove(); }, 300);
}

/* ─── updateUI ────────────────────────────────────────────── */

function updateUI() {
    const invList = document.getElementById('inventory-list');
    const stockListBody = document.getElementById('stock-list-body');
    [invList, stockListBody].forEach(list => {
        if (!list) return;
        list.innerHTML = '';
        inventory.forEach(function(item) {
            const isLow = item.stock <= item.minLevel;
            const isCritical = item.stock === 0;
            const row = document.createElement('tr');
            if (isCritical) row.classList.add('row-critical');
            else if (isLow)  row.classList.add('row-low');
            if (list.id === 'stock-list-body') {
                row.innerHTML =
                    '<td>' + (item.code || '—') + '</td>' +
                    '<td>' + item.name + '</td>' +
                    '<td>' + item.category + '</td>' +
                    '<td>' + item.stock + '</td>' +
                    '<td><span class="badge ' + (isCritical ? 'out-of-stock' : isLow ? 'badge-low' : 'in-stock') + '">' + (isCritical ? 'Out of Stock' : isLow ? 'Low' : 'Good') + '</span></td>';
            } else {
                row.innerHTML =
                    '<td>' + item.name + '</td>' +
                    '<td><span class="stock-value ' + (isCritical ? 'stock-zero' : isLow ? 'stock-low' : '') + '">' + item.stock + '</span></td>' +
                    '<td><span class="badge ' + (isCritical ? 'out-of-stock' : isLow ? 'badge-low' : 'in-stock') + '">' + (isCritical ? 'Out of Stock' : isLow ? 'Low' : 'Good') + '</span></td>' +
                    '<td>' + item.unit + '</td>' +
                    '<td>' +
                        '<button class="action-btn btn-return" onclick="processReturn(' + item.id + ', \'' + 'return' + '\')"><i class="fas fa-undo"></i> Return</button>' +
                        '<button class="action-btn btn-damage" onclick="processReturn(' + item.id + ', \'' + 'return-damage' + '\')"><i class="fas fa-tools"></i> Damaged</button>' +
                    '</td>';
            }
            list.appendChild(row);
        });
    });

    populateDamageProductSelect();
    populateExchangeProductSelect();

    const salesTbody = document.getElementById('sales-log');
    if (salesTbody) {
        salesTbody.innerHTML = '';
        if (salesLog.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="5" style="text-align:center;color:#999;padding:20px;">No sales recorded yet</td>';
            salesTbody.appendChild(emptyRow);
        } else {
            salesLog.forEach(function(sale, index) {
                const row = document.createElement('tr');
                const paymentColor = sale.type === 'credit' ? '#ff9800' : sale.type === 'card' ? '#2196f3' : sale.type === 'return' ? '#d32f2f' : sale.type === 'return-damage' ? '#e65100' : '#4caf50';
                const creditMeta = sale.type === 'credit' ? '<br><small style="color:#999;">' + escapeHtml(sale.customer || '') + (sale.dueDate ? ' • Due: ' + formatDate(sale.dueDate) : '') + '</small>' : '';
                row.innerHTML =
                    '<td><strong>' + escapeHtml(sale.name) + '</strong>' + (sale.code ? '<br><small style="color:#999;">' + escapeHtml(sale.code) + '</small>' : '') + creditMeta + '</td>' +
                    '<td>' + formatCurrency(sale.price) + '</td>' +
                    '<td>' + sale.qty + '</td>' +
                    '<td><span class="badge" style="background:' + paymentColor + ';color:white;padding:4px 8px;border-radius:4px;font-size:0.8rem;">' + sale.type.toUpperCase() + '</span></td>' +
                    '<td><strong>' + formatCurrency(sale.total) + '</strong></td>';
                salesTbody.appendChild(row);
            });
        }
    }

    const dmgSection = document.getElementById('damage-log-section');
    const dmgBody    = document.getElementById('damage-log-body');
    if (dmgSection && dmgBody) {
        if (damageLog.length > 0) {
            dmgSection.style.display = 'block';
            dmgBody.innerHTML = damageLog.map((d, index) =>
                '<tr>' +
                    '<td>' + d.name + '</td>' +
                    '<td>' + d.qty + '</td>' +
                    '<td>' + d.unit + '</td>' +
                    '<td>' + formatTime(d.time) + '</td>' +
                    '<td><button class="action-btn" onclick="returnDamagedItem(' + index + ')">Return</button></td>' +
                '</tr>'
            ).join('');
        } else {
            dmgSection.style.display = 'none';
        }
    }

    const damageCount = document.getElementById('damage-count');
    const damageTotalQty = document.getElementById('damage-total-qty');
    const damageTotalValue = document.getElementById('damage-total-value');
    if (damageCount && damageTotalQty && damageTotalValue) {
        const totalQty = damageLog.reduce((sum, entry) => sum + entry.qty, 0);
        const totalValue = damageLog.reduce((sum, entry) => {
            const item = inventory.find(i => i.id === entry.itemId);
            return sum + entry.qty * (item ? item.price : 0);
        }, 0);
        damageCount.textContent = damageLog.length;
        damageTotalQty.textContent = totalQty;
        damageTotalValue.textContent = formatCurrency(totalValue);
    }

    renderDamageHistory();
    updateReceivingTable();
    renderStockValueReport();
    renderOrderSummary();
    runAlertChecks();
}

/* ─── POS ─────────────────────────────────────────────────── */

function processSales() {
    const itemName = document.getElementById('search-item')?.value.trim();
    const qty = parseInt(document.getElementById('search-item-qty')?.value, 10);
    const type = document.getElementById('payment-type')?.value;
    const suggestions = document.getElementById('item-suggestions');
    
    if (!itemName || !qty || qty <= 0) {
        showAlertBanner('Please select a product and enter valid quantity.', 'warning');
        return;
    }

    // Use selected item if available, otherwise search
    let item = window.selectedItem && window.selectedItem.name.toLowerCase() === itemName.toLowerCase() 
        ? window.selectedItem 
        : inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    
    if (!item) {
        showAlertBanner('Product not found. Please select from the dropdown.', 'warning');
        return;
    }

    const isReturn = type === 'return' || type === 'return-damage';
    if (!isReturn && item.stock < qty) {
        showAlertBanner('Insufficient stock for ' + item.name + '. Only ' + item.stock + ' ' + item.unit + ' available.', 'warning');
        return;
    }

    let total = qty * item.price;
    if (type === 'return') {
        item.stock += qty;
        total = -total;
        salesLog.push({
            name: item.name,
            price: item.price,
            qty: -qty,
            total: total,
            type: 'return',
            date: new Date(),
            code: item.code
        });
        showAlertBanner('Return processed: ' + qty + ' ' + item.name + ' restocked.', 'success');
    } else if (type === 'return-damage') {
        total = -total;
        salesLog.push({
            name: item.name,
            price: item.price,
            qty: -qty,
            total: total,
            type: 'return-damage',
            date: new Date(),
            code: item.code
        });
        damageLog.unshift({ itemId: item.id, name: item.name, qty: qty, unit: item.unit, time: new Date() });
        showAlertBanner('Damaged return logged: ' + qty + ' ' + item.name + '.', 'damage');
    } else {
        item.stock -= qty;
        salesLog.push({ 
            name: item.name, 
            price: item.price, 
            qty: qty, 
            total: total, 
            type: type, 
            date: new Date(),
            code: item.code
        });
        if (type.toLowerCase() === 'credit') totalAR += total;
        if (item.stock === 0 && appSettings.notifOutOfStock) {
            showAlertBanner('⚠️ ' + item.name + ' is now OUT OF STOCK!', 'warning');
        } else if (item.stock > 0 && item.stock <= item.minLevel && appSettings.notifLowStock) {
            showAlertBanner('⚠️ ' + item.name + ' is now low — only ' + item.stock + ' ' + item.unit + ' left.', 'warning');
        }
        showAlertBanner('✓ Sale Successful: ' + item.name + ' (' + qty + ') - ' + formatCurrency(total), 'success');
    }
    
    // Clear inputs
    document.getElementById('search-item').value = '';
    document.getElementById('search-item-qty').value = '';
    if (suggestions) suggestions.classList.remove('open');
    window.selectedItem = null;
    
    updateUI();
    renderSalesChart();
}

function processReturn(itemId, returnType) {
    const item = inventory.find(i => i.id === itemId);
    if (!item) {
        showAlertBanner('Item not found for return.', 'warning');
        return;
    }
    const promptText = returnType === 'return'
        ? 'Enter returned quantity for ' + item.name + ':'
        : 'Enter damaged returned quantity for ' + item.name + ':';
    const input = prompt(promptText, '1');
    if (input === null) return;
    const qty = parseInt(input, 10);
    if (isNaN(qty) || qty <= 0) {
        showAlertBanner('Please enter a valid return quantity.', 'warning');
        return;
    }
    const total = -(qty * item.price);
    if (returnType === 'return') {
        item.stock += qty;
        salesLog.push({
            name: item.name,
            price: item.price,
            qty: -qty,
            total: total,
            type: 'return',
            date: new Date(),
            code: item.code
        });
        showAlertBanner('Return processed: ' + qty + ' ' + item.name + ' restocked.', 'success');
    } else {
        salesLog.push({
            name: item.name,
            price: item.price,
            qty: -qty,
            total: total,
            type: 'return-damage',
            date: new Date(),
            code: item.code
        });
        damageLog.unshift({ itemId: item.id, name: item.name, qty: qty, unit: item.unit, time: new Date() });
        showAlertBanner('Damaged return logged: ' + qty + ' ' + item.name + '.', 'damage');
    }
    updateUI();
    renderSalesChart();
}

/* ─── Damage Report ───────────────────────────────────────── */

function reportDamage(id) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const input = prompt('How many ' + item.unit + ' of "' + item.name + '" are damaged?');
    if (input === null) return;
    const qty = parseInt(input, 10);
    if (isNaN(qty) || qty <= 0) { alert('Please enter a valid quantity.'); return; }
    if (qty > item.stock) { alert('Cannot report more than current stock (' + item.stock + ' ' + item.unit + ').'); return; }
    item.stock -= qty;
    damageLog.unshift({ itemId: item.id, name: item.name, qty: qty, unit: item.unit, time: new Date() });
    if (appSettings.notifDamage) {
        showAlertBanner('Damage recorded: ' + qty + ' ' + item.unit + ' of "' + item.name + '" — stock updated to ' + item.stock + '.', 'damage');
    }
    if (item.stock <= item.minLevel && appSettings.notifLowStock) {
        const warn = item.stock === 0
            ? '🚨 "' + item.name + '" is now OUT OF STOCK after damage report!'
            : '⚠️ "' + item.name + '" dropped to low stock (' + item.stock + ' ' + item.unit + ' remaining).';
        setTimeout(function() { showAlertBanner(warn, 'warning'); }, 400);
    }
    updateUI();
}

function populateDamageProductSelect() {
    const select = document.getElementById('damageProductSelect');
    if (!select) return;
    const selectedValue = select.value;
    select.innerHTML = '<option value="">-- Select damaged item --</option>';
    inventory.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name + ' (' + item.stock + ' ' + item.unit + ' available)';
        select.appendChild(option);
    });
    if (selectedValue) select.value = selectedValue;
}

function submitDamageReport() {
    const select = document.getElementById('damageProductSelect');
    const qtyInput = document.getElementById('damageQty');
    const noteInput = document.getElementById('damageNote');
    if (!select || !qtyInput || !noteInput) return;

    const itemId = select.value;
    const qty = parseInt(qtyInput.value, 10);
    const note = noteInput.value.trim();
    if (!itemId) return alert('Please select a product to report damage.');
    if (!qty || qty <= 0) return alert('Enter a valid damaged quantity.');

    const item = inventory.find(i => String(i.id) === String(itemId));
    if (!item) return alert('Selected product is not available in inventory.');
    if (qty > item.stock) return alert('Cannot report more damage than current stock (' + item.stock + ').');

    item.stock -= qty;
    damageLog.unshift({
        itemId: item.id,
        name: item.name,
        qty: qty,
        unit: item.unit,
        note: note || 'No note provided',
        time: new Date()
    });

    select.value = '';
    qtyInput.value = '1';
    noteInput.value = '';
    showAlertBanner('Damage reported for ' + item.name + ' (' + qty + ' ' + item.unit + ').', 'damage');
    updateUI();
}

function renderDamageHistory() {
    const body = document.getElementById('damage-history-body');
    if (!body) return;
    if (damageLog.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:16px">No damage reports yet.</td></tr>';
        return;
    }
    body.innerHTML = damageLog.map(entry =>
        '<tr>' +
            '<td>' + escapeHtml(entry.name) + '</td>' +
            '<td>' + entry.qty + '</td>' +
            '<td>' + escapeHtml(entry.unit) + '</td>' +
            '<td>' + escapeHtml(entry.note || '—') + '</td>' +
            '<td>' + formatTime(entry.time) + '</td>' +
        '</tr>'
    ).join('');
}

function returnDamagedItem(index) {
    if (index < 0 || index >= damageLog.length) return;
    const entry = damageLog[index];
    const item = inventory.find(i => i.id === entry.itemId);
    if (item) {
        item.stock += entry.qty;
        showAlertBanner('Returned ' + entry.qty + ' ' + entry.unit + ' of "' + entry.name + '" to inventory.', 'success');
    } else {
        showAlertBanner('Returned damaged item record, but inventory item not found.', 'warning');
    }
    damageLog.splice(index, 1);
    updateUI();
}

/* ─── Add Item / Supplier ─────────────────────────────────── */

function addItem() {
    const code = document.getElementById('item-code')?.value.trim();
    const name = document.getElementById('item-name')?.value.trim();
    const category = document.getElementById('item-category')?.value.trim();
    const qty = parseInt(document.getElementById('item-qty')?.value, 10);
    const status = document.getElementById('item-status')?.value;
    if (!code || !name || !category || !qty || !status) return;
    const nextId = inventory.length > 0 ? Math.max(...inventory.map(i => i.id)) + 1 : 1;
    const minLevel = status === 'Low' ? Math.max(1, Math.round(qty * 0.2)) : 15;
    inventory.push({ id: nextId, code, name, category, stock: qty, price: status === 'Out of Stock' ? 0 : 0, cost: 0, unit: 'pcs', minLevel: minLevel });
    document.getElementById('add-item-form').reset();
    closeModal(document.getElementById('item-modal'));
    updateUI();
    renderStockValueReport();
}

function addSupplier() {
    const name = document.getElementById('supplier-name')?.value.trim();
    const contact = document.getElementById('supplier-contact')?.value.trim();
    const category = document.getElementById('supplier-category')?.value.trim();
    const status = document.getElementById('supplier-status')?.value;
    if (!name || !contact || !category || !status) return;
    const tableBody = document.querySelector('#suppliers table tbody');
    if (!tableBody) return;
    const row = document.createElement('tr');
    row.innerHTML =
        '<td>' + name + '</td>' +
        '<td>' + contact + '</td>' +
        '<td>' + category + '</td>' +
        '<td><span class="badge ' + (status === 'Active' ? 'in-stock' : 'out-of-stock') + '">' + status + '</span></td>';
    tableBody.appendChild(row);
    document.getElementById('add-supplier-form').reset();
    closeModal(document.getElementById('supplier-modal'));
}

/* ─── Purchase Order / Receiving ───────────────────────────── */

function openPOModal() {
    const modal = document.getElementById('po-modal');
    if (!modal) return;
    const itemSelect = document.getElementById('po-item');
    if (itemSelect) {
        itemSelect.innerHTML = '<option value="">— Select Item —</option>';
        inventory.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            itemSelect.appendChild(option);
        });
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
}

function closePOModal() {
    const modal = document.getElementById('po-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
}

function submitPO(event) {
    event.preventDefault();
    const itemId = parseInt(document.getElementById('po-item').value, 10);
    const supplier = document.getElementById('po-supplier').value.trim();
    const qty = parseInt(document.getElementById('po-qty').value, 10);
    const date = document.getElementById('po-date').value;
    const status = document.getElementById('po-status').value;
    const item = inventory.find(i => i.id === itemId);
    if (!item || !supplier || !qty || !date || !status) {
        alert('Please complete all purchase order fields.');
        return;
    }
    const poNumber = 'PO-' + poCounter++;
    const cost = qty * item.cost;
    poList.unshift({ poNumber, itemId, item: item.name, supplier, qty, totalCost: cost, date, status });
    if (status === 'Received') {
        item.stock += qty;
        showAlertBanner('Stock received for ' + item.name + ': +' + qty + ' ' + item.unit + '.', 'warning');
    }
    closePOModal();
    updateReceivingTable();
    updateUI();
    renderOrderSummary();
    showAlertBanner('Purchase order ' + poNumber + ' created successfully.', 'warning');
}

function updateReceivingTable() {
    const receivingBody = document.getElementById('receiving-list');
    if (!receivingBody) return;
    receivingBody.innerHTML = poList.map(po =>
        '<tr>' +
            '<td>' + po.poNumber + '</td>' +
            '<td>' + po.item + '</td>' +
            '<td>' + po.supplier + '</td>' +
            '<td>' + po.qty + '</td>' +
            '<td>' + po.date + '</td>' +
            '<td><span class="badge ' + (po.status === 'Received' ? 'in-stock' : po.status === 'Pending' ? 'badge-low' : 'out-of-stock') + '">' + po.status + '</span></td>' +
            '<td>' + (po.status === 'Pending'
                ? '<button class="action-btn" onclick="markPOReceived(\'' + po.poNumber + '\')">Mark Received</button>'
                : '<span class="badge in-stock">Received</span>') +
            '</td>' +
        '</tr>'
    ).join('');
    updatePOStats();
}

function updatePOStats() {
    const total = poList.length;
    const pending = poList.filter(po => po.status === 'Pending').length;
    const received = poList.filter(po => po.status === 'Received').length;
    document.getElementById('po-total-count').textContent = total;
    document.getElementById('po-pending-count').textContent = pending;
    document.getElementById('po-received-count').textContent = received;
}

function markPOReceived(poNumber) {
    const po = poList.find(item => item.poNumber === poNumber);
    if (!po || po.status === 'Received') return;
    po.status = 'Received';
    const item = inventory.find(i => i.id === po.itemId);
    if (item) {
        item.stock += po.qty;
        showAlertBanner('Stock updated for ' + item.name + ': +' + po.qty + ' ' + item.unit + '.', 'warning');
    }
    updateReceivingTable();
    updateUI();
    renderStockValueReport();
    renderOrderSummary();
}

/* ─── Reports ─────────────────────────────────────────────── */

function switchReport(reportType, button) {
    document.querySelectorAll('.report-panel').forEach(panel => panel.classList.toggle('active', panel.id === 'report-' + reportType));
    document.querySelectorAll('.report-tab').forEach(tab => tab.classList.toggle('active', tab === button));
    if (reportType === 'stock-value') renderStockValueReport();
    if (reportType === 'order-summary') renderOrderSummary();
    if (reportType === 'monthly-sales') renderSalesChart();
    // 'returns' report removed
    if (reportType === 'damage-history') renderDamageHistoryReport();
    if (reportType === 'credit-receivables') renderCreditAdminPanel();
}

function renderDamageHistoryReport() {
    const entries = damageLog || [];
    const totalQty = entries.reduce((sum, entry) => sum + (entry.qty || 0), 0);
    const totalValue = entries.reduce((sum, entry) => {
        const item = inventory.find(i => i.id === entry.itemId);
        return sum + (entry.qty || 0) * (item ? item.price : 0);
    }, 0);
    const kpiRow = document.getElementById('damage-kpi-row');
    if (kpiRow) {
        kpiRow.innerHTML =
            '<div class="stat-card"><h3>' + entries.length + '</h3><p>Total Reports</p></div>' +
            '<div class="stat-card highlighted"><h3>' + totalQty + '</h3><p>Total Damaged Qty</p></div>' +
            '<div class="stat-card"><h3>' + formatCurrency(totalValue) + '</h3><p>Estimated Loss</p></div>';
    }
    const entriesEl = document.getElementById('damageTotalEntries');
    const qtyEl = document.getElementById('damageTotalQty');
    const valueEl = document.getElementById('damageTotalValue');
    if (entriesEl) entriesEl.textContent = entries.length;
    if (qtyEl) qtyEl.textContent = totalQty;
    if (valueEl) valueEl.textContent = formatCurrency(totalValue);
    renderDamageHistory();
}

function renderSalesChart() {
    const monthFilter = document.getElementById('sales-month-filter')?.value || 'all';
    const salesBody = document.getElementById('sales-report-body');
    const salesKpi = document.getElementById('sales-kpi-row');
    const labels = ['January','February','March','April','May','June'];
    const monthly = labels.map(() => ({ units: 0, revenue: 0, cost: 0, profit: 0 }));

    let creditRevenue = 0;
    let creditUnits = 0;

    salesLog.forEach(sale => {
        const monthIndex = sale.date ? sale.date.getMonth() : 0;
        if (monthIndex >= 0 && monthIndex < monthly.length) {
            monthly[monthIndex].units += sale.qty;
            monthly[monthIndex].revenue += sale.total;
            monthly[monthIndex].cost += sale.qty * sale.price * 0.7;
            monthly[monthIndex].profit += sale.total - (sale.qty * sale.price * 0.7);
        }
        if (sale.type === 'credit') {
            creditRevenue += sale.total;
            creditUnits += sale.qty;
        }
    });

    const filtered = monthFilter === 'all' ? monthly : [monthly[parseInt(monthFilter, 10)] || { units: 0, revenue: 0, cost: 0, profit: 0 }];
    if (salesBody) {
        salesBody.innerHTML = filtered.map((row, index) => {
            const label = monthFilter === 'all' ? labels[index] : labels[parseInt(monthFilter, 10)];
            return '<tr><td>' + label + '</td><td>' + row.units + '</td><td>' + formatCurrency(row.revenue) + '</td><td>' + formatCurrency(row.cost) + '</td><td>' + formatCurrency(row.profit) + '</td><td>' + (row.revenue > 0 ? 'Up' : 'Stable') + '</td></tr>';
        }).join('');
    }
    if (salesKpi) {
        const totalRevenue = monthly.reduce((sum, row) => sum + row.revenue, 0);
        const totalUnits = monthly.reduce((sum, row) => sum + row.units, 0);
        salesKpi.innerHTML =
            '<div class="stat-card"><h3>' + formatCurrency(totalRevenue) + '</h3><p>Total Revenue</p></div>' +
            '<div class="stat-card highlighted"><h3>' + totalUnits + '</h3><p>Units Sold</p></div>' +
            '<div class="stat-card"><h3>' + formatCurrency(creditRevenue) + '</h3><p>Credit Revenue</p></div>';
    }
    const chartLabels = document.getElementById('sales-bar-labels');
    if (chartLabels) {
        chartLabels.innerHTML = labels.map(label => '<span>' + label.slice(0, 3) + '</span>').join('');
    }
}

/* ─── Returns Portal (storage + admin UI) ─────────────────── */

let returnRequests = [];

function loadReturnRequests() {
    try {
        const saved = localStorage.getItem('returnRequests');
        if (saved) returnRequests = JSON.parse(saved);
    } catch (e) {
        returnRequests = [];
    }
    renderReturnAdminTable();
}

function saveReturnRequests() {
    try { localStorage.setItem('returnRequests', JSON.stringify(returnRequests)); } catch (e) { console.warn(e); }
}

function renderReturnAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;
    if (!returnRequests || returnRequests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;padding:18px">No return requests yet</td></tr>';
        return;
    }
    tbody.innerHTML = returnRequests.map((r, idx) =>
        '<tr>' +
            '<td>' + (idx + 1) + '</td>' +
            '<td>' + escapeHtml(r.orderId) + '</td>' +
            '<td>' + escapeHtml(r.email) + '</td>' +
            '<td>' + escapeHtml(r.productName || '—') + (r.exchangeProductName ? '<br><small style="color:#999;">Exchange for: ' + escapeHtml(r.exchangeProductName) + ' ×' + escapeHtml(String(r.exchangeQty || '1')) + '</small>' : '') + '</td>' +
            '<td>' + escapeHtml(r.reason) + '</td>' +
            '<td>' + escapeHtml(r.resolution) + '</td>' +
            '<td><span class="badge ' + (r.status === 'Approved' ? 'in-stock' : r.status === 'Denied' ? 'out-of-stock' : 'badge-low') + '">' + r.status + '</span></td>' +
            '<td>' +
                (r.status === 'Pending'
                    ? '<button class="btn-action btn-approve" onclick="approveReturnRequest(' + idx + ')"><i class="fas fa-check"></i> Approve</button> <button class="btn-action btn-reject" onclick="denyReturnRequest(' + idx + ')"><i class="fas fa-times"></i> Reject</button>'
                    : '<button class="btn-action" onclick="removeReturnRecord(' + idx + ')">Remove</button>') +
            '</td>' +
        '</tr>'
    ).join('');
}

function handleReturnFormSubmit(e) {
    e.preventDefault();
    const orderId = document.getElementById('orderId')?.value.trim();
    const email = document.getElementById('returnCustomerEmail')?.value.trim();
    const reason = document.getElementById('reason')?.value;
    const resolution = document.getElementById('resolution')?.value;
    const returnProductSearch = document.getElementById('returnProductSearch');
    const selectedId = returnProductSearch?.dataset.selectedId;
    const portalMessage = document.getElementById('portalMessage');
    
    if (!orderId || !email || !reason || !resolution) {
        if (portalMessage) { portalMessage.classList.remove('hidden'); portalMessage.textContent = 'Please complete all required fields.'; }
        return;
    }

    const item = selectedId ? inventory.find(i => i.id === parseInt(selectedId, 10)) : null;
    const exchangeProductSelect = document.getElementById('exchangeProductSelect');
    const exchangeQtyInput = document.getElementById('exchangeQty');
    const exchangeProductId = exchangeProductSelect?.value || null;
    const exchangeProduct = exchangeProductId ? inventory.find(i => String(i.id) === String(exchangeProductId)) : null;
    const exchangeQty = parseInt(exchangeQtyInput?.value || '0', 10) || 0;

    if (resolution === 'Exchange' && (!exchangeProduct || exchangeQty <= 0)) {
        if (portalMessage) {
            portalMessage.classList.remove('hidden');
            portalMessage.textContent = 'Please select an exchange item and quantity.';
        }
        return;
    }

    const req = {
        orderId,
        email,
        reason,
        resolution,
        productId: item?.id || null,
        productName: item?.name || '',
        exchangeProductId: exchangeProduct?.id || null,
        exchangeProductName: exchangeProduct?.name || '',
        exchangeQty: resolution === 'Exchange' ? exchangeQty : 0,
        status: 'Pending',
        createdAt: new Date()
    };
    returnRequests.unshift(req);
    saveReturnRequests();
    renderReturnAdminTable();
    if (portalMessage) { 
        portalMessage.classList.remove('hidden'); 
        portalMessage.textContent = 'Return request submitted — awaiting admin review.'; 
        setTimeout(() => { portalMessage.classList.add('hidden'); }, 4000); 
    }
    document.getElementById('returnForm').reset();
    document.getElementById('returnProductInfo').style.display = 'none';
    if (returnProductSearch) returnProductSearch.dataset.selectedId = '';
    updateUI();
    updateReturnSummaryPreview();
}

function approveReturnRequest(index) {
    const r = returnRequests[index];
    if (!r) return;
    if (r.status === 'Approved') return;

    // Ask admin which inventory item and quantity to apply the approved return to
    const list = inventory.map(i => i.id + ': ' + i.name + ' (stock: ' + i.stock + ')').join('\n');
    const itemInput = prompt('Approve return ' + r.orderId + "\n\nEnter inventory item id to apply return (choose from list):\n" + list, '');
    if (itemInput === null) return; // cancelled by admin
    const itemId = parseInt(itemInput, 10);
    const item = inventory.find(i => i.id === itemId);
    if (!item) { showAlertBanner('Invalid item id. Approval canceled.', 'warning'); return; }

    const qtyInput = prompt('Enter quantity to apply for ' + item.name + ':', '1');
    if (qtyInput === null) return;
    const qty = parseInt(qtyInput, 10);
    if (isNaN(qty) || qty <= 0) { showAlertBanner('Invalid quantity. Approval canceled.', 'warning'); return; }

    const isDamaged = (r.reason && r.reason.toLowerCase().includes('damaged'));
    const total = -(qty * item.price);

    if (isDamaged) {
        // Log as damaged return (do not restock)
        damageLog.unshift({ itemId: item.id, name: item.name, qty: qty, unit: item.unit, time: new Date() });
        salesLog.push({
            name: item.name,
            price: item.price,
            qty: -qty,
            total: total,
            type: 'return-damage',
            date: new Date(),
            code: item.code
        });
        showAlertBanner('Damaged return approved: ' + qty + ' ' + item.name + '.', 'damage');
    } else {
        // Restock and log as return
        item.stock += qty;
        salesLog.push({
            name: item.name,
            price: item.price,
            qty: -qty,
            total: total,
            type: 'return',
            date: new Date(),
            code: item.code
        });
        showAlertBanner('Return approved and restocked: +' + qty + ' ' + item.name + '.', 'success');
    }

    r.status = 'Approved';
    r.applied = { itemId: item.id, qty: qty, type: isDamaged ? 'return-damage' : 'return', appliedAt: new Date() };
    saveReturnRequests();
    renderReturnAdminTable();
    updateUI();
    renderSalesChart();
}

function denyReturnRequest(index) {
    const r = returnRequests[index];
    if (!r) return;
    r.status = 'Denied';
    saveReturnRequests();
    renderReturnAdminTable();
    showAlertBanner('Return request ' + r.orderId + ' denied.', 'warning');
}

function removeReturnRecord(index) {
    if (index < 0 || index >= returnRequests.length) return;
    returnRequests.splice(index, 1);
    saveReturnRequests();
    renderReturnAdminTable();
}

function renderReturnProductSuggestions(query) {
    const suggestions = document.getElementById('returnProductSuggestions');
    if (!suggestions) return;
    
    const normalized = (query || '').trim().toLowerCase();
    let matches = [];
    
    if (normalized.length === 0) {
        matches = inventory.slice(0, 10);
    } else {
        matches = inventory.filter(item => 
            item.name.toLowerCase().includes(normalized) || 
            item.code.toLowerCase().includes(normalized) ||
            item.category.toLowerCase().includes(normalized)
        ).slice(0, 10);
    }
    
    if (matches.length === 0) {
        suggestions.innerHTML = '<button type="button" disabled style="padding: 16px; text-align: center; color: #d97706;">No matching products found</button>';
        suggestions.classList.add('open');
        return;
    }
    
    suggestions.innerHTML = matches.map(item => {
        const statusClass = item.stock > item.minLevel ? 'in-stock' : item.stock > 0 ? 'low-stock' : 'out-of-stock';
        const statusText = item.stock > item.minLevel ? 'In Stock' : item.stock > 0 ? 'Low' : 'Out of Stock';
        return '<button type="button" onclick="selectReturnProduct(' + item.id + ')" title="' + item.name + '">' +
            '<strong>' + item.name + '</strong>' +
            '<span style="float:right;color:#b45309;font-size:0.85rem;font-weight:600;">' + item.code + '</span><br>' +
            '<small>' + item.category + ' • <span class="badge ' + statusClass + '">' + statusText + '</span> • ' + item.stock + ' ' + item.unit + ' available</small>' +
        '</button>';
    }).join('');
    suggestions.classList.add('open');
}

function selectReturnProduct(itemId) {
    const item = inventory.find(i => i.id === itemId);
    const returnProductSearch = document.getElementById('returnProductSearch');
    const suggestions = document.getElementById('returnProductSuggestions');
    const returnProductInfo = document.getElementById('returnProductInfo');
    const returnProductName = document.getElementById('returnProductName');
    const returnProductDetails = document.getElementById('returnProductDetails');
    
    if (!item || !returnProductSearch || !suggestions || !returnProductInfo) return;
    
    returnProductSearch.value = item.name;
    returnProductSearch.dataset.selectedId = item.id;
    
    if (returnProductName) returnProductName.textContent = item.name;
    if (returnProductDetails) {
        const statusClass = item.stock > item.minLevel ? 'in-stock' : item.stock > 0 ? 'low-stock' : 'out-of-stock';
        const statusText = item.stock > item.minLevel ? 'In Stock' : item.stock > 0 ? 'Low' : 'Out of Stock';
        returnProductDetails.innerHTML = 
            '<div><strong style="color:#92400e;">Code:</strong> ' + item.code + '</div>' +
            '<div><strong style="color:#92400e;">Category:</strong> ' + item.category + '</div>' +
            '<div><strong style="color:#92400e;">Stock:</strong> ' + item.stock + ' ' + item.unit + ' <span class="badge ' + statusClass + '">' + statusText + '</span></div>' +
            '<div><strong style="color:#92400e;">Price:</strong> ' + formatCurrency(item.price) + '</div>';
    }
    
    returnProductInfo.style.display = 'block';
    suggestions.classList.remove('open');
}

function toggleExchangeFields() {
    const resolutionEl = document.getElementById('resolution');
    const exchangeFields = document.getElementById('exchangeFields');
    const exchangeHint = document.getElementById('exchangeHint');
    const isExchange = resolutionEl && resolutionEl.value === 'Exchange';
    if (exchangeFields) exchangeFields.style.display = isExchange ? 'grid' : 'none';
    if (exchangeHint) exchangeHint.style.display = isExchange ? 'block' : 'none';
}

function populateExchangeProductSelect() {
    const select = document.getElementById('exchangeProductSelect');
    if (!select) return;
    const selectedValue = select.value;
    select.innerHTML = '<option value="">-- Select item for exchange --</option>';
    inventory.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name + ' (' + item.stock + ' ' + item.unit + ' available)';
        select.appendChild(option);
    });
    if (selectedValue) select.value = selectedValue;
}

function clearReturnProductSelection() {
    const returnProductSearch = document.getElementById('returnProductSearch');
    const returnProductInfo = document.getElementById('returnProductInfo');
    const suggestions = document.getElementById('returnProductSuggestions');
    
    if (returnProductSearch) {
        returnProductSearch.value = '';
        returnProductSearch.dataset.selectedId = '';
        returnProductSearch.focus();
    }
    if (returnProductInfo) {
        returnProductInfo.style.display = 'none';
    }
    if (suggestions) {
        suggestions.classList.remove('open');
    }
}


// bind form
document.addEventListener('DOMContentLoaded', function () {
    const rf = document.getElementById('returnForm');
    if (rf) rf.addEventListener('submit', handleReturnFormSubmit);

    // Product search for returns form
    const returnProductSearch = document.getElementById('returnProductSearch');
    const returnProductSuggestions = document.getElementById('returnProductSuggestions');
    if (returnProductSearch && returnProductSuggestions) {
        returnProductSearch.addEventListener('input', () => {
            renderReturnProductSuggestions(returnProductSearch.value);
        });
        returnProductSearch.addEventListener('focus', () => {
            if (returnProductSearch.value.length > 0 || inventory.length > 0) {
                renderReturnProductSuggestions(returnProductSearch.value);
                if (returnProductSuggestions.querySelectorAll('button').length > 0) {
                    returnProductSuggestions.classList.add('open');
                }
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (returnProductSuggestions && !returnProductSuggestions.contains(e.target) && e.target !== returnProductSearch) {
            returnProductSuggestions.classList.remove('open');
        }
    });

    populateExchangeProductSelect();
    toggleExchangeFields();
    updateReturnSummaryPreview();
});

function openReturnsReport() {
    const reportsSection = document.getElementById('reports');
    const reportTab = document.querySelector('.report-tab[onclick*="returns"]');
    if (reportTab) {
        switchReport('returns', reportTab);
    }
    if (reportsSection) {
        reportsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
}

function updateReturnSummaryPreview() {
    const total = returnRequests.length;
    const pending = returnRequests.filter(r => r.status === 'Pending').length;
    const approved = returnRequests.filter(r => r.status === 'Approved').length;
    const denied = returnRequests.filter(r => r.status === 'Denied').length;
    const exchanges = returnRequests.filter(r => r.resolution === 'Exchange').length;
    const refunds = returnRequests.filter(r => r.resolution === 'Refund' || r.resolution === 'Store Credit').length;

    const setPreviewValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    };

    setPreviewValue('previewReturnsTotal', total);
    setPreviewValue('previewReturnsPending', pending);
    setPreviewValue('previewReturnsApproved', approved);
    setPreviewValue('previewReturnsDenied', denied);
    setPreviewValue('previewReturnsExchanges', exchanges);
    setPreviewValue('previewReturnsRefunds', refunds);
}

function renderStockValueReport() {
    const stockKpi = document.getElementById('stock-kpi-row');
    const stockBody = document.getElementById('stock-value-body');
    const stockCanvas = document.getElementById('stock-donut');
    const legend = document.getElementById('donut-legend');
    const categories = {};
    inventory.forEach(item => {
        const value = item.stock * item.cost;
        categories[item.category] = (categories[item.category] || 0) + value;
    });
    const totalValue = Object.values(categories).reduce((sum, v) => sum + v, 0);
    if (stockKpi) {
        stockKpi.innerHTML =
            '<div class="stat-card"><h3>' + formatCurrency(totalValue) + '</h3><p>Total Stock Value</p></div>' +
            '<div class="stat-card highlighted"><h3>' + Object.keys(categories).length + '</h3><p>Categories</p></div>' +
            '<div class="stat-card"><h3>' + inventory.length + '</h3><p>Items</p></div>';
    }
    if (stockBody) {
        stockBody.innerHTML = inventory.map(item =>
            '<tr><td>' + item.name + '</td><td>' + item.category + '</td><td>' + item.stock + '</td><td>' + formatCurrency(item.cost) + '</td><td>' + formatCurrency(item.price) + '</td><td>' + formatCurrency(item.stock * item.cost) + '</td><td>' + formatCurrency(item.stock * item.price) + '</td></tr>'
        ).join('');
    }
    if (stockCanvas && stockCanvas.getContext && totalValue > 0) {
        const ctx = stockCanvas.getContext('2d');
        const colors = ['#ff7597','#fbbf24','#22c55e','#60a5fa','#a855f7'];
        const data = Object.values(categories);
        const names = Object.keys(categories);
        const total = data.reduce((sum, v) => sum + v, 0);
        let startAngle = -Math.PI / 2;
        ctx.clearRect(0, 0, stockCanvas.width, stockCanvas.height);
        data.forEach((value, index) => {
            const sliceAngle = value / total * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(stockCanvas.width / 2, stockCanvas.height / 2);
            ctx.arc(stockCanvas.width / 2, stockCanvas.height / 2, 100, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = colors[index % colors.length];
            ctx.fill();
            startAngle += sliceAngle;
        });
        if (legend) {
            legend.innerHTML = names.map((name, index) => '<div class="donut-label"><span style="background:' + colors[index % colors.length] + '"></span>' + name + '</div>').join('');
        }
    }
}

function renderOrderSummary() {
    const orderBody = document.getElementById('order-summary-body');
    const orderKpi = document.getElementById('order-kpi-row');
    const filter = document.getElementById('order-status-filter')?.value || 'all';
    const filtered = filter === 'all' ? poList : poList.filter(po => po.status === filter);
    if (orderBody) {
        orderBody.innerHTML = filtered.map(po =>
            '<tr><td>' + po.poNumber + '</td><td>' + po.item + '</td><td>' + po.supplier + '</td><td>' + po.qty + '</td><td>' + formatCurrency(po.totalCost) + '</td><td>' + formatDate(po.date) + '</td><td><span class="badge ' + (po.status === 'Received' ? 'in-stock' : po.status === 'Pending' ? 'badge-low' : 'out-of-stock') + '">' + po.status + '</span></td></tr>'
        ).join('');
    }
    if (orderKpi) {
        orderKpi.innerHTML =
            '<div class="stat-card"><h3>' + poList.length + '</h3><p>Total POs</p></div>' +
            '<div class="stat-card highlighted"><h3>' + filtered.length + '</h3><p>Shown POs</p></div>' +
            '<div class="stat-card"><h3>' + formatCurrency(poList.reduce((s, po) => s + po.totalCost, 0)) + '</h3><p>Total Value</p></div>';
    }
}

// Returns report removed: function deleted



/* ─── Settings ───────────────────────────────────────────── */

function switchSettings(section, button) {
    document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.toggle('active', panel.id === 'settings-' + section));
    document.querySelectorAll('.settings-tab').forEach(tab => tab.classList.toggle('active', tab === button));
}

function saveProfile() {
    const firstName = document.getElementById('s-first-name')?.value.trim();
    const lastName = document.getElementById('s-last-name')?.value.trim();
    const email = document.getElementById('s-email')?.value.trim();
    if (!firstName || !lastName || !email) {
        alert('Please complete your profile details.');
        return;
    }
    appSettings.profile = { firstName, lastName, email };
    saveSettings();
    const displayName = document.getElementById('settings-display-name');
    if (displayName) displayName.textContent = firstName + ' ' + lastName;
    const topAdminName = document.getElementById('admin-display-name');
    if (topAdminName) topAdminName.textContent = firstName + ' ' + lastName;
    showAlertBanner('Profile saved successfully.', 'warning');
}

function changePassword() {
    const current = document.getElementById('s-current-pass')?.value;
    const newPass = document.getElementById('s-new-pass')?.value;
    const confirm = document.getElementById('s-confirm-pass')?.value;
    if (!current || !newPass || !confirm) { alert('Please fill in all password fields.'); return; }
    if (newPass !== confirm) { alert('Passwords do not match.'); return; }
    if (newPass.length < 6) { alert('Password must be at least 6 characters.'); return; }
    document.getElementById('s-current-pass').value = '';
    document.getElementById('s-new-pass').value = '';
    document.getElementById('s-confirm-pass').value = '';
    showAlertBanner('Password updated.', 'warning');
}

function toggleSettingsPass(fieldId, icon) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.type = field.type === 'password' ? 'text' : 'password';
    icon.classList.toggle('fa-eye-slash');
}

function saveNotifSettings() {
    appSettings.notifLowStock = !!document.getElementById('notif-low-stock')?.checked;
    appSettings.notifOutOfStock = !!document.getElementById('notif-out-of-stock')?.checked;
    appSettings.notifDamage = !!document.getElementById('notif-damage')?.checked;
    appSettings.notifDailySummary = !!document.getElementById('notif-daily-summary')?.checked;
    appSettings.notifWeeklyReport = !!document.getElementById('notif-weekly-report')?.checked;
    appSettings.notifPoReminder = !!document.getElementById('notif-po-reminder')?.checked;
    appSettings.notifEmail = document.getElementById('notif-email')?.value.trim();
    appSettings.notifCc = document.getElementById('notif-cc')?.value.trim();
    saveSettings();
    runAlertChecks();
    const msg = document.getElementById('notif-saved-msg');
    if (msg) {
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 3000);
    }
}

function savePrefs() {
    appSettings.currency = document.getElementById('pref-currency')?.value || appSettings.currency;
    appSettings.dateFormat = document.getElementById('pref-date-format')?.value || appSettings.dateFormat;
    appSettings.perPage = parseInt(document.getElementById('pref-per-page')?.value, 10) || appSettings.perPage;
    appSettings.minStock = parseInt(document.getElementById('pref-min-stock')?.value, 10) || appSettings.minStock;
    appSettings.autoPO = !!document.getElementById('pref-auto-po')?.checked;
    saveSettings();
    applySettings();
    updateUI();
    renderSalesChart();
    renderStockValueReport();
    renderOrderSummary();
    const msg = document.getElementById('pref-saved-msg');
    if (msg) {
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 3000);
    }
}
// Auto-fill price and stock fields when dropdown selection updates
        // Credit sales cart and handlers
        let creditCart = [];
        let creditCartSelectionMode = false;

        function getCreditProductItem(productId) {
            return inventory.find(i => String(i.id) === String(productId));
        }

        function populateCreditProductSelect() {
            const select = document.getElementById('productSelect');
            if (!select) return;
            const selectedValue = select.value;
            select.innerHTML = '<option value="">-- Choose a Product --</option>';
            inventory.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.textContent = item.name;
                opt.setAttribute('data-price', item.price);
                opt.setAttribute('data-stock', item.stock);
                select.appendChild(opt);
            });
            if (selectedValue) select.value = selectedValue;
        }

        function syncCreditProductOptions() {
            populateCreditProductSelect();
            const select = document.getElementById('productSelect');
            if (!select) return;
            for (let i = 0; i < select.options.length; i++) {
                const opt = select.options[i];
                const item = getCreditProductItem(opt.value);
                if (item) {
                    opt.setAttribute('data-stock', item.stock);
                    opt.setAttribute('data-price', item.price);
                }
            }
            handleProductChange();
        }

        function handleProductChange() {
            const select = document.getElementById('productSelect');
            if (!select) return;
            const sellingPriceEl = document.getElementById('sellingPrice');
            const stockAvailableEl = document.getElementById('stockAvailable');
            const opt = select.options[select.selectedIndex];
            const item = getCreditProductItem(select.value);

            if (select.value && opt) {
                const price = item ? item.price : parseFloat(opt.getAttribute('data-price')) || 0;
                const reservedQty = creditCart.filter(c => c.id === select.value).reduce((sum, c) => sum + c.qty, 0);
                const stock = item ? Math.max(0, item.stock - reservedQty) : parseInt(opt.getAttribute('data-stock')) || 0;
                sellingPriceEl.value = formatCurrency(price);
                stockAvailableEl.value = stock;
            } else {
                sellingPriceEl.value = '';
                stockAvailableEl.value = '';
            }
        }

        function incrementQty() {
            const qtyInput = document.getElementById('quantity');
            if (qtyInput) {
                qtyInput.value = Math.max(1, parseInt(qtyInput.value || 1, 10) + 1);
            }
        }

        function decrementQty() {
            const qtyInput = document.getElementById('quantity');
            if (qtyInput) {
                qtyInput.value = Math.max(1, parseInt(qtyInput.value || 1, 10) - 1);
            }
        }

        function addToCartItem() {
            const select = document.getElementById('productSelect');
            const qtyInput = document.getElementById('quantity');
            if (!select || !qtyInput) return;
            if (!select.value) return alert('Please choose a product first.');
            const qty = parseInt(qtyInput.value, 10) || 0;
            const opt = select.options[select.selectedIndex];
            const item = getCreditProductItem(select.value);
            const reservedQty = creditCart.filter(c => c.id === select.value).reduce((sum, c) => sum + c.qty, 0);
            const stock = item ? Math.max(0, item.stock - reservedQty) : parseInt(opt.getAttribute('data-stock')) || 0;
            const price = item ? item.price : parseFloat(opt.getAttribute('data-price')) || 0;

            if (qty <= 0) return alert('Quantity must be at least 1.');
            if (qty > stock) return alert('Requested quantity exceeds current stock.');

            if (item && qty > item.stock) return alert('Insufficient actual inventory stock for this item.');

            if (opt) {
                opt.setAttribute('data-stock', Math.max(0, stock - qty));
            }
            document.getElementById('stockAvailable').value = Math.max(0, stock - qty);

            const cartItem = {
                id: select.value,
                name: opt ? opt.text : 'Item',
                code: item ? item.code : (opt ? opt.value : ''),
                price: price,
                qty: qty,
                subtotal: price * qty,
                selected: false
            };
            creditCart.push(cartItem);
            qtyInput.value = 1;
            renderCreditCart();
            showAlertBanner('Staged ' + qty + ' × ' + cartItem.name + ' for credit sale.', 'success');
        }

        function renderCreditCart() {
            const container = document.getElementById('credit-cart');
            if (!container) return;
            if (creditCart.length === 0) {
                container.innerHTML = '<div style="padding:12px;color:#666">No items staged for credit sale.</div>';
                updateCreditCartSelectionSummary();
                return;
            }
            const rows = creditCart.map((it, idx) =>
                '<div class="credit-cart-item-row" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">' +
                    (creditCartSelectionMode ?
                        '<label class="credit-cart-checkbox" style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" onclick="toggleCreditCartItemSelection(' + idx + ')" ' + (it.selected ? 'checked' : '') + '>' +
                        '<span>Select</span></label>'
                        : '') +
                    '<div style="flex:1;min-width:0;margin-left:' + (creditCartSelectionMode ? '12px' : '0') + ';">' +
                        '<strong>' + it.name + '</strong><div style="font-size:0.85rem;color:#666">' + it.qty + ' × ' + formatCurrency(it.price) + '</div>' +
                    '</div>' +
                    '<div style="text-align:right">' + formatCurrency(it.subtotal) + '<br><button style="margin-top:6px" onclick="removeCreditItem(' + idx + ')" class="action-btn">Remove</button></div>' +
                '</div>'
            ).join('');
            const total = creditCart.reduce((s, i) => s + i.subtotal, 0);
            container.innerHTML = rows + '<div style="padding:12px 0;text-align:right"><strong>Total: ' + formatCurrency(total) + '</strong></div>';
            updateCreditCartSelectionSummary();
        }

        function removeCreditItem(index) {
            if (index < 0 || index >= creditCart.length) return;
            const item = creditCart[index];
            // restore stock on the option element
            const select = document.getElementById('productSelect');
            if (select) {
                for (let i = 0; i < select.options.length; i++) {
                    const opt = select.options[i];
                    if (opt.value === item.id) {
                        const cur = parseInt(opt.getAttribute('data-stock')) || 0;
                        opt.setAttribute('data-stock', cur + item.qty);
                        break;
                    }
                }
            }
            creditCart.splice(index, 1);
            renderCreditCart();
            showAlertBanner('Removed ' + item.name + ' from staged items.', 'warning');
        }

        function toggleCreditCartSelectionMode() {
            creditCartSelectionMode = !creditCartSelectionMode;
            if (creditCartSelectionMode) {
                creditCart.forEach(item => item.selected = true);
            }
            renderCreditCart();
        }

        function toggleCreditCartItemSelection(index) {
            if (index < 0 || index >= creditCart.length) return;
            creditCart[index].selected = !creditCart[index].selected;
            updateCreditCartSelectionSummary();
        }

        function confirmCreditSelection() {
            const selected = creditCart.filter(item => item.selected);
            if (selected.length === 0) {
                return alert('Please select at least one staged item before confirming.');
            }
            creditCartSelectionMode = false;
            renderCreditCart();
            showAlertBanner('Selected ' + selected.length + ' staged item(s) for this credit sale.', 'success');
        }

        function updateCreditCartSelectionSummary() {
            const total = creditCart.length;
            const selected = creditCart.filter(item => item.selected).length;
            const countEl = document.getElementById('creditCartCount');
            const selectedEl = document.getElementById('creditCartSelectedCount');
            const selectButton = document.querySelector('#credit-cart-actions button[onclick="toggleCreditCartSelectionMode()"]');
            if (countEl) countEl.textContent = total;
            if (selectedEl) selectedEl.textContent = selected;
            if (selectButton) selectButton.textContent = creditCartSelectionMode ? 'Cancel Selection' : 'Select Staged Items';
        }

        function renderCreditAdminPanel() {
            const creditRecords = salesLog.filter(sale => sale.type === 'credit');
            const openCreditRecords = creditRecords.filter(sale => sale.balance > 0);
            const openCountEl = document.getElementById('creditOpenCount');
            const totalAREl = document.getElementById('creditTotalAR');
            const tableBody = document.getElementById('credit-admin-table');
            const openCount = openCreditRecords.length;
            if (openCountEl) openCountEl.textContent = openCount;
            if (totalAREl) totalAREl.textContent = formatCurrency(totalAR);
            if (!tableBody) return;
            if (creditRecords.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:16px">No outstanding credit sales yet.</td></tr>';
                return;
            }
            tableBody.innerHTML = creditRecords.map((sale, index) => {
                const statusLabel = sale.balance <= 0 ? 'Paid' : sale.balance < sale.total ? 'Partial' : 'Open';
                const button = sale.balance <= 0 ? '<span style="color:#10b981;font-weight:700;">Settled</span>' : '<button type="button" class="action-btn" onclick="recordCreditPayment(' + index + ')">Pay Cash</button>';
                return '<tr>' +
                    '<td>' + escapeHtml(sale.customer || 'Unknown') + '</td>' +
                    '<td>' + escapeHtml(sale.name) + '</td>' +
                    '<td>' + sale.qty + '</td>' +
                    '<td>' + (sale.dueDate ? escapeHtml(formatDate(sale.dueDate)) : '—') + '</td>' +
                    '<td>' + formatCurrency(sale.balance) + '</td>' +
                    '<td><span class="badge ' + (statusLabel === 'Paid' ? 'in-stock' : statusLabel === 'Partial' ? 'badge-low' : '') + '">' + statusLabel + '</span></td>' +
                    '<td>' + button + '</td>' +
                '</tr>';
            }).join('');
        }

        function recordCreditPayment(index) {
            const creditItems = salesLog.filter(sale => sale.type === 'credit');
            const sale = creditItems[index];
            if (!sale) return;
            if (sale.balance <= 0) return showAlertBanner('This credit sale is already paid.', 'warning');
            const amountInput = prompt('Enter cash payment amount for ' + sale.customer + ' (remaining ' + formatCurrency(sale.balance) + '):', sale.balance.toFixed(2));
            if (amountInput === null) return;
            const amount = parseFloat(amountInput.replace(/[^0-9.]/g, ''));
            if (isNaN(amount) || amount <= 0) return alert('Enter a valid payment amount.');
            if (amount > sale.balance) return alert('Payment cannot exceed remaining balance.');
            sale.balance = Math.max(0, sale.balance - amount);
            sale.paid += amount;
            sale.payments = sale.payments || [];
            sale.payments.push({ amount: amount, date: new Date() });
            sale.status = sale.balance <= 0 ? 'paid' : 'partial';
            totalAR = Math.max(0, totalAR - amount);
            syncCreditProductOptions();
            renderCreditAdminPanel();
            updateUI();
            renderSalesChart();
            showAlertBanner('Cash payment recorded: ' + formatCurrency(amount) + ' for ' + sale.customer + '.', 'success');
        }

        function getOutstandingCreditByIndex(index) {
            return salesLog.filter(sale => sale.type === 'credit')[index] || null;
        }

        document.getElementById('creditSalesForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('customerName')?.value.trim();
            const phone = document.getElementById('customerPhone')?.value.trim();
            const dueDate = document.getElementById('creditDueDate')?.value;
            if (!name || !phone || !dueDate) return alert('Please enter customer name, phone, and due date.');
            if (creditCart.length === 0) return alert('No items staged for this credit sale.');

            const selectedItems = creditCart.filter(it => it.selected);
            const saleItems = selectedItems.length > 0 ? selectedItems : creditCart;

            // validate inventory still has enough stock for selected staged items
            for (const it of saleItems) {
                const inventoryItem = getCreditProductItem(it.id);
                if (!inventoryItem) return alert('A selected item is no longer available in inventory.');
                if (inventoryItem.stock < it.qty) return alert('Stock changed for ' + it.name + '. Please re-stage the credit sale.');
            }

            const total = saleItems.reduce((s, i) => s + i.subtotal, 0);

            saleItems.forEach(it => {
                const inventoryItem = getCreditProductItem(it.id);
                if (inventoryItem) inventoryItem.stock -= it.qty;
                salesLog.push({
                    name: it.name,
                    price: it.price,
                    qty: it.qty,
                    total: it.subtotal,
                    balance: it.subtotal,
                    paid: 0,
                    payments: [],
                    type: 'credit',
                    date: new Date(),
                    code: it.code || null,
                    customer: name,
                    dueDate: dueDate,
                    status: 'open'
                });
            });
            totalAR += total;

            creditCart = [];
            renderCreditCart();
            document.getElementById('creditSalesForm').reset();
            document.getElementById('sellingPrice').value = '';
            document.getElementById('stockAvailable').value = '';
            syncCreditProductOptions();
            showAlertBanner('Credit sale processed for ' + name + ' • ' + formatCurrency(total), 'success');
            updateUI();
            renderSalesChart();
            renderCreditAdminPanel();
        });
// State Management: Load from localStorage or initialize empty array
let returnsList = JSON.parse(localStorage.getItem('returnsSystemData')) || [];

// DOM Elements
const returnForm = document.getElementById('returnForm');
const portalMessage = document.getElementById('portalMessage');
const adminTableBody = document.getElementById('adminTableBody');

// Handle Customer Form Submission
returnForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Gather Form Data
    const newReturn = {
        id: 'RMA-' + Math.floor(100000 + Math.random() * 900000), // Random RMA number
        orderId: document.getElementById('orderId').value.trim(),
        email: document.getElementById('customerEmail').value.trim(),
        reason: document.getElementById('reason').value,
        resolution: document.getElementById('resolution').value,
        status: 'Pending'
    };

    // Save data
    returnsList.push(newReturn);
    updateLocalStorage();

    // Show Success Message to Customer
    portalMessage.innerHTML = `🎉 Success! Your return request <strong>${newReturn.id}</strong> has been submitted. Look out for a shipping label in your email.`;
    portalMessage.classList.remove('hidden');

    // Reset Form & Update Dashboard
    returnForm.reset();
    renderAdminTable();
});

// Render Admin Dashboard Table
function renderAdminTable() {
    adminTableBody.innerHTML = '';

    if (returnsList.length === 0) {
        adminTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No return requests found.</td></tr>`;
        return;
    }

    returnsList.forEach((item, index) => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td><strong>${item.id}</strong></td>
            <td>${item.orderId}</td>
            <td>${item.reason}</td>
            <td>${item.resolution}</td>
            <td><span class="status-badge status-${item.status.toLowerCase()}">${item.status}</span></td>
            <td>
                ${item.status === 'Pending' ? `
                    <button class="btn-sm btn-approve" onclick="updateStatus(${index}, 'Approved')">Approve</button>
                    <button class="btn-sm btn-reject" onclick="updateStatus(${index}, 'Rejected')">Reject</button>
                ` : `<span style="color:#64748b; font-size:0.85rem;">Processed</span>`}
            </td>
        `;
        adminTableBody.appendChild(row);
    });
}

// Update Return Status (Approve / Reject)
window.updateStatus = function(index, newStatus) {
    returnsList[index].status = newStatus;
    updateLocalStorage();
    renderAdminTable();
    
    // Simulate back-end alert action
    alert(`RMA ${returnsList[index].id} has been ${newStatus}. A notification was simulated to ${returnsList[index].email}.`);
};

// Sync with Browser Storage
function updateLocalStorage() {
    localStorage.setItem('returnsSystemData', JSON.stringify(returnsList));
}

// Initial Run to load any saved items
renderAdminTable();
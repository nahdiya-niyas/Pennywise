/* ============================================================
   PennyWise – script.js
   Personal Finance & Budget Management App
   ============================================================ */

'use strict';

/* ============================================================
   CONSTANTS & CONFIGURATION
   ============================================================ */

const APP_VERSION = '1.0';
const LS_KEY_TRANSACTIONS = 'pennywise_transactions';
const LS_KEY_BUDGET       = 'pennywise_budget';

const EXPENSE_CATEGORIES = [
  'Food', 'Transportation', 'Housing', 'Shopping',
  'Healthcare', 'Education', 'Entertainment', 'Bills & Utilities', 'Other'
];

const INCOME_SOURCES = [
  'Salary', 'Freelance', 'Allowance', 'Business', 'Investment', 'Other'
];

// Currency formatter – easy to swap locale/currency in the future
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// Category colours for charts
const CATEGORY_COLORS = {
  'Food':              '#F97316',
  'Transportation':    '#06B6D4',
  'Housing':           '#8B5CF6',
  'Shopping':          '#EC4899',
  'Healthcare':        '#14B8A6',
  'Education':         '#3B82F6',
  'Entertainment':     '#A855F7',
  'Bills & Utilities': '#F59E0B',
  'Other':             '#6B7280',
};

/* ============================================================
   STATE
   ============================================================ */

let transactions = [];   // { id, type:'income'|'expense', title, category, amount, date, description }
let budget = 0;          // monthly budget amount (0 = not set)
let currentPage = 'dashboard';
let reportMonth = new Date(); // month being viewed in reports
let importFileData = null;    // holds parsed JSON pending import
let chartIncomeExpense = null;
let chartExpenseCategory = null;
let chartReportCategory = null;
let chartReportTrend = null;
let submitting = false;       // prevent double submit

/* ============================================================
   LOCAL STORAGE
   ============================================================ */

function saveTransactions() {
  try {
    localStorage.setItem(LS_KEY_TRANSACTIONS, JSON.stringify(transactions));
  } catch (e) {
    showToast('Storage error – data may not be saved.', 'error');
  }
}

function saveBudget() {
  try {
    localStorage.setItem(LS_KEY_BUDGET, JSON.stringify(budget));
  } catch (e) {
    showToast('Storage error – budget may not be saved.', 'error');
  }
}

function loadData() {
  try {
    const rawTx = localStorage.getItem(LS_KEY_TRANSACTIONS);
    if (rawTx) {
      const parsed = JSON.parse(rawTx);
      if (Array.isArray(parsed)) transactions = parsed;
    }
  } catch (e) {
    transactions = [];
  }
  try {
    const rawBudget = localStorage.getItem(LS_KEY_BUDGET);
    if (rawBudget !== null) {
      const parsed = parseFloat(rawBudget);
      if (!isNaN(parsed) && parsed >= 0) budget = parsed;
    }
  } catch (e) {
    budget = 0;
  }
}

/* ============================================================
   UTILITIES
   ============================================================ */

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  // dateStr is YYYY-MM-DD (no timezone shift trick)
  const [y, m, d] = dateStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getMonthYear(dateStr) {
  // returns "YYYY-MM" from "YYYY-MM-DD"
  return dateStr ? dateStr.slice(0, 7) : '';
}

function currentMonthYear() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

function monthLabel(dateObj) {
  return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Returns "YYYY-MM" for a Date object
function toMonthKey(dateObj) {
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  return `${dateObj.getFullYear()}-${m}`;
}

/* ============================================================
   TOAST
   ============================================================ */

let toastTimer = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 3200);
}

/* ============================================================
   MODAL MANAGEMENT
   ============================================================ */

function openModal(id) {
  document.getElementById('modalOverlay').classList.add('open');
  const modal = document.getElementById(id);
  modal.style.display = 'block';
  // Force reflow for transition
  modal.offsetHeight; // eslint-disable-line no-unused-expressions
  modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = ''; }, 210);
  // Close overlay only if no other modal open
  const anyOpen = document.querySelectorAll('.modal.open').length;
  if (!anyOpen) {
    document.getElementById('modalOverlay').classList.remove('open');
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal.open').forEach(m => {
    m.classList.remove('open');
    setTimeout(() => { m.style.display = ''; }, 210);
  });
  document.getElementById('modalOverlay').classList.remove('open');
}

// Wire close buttons and overlay
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });
  document.getElementById('modalOverlay').addEventListener('click', closeAllModals);
});

/* ============================================================
   NAVIGATION
   ============================================================ */

const PAGE_TITLES = {
  dashboard:    'Dashboard',
  income:       'Income',
  expenses:     'Expenses',
  budget:       'Budget',
  savings:      'Savings',
  transactions: 'Transactions',
  reports:      'Reports',
  settings:     'Settings & Data',
};

function navigateTo(page) {
  if (!PAGE_TITLES[page]) return;

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Show target
  document.getElementById(`page-${page}`).classList.add('active');

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });

  // Update topbar title
  document.getElementById('topbarTitle').textContent = PAGE_TITLES[page];

  currentPage = page;

  // Render the page's content
  switch (page) {
    case 'dashboard':    renderDashboard(); break;
    case 'income':       renderIncomeTable(); break;
    case 'expenses':     renderExpenseTable(); break;
    case 'budget':       renderBudgetPage(); break;
    case 'savings':      renderSavingsPage(); break;
    case 'transactions': renderTransactionsPage(); break;
    case 'reports':      renderReportsPage(); break;
    case 'settings':     /* static */ break;
  }

  // Close sidebar on mobile after navigation
  document.getElementById('sidebar').classList.remove('open');
}

/* ============================================================
   CALCULATIONS
   ============================================================ */

function getMonthTransactions(monthKey) {
  return transactions.filter(t => getMonthYear(t.date) === monthKey);
}

function sumByType(txList, type) {
  return txList
    .filter(t => t.type === type)
    .reduce((s, t) => s + t.amount, 0);
}

function expensesByCategory(txList) {
  const map = {};
  txList
    .filter(t => t.type === 'expense')
    .forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
  return map;
}

function totalAllTime(type) {
  return transactions
    .filter(t => t.type === type)
    .reduce((s, t) => s + t.amount, 0);
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function renderDashboard() {
  const mk = currentMonthYear();
  const monthTx = getMonthTransactions(mk);
  const income   = sumByType(monthTx, 'income');
  const expenses = sumByType(monthTx, 'expense');
  const balance  = income - expenses;

  // All-time savings
  const allIncome   = totalAllTime('income');
  const allExpenses = totalAllTime('expense');
  const savings     = allIncome - allExpenses;

  // Subtitle
  const now = new Date();
  document.getElementById('dashboardSubtitle').textContent =
    now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  document.getElementById('topbarMonth').textContent =
    now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  document.getElementById('dashIncome').textContent   = currency.format(income);
  document.getElementById('dashExpenses').textContent = currency.format(expenses);
  document.getElementById('dashBalance').textContent  = currency.format(balance);
  document.getElementById('dashSavings').textContent  = currency.format(savings);

  // Budget progress
  renderDashBudget(expenses);

  // Charts
  renderIncomeExpenseChart(income, expenses);
  renderExpenseCategoryChart(expensesByCategory(monthTx));

  // Recent transactions (last 8)
  renderRecentTransactions();
}

function renderDashBudget(expenses) {
  const bar    = document.getElementById('dashBudgetBar');
  const badge  = document.getElementById('dashBudgetBadge');
  const spent  = document.getElementById('dashBudgetSpent');
  const limit  = document.getElementById('dashBudgetLimit');

  spent.textContent = `Spent: ${currency.format(expenses)}`;

  if (!budget) {
    bar.style.width = '0%';
    bar.className = 'progress-bar';
    badge.textContent = 'No budget set';
    badge.className = 'budget-status-badge';
    limit.textContent = 'Budget: Not set';
    return;
  }

  const pct = Math.min((expenses / budget) * 100, 100);
  bar.style.width = pct + '%';
  limit.textContent = `Budget: ${currency.format(budget)}`;

  if (pct < 75) {
    bar.className = 'progress-bar';
    badge.className = 'budget-status-badge ok';
    badge.textContent = 'Under Control';
  } else if (pct < 90) {
    bar.className = 'progress-bar near';
    badge.className = 'budget-status-badge near';
    badge.textContent = 'Approaching Limit';
  } else if (pct <= 100) {
    bar.className = 'progress-bar danger';
    badge.className = 'budget-status-badge danger';
    badge.textContent = 'Almost Exhausted';
  } else {
    bar.className = 'progress-bar danger';
    badge.className = 'budget-status-badge danger';
    badge.textContent = 'Budget Exceeded!';
  }
}

function renderRecentTransactions() {
  const container = document.getElementById('recentTransactions');
  const recent = [...transactions]
    .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
    .slice(0, 8);

  if (!recent.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:24px 0;font-size:.88rem;">No transactions yet.</p>';
    return;
  }

  container.innerHTML = recent.map(t => `
    <div class="tx-item">
      <span class="tx-badge ${t.type}">${t.type === 'income' ? 'Income' : 'Expense'}</span>
      <div class="tx-info">
        <div class="tx-title">${escapeHtml(t.title)}</div>
        <div class="tx-meta">${escapeHtml(t.category)} · ${formatDate(t.date)}</div>
      </div>
      <span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${currency.format(t.amount)}</span>
    </div>
  `).join('');
}

/* ============================================================
   CHARTS
   ============================================================ */

function destroyChart(chartVar) {
  if (chartVar) { try { chartVar.destroy(); } catch(e) { /* ignore */ } }
  return null;
}

function renderIncomeExpenseChart(income, expenses) {
  chartIncomeExpense = destroyChart(chartIncomeExpense);
  const ctx = document.getElementById('incomeExpenseChart').getContext('2d');
  chartIncomeExpense = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{
        data: [income, expenses],
        backgroundColor: ['#16A34A', '#DC2626'],
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => currency.format(ctx.parsed.y)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => '$' + v.toLocaleString()
          }
        }
      }
    }
  });
}

function renderExpenseCategoryChart(catMap) {
  chartExpenseCategory = destroyChart(chartExpenseCategory);
  const labels = Object.keys(catMap);
  const data   = Object.values(catMap);

  const ctx = document.getElementById('expenseCategoryChart').getContext('2d');

  if (!labels.length) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'center';
    ctx.fillText('No expense data', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  chartExpenseCategory = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map(l => CATEGORY_COLORS[l] || '#6B7280'),
        borderWidth: 2,
        borderColor: '#fff',
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${currency.format(ctx.parsed)}`
          }
        }
      }
    }
  });
}

/* ============================================================
   INCOME PAGE
   ============================================================ */

function renderIncomeTable() {
  const tbody  = document.getElementById('incomeTableBody');
  const empty  = document.getElementById('incomeEmpty');
  const table  = document.getElementById('incomeTable');
  const income = transactions.filter(t => t.type === 'income')
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  if (!income.length) {
    table.style.display = 'none';
    empty.classList.add('visible');
    return;
  }

  table.style.display = '';
  empty.classList.remove('visible');

  tbody.innerHTML = income.map(t => `
    <tr>
      <td><strong>${escapeHtml(t.title)}</strong></td>
      <td><span class="amount-cell income">${currency.format(t.amount)}</span></td>
      <td>${formatDate(t.date)}</td>
      <td>${escapeHtml(t.description || '—')}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-icon btn-edit"   onclick="editTransaction('${t.id}')">✏️ Edit</button>
          <button class="btn btn-icon btn-delete" onclick="confirmDelete('${t.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ============================================================
   EXPENSE PAGE
   ============================================================ */

function renderExpenseTable() {
  const tbody    = document.getElementById('expenseTableBody');
  const empty    = document.getElementById('expenseEmpty');
  const table    = document.getElementById('expenseTable');
  const expenses = transactions.filter(t => t.type === 'expense')
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  if (!expenses.length) {
    table.style.display = 'none';
    empty.classList.add('visible');
    return;
  }

  table.style.display = '';
  empty.classList.remove('visible');

  tbody.innerHTML = expenses.map(t => `
    <tr>
      <td><strong>${escapeHtml(t.title)}</strong></td>
      <td><span class="category-pill">${escapeHtml(t.category)}</span></td>
      <td><span class="amount-cell expense">${currency.format(t.amount)}</span></td>
      <td>${formatDate(t.date)}</td>
      <td>${escapeHtml(t.description || '—')}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-icon btn-edit"   onclick="editTransaction('${t.id}')">✏️ Edit</button>
          <button class="btn btn-icon btn-delete" onclick="confirmDelete('${t.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ============================================================
   INCOME MODAL FORM
   ============================================================ */

function openAddIncomeModal() {
  // Reset form
  document.getElementById('incomeForm').reset();
  document.getElementById('incomeEditId').value = '';
  document.getElementById('incomeModalTitle').textContent = 'Add Income';
  document.getElementById('incomeSubmitBtn').textContent  = 'Add Income';
  clearIncomeErrors();
  document.getElementById('incomeDate').value = todayISO();
  openModal('incomeModal');
}

function clearIncomeErrors() {
  ['incomeSourceErr', 'incomeAmountErr', 'incomeDateErr'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  ['incomeSource', 'incomeAmount', 'incomeDate'].forEach(id => {
    document.getElementById(id).classList.remove('error');
  });
}

function validateIncomeForm() {
  clearIncomeErrors();
  let valid = true;

  const source = document.getElementById('incomeSource').value.trim();
  const amount = parseFloat(document.getElementById('incomeAmount').value);
  const date   = document.getElementById('incomeDate').value;

  if (!source) {
    document.getElementById('incomeSourceErr').textContent = 'Please select an income source.';
    document.getElementById('incomeSource').classList.add('error');
    valid = false;
  }
  if (!document.getElementById('incomeAmount').value || isNaN(amount) || amount <= 0) {
    document.getElementById('incomeAmountErr').textContent = 'Enter a valid amount greater than 0.';
    document.getElementById('incomeAmount').classList.add('error');
    valid = false;
  }
  if (!date) {
    document.getElementById('incomeDateErr').textContent = 'Please select a date.';
    document.getElementById('incomeDate').classList.add('error');
    valid = false;
  }
  return valid;
}

document.addEventListener('DOMContentLoaded', () => {
  // Income form submit
  document.getElementById('incomeForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (submitting) return;
    if (!validateIncomeForm()) return;

    submitting = true;
    const editId = document.getElementById('incomeEditId').value;
    const source = document.getElementById('incomeSource').value;
    const amount = parseFloat(parseFloat(document.getElementById('incomeAmount').value).toFixed(2));
    const date   = document.getElementById('incomeDate').value;
    const desc   = document.getElementById('incomeDesc').value.trim();

    if (editId) {
      // Edit existing
      const idx = transactions.findIndex(t => t.id === editId);
      if (idx !== -1) {
        transactions[idx] = { ...transactions[idx], title: source, category: source, amount, date, description: desc };
        showToast('Income updated successfully.', 'success');
      }
    } else {
      // Add new
      transactions.push({
        id: generateId(),
        type: 'income',
        title: source,
        category: source,
        amount,
        date,
        description: desc,
      });
      showToast('Income added successfully.', 'success');
    }

    saveTransactions();
    closeModal('incomeModal');
    refreshCurrentPage();
    submitting = false;
  });

  document.getElementById('openAddIncomeModal').addEventListener('click', openAddIncomeModal);
});

/* ============================================================
   EXPENSE MODAL FORM
   ============================================================ */

function openAddExpenseModal() {
  document.getElementById('expenseForm').reset();
  document.getElementById('expenseEditId').value = '';
  document.getElementById('expenseModalTitle').textContent = 'Add Expense';
  document.getElementById('expenseSubmitBtn').textContent  = 'Add Expense';
  clearExpenseErrors();
  document.getElementById('expenseDate').value = todayISO();
  openModal('expenseModal');
}

function clearExpenseErrors() {
  ['expenseTitleErr', 'expenseCategoryErr', 'expenseAmountErr', 'expenseDateErr'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  ['expenseTitle', 'expenseCategory', 'expenseAmount', 'expenseDate'].forEach(id => {
    document.getElementById(id).classList.remove('error');
  });
}

function validateExpenseForm() {
  clearExpenseErrors();
  let valid = true;

  const title    = document.getElementById('expenseTitle').value.trim();
  const category = document.getElementById('expenseCategory').value;
  const amount   = parseFloat(document.getElementById('expenseAmount').value);
  const date     = document.getElementById('expenseDate').value;

  if (!title) {
    document.getElementById('expenseTitleErr').textContent = 'Please enter an expense title.';
    document.getElementById('expenseTitle').classList.add('error');
    valid = false;
  }
  if (!category) {
    document.getElementById('expenseCategoryErr').textContent = 'Please select a category.';
    document.getElementById('expenseCategory').classList.add('error');
    valid = false;
  }
  if (!document.getElementById('expenseAmount').value || isNaN(amount) || amount <= 0) {
    document.getElementById('expenseAmountErr').textContent = 'Enter a valid amount greater than 0.';
    document.getElementById('expenseAmount').classList.add('error');
    valid = false;
  }
  if (!date) {
    document.getElementById('expenseDateErr').textContent = 'Please select a date.';
    document.getElementById('expenseDate').classList.add('error');
    valid = false;
  }
  return valid;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('expenseForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (submitting) return;
    if (!validateExpenseForm()) return;

    submitting = true;
    const editId   = document.getElementById('expenseEditId').value;
    const title    = document.getElementById('expenseTitle').value.trim();
    const category = document.getElementById('expenseCategory').value;
    const amount   = parseFloat(parseFloat(document.getElementById('expenseAmount').value).toFixed(2));
    const date     = document.getElementById('expenseDate').value;
    const desc     = document.getElementById('expenseDesc').value.trim();

    if (editId) {
      const idx = transactions.findIndex(t => t.id === editId);
      if (idx !== -1) {
        transactions[idx] = { ...transactions[idx], title, category, amount, date, description: desc };
        showToast('Expense updated successfully.', 'success');
      }
    } else {
      transactions.push({
        id: generateId(),
        type: 'expense',
        title,
        category,
        amount,
        date,
        description: desc,
      });
      showToast('Expense added successfully.', 'success');
    }

    saveTransactions();
    closeModal('expenseModal');
    refreshCurrentPage();
    submitting = false;
  });

  document.getElementById('openAddExpenseModal').addEventListener('click', openAddExpenseModal);
});

/* ============================================================
   EDIT TRANSACTION (universal)
   ============================================================ */

function editTransaction(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  if (tx.type === 'income') {
    document.getElementById('incomeForm').reset();
    document.getElementById('incomeEditId').value     = tx.id;
    document.getElementById('incomeSource').value     = tx.title;
    document.getElementById('incomeAmount').value     = tx.amount;
    document.getElementById('incomeDate').value       = tx.date;
    document.getElementById('incomeDesc').value       = tx.description || '';
    document.getElementById('incomeModalTitle').textContent = 'Edit Income';
    document.getElementById('incomeSubmitBtn').textContent  = 'Update Income';
    clearIncomeErrors();
    openModal('incomeModal');
  } else {
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseEditId').value     = tx.id;
    document.getElementById('expenseTitle').value      = tx.title;
    document.getElementById('expenseCategory').value   = tx.category;
    document.getElementById('expenseAmount').value     = tx.amount;
    document.getElementById('expenseDate').value       = tx.date;
    document.getElementById('expenseDesc').value       = tx.description || '';
    document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
    document.getElementById('expenseSubmitBtn').textContent  = 'Update Expense';
    clearExpenseErrors();
    openModal('expenseModal');
  }
}

/* ============================================================
   DELETE TRANSACTION
   ============================================================ */

let pendingDeleteId = null;

function confirmDelete(id) {
  pendingDeleteId = id;
  const tx = transactions.find(t => t.id === id);
  const name = tx ? escapeHtml(tx.title) : 'this transaction';
  document.getElementById('confirmModalMessage').innerHTML =
    `Are you sure you want to delete <strong>${name}</strong>? This cannot be undone.`;
  openModal('confirmModal');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('confirmModalOk').addEventListener('click', () => {
    if (!pendingDeleteId) return;
    transactions = transactions.filter(t => t.id !== pendingDeleteId);
    pendingDeleteId = null;
    saveTransactions();
    closeModal('confirmModal');
    showToast('Transaction deleted.', 'success');
    refreshCurrentPage();
  });
});

/* ============================================================
   BUDGET PAGE
   ============================================================ */

function renderBudgetPage() {
  const mk       = currentMonthYear();
  const monthTx  = getMonthTransactions(mk);
  const expenses = sumByType(monthTx, 'expense');

  document.getElementById('budgetInput').value = budget > 0 ? budget : '';

  const limitEl     = document.getElementById('budgetLimitDisplay');
  const spentEl     = document.getElementById('budgetSpentDisplay');
  const remainEl    = document.getElementById('budgetRemainingDisplay');
  const fill        = document.getElementById('budgetProgressFill');
  const pctEl       = document.getElementById('budgetProgressPct');
  const warningEl   = document.getElementById('budgetWarning');

  limitEl.textContent = budget > 0 ? currency.format(budget) : 'Not set';
  spentEl.textContent = currency.format(expenses);

  if (!budget) {
    remainEl.textContent = '—';
    fill.style.width = '0%';
    fill.className = 'big-progress-fill';
    pctEl.textContent = '0%';
    warningEl.className = 'budget-warning';
    return;
  }

  const pct       = (expenses / budget) * 100;
  const remaining = budget - expenses;
  const pctCapped = Math.min(pct, 100);

  remainEl.textContent = currency.format(remaining);
  remainEl.style.color = remaining < 0 ? 'var(--danger)' : 'var(--success)';

  fill.style.width = pctCapped + '%';
  pctEl.textContent = pct.toFixed(1) + '%';

  if (pct < 75) {
    fill.className = 'big-progress-fill';
    warningEl.className = 'budget-warning ok';
    warningEl.textContent = '✅ Budget is under control. Keep it up!';
  } else if (pct < 90) {
    fill.className = 'big-progress-fill near';
    warningEl.className = 'budget-warning near';
    warningEl.textContent = '⚠️ You are approaching your budget limit.';
  } else if (pct <= 100) {
    fill.className = 'big-progress-fill danger';
    warningEl.className = 'budget-warning danger';
    warningEl.textContent = '🚨 Warning: Your budget is almost exhausted!';
  } else {
    fill.className = 'big-progress-fill danger';
    warningEl.className = 'budget-warning over';
    warningEl.textContent = `❌ You have exceeded your monthly budget by ${currency.format(-remaining)}!`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveBudgetBtn').addEventListener('click', () => {
    const val = parseFloat(document.getElementById('budgetInput').value);
    if (isNaN(val) || val < 0) {
      showToast('Please enter a valid budget amount.', 'error');
      return;
    }
    budget = parseFloat(val.toFixed(2));
    saveBudget();
    renderBudgetPage();
    showToast('Budget saved successfully.', 'success');
  });
});

/* ============================================================
   SAVINGS PAGE
   ============================================================ */

function renderSavingsPage() {
  const allIncome   = totalAllTime('income');
  const allExpenses = totalAllTime('expense');
  const savings     = allIncome - allExpenses;
  const rate        = allIncome > 0 ? (savings / allIncome) * 100 : 0;

  document.getElementById('savTotalIncome').textContent   = currency.format(allIncome);
  document.getElementById('savTotalExpenses').textContent = currency.format(allExpenses);
  document.getElementById('savAmount').textContent        = currency.format(savings);
  document.getElementById('savRate').textContent          = rate.toFixed(1) + '%';

  const savAmountEl = document.getElementById('savAmount');
  savAmountEl.className = 'savings-value ' + (savings >= 0 ? 'success' : 'danger');

  const rateEl = document.getElementById('savRate');
  rateEl.className = 'savings-value ' + (rate >= 20 ? 'success' : rate >= 10 ? '' : 'danger');

  const insightEl = document.getElementById('savingsInsight');
  if (!allIncome && !allExpenses) {
    insightEl.textContent = 'Add income and expenses to see your savings analysis.';
  } else if (savings < 0) {
    insightEl.textContent = `You are spending ${currency.format(Math.abs(savings))} more than you earn. Consider reducing expenses to improve your financial health.`;
  } else if (rate >= 20) {
    insightEl.textContent = `Great job! You are saving ${rate.toFixed(1)}% of your income. Financial experts recommend saving at least 20%. Keep it up!`;
  } else if (rate >= 10) {
    insightEl.textContent = `You are saving ${rate.toFixed(1)}% of your income. You are on the right track! Try to increase your savings rate to 20% or more.`;
  } else {
    insightEl.textContent = `Your savings rate is ${rate.toFixed(1)}%. Try to save more by cutting unnecessary expenses or finding additional income sources.`;
  }
}

/* ============================================================
   TRANSACTIONS PAGE
   ============================================================ */

function populateCategoryFilter() {
  const select = document.getElementById('txFilterCategory');
  const current = select.value;
  // Clear and rebuild
  select.innerHTML = '<option value="all">All Categories</option>';

  const cats = new Set();
  transactions.forEach(t => { if (t.category) cats.add(t.category); });
  [...cats].sort().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });

  // Restore selection if still valid
  if ([...cats].includes(current) || current === 'all') {
    select.value = current;
  }
}

function renderTransactionsPage() {
  populateCategoryFilter();
  applyTransactionFilters();
}

function applyTransactionFilters() {
  const search    = document.getElementById('txSearch').value.toLowerCase().trim();
  const typeF     = document.getElementById('txFilterType').value;
  const catF      = document.getElementById('txFilterCategory').value;
  const sortDir   = document.getElementById('txSortDate').value;

  let filtered = transactions.filter(t => {
    if (typeF !== 'all' && t.type !== typeF) return false;
    if (catF  !== 'all' && t.category !== catF) return false;
    if (search && !t.title.toLowerCase().includes(search)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (sortDir === 'desc') return b.date > a.date ? 1 : b.date < a.date ? -1 : 0;
    return a.date > b.date ? 1 : a.date < b.date ? -1 : 0;
  });

  const tbody = document.getElementById('txTableBody');
  const empty = document.getElementById('txEmpty');
  const table = document.getElementById('txTable');

  if (!filtered.length) {
    table.style.display = 'none';
    empty.classList.add('visible');
    return;
  }

  table.style.display = '';
  empty.classList.remove('visible');

  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td><strong>${escapeHtml(t.title)}</strong></td>
      <td><span class="tx-badge ${t.type}">${t.type === 'income' ? 'Income' : 'Expense'}</span></td>
      <td><span class="category-pill">${escapeHtml(t.category)}</span></td>
      <td class="amount-cell ${t.type}">${t.type === 'income' ? '+' : '-'}${currency.format(t.amount)}</td>
      <td>${formatDate(t.date)}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-icon btn-edit"   onclick="editTransaction('${t.id}')">✏️ Edit</button>
          <button class="btn btn-icon btn-delete" onclick="confirmDelete('${t.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  ['txSearch', 'txFilterType', 'txFilterCategory', 'txSortDate'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyTransactionFilters);
    document.getElementById(id).addEventListener('change', applyTransactionFilters);
  });
});

/* ============================================================
   REPORTS PAGE
   ============================================================ */

function renderReportsPage() {
  document.getElementById('reportMonthLabel').textContent = monthLabel(reportMonth);

  const mk      = toMonthKey(reportMonth);
  const monthTx = getMonthTransactions(mk);
  const income   = sumByType(monthTx, 'income');
  const expenses = sumByType(monthTx, 'expense');
  const savings  = income - expenses;

  document.getElementById('reportIncome').textContent   = currency.format(income);
  document.getElementById('reportExpenses').textContent = currency.format(expenses);
  document.getElementById('reportSavings').textContent  = currency.format(savings);
  document.getElementById('reportSavings').style.color  = savings >= 0 ? 'var(--success)' : 'var(--danger)';

  renderReportCategoryChart(expensesByCategory(monthTx));
  renderReportTrendChart();
  renderReportCategoryTable(expensesByCategory(monthTx), expenses);
}

function renderReportCategoryChart(catMap) {
  chartReportCategory = destroyChart(chartReportCategory);
  const labels = Object.keys(catMap);
  const data   = Object.values(catMap);
  const ctx    = document.getElementById('reportCategoryChart').getContext('2d');

  if (!labels.length) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'center';
    ctx.fillText('No expense data for this month', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  chartReportCategory = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map(l => CATEGORY_COLORS[l] || '#6B7280'),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${currency.format(ctx.parsed)}`
          }
        }
      }
    }
  });
}

function renderReportTrendChart() {
  chartReportTrend = destroyChart(chartReportTrend);

  // Build last 6 months
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(reportMonth.getFullYear(), reportMonth.getMonth() - i, 1);
    months.push({ key: toMonthKey(d), label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) });
  }

  const incomeData   = months.map(m => sumByType(getMonthTransactions(m.key), 'income'));
  const expenseData  = months.map(m => sumByType(getMonthTransactions(m.key), 'expense'));

  const ctx = document.getElementById('reportTrendChart').getContext('2d');
  chartReportTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: '#16A34A',
          backgroundColor: 'rgba(22,163,74,.1)',
          borderWidth: 2,
          pointRadius: 4,
          fill: true,
          tension: .3,
        },
        {
          label: 'Expenses',
          data: expenseData,
          borderColor: '#DC2626',
          backgroundColor: 'rgba(220,38,38,.08)',
          borderWidth: 2,
          pointRadius: 4,
          fill: true,
          tension: .3,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${currency.format(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => '$' + v.toLocaleString() }
        }
      }
    }
  });
}

function renderReportCategoryTable(catMap, totalExpenses) {
  const tbody = document.getElementById('reportCategoryTableBody');
  const empty = document.getElementById('reportEmpty');
  const table = document.getElementById('reportCategoryTable');

  const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    table.style.display = 'none';
    empty.classList.add('visible');
    return;
  }

  table.style.display = '';
  empty.classList.remove('visible');

  tbody.innerHTML = entries.map(([cat, amt]) => `
    <tr>
      <td><span class="category-pill">${escapeHtml(cat)}</span></td>
      <td class="amount-cell expense">${currency.format(amt)}</td>
      <td>${totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(1) + '%' : '0%'}</td>
    </tr>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('reportPrevMonth').addEventListener('click', () => {
    reportMonth = new Date(reportMonth.getFullYear(), reportMonth.getMonth() - 1, 1);
    renderReportsPage();
  });
  document.getElementById('reportNextMonth').addEventListener('click', () => {
    reportMonth = new Date(reportMonth.getFullYear(), reportMonth.getMonth() + 1, 1);
    renderReportsPage();
  });
});

/* ============================================================
   SETTINGS – EXPORT / IMPORT / CLEAR
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // Export
  document.getElementById('exportDataBtn').addEventListener('click', () => {
    const data = {
      version: APP_VERSION,
      exportDate: new Date().toISOString(),
      transactions,
      budget,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `pennywise-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Data exported successfully.', 'success');
  });

  // File picker
  document.getElementById('importFileInput').addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    document.getElementById('importFilename').textContent = file.name;
    document.getElementById('importDataBtn').disabled = true;
    importFileData = null;

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const parsed = JSON.parse(e.target.result);
        // Validate structure
        if (!Array.isArray(parsed.transactions)) {
          throw new Error('Invalid file: missing transactions array.');
        }
        // Validate each transaction
        for (const tx of parsed.transactions) {
          if (!tx.id || !tx.type || typeof tx.amount !== 'number' || !tx.date) {
            throw new Error('Invalid transaction structure in file.');
          }
          if (!['income', 'expense'].includes(tx.type)) {
            throw new Error('Invalid transaction type found.');
          }
        }
        importFileData = parsed;
        document.getElementById('importDataBtn').disabled = false;
        showToast(`File validated. ${parsed.transactions.length} transaction(s) ready to import.`, 'success');
      } catch (err) {
        showToast('Import failed: ' + err.message, 'error');
        document.getElementById('importFilename').textContent = 'Invalid file';
        importFileData = null;
      }
    };
    reader.readAsText(file);
  });

  // Import confirmation
  document.getElementById('importDataBtn').addEventListener('click', () => {
    if (!importFileData) return;
    const count = importFileData.transactions.length;
    document.getElementById('confirmModalTitle').textContent = 'Import Data';
    document.getElementById('confirmModalMessage').innerHTML =
      `This will <strong>replace all current data</strong> with the imported file (${count} transactions). This cannot be undone. Continue?`;
    pendingDeleteId = null; // not a delete action
    openModal('confirmModal');

    // Override confirm button for import
    const okBtn = document.getElementById('confirmModalOk');
    okBtn.onclick = () => {
      transactions = importFileData.transactions.map(tx => ({
        ...tx,
        amount: parseFloat(tx.amount) || 0,
      }));
      if (typeof importFileData.budget === 'number' && importFileData.budget >= 0) {
        budget = importFileData.budget;
      }
      saveTransactions();
      saveBudget();
      importFileData = null;
      document.getElementById('importFilename').textContent = 'No file chosen';
      document.getElementById('importDataBtn').disabled = true;
      document.getElementById('importFileInput').value = '';
      closeModal('confirmModal');
      showToast('Data imported successfully.', 'success');
      // Restore default confirm action
      restoreConfirmBtn();
    };
  });

  // Clear all data
  document.getElementById('clearAllDataBtn').addEventListener('click', () => {
    document.getElementById('confirmModalTitle').textContent = 'Clear All Data';
    document.getElementById('confirmModalMessage').innerHTML =
      'This will <strong>permanently delete all transactions and settings</strong>. This cannot be undone. Are you absolutely sure?';
    openModal('confirmModal');

    const okBtn = document.getElementById('confirmModalOk');
    okBtn.onclick = () => {
      transactions = [];
      budget = 0;
      saveTransactions();
      saveBudget();
      closeModal('confirmModal');
      showToast('All data cleared.', 'success');
      restoreConfirmBtn();
    };
  });
});

function restoreConfirmBtn() {
  // Restore confirmModalOk to its default delete behaviour
  document.getElementById('confirmModalOk').onclick = () => {
    if (!pendingDeleteId) return;
    transactions = transactions.filter(t => t.id !== pendingDeleteId);
    pendingDeleteId = null;
    saveTransactions();
    closeModal('confirmModal');
    showToast('Transaction deleted.', 'success');
    refreshCurrentPage();
  };
}

/* ============================================================
   REFRESH CURRENT PAGE
   ============================================================ */

function refreshCurrentPage() {
  navigateTo(currentPage);
}

/* ============================================================
   NAVIGATION SETUP
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Sidebar links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  // "View All" button on dashboard
  document.querySelectorAll('[data-page]').forEach(btn => {
    if (btn.classList.contains('nav-link')) return; // already handled
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Hamburger
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('sidebarClose').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Topbar month
  document.getElementById('topbarMonth').textContent =
    new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
});

/* ============================================================
   INIT
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  navigateTo('dashboard');
});

/**
 * customersView.js — Customer list, detail, add, edit, archive.
 *
 * Tap a card → detail sheet (name, phone, address, balance)
 * From detail → "Edit" switches sheet to form mode
 * From detail → "Archive" (blocked if balance > 0)
 *
 * Filter tabs: All | With Dues
 */

import CustomerService from "../services/customerService.js";
import { formatCurrency, debounce } from "../utils/helpers.js";
import { updateHeader, updateNav, showToast } from "./viewHelpers.js";

const viewState = {
  customers: [],
  activeFilter: "all",
  searchTerm: "",
  selectedCustomer: null,
  sheetMode: null, // 'detail' | 'form'
  archiveTarget: null,
  loading: false,
};

export async function renderCustomers(mount) {
  updateHeader("Customers");
  updateNav("customers");
  viewState.customers = [];
  viewState.searchTerm = "";
  viewState.activeFilter = "all";
  viewState.selectedCustomer = null;
  viewState.sheetMode = null;
  mount.innerHTML = buildShell();
  await loadCustomers();
}

async function loadCustomers() {
  viewState.loading = true;
  renderList();

  const result = await CustomerService.getAll({
    activeOnly: true,
    debtorsOnly: viewState.activeFilter === "dues",
    search: viewState.searchTerm,
  });

  if (result.success) {
    viewState.customers = result.data;
  } else {
    showToast(result.error, "error");
  }

  viewState.loading = false;
  renderList();
  renderCount();
}

function buildShell() {
  return `
        <div class="p-4 space-y-3">
            <div class="flex gap-2">
                <button class="filter-tab" data-filter="all">All</button>
                <button class="filter-tab" data-filter="dues">With Dues</button>
            </div>
            <style>
                .filter-tab {
                    padding: 6px 14px; border-radius: 20px; font-size: 13px;
                    font-weight: 600; border: 1.5px solid #E7E5E4; background: white;
                    color: #78716C; transition: all 0.15s ease; cursor: pointer;
                    font-family: 'DM Sans', sans-serif;
                }
                .filter-tab.active { color: white; border-color: transparent; background: #B45309; }
            </style>
            <div class="relative">
                <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"></i>
                <input id="c-search" type="text" inputmode="text" autocomplete="off"
                    placeholder="Search by name or phone..."
                    class="w-full h-10 pl-10 pr-4 bg-white border border-stone-200 rounded-lg
                           text-sm text-stone-900 placeholder-stone-400
                           focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700"
                    style="font-size:16px;">
            </div>
            <p id="c-count" class="text-xs text-stone-500 px-1"></p>
            <div id="c-list" class="space-y-2"></div>
        </div>
        <button id="c-fab"
            class="fixed z-20 w-14 h-14 rounded-full shadow-lg flex items-center justify-center
                   text-white hover:opacity-90 active:scale-95 transition-transform"
            style="bottom:calc(68px + env(safe-area-inset-bottom, 0px)); right:16px; background:#B45309;">
            <i data-lucide="plus" class="w-6 h-6"></i>
        </button>
        <div id="c-sheet-overlay" class="fixed inset-0 bg-black/40 z-40 opacity-0
            pointer-events-none transition-opacity duration-200"></div>
        <div id="c-sheet" class="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-40
            transform translate-y-full"
            style="transition:transform 0.25s cubic-bezier(0.32,0.72,0,1);
                   max-height:80vh; overflow-y:auto;
                   padding-bottom:env(safe-area-inset-bottom,16px);">
            <div class="sticky top-0 bg-white pt-3 pb-1 px-5 z-10">
                <div class="flex justify-center mb-3">
                    <div class="w-9 h-1 bg-stone-300 rounded-full"></div>
                </div>
                <h2 id="c-sheet-title" class="text-lg font-bold text-stone-900"></h2>
            </div>
            <div id="c-sheet-body" class="px-5 pb-5"></div>
        </div>
        <div id="c-archive-modal" class="fixed inset-0 bg-black/40 z-50 flex items-center
            justify-center px-6 opacity-0 pointer-events-none transition-opacity duration-200">
            <div class="bg-white rounded-xl w-full max-w-xs p-6 shadow-xl">
                <h3 class="text-lg font-bold text-stone-900 mb-2">Archive Customer?</h3>
                <p id="c-archive-text" class="text-sm text-stone-500 mb-5"></p>
                <div class="flex gap-3">
                    <button id="c-archive-cancel" class="flex-1 h-11 border border-stone-300
                        rounded-lg text-sm font-semibold text-stone-700 hover:bg-stone-50
                        transition-colors">Cancel</button>
                    <button id="c-archive-confirm" class="flex-1 h-11 bg-red-600 hover:bg-red-700
                        rounded-lg text-sm font-semibold text-white transition-colors">
                        Archive</button>
                </div>
            </div>
        </div>
    `;
}

function renderList() {
  const listEl = document.getElementById("c-list");
  if (!listEl) return;

  if (viewState.loading) {
    listEl.innerHTML = `<div class="text-center py-12">
            <div class="inline-block w-6 h-6 border-2 border-amber-700 border-t-transparent
                        rounded-full animate-spin"></div>
            <p class="text-sm text-stone-400 mt-3">Loading...</p></div>`;
    return;
  }

  if (viewState.customers.length === 0) {
    const isSearching = viewState.searchTerm.trim().length > 0;
    listEl.innerHTML = `<div class="text-center py-12">
            <i data-lucide="${isSearching ? "search-x" : "users"}" class="w-12 h-12 text-stone-300 mx-auto mb-3"></i>
            <p class="text-sm font-semibold text-stone-600">${isSearching ? 'No customers match "' + escapeHtml(viewState.searchTerm) + '"' : "No customers yet"}</p>
            <p class="text-xs text-stone-400 mt-1">${isSearching ? "Try a different search" : "Tap + to add your first customer"}</p></div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  listEl.innerHTML = viewState.customers
    .map((c) => {
      const hasDues = c.balance > 0;
      return `
        <div class="customer-card bg-white rounded-xl border border-stone-200 p-3.5
                    active:bg-stone-50 cursor-pointer transition-colors" data-id="${c.id}">
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-semibold text-stone-900 truncate">${escapeHtml(c.name)}</h3>
                    ${c.phone ? `<p class="text-xs text-stone-500 mt-0.5">${escapeHtml(c.phone)}</p>` : ""}
                </div>
                <div class="text-right flex-shrink-0">
                    <span class="text-sm font-bold ${hasDues ? "text-red-600" : "text-stone-400"}">
                        ${formatCurrency(c.balance)}
                    </span>
                    ${hasDues ? `<p class="text-[10px] text-red-500 font-medium">DUE</p>` : ""}
                </div>
            </div>
        </div>`;
    })
    .join("");

  listEl.querySelectorAll(".customer-card").forEach((card) => {
    card.addEventListener("click", () => {
      const c = viewState.customers.find((x) => x.id === card.dataset.id);
      if (c) openDetailSheet(c);
    });
  });
}

function renderCount() {
  const el = document.getElementById("c-count");
  if (!el) return;
  const n = viewState.customers.length;
  el.textContent = n === 1 ? "1 customer" : `${n} customers`;
}

// --- DETAIL SHEET ---

function openDetailSheet(customer) {
  viewState.selectedCustomer = customer;
  viewState.sheetMode = "detail";
  document.getElementById("c-sheet-title").textContent = "Customer Details";
  const hasDues = customer.balance > 0;
  const body = document.getElementById("c-sheet-body");
  body.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="user" class="w-5 h-5 text-amber-700"></i>
                </div>
                <div class="min-w-0">
                    <h3 class="text-base font-bold text-stone-900 truncate">${escapeHtml(customer.name)}</h3>
                    ${customer.phone ? `<p class="text-sm text-stone-500">${escapeHtml(customer.phone)}</p>` : '<p class="text-sm text-stone-400">No phone</p>'}
                </div>
            </div>
            ${customer.address ? `<div><p class="text-xs font-medium text-stone-500 mb-1">Address</p><p class="text-sm text-stone-800">${escapeHtml(customer.address)}</p></div>` : ""}
            <div class="p-4 rounded-lg ${hasDues ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}">
                <p class="text-xs font-medium ${hasDues ? "text-red-500" : "text-green-600"} mb-1">Outstanding Balance</p>
                <p class="text-2xl font-bold ${hasDues ? "text-red-700" : "text-green-700"}">${formatCurrency(customer.balance)}</p>
                ${hasDues ? '<p class="text-xs text-red-500 mt-1">This customer owes this amount</p>' : '<p class="text-xs text-green-600 mt-1">No pending dues</p>'}
            </div>
            <button id="c-edit-btn" class="w-full h-11 bg-amber-700 hover:bg-amber-800 text-white
                font-semibold rounded-lg text-sm transition-colors">Edit Details</button>
            <button id="c-archive-btn" class="w-full h-11 border ${hasDues ? "border-stone-200 text-stone-400 cursor-not-allowed" : "border-red-200 text-red-600 hover:bg-red-50"}
                font-semibold rounded-lg text-sm transition-colors" ${hasDues ? "disabled" : ""}>
                ${hasDues ? "Cannot Archive (Has Dues)" : "Archive Customer"}
            </button>
            ${hasDues ? '<p class="text-[11px] text-stone-400 text-center">Settle the outstanding balance before archiving</p>' : '<p class="text-[11px] text-stone-400 text-center">Archived customers won\'t appear in lists</p>'}
        </div>
    `;
  if (window.lucide) lucide.createIcons();

  document.getElementById("c-edit-btn").addEventListener("click", () => {
    openFormSheet(customer);
  });

  if (!hasDues) {
    document.getElementById("c-archive-btn").addEventListener("click", () => {
      closeSheet();
      openArchiveModal(customer);
    });
  }
}

// --- FORM SHEET ---

function openFormSheet(customer) {
  viewState.sheetMode = "form";
  viewState.selectedCustomer = customer;
  const isEdit = !!customer;
  document.getElementById("c-sheet-title").textContent = isEdit
    ? "Edit Customer"
    : "Add Customer";

  const body = document.getElementById("c-sheet-body");
  body.innerHTML = `
        <div class="space-y-4">
            <div id="c-form-error" class="hidden p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"></div>
            <div>
                <label class="block text-sm font-medium text-stone-700 mb-1">Name <span class="text-red-500">*</span></label>
                <input id="cf-name" type="text" inputmode="text"
                    value="${customer ? escapeHtml(customer.name) : ""}"
                    placeholder="Customer name"
                    class="w-full h-11 px-3 border border-stone-300 rounded-lg text-stone-900
                           text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                           focus:border-amber-700" style="font-size:16px;">
            </div>
            <div>
                <label class="block text-sm font-medium text-stone-700 mb-1">Phone</label>
                <input id="cf-phone" type="tel" inputmode="tel"
                    value="${customer && customer.phone ? escapeHtml(customer.phone) : ""}"
                    placeholder="e.g. 01712-345678"
                    class="w-full h-11 px-3 border border-stone-300 rounded-lg text-stone-900
                           text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                           focus:border-amber-700" style="font-size:16px;">
            </div>
            <div>
                <label class="block text-sm font-medium text-stone-700 mb-1">Address</label>
                <textarea id="cf-address" rows="2"
                    placeholder="Village, area, etc."
                    class="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900
                           text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                           focus:border-amber-700 resize-none" style="font-size:16px;">${customer && customer.address ? escapeHtml(customer.address) : ""}</textarea>
            </div>
            ${
              isEdit
                ? `
                <div class="p-3 bg-stone-50 rounded-lg">
                    <p class="text-xs text-stone-500">Balance (updated by transactions only)</p>
                    <p class="text-base font-bold text-stone-900 mt-0.5">${formatCurrency(customer.balance)}</p>
                </div>
            `
                : ""
            }
            <button id="cf-submit" class="w-full h-12 bg-amber-700 hover:bg-amber-800 text-white
                font-semibold rounded-lg text-sm transition-colors disabled:opacity-50">
                ${isEdit ? "Update Customer" : "Add Customer"}
            </button>
        </div>
    `;

  document
    .getElementById("cf-submit")
    .addEventListener("click", handleFormSubmit);
  document.getElementById("cf-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("cf-phone").focus();
    }
  });
}

async function handleFormSubmit() {
  const errEl = document.getElementById("c-form-error");
  const btn = document.getElementById("cf-submit");
  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Saving...";

  const data = {
    name: document.getElementById("cf-name").value,
    phone: document.getElementById("cf-phone").value,
    address: document.getElementById("cf-address").value,
  };

  let result;
  if (viewState.selectedCustomer) {
    result = await CustomerService.update(viewState.selectedCustomer.id, data);
  } else {
    result = await CustomerService.create(data);
  }

  btn.disabled = false;
  btn.textContent = viewState.selectedCustomer
    ? "Update Customer"
    : "Add Customer";

  if (result.success) {
    closeSheet();
    showToast(
      viewState.selectedCustomer ? "Customer updated" : "Customer added",
    );
    await loadCustomers();
  } else {
    errEl.textContent = result.error;
    errEl.classList.remove("hidden");
  }
}

// --- SHEET OPEN/CLOSE ---

function openSheet() {
  const overlay = document.getElementById("c-sheet-overlay");
  const sheet = document.getElementById("c-sheet");
  overlay.classList.remove("opacity-0", "pointer-events-none");
  overlay.classList.add("opacity-100", "pointer-events-auto");
  sheet.classList.remove("translate-y-full");
  sheet.classList.add("translate-y-0");
}

function closeSheet() {
  viewState.sheetMode = null;
  viewState.selectedCustomer = null;
  const overlay = document.getElementById("c-sheet-overlay");
  const sheet = document.getElementById("c-sheet");
  overlay.classList.add("opacity-0", "pointer-events-none");
  overlay.classList.remove("opacity-100", "pointer-events-auto");
  sheet.classList.add("translate-y-full");
  sheet.classList.remove("translate-y-0");
}

function openAddSheet() {
  viewState.selectedCustomer = null;
  openFormSheet(null);
  openSheet();
}

// --- ARCHIVE MODAL ---

function openArchiveModal(customer) {
  viewState.archiveTarget = customer;
  document.getElementById("c-archive-text").textContent =
    `"${customer.name}" will be hidden from the customer list.`;
  const modal = document.getElementById("c-archive-modal");
  modal.classList.remove("opacity-0", "pointer-events-none");
  modal.classList.add("opacity-100", "pointer-events-auto");
}

function closeArchiveModal() {
  viewState.archiveTarget = null;
  const modal = document.getElementById("c-archive-modal");
  modal.classList.add("opacity-0", "pointer-events-none");
  modal.classList.remove("opacity-100", "pointer-events-auto");
}

async function confirmArchive() {
  if (!viewState.archiveTarget) return;
  const btn = document.getElementById("c-archive-confirm");
  btn.disabled = true;
  btn.textContent = "Archiving...";
  const result = await CustomerService.archive(viewState.archiveTarget.id);
  btn.disabled = false;
  btn.textContent = "Archive";
  if (result.success) {
    closeArchiveModal();
    showToast("Customer archived");
    await loadCustomers();
  } else {
    showToast(result.error, "error");
  }
}

// --- EVENT DELEGATION ---

document.addEventListener("click", (e) => {
  if (e.target.closest("#c-fab")) {
    e.preventDefault();
    openAddSheet();
    return;
  }
  if (e.target.closest("#c-sheet-overlay")) {
    closeSheet();
    return;
  }
  if (e.target.closest("#c-archive-cancel")) {
    closeArchiveModal();
    return;
  }
  if (e.target.closest("#c-archive-confirm")) {
    confirmArchive();
    return;
  }
  if (e.target.id === "c-archive-modal") {
    closeArchiveModal();
    return;
  }

  const tab = e.target.closest(".filter-tab");
  if (tab && tab.closest("#c-list") === null) {
    // Only handle tabs within the customers view
    const listContainer = document.getElementById("c-list");
    if (listContainer && tab.closest(".p-4") === listContainer.parentElement) {
      viewState.activeFilter = tab.dataset.filter;
      document.querySelectorAll(".filter-tab").forEach((t) => {
        t.classList.toggle(
          "active",
          t.dataset.filter === viewState.activeFilter,
        );
      });
      loadCustomers();
    }
    return;
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "c-search") {
    debounce(() => {
      viewState.searchTerm = e.target.value;
      loadCustomers();
    }, 250)();
  }
});

function escapeHtml(str) {
  if (!str) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

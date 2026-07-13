/**
 * suppliersView.js — Supplier list, detail, add, edit, archive.
 *
 * Structurally identical to customersView, separated for clarity.
 * Balance here = amount the store owes the supplier.
 */

import SupplierService from "../services/supplierService.js";
import { formatCurrency, debounce } from "../utils/helpers.js";
import { updateHeader, updateNav, showToast } from "./viewHelpers.js";

const viewState = {
  suppliers: [],
  activeFilter: "all",
  searchTerm: "",
  selectedSupplier: null,
  sheetMode: null,
  archiveTarget: null,
  loading: false,
};

export async function renderSuppliers(mount) {
  updateHeader("Suppliers");
  updateNav("suppliers");
  viewState.suppliers = [];
  viewState.searchTerm = "";
  viewState.activeFilter = "all";
  viewState.selectedSupplier = null;
  viewState.sheetMode = null;
  mount.innerHTML = buildShell();
  await loadSuppliers();
}

async function loadSuppliers() {
  viewState.loading = true;
  renderList();

  const result = await SupplierService.getAll({
    activeOnly: true,
    debtorsOnly: viewState.activeFilter === "dues",
    search: viewState.searchTerm,
  });

  if (result.success) {
    viewState.suppliers = result.data;
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
                <button class="s-filter-tab" data-filter="all">All</button>
                <button class="s-filter-tab" data-filter="dues">With Dues</button>
            </div>
            <style>
                .s-filter-tab {
                    padding: 6px 14px; border-radius: 20px; font-size: 13px;
                    font-weight: 600; border: 1.5px solid #E7E5E4; background: white;
                    color: #78716C; transition: all 0.15s ease; cursor: pointer;
                    font-family: 'DM Sans', sans-serif;
                }
                .s-filter-tab.active { color: white; border-color: transparent; background: #B45309; }
            </style>
            <div class="relative">
                <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"></i>
                <input id="s-search" type="text" inputmode="text" autocomplete="off"
                    placeholder="Search by name or phone..."
                    class="w-full h-10 pl-10 pr-4 bg-white border border-stone-200 rounded-lg
                           text-sm text-stone-900 placeholder-stone-400
                           focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700"
                    style="font-size:16px;">
            </div>
            <p id="s-count" class="text-xs text-stone-500 px-1"></p>
            <div id="s-list" class="space-y-2"></div>
        </div>
        <button id="s-fab"
            class="fixed z-20 w-14 h-14 rounded-full shadow-lg flex items-center justify-center
                   text-white hover:opacity-90 active:scale-95 transition-transform"
            style="bottom:calc(68px + env(safe-area-inset-bottom, 0px)); right:16px; background:#B45309;">
            <i data-lucide="plus" class="w-6 h-6"></i>
        </button>
        <div id="s-sheet-overlay" class="fixed inset-0 bg-black/40 z-40 opacity-0
            pointer-events-none transition-opacity duration-200"></div>
        <div id="s-sheet" class="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-40
            transform translate-y-full"
            style="transition:transform 0.25s cubic-bezier(0.32,0.72,0,1);
                   max-height:80vh; overflow-y:auto;
                   padding-bottom:env(safe-area-inset-bottom,16px);">
            <div class="sticky top-0 bg-white pt-3 pb-1 px-5 z-10">
                <div class="flex justify-center mb-3">
                    <div class="w-9 h-1 bg-stone-300 rounded-full"></div>
                </div>
                <h2 id="s-sheet-title" class="text-lg font-bold text-stone-900"></h2>
            </div>
            <div id="s-sheet-body" class="px-5 pb-5"></div>
        </div>
        <div id="s-archive-modal" class="fixed inset-0 bg-black/40 z-50 flex items-center
            justify-center px-6 opacity-0 pointer-events-none transition-opacity duration-200">
            <div class="bg-white rounded-xl w-full max-w-xs p-6 shadow-xl">
                <h3 class="text-lg font-bold text-stone-900 mb-2">Archive Supplier?</h3>
                <p id="s-archive-text" class="text-sm text-stone-500 mb-5"></p>
                <div class="flex gap-3">
                    <button id="s-archive-cancel" class="flex-1 h-11 border border-stone-300
                        rounded-lg text-sm font-semibold text-stone-700 hover:bg-stone-50
                        transition-colors">Cancel</button>
                    <button id="s-archive-confirm" class="flex-1 h-11 bg-red-600 hover:bg-red-700
                        rounded-lg text-sm font-semibold text-white transition-colors">
                        Archive</button>
                </div>
            </div>
        </div>
    `;
}

function renderList() {
  const listEl = document.getElementById("s-list");
  if (!listEl) return;

  if (viewState.loading) {
    listEl.innerHTML = `<div class="text-center py-12">
            <div class="inline-block w-6 h-6 border-2 border-amber-700 border-t-transparent
                        rounded-full animate-spin"></div>
            <p class="text-sm text-stone-400 mt-3">Loading...</p></div>`;
    return;
  }

  if (viewState.suppliers.length === 0) {
    const isSearching = viewState.searchTerm.trim().length > 0;
    listEl.innerHTML = `<div class="text-center py-12">
            <i data-lucide="${isSearching ? "search-x" : "truck"}" class="w-12 h-12 text-stone-300 mx-auto mb-3"></i>
            <p class="text-sm font-semibold text-stone-600">${isSearching ? 'No suppliers match "' + escapeHtml(viewState.searchTerm) + '"' : "No suppliers yet"}</p>
            <p class="text-xs text-stone-400 mt-1">${isSearching ? "Try a different search" : "Tap + to add your first supplier"}</p></div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  listEl.innerHTML = viewState.suppliers
    .map((s) => {
      const hasDues = s.balance > 0;
      return `
        <div class="supplier-card bg-white rounded-xl border border-stone-200 p-3.5
                    active:bg-stone-50 cursor-pointer transition-colors" data-id="${s.id}">
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-semibold text-stone-900 truncate">${escapeHtml(s.name)}</h3>
                    ${s.phone ? `<p class="text-xs text-stone-500 mt-0.5">${escapeHtml(s.phone)}</p>` : ""}
                </div>
                <div class="text-right flex-shrink-0">
                    <span class="text-sm font-bold ${hasDues ? "text-red-600" : "text-stone-400"}">
                        ${formatCurrency(s.balance)}
                    </span>
                    ${hasDues ? `<p class="text-[10px] text-red-500 font-medium">WE OWE</p>` : ""}
                </div>
            </div>
        </div>`;
    })
    .join("");

  listEl.querySelectorAll(".supplier-card").forEach((card) => {
    card.addEventListener("click", () => {
      const s = viewState.suppliers.find((x) => x.id === card.dataset.id);
      if (s) openDetailSheet(s);
    });
  });
}

function renderCount() {
  const el = document.getElementById("s-count");
  if (!el) return;
  const n = viewState.suppliers.length;
  el.textContent = n === 1 ? "1 supplier" : `${n} suppliers`;
}

function openDetailSheet(supplier) {
  viewState.selectedSupplier = supplier;
  viewState.sheetMode = "detail";
  document.getElementById("s-sheet-title").textContent = "Supplier Details";
  const hasDues = supplier.balance > 0;
  const body = document.getElementById("s-sheet-body");
  body.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="truck" class="w-5 h-5 text-amber-700"></i>
                </div>
                <div class="min-w-0">
                    <h3 class="text-base font-bold text-stone-900 truncate">${escapeHtml(supplier.name)}</h3>
                    ${supplier.phone ? `<p class="text-sm text-stone-500">${escapeHtml(supplier.phone)}</p>` : '<p class="text-sm text-stone-400">No phone</p>'}
                </div>
            </div>
            ${supplier.address ? `<div><p class="text-xs font-medium text-stone-500 mb-1">Address</p><p class="text-sm text-stone-800">${escapeHtml(supplier.address)}</p></div>` : ""}
            <div class="p-4 rounded-lg ${hasDues ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}">
                <p class="text-xs font-medium ${hasDues ? "text-red-500" : "text-green-600"} mb-1">Outstanding Balance</p>
                <p class="text-2xl font-bold ${hasDues ? "text-red-700" : "text-green-700"}">${formatCurrency(supplier.balance)}</p>
                ${hasDues ? '<p class="text-xs text-red-500 mt-1">We owe this amount to the supplier</p>' : '<p class="text-xs text-green-600 mt-1">No pending balance</p>'}
            </div>
            <button id="s-edit-btn" class="w-full h-11 bg-amber-700 hover:bg-amber-800 text-white
                font-semibold rounded-lg text-sm transition-colors">Edit Details</button>
            <button id="s-archive-btn" class="w-full h-11 border ${hasDues ? "border-stone-200 text-stone-400 cursor-not-allowed" : "border-red-200 text-red-600 hover:bg-red-50"}
                font-semibold rounded-lg text-sm transition-colors" ${hasDues ? "disabled" : ""}>
                ${hasDues ? "Cannot Archive (Has Balance)" : "Archive Supplier"}
            </button>
            ${hasDues ? '<p class="text-[11px] text-stone-400 text-center">Settle the outstanding balance before archiving</p>' : '<p class="text-[11px] text-stone-400 text-center">Archived suppliers won\'t appear in lists</p>'}
        </div>
    `;
  if (window.lucide) lucide.createIcons();

  document.getElementById("s-edit-btn").addEventListener("click", () => {
    openFormSheet(supplier);
  });

  if (!hasDues) {
    document.getElementById("s-archive-btn").addEventListener("click", () => {
      closeSheet();
      openArchiveModal(supplier);
    });
  }
}

function openFormSheet(supplier) {
  viewState.sheetMode = "form";
  viewState.selectedSupplier = supplier;
  const isEdit = !!supplier;
  document.getElementById("s-sheet-title").textContent = isEdit
    ? "Edit Supplier"
    : "Add Supplier";

  const body = document.getElementById("s-sheet-body");
  body.innerHTML = `
        <div class="space-y-4">
            <div id="s-form-error" class="hidden p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"></div>
            <div>
                <label class="block text-sm font-medium text-stone-700 mb-1">Name <span class="text-red-500">*</span></label>
                <input id="sf-name" type="text" inputmode="text"
                    value="${supplier ? escapeHtml(supplier.name) : ""}"
                    placeholder="Supplier name"
                    class="w-full h-11 px-3 border border-stone-300 rounded-lg text-stone-900
                           text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                           focus:border-amber-700" style="font-size:16px;">
            </div>
            <div>
                <label class="block text-sm font-medium text-stone-700 mb-1">Phone</label>
                <input id="sf-phone" type="tel" inputmode="tel"
                    value="${supplier && supplier.phone ? escapeHtml(supplier.phone) : ""}"
                    placeholder="e.g. 01912-345678"
                    class="w-full h-11 px-3 border border-stone-300 rounded-lg text-stone-900
                           text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                           focus:border-amber-700" style="font-size:16px;">
            </div>
            <div>
                <label class="block text-sm font-medium text-stone-700 mb-1">Address</label>
                <textarea id="sf-address" rows="2"
                    placeholder="Warehouse or office address"
                    class="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900
                           text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                           focus:border-amber-700 resize-none" style="font-size:16px;">${supplier && supplier.address ? escapeHtml(supplier.address) : ""}</textarea>
            </div>
            ${
              isEdit
                ? `
                <div class="p-3 bg-stone-50 rounded-lg">
                    <p class="text-xs text-stone-500">Balance (updated by transactions only)</p>
                    <p class="text-base font-bold text-stone-900 mt-0.5">${formatCurrency(supplier.balance)}</p>
                </div>
            `
                : ""
            }
            <button id="sf-submit" class="w-full h-12 bg-amber-700 hover:bg-amber-800 text-white
                font-semibold rounded-lg text-sm transition-colors disabled:opacity-50">
                ${isEdit ? "Update Supplier" : "Add Supplier"}
            </button>
        </div>
    `;

  document
    .getElementById("sf-submit")
    .addEventListener("click", handleFormSubmit);
  document.getElementById("sf-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("sf-phone").focus();
    }
  });
}

async function handleFormSubmit() {
  const errEl = document.getElementById("s-form-error");
  const btn = document.getElementById("sf-submit");
  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Saving...";

  const data = {
    name: document.getElementById("sf-name").value,
    phone: document.getElementById("sf-phone").value,
    address: document.getElementById("sf-address").value,
  };

  let result;
  if (viewState.selectedSupplier) {
    result = await SupplierService.update(viewState.selectedSupplier.id, data);
  } else {
    result = await SupplierService.create(data);
  }

  btn.disabled = false;
  btn.textContent = viewState.selectedSupplier
    ? "Update Supplier"
    : "Add Supplier";

  if (result.success) {
    closeSheet();
    showToast(
      viewState.selectedSupplier ? "Supplier updated" : "Supplier added",
    );
    await loadSuppliers();
  } else {
    errEl.textContent = result.error;
    errEl.classList.remove("hidden");
  }
}

function openSheet() {
  const overlay = document.getElementById("s-sheet-overlay");
  const sheet = document.getElementById("s-sheet");
  overlay.classList.remove("opacity-0", "pointer-events-none");
  overlay.classList.add("opacity-100", "pointer-events-auto");
  sheet.classList.remove("translate-y-full");
  sheet.classList.add("translate-y-0");
}

function closeSheet() {
  viewState.sheetMode = null;
  viewState.selectedSupplier = null;
  const overlay = document.getElementById("s-sheet-overlay");
  const sheet = document.getElementById("s-sheet");
  overlay.classList.add("opacity-0", "pointer-events-none");
  overlay.classList.remove("opacity-100", "pointer-events-auto");
  sheet.classList.add("translate-y-full");
  sheet.classList.remove("translate-y-0");
}

function openAddSheet() {
  viewState.selectedSupplier = null;
  openFormSheet(null);
  openSheet();
}

function openArchiveModal(supplier) {
  viewState.archiveTarget = supplier;
  document.getElementById("s-archive-text").textContent =
    `"${supplier.name}" will be hidden from the supplier list.`;
  const modal = document.getElementById("s-archive-modal");
  modal.classList.remove("opacity-0", "pointer-events-none");
  modal.classList.add("opacity-100", "pointer-events-auto");
}

function closeArchiveModal() {
  viewState.archiveTarget = null;
  const modal = document.getElementById("s-archive-modal");
  modal.classList.add("opacity-0", "pointer-events-none");
  modal.classList.remove("opacity-100", "pointer-events-auto");
}

async function confirmArchive() {
  if (!viewState.archiveTarget) return;
  const btn = document.getElementById("s-archive-confirm");
  btn.disabled = true;
  btn.textContent = "Archiving...";
  const result = await SupplierService.archive(viewState.archiveTarget.id);
  btn.disabled = false;
  btn.textContent = "Archive";
  if (result.success) {
    closeArchiveModal();
    showToast("Supplier archived");
    await loadSuppliers();
  } else {
    showToast(result.error, "error");
  }
}

document.addEventListener("click", (e) => {
  if (e.target.closest("#s-fab")) {
    e.preventDefault();
    openAddSheet();
    return;
  }
  if (e.target.closest("#s-sheet-overlay")) {
    closeSheet();
    return;
  }
  if (e.target.closest("#s-archive-cancel")) {
    closeArchiveModal();
    return;
  }
  if (e.target.closest("#s-archive-confirm")) {
    confirmArchive();
    return;
  }
  if (e.target.id === "s-archive-modal") {
    closeArchiveModal();
    return;
  }

  const tab = e.target.closest(".s-filter-tab");
  if (tab) {
    viewState.activeFilter = tab.dataset.filter;
    document.querySelectorAll(".s-filter-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.filter === viewState.activeFilter);
    });
    loadSuppliers();
    return;
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "s-search") {
    debounce(() => {
      viewState.searchTerm = e.target.value;
      loadSuppliers();
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

/**
 * productsView.js — Complete product management UI.
 *
 * Mobile-first. Designed for thumbs.
 *
 * Layout:
 *   - Category filter tabs (All | Poultry | Fish | Cow)
 *   - Search bar with debounce
 *   - Product count
 *   - Product cards with category color strip
 *   - FAB for adding new product
 *   - Bottom sheet form for add/edit
 *   - Archive confirmation modal
 */

import ProductService from "../services/productService.js";
import db from "../db/schema.js";
import { CATEGORY_COLORS } from "../config.js";
import {
  formatCurrency,
  formatNumber,
  debounce,
  toBool,
} from "../utils/helpers.js";
import { updateHeader, updateNav, showToast } from "./viewHelpers.js";

// ============================================================
// VIEW STATE
// ============================================================

const viewState = {
  products: [],
  categories: [],
  activeFilter: "all",
  searchTerm: "",
  editingProduct: null,
  sheetOpen: false,
  archiveTarget: null,
  loading: false,
};

// ============================================================
// MAIN RENDER (called by router)
// ============================================================

export async function renderProducts(mount) {
  updateHeader("Products");
  updateNav("products");

  // Reset state
  viewState.products = [];
  viewState.searchTerm = "";
  viewState.activeFilter = "all";
  viewState.editingProduct = null;
  viewState.sheetOpen = false;
  viewState.archiveTarget = null;

  // Load categories
  viewState.categories = await db.categories
    .where("is_active")
    .equals(1)
    .toArray();

  // Render shell
  mount.innerHTML = buildShell();

  // Load and render products
  await loadProducts();
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadProducts() {
  viewState.loading = true;
  renderList();

  const result = await ProductService.getAll({
    categoryId:
      viewState.activeFilter === "all" ? null : viewState.activeFilter,
    activeOnly: true,
    search: viewState.searchTerm,
  });

  if (result.success) {
    viewState.products = result.data;
  } else {
    showToast(result.error, "error");
  }

  viewState.loading = false;
  renderList();
  renderCount();
}

// ============================================================
// SHELL HTML
// ============================================================

function buildShell() {
  const tabs = buildFilterTabs();

  return `
        <div class="p-4 space-y-3">
            ${tabs}

            <div class="relative">
                <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"></i>
                <input id="p-search" type="text" inputmode="text" autocomplete="off"
                    placeholder="Search by name or brand..."
                    class="w-full h-10 pl-10 pr-4 bg-white border border-stone-200 rounded-lg
                           text-sm text-stone-900 placeholder-stone-400
                           focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700"
                    style="font-size:16px;">
            </div>

            <p id="p-count" class="text-xs text-stone-500 px-1"></p>

            <div id="p-list" class="space-y-2"></div>
        </div>

        <!-- FAB -->
        <button id="p-fab"
            class="fixed z-20 w-14 h-14 rounded-full shadow-lg flex items-center
                   justify-center text-white hover:opacity-90 active:scale-95
                   transition-transform"
            style="bottom:calc(68px + env(safe-area-inset-bottom, 0px)); right:16px;
                   background:#B45309;">
            <i data-lucide="plus" class="w-6 h-6"></i>
        </button>

        <!-- Form Sheet Overlay -->
        <div id="p-sheet-overlay" class="fixed inset-0 bg-black/40 z-40 opacity-0
            pointer-events-none transition-opacity duration-200"></div>

        <!-- Form Sheet -->
        <div id="p-sheet" class="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-40
            transform translate-y-full transition-transform duration-250"
            style="transition:transform 0.25s cubic-bezier(0.32,0.72,0,1);
                   max-height:80vh; overflow-y:auto;
                   padding-bottom:env(safe-area-inset-bottom,16px);">
            <div class="sticky top-0 bg-white pt-3 pb-1 px-5 z-10">
                <div class="flex justify-center mb-3">
                    <div class="w-9 h-1 bg-stone-300 rounded-full"></div>
                </div>
                <h2 id="p-sheet-title" class="text-lg font-bold text-stone-900">Add Product</h2>
            </div>
            <div id="p-sheet-body" class="px-5 pb-5 space-y-4"></div>
        </div>

        <!-- Archive Modal -->
        <div id="p-archive-modal" class="fixed inset-0 bg-black/40 z-50 flex items-center
            justify-center px-6 opacity-0 pointer-events-none transition-opacity duration-200">
            <div class="bg-white rounded-xl w-full max-w-xs p-6 shadow-xl">
                <h3 class="text-lg font-bold text-stone-900 mb-2">Archive Product?</h3>
                <p id="p-archive-name" class="text-sm text-stone-500 mb-5"></p>
                <div class="flex gap-3">
                    <button id="p-archive-cancel" class="flex-1 h-11 border border-stone-300
                        rounded-lg text-sm font-semibold text-stone-700 hover:bg-stone-50
                        transition-colors">Cancel</button>
                    <button id="p-archive-confirm" class="flex-1 h-11 bg-red-600 hover:bg-red-700
                        rounded-lg text-sm font-semibold text-white transition-colors">
                        Archive</button>
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// FILTER TABS
// ============================================================

function buildFilterTabs() {
  const allCount = ""; // Count shown separately
  let tabs = `<button class="filter-tab" data-filter="all">All</button>`;

  for (const cat of viewState.categories) {
    tabs += `<button class="filter-tab" data-filter="${cat.id}">${cat.name.replace(" Feed", "")}</button>`;
  }

  return `
        <div class="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar" style="-ms-overflow-style:none;scrollbar-width:none;">
            ${tabs}
        </div>
        <style>
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .filter-tab {
                flex-shrink: 0;
                padding: 6px 14px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                border: 1.5px solid #E7E5E4;
                background: white;
                color: #78716C;
                transition: all 0.15s ease;
                cursor: pointer;
                font-family: 'DM Sans', sans-serif;
            }
            .filter-tab.active {
                color: white;
                border-color: transparent;
            }
        </style>
    `;
}

function updateFilterTabs() {
  document.querySelectorAll(".filter-tab").forEach((btn) => {
    const filter = btn.dataset.filter;
    const isActive = filter === viewState.activeFilter;

    btn.classList.toggle("active", isActive);

    if (isActive) {
      if (filter === "all") {
        btn.style.background = "#B45309";
        btn.style.borderColor = "transparent";
      } else {
        const cat = viewState.categories.find((c) => c.id === filter);
        btn.style.background = cat ? cat.color : "#B45309";
        btn.style.borderColor = "transparent";
      }
    } else {
      btn.style.background = "white";
      btn.style.borderColor = "#E7E5E4";
    }
  });
}

// ============================================================
// PRODUCT LIST
// ============================================================

function renderList() {
  const listEl = document.getElementById("p-list");
  if (!listEl) return;

  if (viewState.loading) {
    listEl.innerHTML = `
            <div class="text-center py-12">
                <div class="inline-block w-6 h-6 border-2 border-amber-700 border-t-transparent
                            rounded-full animate-spin"></div>
                <p class="text-sm text-stone-400 mt-3">Loading products...</p>
            </div>
        `;
    return;
  }

  if (viewState.products.length === 0) {
    const isSearching = viewState.searchTerm.trim().length > 0;
    listEl.innerHTML = `
            <div class="text-center py-12">
                <i data-lucide="${isSearching ? "search-x" : "package"}" class="w-12 h-12 text-stone-300 mx-auto mb-3"></i>
                <p class="text-sm font-semibold text-stone-600">
                    ${isSearching ? 'No products match "' + escapeHtml(viewState.searchTerm) + '"' : "No products yet"}
                </p>
                <p class="text-xs text-stone-400 mt-1">
                    ${isSearching ? "Try a different search term" : "Tap the + button to add your first feed product"}
                </p>
            </div>
        `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  listEl.innerHTML = viewState.products
    .map((p) => buildProductCard(p))
    .join("");
  if (window.lucide) lucide.createIcons();

  // Attach click handlers to cards
  listEl.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const product = viewState.products.find((p) => p.id === id);
      if (product) openEditSheet(product);
    });
  });
}

function buildProductCard(p) {
  const catColor = p.category ? p.category.color : "#A8A29E";
  const catName = p.category ? p.category.name.replace(" Feed", "") : "";
  const brandText = p.brand ? escapeHtml(p.brand) : "";
  const isLowStock =
    p.min_stock_level > 0 && p.stock_quantity <= p.min_stock_level;

  const metaParts = [];
  if (brandText) metaParts.push(brandText);
  if (catName) metaParts.push(catName);

  return `
        <div class="product-card bg-white rounded-xl border border-stone-200 overflow-hidden
                    active:bg-stone-50 cursor-pointer transition-colors"
             style="border-left:3px solid ${catColor};" data-id="${p.id}">
            <div class="p-3.5">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                        <h3 class="text-sm font-semibold text-stone-900 truncate">${escapeHtml(p.name)}</h3>
                        ${
                          metaParts.length > 0
                            ? `
                            <p class="text-xs text-stone-500 mt-0.5 truncate">${metaParts.join(" · ")}</p>
                        `
                            : ""
                        }
                    </div>
                    <span class="text-sm font-bold text-stone-900 whitespace-nowrap">
                        ${formatCurrency(p.selling_price)}
                    </span>
                </div>
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                    <span class="text-xs ${isLowStock ? "text-red-600 font-semibold" : "text-stone-500"}">
                        ${formatNumber(p.stock_quantity)} ${p.unit}
                    </span>
                    <span class="text-xs text-stone-300">·</span>
                    <span class="text-xs text-stone-500">Cost ${formatCurrency(p.cost_price)}</span>
                    ${
                      isLowStock
                        ? `
                        <span class="inline-flex items-center gap-1 ml-auto px-2 py-0.5
                                     bg-red-50 text-red-600 rounded text-[11px] font-semibold">
                            <i data-lucide="alert-triangle" class="w-3 h-3"></i> Low
                        </span>
                    `
                        : ""
                    }
                </div>
            </div>
        </div>
    `;
}

function renderCount() {
  const el = document.getElementById("p-count");
  if (!el) return;
  const n = viewState.products.length;
  el.textContent = n === 1 ? "1 product" : `${n} products`;
}

// ============================================================
// FORM SHEET
// ============================================================

function openAddSheet() {
  viewState.editingProduct = null;
  document.getElementById("p-sheet-title").textContent = "Add Product";
  renderFormBody(null);
  openSheet();
}

function openEditSheet(product) {
  viewState.editingProduct = product;
  document.getElementById("p-sheet-title").textContent = "Edit Product";
  renderFormBody(product);
  openSheet();
}

function renderFormBody(product) {
  const body = document.getElementById("p-sheet-body");
  const isEdit = !!product;

  const catOptions = viewState.categories
    .map(
      (c) =>
        `<option value="${c.id}" ${product && product.category_id === c.id ? "selected" : ""}>
            ${c.name}
        </option>`,
    )
    .join("");

  body.innerHTML = `
        <div id="p-form-error" class="hidden p-3 bg-red-50 border border-red-200
            rounded-lg text-red-700 text-sm"></div>

        <div>
            <label class="block text-sm font-medium text-stone-700 mb-1">
                Product Name <span class="text-red-500">*</span>
            </label>
            <input id="pf-name" type="text" inputmode="text"
                value="${product ? escapeHtml(product.name) : ""}"
                placeholder="e.g. Broiler Feed"
                class="w-full h-11 px-3 border border-stone-300 rounded-lg text-stone-900
                       text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                       focus:border-amber-700" style="font-size:16px;">
        </div>

        <div>
            <label class="block text-sm font-medium text-stone-700 mb-1">
                Category <span class="text-red-500">*</span>
            </label>
            <select id="pf-category"
                class="w-full h-11 px-3 border border-stone-300 rounded-lg text-stone-900
                       text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                       focus:border-amber-700 bg-white" style="font-size:16px;">
                <option value="">Select category</option>
                ${catOptions}
            </select>
        </div>

        <div>
            <label class="block text-sm font-medium text-stone-700 mb-1">Brand</label>
            <input id="pf-brand" type="text" inputmode="text"
                value="${product && product.brand ? escapeHtml(product.brand) : ""}"
                placeholder="e.g. CP Bangladesh (optional)"
                class="w-full h-11 px-3 border border-stone-300 rounded-lg text-stone-900
                       text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                       focus:border-amber-700" style="font-size:16px;">
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-sm font-medium text-stone-700 mb-1">
                    Cost Price <span class="text-red-500">*</span>
                </label>
                <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-500
                                 pointer-events-none">৳</span>
                    <input id="pf-cost" type="text" inputmode="decimal"
                        value="${product ? product.cost_price : ""}"
                        placeholder="0"
                        class="w-full h-11 pl-8 pr-3 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-stone-700 mb-1">
                    Selling Price <span class="text-red-500">*</span>
                </label>
                <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-500
                                 pointer-events-none">৳</span>
                    <input id="pf-selling" type="text" inputmode="decimal"
                        value="${product ? product.selling_price : ""}"
                        placeholder="0"
                        class="w-full h-11 pl-8 pr-3 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-sm font-medium text-stone-700 mb-1">Current Stock</label>
                <div class="relative">
                    <input id="pf-stock" type="text" inputmode="decimal"
                        value="${product ? product.stock_quantity : ""}"
                        placeholder="0"
                        class="w-full h-11 px-3 pr-10 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500
                                 pointer-events-none">KG</span>
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-stone-700 mb-1">Low Stock Alert</label>
                <div class="relative">
                    <input id="pf-minstock" type="text" inputmode="decimal"
                        value="${product ? product.min_stock_level : ""}"
                        placeholder="0"
                        class="w-full h-11 px-3 pr-10 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500
                                 pointer-events-none">KG</span>
                </div>
            </div>
        </div>

        <button id="pf-submit"
            class="w-full h-12 bg-amber-700 hover:bg-amber-800 text-white font-semibold
                   rounded-lg text-sm transition-colors disabled:opacity-50 mt-2">
            ${isEdit ? "Update Product" : "Add Product"}
        </button>

        ${
          isEdit
            ? `
            <button id="pf-archive"
                class="w-full h-11 border border-red-200 text-red-600 hover:bg-red-50
                       font-semibold rounded-lg text-sm transition-colors">
                Archive This Product
            </button>
            <p class="text-[11px] text-stone-400 text-center">
                Archived products won't appear in lists but remain in records
            </p>
        `
            : ""
        }
    `;

  // Submit handler
  document
    .getElementById("pf-submit")
    .addEventListener("click", handleFormSubmit);

  // Archive handler (edit mode only)
  if (isEdit) {
    document.getElementById("pf-archive").addEventListener("click", () => {
      closeSheet();
      openArchiveModal(product);
    });
  }

  // Enter key on name field moves to category
  document.getElementById("pf-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("pf-category").focus();
    }
  });
}

async function handleFormSubmit() {
  const errEl = document.getElementById("p-form-error");
  const btn = document.getElementById("pf-submit");
  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Saving...";

  const data = {
    name: document.getElementById("pf-name").value,
    category_id: document.getElementById("pf-category").value,
    brand: document.getElementById("pf-brand").value,
    cost_price: document.getElementById("pf-cost").value,
    selling_price: document.getElementById("pf-selling").value,
    stock_quantity: document.getElementById("pf-stock").value,
    min_stock_level: document.getElementById("pf-minstock").value,
    unit: "KG",
  };

  let result;
  if (viewState.editingProduct) {
    result = await ProductService.update(viewState.editingProduct.id, data);
  } else {
    result = await ProductService.create(data);
  }

  btn.disabled = false;
  btn.textContent = viewState.editingProduct ? "Update Product" : "Add Product";

  if (result.success) {
    closeSheet();
    showToast(viewState.editingProduct ? "Product updated" : "Product added");
    await loadProducts();
  } else {
    errEl.textContent = result.error;
    errEl.classList.remove("hidden");
  }
}

// ============================================================
// SHEET OPEN / CLOSE
// ============================================================

function openSheet() {
  viewState.sheetOpen = true;
  const overlay = document.getElementById("p-sheet-overlay");
  const sheet = document.getElementById("p-sheet");
  overlay.classList.remove("opacity-0", "pointer-events-none");
  overlay.classList.add("opacity-100", "pointer-events-auto");
  sheet.classList.remove("translate-y-full");
  sheet.classList.add("translate-y-0");
}

function closeSheet() {
  viewState.sheetOpen = false;
  const overlay = document.getElementById("p-sheet-overlay");
  const sheet = document.getElementById("p-sheet");
  overlay.classList.add("opacity-0", "pointer-events-none");
  overlay.classList.remove("opacity-100", "pointer-events-auto");
  sheet.classList.add("translate-y-full");
  sheet.classList.remove("translate-y-0");
}

// ============================================================
// ARCHIVE MODAL
// ============================================================

function openArchiveModal(product) {
  viewState.archiveTarget = product;
  document.getElementById("p-archive-name").textContent =
    `"${product.name}" will be hidden from product lists. Existing transactions will not be affected.`;
  const modal = document.getElementById("p-archive-modal");
  modal.classList.remove("opacity-0", "pointer-events-none");
  modal.classList.add("opacity-100", "pointer-events-auto");
}

function closeArchiveModal() {
  viewState.archiveTarget = null;
  const modal = document.getElementById("p-archive-modal");
  modal.classList.add("opacity-0", "pointer-events-none");
  modal.classList.remove("opacity-100", "pointer-events-auto");
}

async function confirmArchive() {
  if (!viewState.archiveTarget) return;
  const btn = document.getElementById("p-archive-confirm");
  btn.disabled = true;
  btn.textContent = "Archiving...";

  const result = await ProductService.archive(viewState.archiveTarget.id);
  btn.disabled = false;
  btn.textContent = "Archive";

  if (result.success) {
    closeArchiveModal();
    showToast("Product archived");
    await loadProducts();
  } else {
    showToast(result.error, "error");
  }
}

// ============================================================
// EVENT DELEGATION
// ============================================================

document.addEventListener("click", (e) => {
  // FAB
  if (e.target.closest("#p-fab")) {
    e.preventDefault();
    openAddSheet();
    return;
  }

  // Sheet overlay close
  if (e.target.closest("#p-sheet-overlay")) {
    closeSheet();
    return;
  }

  // Archive cancel
  if (e.target.closest("#p-archive-cancel")) {
    closeArchiveModal();
    return;
  }

  // Archive confirm
  if (e.target.closest("#p-archive-confirm")) {
    confirmArchive();
    return;
  }

  // Archive modal overlay
  if (e.target.id === "p-archive-modal") {
    closeArchiveModal();
    return;
  }

  // Filter tabs
  const tab = e.target.closest(".filter-tab");
  if (tab) {
    viewState.activeFilter = tab.dataset.filter;
    updateFilterTabs();
    loadProducts();
    return;
  }
});

// Search input with debounce
document.addEventListener("input", (e) => {
  if (e.target.id === "p-search") {
    const debounced = debounce(() => {
      viewState.searchTerm = e.target.value;
      loadProducts();
    }, 250);
    debounced();
  }
});

// ============================================================
// UTILITY
// ============================================================

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

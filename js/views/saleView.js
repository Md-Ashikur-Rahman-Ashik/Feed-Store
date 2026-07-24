/**
 * saleView.js — THE CRITICAL PATH UI.
 *
 * Single-page sale form. No wizard. No steps. Everything visible.
 * Optimized for speed: fewest taps to complete a sale.
 *
 * Layout:
 *   1. Customer selection (search dropdown, optional)
 *   2. Items list + product search + inline add form
 *   3. Payment section (subtotal, discount, method, amounts)
 *   4. Fixed "Complete Sale" button above bottom nav
 *   5. Success screen (replaces form on completion)
 */

import SaleService from "../services/saleService.js";
import CustomerService from "../services/customerService.js";
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
// STATE
// ============================================================

const S = {
  mode: "form", // 'form' | 'success'
  selectedCustomer: null,
  items: [], // [{ uid, productId, productName, categoryColor, quantity, unitPrice, total, unit, maxStock }]
  paymentMethod: "CASH",
  discount: 0,
  amountPaid: 0,
  // Search
  customerResults: [],
  productResults: [],
  showCustDrop: false,
  showProdDrop: false,
  // Inline add form
  addFormProduct: null,
  // Success
  lastTx: null,
  // Loading
  loading: false,
};

let uidCounter = 0;
function nextUid() {
  return "i" + ++uidCounter;
}

// ============================================================
// MAIN RENDER
// ============================================================

export async function renderSale(mount) {
  updateHeader(null);
  updateNav("sale");
  resetState();
  mount.innerHTML = buildShell();
  renderPayment();
  renderSummary();
}

function resetState() {
  S.mode = "form";
  S.selectedCustomer = null;
  S.items = [];
  S.paymentMethod = "CASH";
  S.discount = 0;
  S.amountPaid = 0;
  S.customerResults = [];
  S.productResults = [];
  S.showCustDrop = false;
  S.showProdDrop = false;
  S.addFormProduct = null;
  S.lastTx = null;
  S.loading = false;
  uidCounter = 0;
}

// ============================================================
// SHELL
// ============================================================

function buildShell() {
  return `
        <div id="sale-form" class="pb-24">
            <!-- Customer Section -->
            <div class="p-4 pb-2">
                <div class="flex items-center justify-between mb-2">
                    <h2 class="text-sm font-semibold text-stone-500">CUSTOMER</h2>
                    <button id="sale-clear-cust" class="hidden text-xs text-red-500 font-semibold
                        px-2 py-1 rounded hover:bg-red-50">Clear</button>
                </div>
                <div id="sale-cust-display"></div>
                <div class="relative">
                    <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2
                        w-4 h-4 text-stone-400 pointer-events-none"></i>
                    <input id="sale-cust-search" type="text" inputmode="text" autocomplete="off"
                        placeholder="Search customer by name or phone..."
                        class="w-full h-10 pl-10 pr-4 bg-white border border-stone-200 rounded-lg
                               text-sm text-stone-900 placeholder-stone-400
                               focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700"
                        style="font-size:16px;">
                    <div id="sale-cust-drop" class="hidden absolute left-0 right-0 top-full mt-1
                        bg-white border border-stone-200 rounded-lg shadow-lg z-10
                        max-h-48 overflow-y-auto"></div>
                </div>
                <p id="sale-cust-note" class="text-xs text-stone-400 mt-1.5 px-1">
                    No customer selected — walk-in sale
                </p>
            </div>

            <div class="mx-4 border-t border-stone-200"></div>

            <!-- Items Section -->
            <div class="p-4 pb-2">
                <h2 class="text-sm font-semibold text-stone-500 mb-2">ITEMS</h2>
                <div id="sale-items-list"></div>
                <div class="relative mt-2">
                    <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2
                        w-4 h-4 text-stone-400 pointer-events-none"></i>
                    <input id="sale-prod-search" type="text" inputmode="text" autocomplete="off"
                        placeholder="Search product to add..."
                        class="w-full h-10 pl-10 pr-4 bg-white border border-stone-200 rounded-lg
                               text-sm text-stone-900 placeholder-stone-400
                               focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700"
                        style="font-size:16px;">
                    <div id="sale-prod-drop" class="hidden absolute left-0 right-0 top-full mt-1
                        bg-white border border-stone-200 rounded-lg shadow-lg z-10
                        max-h-48 overflow-y-auto"></div>
                </div>
                <div id="sale-add-form"></div>
            </div>

            <div class="mx-4 border-t border-stone-200"></div>

            <!-- Payment Section -->
            <div id="sale-payment" class="p-4 pb-2"></div>

            <div class="mx-4 border-t border-stone-200"></div>

            <!-- Notes -->
            <div class="p-4 pb-2">
                <label class="block text-sm font-medium text-stone-600 mb-1">Notes (optional)</label>
                <input id="sale-notes" type="text"
                    class="w-full h-10 px-3 bg-white border border-stone-200 rounded-lg
                           text-sm text-stone-900 placeholder-stone-400
                           focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700"
                    style="font-size:16px;" placeholder="Any additional notes...">
            </div>
        </div>

        <!-- Fixed Complete Button -->
        <div id="sale-complete-wrap" class="fixed left-4 right-4 z-20"
            style="bottom:calc(60px + env(safe-area-inset-bottom, 0px) + 12px);">
            <button id="sale-complete-btn"
                class="w-full h-12 rounded-xl text-white font-bold text-base
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors active:scale-[0.98]"
                style="background:#B45309;" disabled>
                Complete Sale · ৳0
            </button>
        </div>

        <!-- Success Screen -->
        <div id="sale-success" class="hidden min-h-screen"></div>
    `;
  if (window.lucide) lucide.createIcons();
}

// ============================================================
// CUSTOMER SECTION
// ============================================================

function renderCustomerDisplay() {
  const el = document.getElementById("sale-cust-display");
  const note = document.getElementById("sale-cust-note");
  const clearBtn = document.getElementById("sale-clear-cust");

  if (S.selectedCustomer) {
    const c = S.selectedCustomer;
    const hasDues = c.balance > 0;
    el.innerHTML = `
            <div class="flex items-center gap-3 p-3 bg-white border border-stone-200 rounded-lg mb-2">
                <div class="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="user" class="w-4 h-4 text-amber-700"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-stone-900 truncate">${escapeHtml(c.name)}</p>
                    <div class="flex items-center gap-2 mt-0.5">
                        ${c.phone ? `<span class="text-xs text-stone-500">${escapeHtml(c.phone)}</span>` : ""}
                        ${hasDues ? `<span class="text-xs text-red-600 font-semibold">Dues: ${formatCurrency(c.balance)}</span>` : ""}
                    </div>
                </div>
            </div>`;
    note.classList.add("hidden");
    clearBtn.classList.remove("hidden");
  } else {
    el.innerHTML = "";
    note.classList.remove("hidden");
    clearBtn.classList.add("hidden");
  }
  if (window.lucide) lucide.createIcons();
}

function renderCustomerDropdown(results) {
  const drop = document.getElementById("sale-cust-drop");
  if (!results || results.length === 0) {
    drop.classList.add("hidden");
    return;
  }
  drop.innerHTML = results
    .map(
      (c) => `
        <button class="cust-drop-item w-full flex items-center gap-3 px-3 py-2.5 text-left
            hover:bg-stone-50 transition-colors" data-id="${c.id}">
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-stone-900 truncate">${escapeHtml(c.name)}</p>
                ${c.phone ? `<p class="text-xs text-stone-500">${escapeHtml(c.phone)}</p>` : ""}
            </div>
            ${c.balance > 0 ? `<span class="text-xs font-semibold text-red-600">${formatCurrency(c.balance)}</span>` : ""}
        </button>
    `,
    )
    .join("");
  drop.classList.remove("hidden");
}

function selectCustomer(customer) {
  S.selectedCustomer = customer;
  S.showCustDrop = false;
  document.getElementById("sale-cust-drop").classList.add("hidden");
  document.getElementById("sale-cust-search").value = "";
  renderCustomerDisplay();
  renderPayment();
  renderSummary();
}

function clearCustomer() {
  S.selectedCustomer = null;
  renderCustomerDisplay();
  renderPayment();
  renderSummary();
}

// ============================================================
// ITEMS SECTION
// ============================================================

function renderItemsList() {
  const el = document.getElementById("sale-items-list");
  if (S.items.length === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = S.items
    .map(
      (item, idx) => `
        <div class="flex items-start gap-2 p-3 bg-white border border-stone-200 rounded-lg mb-2">
            <div class="w-1 self-stretch rounded-full flex-shrink-0" style="background:${item.categoryColor}"></div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-stone-900 truncate">${escapeHtml(item.productName)}</p>
                <p class="text-xs text-stone-500 mt-0.5">
                    ${formatNumber(item.unitPrice)} × ${formatNumber(item.quantity)} ${item.unit} = ${formatCurrency(item.total)}
                </p>
            </div>
            <button class="sale-remove-item p-1.5 text-stone-400 hover:text-red-600
                rounded-lg flex-shrink-0" data-idx="${idx}" aria-label="Remove item">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        </div>
    `,
    )
    .join("");
  if (window.lucide) lucide.createIcons();
}

function renderProductDropdown(results) {
  const drop = document.getElementById("sale-prod-drop");
  if (!results || results.length === 0) {
    drop.classList.add("hidden");
    return;
  }
  drop.innerHTML = results
    .map(
      (p) => `
        <button class="prod-drop-item w-full flex items-center gap-3 px-3 py-2.5 text-left
            hover:bg-stone-50 transition-colors" data-id="${p.id}">
            <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${p.category ? p.category.color : "#A8A29E"}"></div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-stone-900 truncate">${escapeHtml(p.name)}</p>
                <p class="text-xs text-stone-500">
                    ${formatCurrency(p.selling_price)}/${p.unit} · Stock: ${formatNumber(p.stock_quantity)} ${p.unit}
                </p>
            </div>
        </button>
    `,
    )
    .join("");
  drop.classList.remove("hidden");
}

function showAddForm(product) {
  S.addFormProduct = product;
  S.showProdDrop = false;
  document.getElementById("sale-prod-drop").classList.add("hidden");
  document.getElementById("sale-prod-search").value = "";

  const el = document.getElementById("sale-add-form");
  el.innerHTML = `
        <div class="mt-2 p-3 bg-white border-2 border-amber-200 rounded-lg space-y-3">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0">
                    <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${product.category ? product.category.color : "#A8A29E"}"></div>
                    <span class="text-sm font-semibold text-stone-900 truncate">${escapeHtml(product.name)}</span>
                </div>
                <button id="sale-cancel-add" class="p-1 text-stone-400 hover:text-stone-600">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div class="flex gap-2">
                <div class="flex-1">
                    <label class="block text-[11px] font-medium text-stone-500 mb-1">Quantity (${product.unit})</label>
                    <input id="sale-add-qty" type="text" inputmode="decimal"
                        placeholder="0"
                        class="w-full h-10 px-3 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
                <div class="flex-1">
                    <label class="block text-[11px] font-medium text-stone-500 mb-1">Price (৳)</label>
                    <input id="sale-add-price" type="text" inputmode="decimal"
                        value="${product.selling_price}"
                        class="w-full h-10 px-3 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
            </div>
            <div id="sale-add-error" class="hidden text-xs text-red-600"></div>
            <button id="sale-add-btn" class="w-full h-10 bg-amber-700 hover:bg-amber-800 text-white
                font-semibold rounded-lg text-sm transition-colors">
                Add to Sale
            </button>
            <p class="text-[11px] text-stone-400 text-center">Available: ${formatNumber(product.stock_quantity)} ${product.unit}</p>
        </div>
    `;
  if (window.lucide) lucide.createIcons();

  // Focus quantity
  setTimeout(() => document.getElementById("sale-add-qty").focus(), 100);

  // Enter on qty moves to price
  document.getElementById("sale-add-qty").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("sale-add-price").focus();
    }
  });
  // Enter on price adds
  document.getElementById("sale-add-price").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  });
}

function hideAddForm() {
  S.addFormProduct = null;
  document.getElementById("sale-add-form").innerHTML = "";
}

function handleAddItem() {
  const errEl = document.getElementById("sale-add-error");
  const qtyVal = parseFloat(document.getElementById("sale-add-qty").value);
  const priceVal = parseFloat(document.getElementById("sale-add-price").value);
  const product = S.addFormProduct;

  errEl.classList.add("hidden");

  if (!qtyVal || qtyVal <= 0) {
    errEl.textContent = "Enter a valid quantity";
    errEl.classList.remove("hidden");
    return;
  }
  if (isNaN(priceVal) || priceVal < 0) {
    errEl.textContent = "Enter a valid price";
    errEl.classList.remove("hidden");
    return;
  }
  if (qtyVal > product.stock_quantity) {
    errEl.textContent = `Only ${product.stock_quantity} ${product.unit} available`;
    errEl.classList.remove("hidden");
    return;
  }

  S.items.push({
    uid: nextUid(),
    productId: product.id,
    productName: product.name,
    categoryColor: product.category ? product.category.color : "#A8A29E",
    quantity: qtyVal,
    unitPrice: priceVal,
    total: qtyVal * priceVal,
    unit: product.unit,
    maxStock: product.stock_quantity,
  });

  hideAddForm();
  renderItemsList();
  renderPayment();
  renderSummary();

  // Focus product search for next item
  setTimeout(() => document.getElementById("sale-prod-search").focus(), 100);
}

function removeItem(idx) {
  S.items.splice(idx, 1);
  renderItemsList();
  renderPayment();
  renderSummary();
}

// ============================================================
// PAYMENT SECTION
// ============================================================

function getSubtotal() {
  return S.items.reduce((sum, i) => sum + i.total, 0);
}

function getDiscountAmount() {
  return Math.max(0, Math.min(parseFloat(S.discount) || 0, getSubtotal()));
}

function getTotal() {
  return Math.max(0, getSubtotal() - getDiscountAmount());
}

function getPaidAmount() {
  return Math.max(0, Math.min(parseFloat(S.amountPaid) || 0, getTotal()));
}

function getDueAmount() {
  return getTotal() - getPaidAmount();
}

function renderPayment() {
  const el = document.getElementById("sale-payment");
  const subtotal = getSubtotal();
  const total = getTotal();
  const method = S.paymentMethod;
  const needsCustomer =
    (method === "CREDIT" || method === "PARTIAL") && getDueAmount() > 0;
  const customerMissing = needsCustomer && !S.selectedCustomer;

  el.innerHTML = `
        <h2 class="text-sm font-semibold text-stone-500 mb-2">PAYMENT</h2>

        <div class="space-y-2 mb-3">
            <div class="flex justify-between text-sm">
                <span class="text-stone-500">Subtotal</span>
                <span class="font-medium text-stone-900">${formatCurrency(subtotal)}</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-sm text-stone-500">Discount</span>
                <div class="relative flex-1">
                    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">৳</span>
                    <input id="sale-discount" type="text" inputmode="decimal"
                        value="${S.discount || ""}"
                        placeholder="0"
                        class="w-full h-8 pl-6 pr-2 border border-stone-200 rounded-md text-sm text-right
                               text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
            </div>
            <div class="flex justify-between text-sm pt-1 border-t border-stone-100">
                <span class="font-semibold text-stone-700">Total</span>
                <span class="font-bold text-stone-900">${formatCurrency(total)}</span>
            </div>
        </div>

        <!-- Payment Method -->
        <div class="flex gap-2 mb-3">
            <button class="pay-btn flex-1 h-10 rounded-lg text-sm font-semibold border-2
                transition-colors ${method === "CASH" ? "border-amber-700 bg-amber-50 text-amber-800" : "border-stone-200 text-stone-500 hover:border-stone-300"}"
                data-method="CASH">Cash</button>
            <button class="pay-btn flex-1 h-10 rounded-lg text-sm font-semibold border-2
                transition-colors ${method === "CREDIT" ? "border-amber-700 bg-amber-50 text-amber-800" : "border-stone-200 text-stone-500 hover:border-stone-300"}"
                data-method="CREDIT">Credit</button>
            <button class="pay-btn flex-1 h-10 rounded-lg text-sm font-semibold border-2
                transition-colors ${method === "PARTIAL" ? "border-amber-700 bg-amber-50 text-amber-800" : "border-stone-200 text-stone-500 hover:border-stone-300"}"
                data-method="PARTIAL">Partial</button>
        </div>

        ${
          method === "PARTIAL"
            ? `
            <div class="flex items-center gap-2 mb-2">
                <span class="text-sm text-stone-600 whitespace-nowrap">Amount Paid</span>
                <div class="relative flex-1">
                    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">৳</span>
                    <input id="sale-paid" type="text" inputmode="decimal"
                        value="${S.amountPaid || ""}"
                        placeholder="0"
                        class="w-full h-10 pl-6 pr-2 border border-stone-300 rounded-lg text-sm
                               text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
            </div>
            <div class="flex justify-between text-sm p-2 bg-stone-50 rounded-lg">
                <span class="text-stone-600">Amount Due</span>
                <span class="font-bold text-red-600">${formatCurrency(getDueAmount())}</span>
            </div>
        `
            : ""
        }

        ${
          method === "CREDIT"
            ? `
            <div class="flex justify-between text-sm p-2 bg-red-50 border border-red-100 rounded-lg">
                <span class="text-red-600">Amount Due</span>
                <span class="font-bold text-red-700">${formatCurrency(total)}</span>
            </div>
        `
            : ""
        }

        ${
          customerMissing
            ? `
            <div class="flex items-center gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600 flex-shrink-0"></i>
                <span class="text-xs text-amber-700 font-medium">Select a customer above for credit sales</span>
            </div>
        `
            : ""
        }
    `;

  if (window.lucide) lucide.createIcons();
}

function renderSummary() {
  const btn = document.getElementById("sale-complete-btn");
  const total = getTotal();
  const needsCustomer =
    (S.paymentMethod === "CREDIT" || S.paymentMethod === "PARTIAL") &&
    getDueAmount() > 0;
  const customerMissing = needsCustomer && !S.selectedCustomer;

  btn.textContent = `Complete Sale · ${formatCurrency(total)}`;
  btn.disabled = S.items.length === 0 || customerMissing || S.loading;
  btn.style.background =
    S.items.length === 0 || customerMissing ? "#A8A29E" : "#B45309";
}

// ============================================================
// COMPLETE SALE
// ============================================================

async function handleCompleteSale() {
  if (S.loading || S.items.length === 0) return;
  const needsCustomer =
    (S.paymentMethod === "CREDIT" || S.paymentMethod === "PARTIAL") &&
    getDueAmount() > 0;
  if (needsCustomer && !S.selectedCustomer) {
    showToast("Select a customer for credit sales", "error");
    return;
  }

  S.loading = true;
  renderSummary();
  const btn = document.getElementById("sale-complete-btn");
  btn.textContent = "Processing...";

  const result = await SaleService.createSale({
    customerId: S.selectedCustomer ? S.selectedCustomer.id : null,
    items: S.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    paymentMethod: S.paymentMethod,
    amountPaid:
      S.paymentMethod === "PARTIAL"
        ? S.amountPaid
        : S.paymentMethod === "CASH"
          ? getTotal()
          : 0,
    discount: S.discount,
    notes: document.getElementById("sale-notes")
      ? document.getElementById("sale-notes").value.trim()
      : null,
  });

  S.loading = false;

  if (result.success) {
    S.lastTx = result.data;
    S.mode = "success";
    renderSuccess();
  } else {
    btn.textContent = `Complete Sale · ${formatCurrency(getTotal())}`;
    renderSummary();
    showToast(result.error, "error");
  }
}

// ============================================================
// SUCCESS SCREEN
// ============================================================

function renderSuccess() {
  document.getElementById("sale-form").classList.add("hidden");
  document.getElementById("sale-complete-wrap").classList.add("hidden");

  const tx = S.lastTx;
  const el = document.getElementById("sale-success");
  el.classList.remove("hidden");

  const itemsHtml = tx.items
    .map(
      (i) => `
        <div class="flex justify-between text-sm py-1.5">
            <span class="text-stone-700">${escapeHtml(i.product_name)} × ${formatNumber(i.quantity)} ${i.product_unit}</span>
            <span class="font-medium text-stone-900">${formatCurrency(i.total)}</span>
        </div>
    `,
    )
    .join("");

  el.innerHTML = `
        <div class="p-4 space-y-5">
            <div class="text-center pt-8 pb-4">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full
                    bg-green-100 mb-4">
                    <i data-lucide="check" class="w-8 h-8 text-green-600"></i>
                </div>
                <h2 class="text-xl font-bold text-stone-900">Sale Complete</h2>
                <p class="text-sm text-stone-500 mt-1">${formatCurrency(tx.total_amount)}</p>
            </div>

            <div class="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
                ${
                  tx.customer_name
                    ? `
                    <div class="flex justify-between text-sm">
                        <span class="text-stone-500">Customer</span>
                        <span class="font-medium text-stone-900">${escapeHtml(tx.customer_name)}</span>
                    </div>
                `
                    : ""
                }
                <div class="border-t border-stone-100 pt-2">
                    ${itemsHtml}
                </div>
                ${
                  tx.discount > 0
                    ? `
                    <div class="flex justify-between text-sm border-t border-stone-100 pt-2">
                        <span class="text-stone-500">Discount</span>
                        <span class="text-red-600">-${formatCurrency(tx.discount)}</span>
                    </div>
                `
                    : ""
                }
                <div class="flex justify-between text-sm border-t border-stone-100 pt-2">
                    <span class="font-semibold text-stone-700">Total</span>
                    <span class="font-bold text-stone-900">${formatCurrency(tx.total_amount)}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-stone-500">Payment</span>
                    <span class="font-medium text-stone-900">${tx.payment_method}</span>
                </div>
                ${
                  tx.amount_paid > 0
                    ? `
                    <div class="flex justify-between text-sm">
                        <span class="text-stone-500">Paid</span>
                        <span class="font-medium text-green-700">${formatCurrency(tx.amount_paid)}</span>
                    </div>
                `
                    : ""
                }
                ${
                  tx.amount_due > 0
                    ? `
                    <div class="flex justify-between text-sm">
                        <span class="text-stone-500">Due</span>
                        <span class="font-bold text-red-600">${formatCurrency(tx.amount_due)}</span>
                    </div>
                `
                    : ""
                }
            </div>

            <button id="sale-new-btn"
                class="w-full h-12 bg-amber-700 hover:bg-amber-800 text-white font-bold
                       rounded-xl text-base transition-colors">
                New Sale
            </button>

            <button id="sale-back-home"
                class="w-full h-11 border border-stone-300 text-stone-700 font-semibold
                       rounded-xl text-sm hover:bg-stone-50 transition-colors">
                Back to Home
            </button>
        </div>
    `;
  if (window.lucide) lucide.createIcons();
}

function handleNewSale() {
  S.mode = "form";
  S.lastTx = null;
  document.getElementById("sale-success").classList.add("hidden");
  document.getElementById("sale-form").classList.remove("hidden");
  document.getElementById("sale-complete-wrap").classList.remove("hidden");
  resetState();
  renderCustomerDisplay();
  renderItemsList();
  renderPayment();
  renderSummary();
  // Clear notes
  const notesEl = document.getElementById("sale-notes");
  if (notesEl) notesEl.value = "";
}

// ============================================================
// EVENT DELEGATION
// ============================================================

document.addEventListener("click", (e) => {
  // --- Sale form only ---
  if (S.mode !== "form") {
    // Success screen buttons
    if (e.target.closest("#sale-new-btn")) {
      handleNewSale();
      return;
    }
    if (e.target.closest("#sale-back-home")) {
      window.location.hash = "#dashboard";
      return;
    }
    return;
  }

  // Clear customer
  if (e.target.closest("#sale-clear-cust")) {
    clearCustomer();
    return;
  }

  // Customer dropdown item
  const custItem = e.target.closest(".cust-drop-item");
  if (custItem) {
    const c = S.customerResults.find((x) => x.id === custItem.dataset.id);
    if (c) selectCustomer(c);
    return;
  }

  // Product dropdown item
  const prodItem = e.target.closest(".prod-drop-item");
  if (prodItem) {
    const p = S.productResults.find((x) => x.id === prodItem.dataset.id);
    if (p) showAddForm(p);
    return;
  }

  // Cancel add form
  if (e.target.closest("#sale-cancel-add")) {
    hideAddForm();
    return;
  }

  // Add item button
  if (e.target.closest("#sale-add-btn")) {
    handleAddItem();
    return;
  }

  // Remove item
  const removeBtn = e.target.closest(".sale-remove-item");
  if (removeBtn) {
    removeItem(parseInt(removeBtn.dataset.idx));
    return;
  }

  // Payment method buttons
  const payBtn = e.target.closest(".pay-btn");
  if (payBtn) {
    S.paymentMethod = payBtn.dataset.method;
    if (S.paymentMethod !== "PARTIAL") S.amountPaid = 0;
    renderPayment();
    renderSummary();
    return;
  }

  // Complete sale
  if (e.target.closest("#sale-complete-btn")) {
    handleCompleteSale();
    return;
  }

  // Close dropdowns on outside click
  if (
    !e.target.closest("#sale-cust-search") &&
    !e.target.closest("#sale-cust-drop")
  ) {
    S.showCustDrop = false;
    const d = document.getElementById("sale-cust-drop");
    if (d) d.classList.add("hidden");
  }
  if (
    !e.target.closest("#sale-prod-search") &&
    !e.target.closest("#sale-prod-drop") &&
    !e.target.closest("#sale-add-form")
  ) {
    S.showProdDrop = false;
    const d = document.getElementById("sale-prod-drop");
    if (d) d.classList.add("hidden");
  }
});

// Input handlers
document.addEventListener("input", (e) => {
  if (S.mode !== "form") return;

  if (e.target.id === "sale-cust-search") {
    debounce(async () => {
      const term = e.target.value.trim();
      if (term.length === 0) {
        S.customerResults = [];
        renderCustomerDropdown([]);
        return;
      }
      const result = await CustomerService.getAll({
        search: term,
        activeOnly: true,
      });
      if (result.success) {
        S.customerResults = result.data;
        renderCustomerDropdown(result.data);
      }
    }, 200)();
    return;
  }

  if (e.target.id === "sale-prod-search") {
    debounce(async () => {
      const term = e.target.value.trim();
      if (term.length === 0) {
        S.productResults = [];
        renderProductDropdown([]);
        return;
      }
      const result = await ProductService.getAll({
        search: term,
        activeOnly: true,
      });
      if (result.success) {
        S.productResults = result.data;
        renderProductDropdown(result.data);
      }
    }, 200)();
    return;
  }

  if (e.target.id === "sale-discount") {
    S.discount = e.target.value;
    renderPayment();
    renderSummary();
    return;
  }

  if (e.target.id === "sale-paid") {
    S.amountPaid = e.target.value;
    renderPayment();
    renderSummary();
    return;
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

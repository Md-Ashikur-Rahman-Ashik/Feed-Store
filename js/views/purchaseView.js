import PurchaseService from "../services/purchaseService.js";
import SupplierService from "../services/supplierService.js";
import ProductService from "../services/productService.js";
import { CATEGORY_COLORS } from "../config.js";
import { formatCurrency, formatNumber, debounce } from "../utils/helpers.js";
import { updateHeader, updateNav, showToast } from "./viewHelpers.js";

// ============================================================
// STATE
// ============================================================

const S = {
  mode: "form",
  selectedSupplier: null,
  items: [],
  paymentMethod: "CASH",
  discount: 0,
  amountPaid: 0,
  supplierResults: [],
  productResults: [],
  addFormProduct: null,
  lastTx: null,
  loading: false,
};

let uidCounter = 0;
function nextUid() {
  return "pi" + ++uidCounter;
}

// ============================================================
// MAIN RENDER
// ============================================================

export async function renderPurchase(mount) {
  updateHeader(null);
  updateNav("purchase");
  resetState();
  mount.innerHTML = buildShell();
  renderPayment();
  renderSummary();
}

function resetState() {
  S.mode = "form";
  S.selectedSupplier = null;
  S.items = [];
  S.paymentMethod = "CASH";
  S.discount = 0;
  S.amountPaid = 0;
  S.supplierResults = [];
  S.productResults = [];
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
        <div id="pur-form" class="pb-24">
            <div class="p-4 pb-2">
                <div class="flex items-center justify-between mb-2">
                    <h2 class="text-sm font-semibold text-stone-500">SUPPLIER</h2>
                    <button id="pur-clear-sup" class="hidden text-xs text-red-500 font-semibold
                        px-2 py-1 rounded hover:bg-red-50">Clear</button>
                </div>
                <div id="pur-sup-display"></div>
                <div class="relative">
                    <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2
                        w-4 h-4 text-stone-400 pointer-events-none"></i>
                    <input id="pur-sup-search" type="text" inputmode="text" autocomplete="off"
                        placeholder="Search supplier by name or phone..."
                        class="w-full h-10 pl-10 pr-4 bg-white border border-stone-200 rounded-lg
                               text-sm text-stone-900 placeholder-stone-400
                               focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700"
                        style="font-size:16px;">
                    <div id="pur-sup-drop" class="hidden absolute left-0 right-0 top-full mt-1
                        bg-white border border-stone-200 rounded-lg shadow-lg z-10
                        max-h-48 overflow-y-auto"></div>
                </div>
                <p id="pur-sup-note" class="text-xs text-stone-400 mt-1.5 px-1">
                    No supplier selected — cash purchase
                </p>
            </div>

            <div class="mx-4 border-t border-stone-200"></div>

            <div class="p-4 pb-2">
                <h2 class="text-sm font-semibold text-stone-500 mb-2">ITEMS RECEIVED</h2>
                <div id="pur-items-list"></div>
                <div class="relative mt-2">
                    <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2
                        w-4 h-4 text-stone-400 pointer-events-none"></i>
                    <input id="pur-prod-search" type="text" inputmode="text" autocomplete="off"
                        placeholder="Search product to add..."
                        class="w-full h-10 pl-10 pr-4 bg-white border border-stone-200 rounded-lg
                               text-sm text-stone-900 placeholder-stone-400
                               focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700"
                        style="font-size:16px;">
                    <div id="pur-prod-drop" class="hidden absolute left-0 right-0 top-full mt-1
                        bg-white border border-stone-200 rounded-lg shadow-lg z-10
                        max-h-48 overflow-y-auto"></div>
                </div>
                <div id="pur-add-form"></div>
            </div>

            <div class="mx-4 border-t border-stone-200"></div>

            <div id="pur-payment" class="p-4 pb-2"></div>

            <div class="mx-4 border-t border-stone-200"></div>

            <div class="p-4 pb-2">
                <label class="block text-sm font-medium text-stone-600 mb-1">Notes (optional)</label>
                <input id="pur-notes" type="text"
                    class="w-full h-10 px-3 bg-white border border-stone-200 rounded-lg
                           text-sm text-stone-900 placeholder-stone-400
                           focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700"
                    style="font-size:16px;" placeholder="Any additional notes...">
            </div>
        </div>

        <div id="pur-complete-wrap" class="fixed left-4 right-4 z-20"
            style="bottom:calc(60px + env(safe-area-inset-bottom, 0px) + 12px);">
            <button id="pur-complete-btn"
                class="w-full h-12 rounded-xl text-white font-bold text-base
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors active:scale-[0.98]"
                style="background:#B45309;" disabled>
                Complete Purchase · ৳0
            </button>
        </div>

        <div id="pur-success" class="hidden min-h-screen"></div>
    `;
  if (window.lucide) lucide.createIcons();
}

// ============================================================
// SUPPLIER SECTION
// ============================================================

function renderSupplierDisplay() {
  const el = document.getElementById("pur-sup-display");
  const note = document.getElementById("pur-sup-note");
  const clearBtn = document.getElementById("pur-clear-sup");

  if (S.selectedSupplier) {
    const s = S.selectedSupplier;
    const hasBalance = s.balance > 0;
    el.innerHTML = `
            <div class="flex items-center gap-3 p-3 bg-white border border-stone-200 rounded-lg mb-2">
                <div class="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="truck" class="w-4 h-4 text-amber-700"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-stone-900 truncate">${escapeHtml(s.name)}</p>
                    <div class="flex items-center gap-2 mt-0.5">
                        ${s.phone ? `<span class="text-xs text-stone-500">${escapeHtml(s.phone)}</span>` : ""}
                        ${hasBalance ? `<span class="text-xs text-red-600 font-semibold">We Owe: ${formatCurrency(s.balance)}</span>` : ""}
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

function renderSupplierDropdown(results) {
  const drop = document.getElementById("pur-sup-drop");
  if (!results || results.length === 0) {
    drop.classList.add("hidden");
    return;
  }
  drop.innerHTML = results
    .map(
      (s) => `
        <button class="sup-drop-item w-full flex items-center gap-3 px-3 py-2.5 text-left
            hover:bg-stone-50 transition-colors" data-id="${s.id}">
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-stone-900 truncate">${escapeHtml(s.name)}</p>
                ${s.phone ? `<p class="text-xs text-stone-500">${escapeHtml(s.phone)}</p>` : ""}
            </div>
            ${s.balance > 0 ? `<span class="text-xs font-semibold text-red-600">${formatCurrency(s.balance)}</span>` : ""}
        </button>
    `,
    )
    .join("");
  drop.classList.remove("hidden");
}

function selectSupplier(supplier) {
  S.selectedSupplier = supplier;
  document.getElementById("pur-sup-drop").classList.add("hidden");
  document.getElementById("pur-sup-search").value = "";
  renderSupplierDisplay();
  renderPayment();
  renderSummary();
}

function clearSupplier() {
  S.selectedSupplier = null;
  renderSupplierDisplay();
  renderPayment();
  renderSummary();
}

// ============================================================
// ITEMS SECTION
// ============================================================

function renderItemsList() {
  const el = document.getElementById("pur-items-list");
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
            <button class="pur-remove-item p-1.5 text-stone-400 hover:text-red-600
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
  const drop = document.getElementById("pur-prod-drop");
  if (!results || results.length === 0) {
    drop.classList.add("hidden");
    return;
  }
  drop.innerHTML = results
    .map(
      (p) => `
        <button class="pur-prod-drop-item w-full flex items-center gap-3 px-3 py-2.5 text-left
            hover:bg-stone-50 transition-colors" data-id="${p.id}">
            <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${p.category ? p.category.color : "#A8A29E"}"></div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-stone-900 truncate">${escapeHtml(p.name)}</p>
                <p class="text-xs text-stone-500">
                    Cost: ${formatCurrency(p.cost_price)}/${p.unit} · Stock: ${formatNumber(p.stock_quantity)} ${p.unit}
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
  document.getElementById("pur-prod-drop").classList.add("hidden");
  document.getElementById("pur-prod-search").value = "";

  const el = document.getElementById("pur-add-form");
  el.innerHTML = `
        <div class="mt-2 p-3 bg-white border-2 border-amber-200 rounded-lg space-y-3">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0">
                    <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${product.category ? product.category.color : "#A8A29E"}"></div>
                    <span class="text-sm font-semibold text-stone-900 truncate">${escapeHtml(product.name)}</span>
                </div>
                <button id="pur-cancel-add" class="p-1 text-stone-400 hover:text-stone-600">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div class="flex gap-2">
                <div class="flex-1">
                    <label class="block text-[11px] font-medium text-stone-500 mb-1">Quantity (${product.unit})</label>
                    <input id="pur-add-qty" type="text" inputmode="decimal"
                        placeholder="0"
                        class="w-full h-10 px-3 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
                <div class="flex-1">
                    <label class="block text-[11px] font-medium text-stone-500 mb-1">Cost Price (৳)</label>
                    <input id="pur-add-price" type="text" inputmode="decimal"
                        value="${product.cost_price}"
                        class="w-full h-10 px-3 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
            </div>
            <div id="pur-add-error" class="hidden text-xs text-red-600"></div>
            <button id="pur-add-btn" class="w-full h-10 bg-amber-700 hover:bg-amber-800 text-white
                font-semibold rounded-lg text-sm transition-colors">
                Add to Purchase
            </button>
            <p class="text-[11px] text-stone-400 text-center">Current stock: ${formatNumber(product.stock_quantity)} ${product.unit}</p>
        </div>
    `;
  if (window.lucide) lucide.createIcons();

  setTimeout(() => document.getElementById("pur-add-qty").focus(), 100);

  document.getElementById("pur-add-qty").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("pur-add-price").focus();
    }
  });
  document.getElementById("pur-add-price").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  });
}

function hideAddForm() {
  S.addFormProduct = null;
  document.getElementById("pur-add-form").innerHTML = "";
}

function handleAddItem() {
  const errEl = document.getElementById("pur-add-error");
  const qtyVal = parseFloat(document.getElementById("pur-add-qty").value);
  const priceVal = parseFloat(document.getElementById("pur-add-price").value);
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

  S.items.push({
    uid: nextUid(),
    productId: product.id,
    productName: product.name,
    categoryColor: product.category ? product.category.color : "#A8A29E",
    quantity: qtyVal,
    unitPrice: priceVal,
    total: qtyVal * priceVal,
    unit: product.unit,
  });

  hideAddForm();
  renderItemsList();
  renderPayment();
  renderSummary();
  setTimeout(() => document.getElementById("pur-prod-search").focus(), 100);
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
  const el = document.getElementById("pur-payment");
  const subtotal = getSubtotal();
  const total = getTotal();
  const method = S.paymentMethod;
  const needsSupplier =
    (method === "CREDIT" || method === "PARTIAL") && getDueAmount() > 0;
  const supplierMissing = needsSupplier && !S.selectedSupplier;

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
                    <input id="pur-discount" type="text" inputmode="decimal"
                        value="${S.discount || ""}" placeholder="0"
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
        <div class="flex gap-2 mb-3">
            <button class="pur-pay-btn flex-1 h-10 rounded-lg text-sm font-semibold border-2
                transition-colors ${method === "CASH" ? "border-amber-700 bg-amber-50 text-amber-800" : "border-stone-200 text-stone-500 hover:border-stone-300"}"
                data-method="CASH">Cash</button>
            <button class="pur-pay-btn flex-1 h-10 rounded-lg text-sm font-semibold border-2
                transition-colors ${method === "CREDIT" ? "border-amber-700 bg-amber-50 text-amber-800" : "border-stone-200 text-stone-500 hover:border-stone-300"}"
                data-method="CREDIT">Credit</button>
            <button class="pur-pay-btn flex-1 h-10 rounded-lg text-sm font-semibold border-2
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
                    <input id="pur-paid" type="text" inputmode="decimal"
                        value="${S.amountPaid || ""}" placeholder="0"
                        class="w-full h-10 pl-6 pr-2 border border-stone-300 rounded-lg text-sm
                               text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
            </div>
            <div class="flex justify-between text-sm p-2 bg-stone-50 rounded-lg">
                <span class="text-stone-600">We Owe</span>
                <span class="font-bold text-red-600">${formatCurrency(getDueAmount())}</span>
            </div>
        `
            : ""
        }
        ${
          method === "CREDIT"
            ? `
            <div class="flex justify-between text-sm p-2 bg-red-50 border border-red-100 rounded-lg">
                <span class="text-red-600">We Owe</span>
                <span class="font-bold text-red-700">${formatCurrency(total)}</span>
            </div>
        `
            : ""
        }
        ${
          supplierMissing
            ? `
            <div class="flex items-center gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600 flex-shrink-0"></i>
                <span class="text-xs text-amber-700 font-medium">Select a supplier above for credit purchases</span>
            </div>
        `
            : ""
        }
    `;
  if (window.lucide) lucide.createIcons();
}

function renderSummary() {
  const btn = document.getElementById("pur-complete-btn");
  const total = getTotal();
  const needsSupplier =
    (S.paymentMethod === "CREDIT" || S.paymentMethod === "PARTIAL") &&
    getDueAmount() > 0;
  const supplierMissing = needsSupplier && !S.selectedSupplier;

  btn.textContent = `Complete Purchase · ${formatCurrency(total)}`;
  btn.disabled = S.items.length === 0 || supplierMissing || S.loading;
  btn.style.background =
    S.items.length === 0 || supplierMissing ? "#A8A29E" : "#B45309";
}

// ============================================================
// COMPLETE PURCHASE
// ============================================================

async function handleCompletePurchase() {
  if (S.loading || S.items.length === 0) return;
  const needsSupplier =
    (S.paymentMethod === "CREDIT" || S.paymentMethod === "PARTIAL") &&
    getDueAmount() > 0;
  if (needsSupplier && !S.selectedSupplier) {
    showToast("Select a supplier for credit purchases", "error");
    return;
  }

  S.loading = true;
  renderSummary();
  document.getElementById("pur-complete-btn").textContent = "Processing...";

  const result = await PurchaseService.createPurchase({
    supplierId: S.selectedSupplier ? S.selectedSupplier.id : null,
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
    notes: document.getElementById("pur-notes")
      ? document.getElementById("pur-notes").value.trim()
      : null,
  });

  S.loading = false;

  if (result.success) {
    S.lastTx = result.data;
    S.mode = "success";
    renderSuccess();
  } else {
    document.getElementById("pur-complete-btn").textContent =
      `Complete Purchase · ${formatCurrency(getTotal())}`;
    renderSummary();
    showToast(result.error, "error");
  }
}

// ============================================================
// SUCCESS SCREEN
// ============================================================

function renderSuccess() {
  document.getElementById("pur-form").classList.add("hidden");
  document.getElementById("pur-complete-wrap").classList.add("hidden");

  const tx = S.lastTx;
  const el = document.getElementById("pur-success");
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
                <h2 class="text-xl font-bold text-stone-900">Purchase Complete</h2>
                <p class="text-sm text-stone-500 mt-1">${formatCurrency(tx.total_amount)}</p>
            </div>
            <div class="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
                ${
                  tx.supplier_name
                    ? `
                    <div class="flex justify-between text-sm">
                        <span class="text-stone-500">Supplier</span>
                        <span class="font-medium text-stone-900">${escapeHtml(tx.supplier_name)}</span>
                    </div>
                `
                    : ""
                }
                <div class="border-t border-stone-100 pt-2">${itemsHtml}</div>
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
                        <span class="text-stone-500">We Owe</span>
                        <span class="font-bold text-red-600">${formatCurrency(tx.amount_due)}</span>
                    </div>
                `
                    : ""
                }
            </div>
            <button id="pur-new-btn"
                class="w-full h-12 bg-amber-700 hover:bg-amber-800 text-white font-bold
                       rounded-xl text-base transition-colors">New Purchase</button>
            <button id="pur-back-home"
                class="w-full h-11 border border-stone-300 text-stone-700 font-semibold
                       rounded-xl text-sm hover:bg-stone-50 transition-colors">Back to Home</button>
        </div>
    `;
  if (window.lucide) lucide.createIcons();
}

function handleNewPurchase() {
  S.mode = "form";
  S.lastTx = null;
  document.getElementById("pur-success").classList.add("hidden");
  document.getElementById("pur-form").classList.remove("hidden");
  document.getElementById("pur-complete-wrap").classList.remove("hidden");
  resetState();
  renderSupplierDisplay();
  renderItemsList();
  renderPayment();
  renderSummary();
  const notesEl = document.getElementById("pur-notes");
  if (notesEl) notesEl.value = "";
}

// ============================================================
// EVENT DELEGATION
// ============================================================

document.addEventListener("click", (e) => {
  if (S.mode !== "form") {
    if (e.target.closest("#pur-new-btn")) {
      handleNewPurchase();
      return;
    }
    if (e.target.closest("#pur-back-home")) {
      window.location.hash = "#dashboard";
      return;
    }
    return;
  }

  if (e.target.closest("#pur-clear-sup")) {
    clearSupplier();
    return;
  }

  const supItem = e.target.closest(".sup-drop-item");
  if (supItem) {
    const s = S.supplierResults.find((x) => x.id === supItem.dataset.id);
    if (s) selectSupplier(s);
    return;
  }

  const prodItem = e.target.closest(".pur-prod-drop-item");
  if (prodItem) {
    const p = S.productResults.find((x) => x.id === prodItem.dataset.id);
    if (p) showAddForm(p);
    return;
  }

  if (e.target.closest("#pur-cancel-add")) {
    hideAddForm();
    return;
  }
  if (e.target.closest("#pur-add-btn")) {
    handleAddItem();
    return;
  }

  const removeBtn = e.target.closest(".pur-remove-item");
  if (removeBtn) {
    removeItem(parseInt(removeBtn.dataset.idx));
    return;
  }

  const payBtn = e.target.closest(".pur-pay-btn");
  if (payBtn) {
    S.paymentMethod = payBtn.dataset.method;
    if (S.paymentMethod !== "PARTIAL") S.amountPaid = 0;
    renderPayment();
    renderSummary();
    return;
  }

  if (e.target.closest("#pur-complete-btn")) {
    handleCompletePurchase();
    return;
  }

  if (
    !e.target.closest("#pur-sup-search") &&
    !e.target.closest("#pur-sup-drop")
  ) {
    const d = document.getElementById("pur-sup-drop");
    if (d) d.classList.add("hidden");
  }
  if (
    !e.target.closest("#pur-prod-search") &&
    !e.target.closest("#pur-prod-drop") &&
    !e.target.closest("#pur-add-form")
  ) {
    const d = document.getElementById("pur-prod-drop");
    if (d) d.classList.add("hidden");
  }
});

document.addEventListener("input", (e) => {
  if (S.mode !== "form") return;

  if (e.target.id === "pur-sup-search") {
    debounce(async () => {
      const term = e.target.value.trim();
      if (term.length === 0) {
        renderSupplierDropdown([]);
        return;
      }
      const result = await SupplierService.getAll({
        search: term,
        activeOnly: true,
      });
      if (result.success) {
        S.supplierResults = result.data;
        renderSupplierDropdown(result.data);
      }
    }, 200)();
    return;
  }

  if (e.target.id === "pur-prod-search") {
    debounce(async () => {
      const term = e.target.value.trim();
      if (term.length === 0) {
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

  if (e.target.id === "pur-discount") {
    S.discount = e.target.value;
    renderPayment();
    renderSummary();
    return;
  }
  if (e.target.id === "pur-paid") {
    S.amountPaid = e.target.value;
    renderPayment();
    renderSummary();
    return;
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

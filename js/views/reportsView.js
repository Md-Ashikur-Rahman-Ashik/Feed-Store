import ReportService from "../services/reportService.js";
import { formatCurrency, formatNumber } from "../utils/helpers.js";
import { todayDate } from "../utils/uuid.js";
import { updateHeader, updateNav, showToast } from "./viewHelpers.js";

let selectedDate = todayDate();
let rangeFrom = todayDate();
let rangeTo = todayDate();
let activeSection = "daily";

export async function renderReports(mount) {
  updateHeader("Reports");
  updateNav("reports");
  activeSection = "daily";
  mount.innerHTML = buildShell();
  await loadSection();
}

function buildShell() {
  return `
        <div class="p-4 space-y-3 pb-8">
            <div class="flex gap-2">
                <button class="rpt-tab" data-section="daily">Daily Summary</button>
                <button class="rpt-tab" data-section="range">Date Range</button>
                <button class="rpt-tab" data-section="credits">Credits</button>
            </div>
            <style>
                .rpt-tab { padding:6px 14px; border-radius:20px; font-size:13px; font-weight:600;
                    border:1.5px solid #E7E5E4; background:white; color:#78716C;
                    transition:all 0.15s; cursor:pointer; font-family:'DM Sans',sans-serif; }
                .rpt-tab.active { color:white; border-color:transparent; background:#B45309; }
            </style>
            <div id="rpt-content"></div>
        </div>
    `;
}

async function loadSection() {
  document.querySelectorAll(".rpt-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.section === activeSection);
  });
  const el = document.getElementById("rpt-content");
  el.innerHTML =
    '<div class="text-center py-8"><div class="inline-block w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin"></div></div>';

  if (activeSection === "daily") await renderDaily(el);
  else if (activeSection === "range") await renderRange(el);
  else await renderCredits(el);
}

async function renderDaily(el) {
  el.innerHTML = `
        <div class="flex items-center gap-2 mb-4">
            <label class="text-sm font-medium text-stone-600">Date:</label>
            <input id="rpt-date" type="date" value="${selectedDate}"
                class="h-10 px-3 border border-stone-300 rounded-lg text-sm text-stone-900
                       focus:outline-none focus:ring-2 focus:ring-amber-700" style="font-size:16px;">
        </div>
        <div id="rpt-daily-body"></div>
    `;
  await loadDaily();
}

async function loadDaily() {
  const body = document.getElementById("rpt-daily-body");
  if (!body) return;
  const result = await ReportService.getDailySummary(selectedDate);
  if (!result.success) {
    body.innerHTML = `<p class="text-red-600 text-sm">${result.error}</p>`;
    return;
  }
  const d = result.data;
  const s = d.summary;
  const hasData = s !== null;

  body.innerHTML = `
        <div class="space-y-4">
            <div class="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
                <h3 class="text-sm font-semibold text-stone-700">Summary for ${formatDateLong(selectedDate)}</h3>
                <div class="grid grid-cols-2 gap-3">
                    <div class="p-3 bg-green-50 rounded-lg text-center">
                        <p class="text-lg font-bold text-green-700">${formatCurrency(s ? s.total_sales : 0)}</p>
                        <p class="text-[11px] text-green-600">Sales</p>
                    </div>
                    <div class="p-3 bg-blue-50 rounded-lg text-center">
                        <p class="text-lg font-bold text-blue-700">${formatCurrency(s ? s.total_purchases : 0)}</p>
                        <p class="text-[11px] text-blue-600">Purchases</p>
                    </div>
                    <div class="p-3 bg-amber-50 rounded-lg text-center">
                        <p class="text-lg font-bold text-amber-700">${formatCurrency(s ? s.total_cash_received : 0)}</p>
                        <p class="text-[11px] text-amber-600">Cash Received</p>
                    </div>
                    <div class="p-3 bg-red-50 rounded-lg text-center">
                        <p class="text-lg font-bold text-red-600">${formatCurrency(s ? s.total_credit_given : 0)}</p>
                        <p class="text-[11px] text-red-500">Credit Given</p>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center text-sm">
                    <div class="p-2 bg-stone-50 rounded-lg">
                        <p class="font-bold text-stone-900">${s ? s.sale_count : 0}</p>
                        <p class="text-[10px] text-stone-500">Sales</p>
                    </div>
                    <div class="p-2 bg-stone-50 rounded-lg">
                        <p class="font-bold text-stone-900">${s ? s.purchase_count : 0}</p>
                        <p class="text-[10px] text-stone-500">Purchases</p>
                    </div>
                    <div class="p-2 bg-stone-50 rounded-lg">
                        <p class="font-bold ${s && s.estimated_profit > 0 ? "text-green-700" : "text-stone-900"}">${formatCurrency(s ? s.estimated_profit : 0)}</p>
                        <p class="text-[10px] text-stone-500">Est. Profit</p>
                    </div>
                </div>
            </div>

            ${
              d.categoryBreakdown.length > 0
                ? `
            <div class="bg-white rounded-xl border border-stone-200 p-4">
                <h3 class="text-sm font-semibold text-stone-700 mb-3">Category Breakdown</h3>
                ${d.categoryBreakdown
                  .map(
                    (c) => `
                    <div class="flex items-center gap-3 py-2 border-b border-stone-100 last:border-0">
                        <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${c.color}"></div>
                        <span class="text-sm text-stone-700 flex-1">${c.name}</span>
                        <span class="text-sm font-medium text-stone-900">${formatNumber(c.quantity)} KG</span>
                        <span class="text-sm font-bold text-stone-900 w-24 text-right">${formatCurrency(c.total)}</span>
                    </div>
                `,
                  )
                  .join("")}
            </div>`
                : ""
            }

            <div class="bg-white rounded-xl border border-stone-200 p-4">
                <h3 class="text-sm font-semibold text-stone-700 mb-3">Cash Position</h3>
                <div class="flex justify-between text-sm mb-2">
                    <span class="text-stone-500">Cash In</span>
                    <span class="font-medium text-green-700">+${formatCurrency(d.cashIn)}</span>
                </div>
                <div class="flex justify-between text-sm mb-2">
                    <span class="text-stone-500">Cash Out</span>
                    <span class="font-medium text-red-600">-${formatCurrency(d.cashOut)}</span>
                </div>
                <div class="flex justify-between text-sm pt-2 border-t border-stone-200">
                    <span class="font-semibold text-stone-700">Cash Balance</span>
                    <span class="font-bold text-stone-900">${formatCurrency(d.cashBalance)}</span>
                </div>
            </div>

            ${!hasData ? '<p class="text-center text-sm text-stone-400 py-4">No transactions on this date</p>' : ""}
        </div>
    `;
}

async function renderRange(el) {
  el.innerHTML = `
        <div class="flex items-center gap-2 mb-4">
            <input id="rpt-from" type="date" value="${rangeFrom}"
                class="flex-1 h-10 px-3 border border-stone-300 rounded-lg text-sm text-stone-900
                       focus:outline-none focus:ring-2 focus:ring-amber-700" style="font-size:16px;">
            <span class="text-sm text-stone-400">to</span>
            <input id="rpt-to" type="date" value="${rangeTo}"
                class="flex-1 h-10 px-3 border border-stone-300 rounded-lg text-sm text-stone-900
                       focus:outline-none focus:ring-2 focus:ring-amber-700" style="font-size:16px;">
        </div>
        <div id="rpt-range-body"></div>
    `;
  await loadRange();
}

async function loadRange() {
  const body = document.getElementById("rpt-range-body");
  if (!body) return;
  const result = await ReportService.getDateRangeSummary(rangeFrom, rangeTo);
  if (!result.success) {
    body.innerHTML = `<p class="text-red-600 text-sm">${result.error}</p>`;
    return;
  }
  const { totals, summaries } = result.data;

  body.innerHTML = `
        <div class="space-y-4">
            <div class="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
                <h3 class="text-sm font-semibold text-stone-700">${totals.dayCount} Day${totals.dayCount !== 1 ? "s" : ""} Summary</h3>
                <div class="grid grid-cols-2 gap-3">
                    <div class="p-3 bg-green-50 rounded-lg text-center">
                        <p class="text-lg font-bold text-green-700">${formatCurrency(totals.totalSales)}</p>
                        <p class="text-[11px] text-green-600">Total Sales</p>
                    </div>
                    <div class="p-3 bg-blue-50 rounded-lg text-center">
                        <p class="text-lg font-bold text-blue-700">${formatCurrency(totals.totalPurchases)}</p>
                        <p class="text-[11px] text-blue-600">Total Purchases</p>
                    </div>
                    <div class="p-3 bg-amber-50 rounded-lg text-center">
                        <p class="text-lg font-bold text-amber-700">${formatCurrency(totals.totalCashReceived)}</p>
                        <p class="text-[11px] text-amber-600">Cash Received</p>
                    </div>
                    <div class="p-3 bg-red-50 rounded-lg text-center">
                        <p class="text-lg font-bold text-red-600">${formatCurrency(totals.totalCreditGiven)}</p>
                        <p class="text-[11px] text-red-500">Credit Given</p>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center text-sm">
                    <div class="p-2 bg-stone-50 rounded-lg">
                        <p class="font-bold text-stone-900">${totals.saleCount}</p>
                        <p class="text-[10px] text-stone-500">Sales</p>
                    </div>
                    <div class="p-2 bg-stone-50 rounded-lg">
                        <p class="font-bold text-stone-900">${totals.purchaseCount}</p>
                        <p class="text-[10px] text-stone-500">Purchases</p>
                    </div>
                    <div class="p-2 bg-stone-50 rounded-lg">
                        <p class="font-bold ${totals.estimatedProfit > 0 ? "text-green-700" : "text-stone-900"}">${formatCurrency(totals.estimatedProfit)}</p>
                        <p class="text-[10px] text-stone-500">Est. Profit</p>
                    </div>
                </div>
            </div>
            ${
              summaries.length > 0
                ? `
            <div class="bg-white rounded-xl border border-stone-200 p-4">
                <h3 class="text-sm font-semibold text-stone-700 mb-3">Day by Day</h3>
                ${summaries
                  .map(
                    (s) => `
                    <div class="flex items-center justify-between py-2 border-b border-stone-100 last:border-0 text-sm">
                        <span class="text-stone-700">${formatDateShort(s.summary_date)}</span>
                        <span class="font-medium text-green-700">${formatCurrency(s.total_sales)}</span>
                        <span class="font-medium text-red-500">${formatCurrency(s.total_credit_given)}</span>
                        <span class="font-bold ${s.estimated_profit > 0 ? "text-green-700" : "text-stone-900"}">${formatCurrency(s.estimated_profit)}</span>
                    </div>
                    <div class="flex justify-between text-[10px] text-stone-400 -mt-1 mb-2 pb-2 border-b border-stone-50 last:border-0">
                        <span></span><span>Sales</span><span>Credit</span><span>Profit</span>
                    </div>
                `,
                  )
                  .join("")}
            </div>`
                : '<p class="text-center text-sm text-stone-400 py-4">No data in this range</p>'
            }
        </div>
    `;
}

async function renderCredits(el) {
  el.innerHTML = '<div id="rpt-credits-body"></div>';
  const body = document.getElementById("rpt-credits-body");

  const result = await ReportService.getOutstandingCredits();
  if (!result.success) {
    body.innerHTML = `<p class="text-red-600 text-sm">${result.error}</p>`;
    return;
  }
  const { customers, totalOwed } = result.data;

  body.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-stone-700">All Outstanding Credits</h3>
                <span class="text-sm font-bold text-red-600">${formatCurrency(totalOwed)}</span>
            </div>
            ${
              customers.length === 0
                ? '<p class="text-center text-sm text-stone-400 py-8">No outstanding credits</p>'
                : customers
                    .map(
                      (c) => `
                <div class="bg-white rounded-xl border border-stone-200 p-3 flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <i data-lucide="user" class="w-4 h-4 text-red-600"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-stone-900 truncate">${escapeHtml(c.name)}</p>
                        ${c.phone ? `<p class="text-xs text-stone-500">${escapeHtml(c.phone)}</p>` : ""}
                    </div>
                    <span class="text-sm font-bold text-red-600 flex-shrink-0">${formatCurrency(c.balance)}</span>
                    <button class="rpt-view-ledger text-xs font-semibold text-amber-700 px-2 py-1
                        rounded-lg hover:bg-amber-50" data-type="customer" data-id="${c.id}">View</button>
                </div>
            `,
                    )
                    .join("")
            }
        </div>
    `;
  if (window.lucide) lucide.createIcons();
}

// --- Events ---

document.addEventListener("click", (e) => {
  const tab = e.target.closest(".rpt-tab");
  if (tab) {
    activeSection = tab.dataset.section;
    loadSection();
    return;
  }

  if (e.target.closest(".rpt-view-ledger")) {
    const btn = e.target.closest(".rpt-view-ledger");
    window.location.hash = `#${btn.dataset.type}-ledger?id=${btn.dataset.id}`;
    return;
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "rpt-date") {
    selectedDate = e.target.value;
    loadDaily();
    return;
  }
  if (e.target.id === "rpt-from") {
    rangeFrom = e.target.value;
    loadRange();
    return;
  }
  if (e.target.id === "rpt-to") {
    rangeTo = e.target.value;
    loadRange();
    return;
  }
});

function formatDateLong(str) {
  return new Date(str + "T00:00:00").toLocaleDateString("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function formatDateShort(str) {
  return new Date(str + "T00:00:00").toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
}
function escapeHtml(str) {
  if (!str) return "";
  const m = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return str.replace(/[&<>"']/g, (c) => m[c]);
}

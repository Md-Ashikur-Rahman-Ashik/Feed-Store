import ReportService from "../services/reportService.js";
import { formatCurrency, formatNumber, escapeHtml } from "../utils/helpers.js";
import { todayDate } from "../utils/uuid.js";
import { useMountEffect, updateHeader, updateNav, showToast } from "./viewHelpers.js";

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

  useMountEffect(({ on }) => {
    on("click", (e) => {
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

    on("change", (e) => {
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
  });
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

function profitColor(value) {
  if (value > 0) return "text-green-700";
  if (value < 0) return "text-red-600";
  return "text-stone-900";
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
                <h3 class="text-sm font-semibold text-stone-700 flex items-center gap-2">
                    <i data-lucide="calendar" class="w-4 h-4 text-amber-700"></i>
                    Summary for ${formatDateLong(selectedDate)}
                </h3>
                <div class="grid grid-cols-3 gap-2">
                    <div class="p-3 bg-green-50 rounded-lg text-center">
                        <i data-lucide="trending-up" class="w-4 h-4 text-green-600 mx-auto mb-1"></i>
                        <p class="text-lg font-bold text-green-700">${formatCurrency(s ? s.total_sales : 0)}</p>
                        <p class="text-[11px] text-green-600">Sales</p>
                    </div>
                    <div class="p-3 bg-blue-50 rounded-lg text-center">
                        <i data-lucide="shopping-cart" class="w-4 h-4 text-blue-600 mx-auto mb-1"></i>
                        <p class="text-lg font-bold text-blue-700">${formatCurrency(s ? s.total_purchases : 0)}</p>
                        <p class="text-[11px] text-blue-600">Purchases</p>
                    </div>
                    <div class="p-3 bg-amber-50 rounded-lg text-center">
                        <i data-lucide="wallet" class="w-4 h-4 text-amber-600 mx-auto mb-1"></i>
                        <p class="text-lg font-bold text-amber-700">${formatCurrency(s ? s.total_cash_received : 0)}</p>
                        <p class="text-[11px] text-amber-600">Cash Received</p>
                    </div>
                    <div class="p-3 bg-red-50 rounded-lg text-center">
                        <i data-lucide="credit-card" class="w-4 h-4 text-red-500 mx-auto mb-1"></i>
                        <p class="text-lg font-bold text-red-600">${formatCurrency(s ? s.total_credit_given : 0)}</p>
                        <p class="text-[11px] text-red-500">Credit Given</p>
                    </div>
                    <div class="p-3 bg-purple-50 rounded-lg text-center">
                        <i data-lucide="arrow-up-right" class="w-4 h-4 text-purple-600 mx-auto mb-1"></i>
                        <p class="text-lg font-bold text-purple-700">${formatCurrency(s ? s.total_cash_paid : 0)}</p>
                        <p class="text-[11px] text-purple-600">Cash Paid</p>
                    </div>
                    <div class="p-3 bg-orange-50 rounded-lg text-center">
                        <i data-lucide="rotate-ccw" class="w-4 h-4 text-orange-600 mx-auto mb-1"></i>
                        <p class="text-lg font-bold text-orange-600">${formatCurrency(s ? s.total_credit_used : 0)}</p>
                        <p class="text-[11px] text-orange-500">Credit Used</p>
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
                        <p class="font-bold ${s ? profitColor(s.estimated_profit) : "text-stone-900"}">${formatCurrency(s ? s.estimated_profit : 0)}</p>
                        <p class="text-[10px] text-stone-500">Est. Profit</p>
                    </div>
                </div>
            </div>

            ${
              d.categoryBreakdown.length > 0
                ? `
            <div class="bg-white rounded-xl border border-stone-200 p-4">
                <h3 class="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
                    <i data-lucide="pie-chart" class="w-4 h-4 text-amber-700"></i>
                    Category Breakdown
                </h3>
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
                <h3 class="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
                    <i data-lucide="banknote" class="w-4 h-4 text-amber-700"></i>
                    Cash Position
                </h3>
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

            ${
              !hasData
                ? `
            <div class="text-center py-8">
                <i data-lucide="file-x" class="w-10 h-10 text-stone-300 mx-auto mb-2"></i>
                <p class="text-sm text-stone-400">No transactions on this date</p>
            </div>`
                : ""
            }
        </div>
    `;
  if (window.lucide) lucide.createIcons();
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
                <h3 class="text-sm font-semibold text-stone-700 flex items-center gap-2">
                    <i data-lucide="calendar-range" class="w-4 h-4 text-amber-700"></i>
                    ${totals.dayCount} Day${totals.dayCount !== 1 ? "s" : ""} Summary
                </h3>
                <div class="grid grid-cols-3 gap-2">
                    <div class="p-3 bg-green-50 rounded-lg text-center">
                        <i data-lucide="trending-up" class="w-4 h-4 text-green-600 mx-auto mb-1"></i>
                        <p class="text-lg font-bold text-green-700">${formatCurrency(totals.total_sales)}</p>
                        <p class="text-[11px] text-green-600">Total Sales</p>
                    </div>
                    <div class="p-3 bg-blue-50 rounded-lg text-center">
                        <i data-lucide="shopping-cart" class="w-4 h-4 text-blue-600 mx-auto mb-1"></i>
                        <p class="text-lg font-bold text-blue-700">${formatCurrency(totals.total_purchases)}</p>
                        <p class="text-[11px] text-blue-600">Total Purchases</p>
                    </div>
                    <div class="p-3 bg-amber-50 rounded-lg text-center">
                        <i data-lucide="wallet" class="w-4 h-4 text-amber-600 mx-auto mb-1"></i>
                        <p class="text-lg font-bold text-amber-700">${formatCurrency(totals.total_cash_received)}</p>
                        <p class="text-[11px] text-amber-600">Cash Received</p>
                    </div>
                    <div class="p-3 bg-red-50 rounded-lg text-center">
                        <i data-lucide="credit-card" class="w-4 h-4 text-red-500 mx-auto mb-1"></i>
                        <p class="text-lg font-bold text-red-600">${formatCurrency(totals.total_credit_given)}</p>
                        <p class="text-[11px] text-red-500">Credit Given</p>
                    </div>
                    <div class="p-3 bg-purple-50 rounded-lg text-center">
                        <i data-lucide="arrow-up-right" class="w-4 h-4 text-purple-600 mx-auto mb-1"></i>
                        <p class="text-lg font-bold text-purple-700">${formatCurrency(totals.total_cash_paid)}</p>
                        <p class="text-[11px] text-purple-600">Cash Paid</p>
                    </div>
                    <div class="p-3 bg-orange-50 rounded-lg text-center">
                        <i data-lucide="rotate-ccw" class="w-4 h-4 text-orange-600 mx-auto mb-1"></i>
                        <p class="text-lg font-bold text-orange-600">${formatCurrency(totals.total_credit_used)}</p>
                        <p class="text-[11px] text-orange-500">Credit Used</p>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center text-sm">
                    <div class="p-2 bg-stone-50 rounded-lg">
                        <p class="font-bold text-stone-900">${totals.sale_count}</p>
                        <p class="text-[10px] text-stone-500">Sales</p>
                    </div>
                    <div class="p-2 bg-stone-50 rounded-lg">
                        <p class="font-bold text-stone-900">${totals.purchase_count}</p>
                        <p class="text-[10px] text-stone-500">Purchases</p>
                    </div>
                    <div class="p-2 bg-stone-50 rounded-lg">
                        <p class="font-bold ${profitColor(totals.estimated_profit)}">${formatCurrency(totals.estimated_profit)}</p>
                        <p class="text-[10px] text-stone-500">Est. Profit</p>
                    </div>
                </div>
            </div>
            ${
              summaries.length > 0
                ? `
            <div class="bg-white rounded-xl border border-stone-200 p-4">
                <h3 class="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
                    <i data-lucide="list" class="w-4 h-4 text-amber-700"></i>
                    Day by Day
                </h3>
                <div class="flex items-center justify-between py-2 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    <span>Date</span>
                    <span>Sales</span>
                    <span>Credit</span>
                    <span>Profit</span>
                </div>
                ${summaries
                  .map(
                    (s) => `
                    <div class="flex items-center justify-between py-2 border-b border-stone-100 last:border-0 text-sm">
                        <span class="text-stone-700 text-xs">${formatDateShort(s.summary_date)}</span>
                        <span class="font-medium text-green-700">${formatCurrency(s.total_sales)}</span>
                        <span class="font-medium text-red-500">${formatCurrency(s.total_credit_given)}</span>
                        <span class="font-bold ${profitColor(s.estimated_profit)}">${formatCurrency(s.estimated_profit)}</span>
                    </div>
                `,
                  )
                  .join("")}
            </div>`
                : `
            <div class="text-center py-8">
                <i data-lucide="file-x" class="w-10 h-10 text-stone-300 mx-auto mb-2"></i>
                <p class="text-sm text-stone-400">No data in this range</p>
            </div>`
            }
        </div>
    `;
  if (window.lucide) lucide.createIcons();
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
                <h3 class="text-sm font-semibold text-stone-700 flex items-center gap-2">
                    <i data-lucide="users" class="w-4 h-4 text-red-500"></i>
                    All Outstanding Credits
                </h3>
                <span class="text-sm font-bold text-red-600">${formatCurrency(totalOwed)}</span>
            </div>
            ${
              customers.length === 0
                ? `
            <div class="text-center py-8">
                <i data-lucide="check-circle" class="w-10 h-10 text-green-300 mx-auto mb-2"></i>
                <p class="text-sm text-stone-400">No outstanding credits</p>
            </div>`
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

import db from "../db/schema.js";
import { todayDate } from "../utils/uuid.js";
import { formatCurrency, formatNumber, toBool, escapeHtml } from "../utils/helpers.js";
import { updateHeader, updateNav } from "./viewHelpers.js";

export async function renderDashboard(mount) {
  updateHeader(null);
  updateNav("dashboard");

  mount.innerHTML = buildSkeleton();

  const [summary, recentTxns, lowStockProducts, debtors, categoryStock] =
    await Promise.all([
      loadTodaySummary(),
      loadRecentTransactions(),
      loadLowStock(),
      loadDebtors(),
      loadCategoryStock(),
    ]);

  mount.innerHTML = buildDashboard({
    summary,
    recentTxns,
    lowStockProducts,
    debtors,
    categoryStock,
  });

  // Attach click handlers (instead of inline onclick)
  const lowStockEl = document.getElementById("dash-low-stock");
  if (lowStockEl) {
    lowStockEl.addEventListener("click", () => {
      window.location.hash = "#products";
    });
  }
  const viewCustBtn = document.getElementById("dash-view-customers");
  if (viewCustBtn) {
    viewCustBtn.addEventListener("click", () => {
      window.location.hash = "#customers";
    });
  }

  if (window.lucide) lucide.createIcons();
}

// ============================================================
// DATA LOADERS
// ============================================================

async function loadTodaySummary() {
  try {
    const row = await db.daily_summaries
      .where("summary_date")
      .equals(todayDate())
      .first();
    return row || null;
  } catch {
    return null;
  }
}

async function loadRecentTransactions() {
  try {
    const txns = (await db.transactions.toArray())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5);

    if (txns.length === 0) return [];

    // Batch lookup customer and supplier names
    const customerIds = [
      ...new Set(txns.filter((t) => t.customer_id).map((t) => t.customer_id)),
    ];
    const supplierIds = [
      ...new Set(txns.filter((t) => t.supplier_id).map((t) => t.supplier_id)),
    ];

    const [customers, suppliers] = await Promise.all([
      customerIds.length > 0 ? db.customers.bulkGet(customerIds) : [],
      supplierIds.length > 0 ? db.suppliers.bulkGet(supplierIds) : [],
    ]);

    const customerMap = {};
    customers.filter(Boolean).forEach((c) => {
      customerMap[c.id] = c.name;
    });
    const supplierMap = {};
    suppliers.filter(Boolean).forEach((s) => {
      supplierMap[s.id] = s.name;
    });

    return txns.map((t) => ({
      ...t,
      party_name: t.customer_id
        ? customerMap[t.customer_id] || "Unknown Customer"
        : t.supplier_id
          ? supplierMap[t.supplier_id] || "Unknown Supplier"
          : null,
    }));
  } catch {
    return [];
  }
}

async function loadLowStock() {
  try {
    const products = await db.products.toArray();
    return products
      .filter(
        (p) =>
          toBool(p.is_active) &&
          p.min_stock_level > 0 &&
          p.stock_quantity <= p.min_stock_level,
      )
      .sort((a, b) => a.stock_quantity - b.stock_quantity); // Worst first
  } catch {
    return [];
  }
}

async function loadDebtors() {
  try {
    const customers = await db.customers.toArray();
    return customers
      .filter((c) => toBool(c.is_active) && c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 3);
  } catch {
    return [];
  }
}

async function loadCategoryStock() {
  try {
    const [products, categories] = await Promise.all([
      db.products.toArray(),
      db.categories.toArray(),
    ]);

    const activeProducts = products.filter((p) => toBool(p.is_active));
    const catMap = {};
    categories.forEach((c) => {
      catMap[c.id] = {
        name: c.name.replace(" Feed", ""),
        slug: c.slug,
        color: c.color,
        totalStock: 0,
        productCount: 0,
      };
    });

    activeProducts.forEach((p) => {
      if (catMap[p.category_id]) {
        catMap[p.category_id].totalStock += p.stock_quantity;
        catMap[p.category_id].productCount += 1;
      }
    });

    return Object.values(catMap);
  } catch {
    return [];
  }
}

// ============================================================
// SKELETON (shown during data load)
// ============================================================

function buildSkeleton() {
  return `
        <div class="p-4 space-y-4">
            <p class="text-sm text-stone-500">${formatDateLong(todayDate())}</p>
            <div class="grid grid-cols-3 gap-3">
                ${[1, 2, 3]
                  .map(
                    () => `
                    <div class="bg-white rounded-xl border border-stone-200 p-3 animate-pulse">
                        <div class="h-5 bg-stone-200 rounded w-12 mb-2"></div>
                        <div class="h-3 bg-stone-100 rounded w-16"></div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
            <div class="bg-white rounded-xl border border-stone-200 p-4 h-32 animate-pulse"></div>
            <div class="bg-white rounded-xl border border-stone-200 p-4 h-48 animate-pulse"></div>
        </div>
    `;
}

// ============================================================
// FULL DASHBOARD
// ============================================================

function buildDashboard({
  summary,
  recentTxns,
  lowStockProducts,
  debtors,
  categoryStock,
}) {
  const totalSales = summary ? summary.total_sales : 0;
  const salesCount = summary ? summary.sale_count : 0;
  const totalPurchases = summary ? summary.total_purchases : 0;
  const cashReceived = summary ? summary.total_cash_received : 0;
  const creditGiven = summary ? summary.total_credit_given : 0;
  const lowStockCount = lowStockProducts.length;
  const estimatedProfit = summary ? summary.estimated_profit : 0;

  return `
        <div class="p-4 space-y-4">

            <!-- Date -->
            <p class="text-sm text-stone-500 font-medium">${formatDateLong(todayDate())}</p>

            <!-- Stat Cards -->
            <div class="grid grid-cols-3 gap-3">
                <div class="bg-white rounded-xl border border-stone-200 p-3 text-center">
                    <i data-lucide="trending-up" class="w-5 h-5 text-green-600 mx-auto mb-1"></i>
                    <p class="text-lg font-bold text-stone-900">${formatCurrency(totalSales)}</p>
                    <p class="text-[11px] text-stone-500 mt-0.5">Today's Sales</p>
                </div>
                <div class="bg-white rounded-xl border border-stone-200 p-3 text-center">
                    <i data-lucide="shopping-cart" class="w-5 h-5 text-blue-500 mx-auto mb-1"></i>
                    <p class="text-lg font-bold text-stone-900">${salesCount}</p>
                    <p class="text-[11px] text-stone-500 mt-0.5">Sales Today</p>
                </div>
                <div class="bg-white rounded-xl border border-stone-200 p-3 text-center
                    ${lowStockCount > 0 ? "border-red-200 bg-red-50" : ""}">
                    <i data-lucide="alert-triangle" class="w-5 h-5 ${lowStockCount > 0 ? "text-red-500" : "text-stone-300"} mx-auto mb-1"></i>
                    <p class="text-lg font-bold ${lowStockCount > 0 ? "text-red-600" : "text-stone-900"}">${lowStockCount}</p>
                    <p class="text-[11px] ${lowStockCount > 0 ? "text-red-500" : "text-stone-500"} mt-0.5">Low Stock</p>
                </div>
            </div>

            ${lowStockCount > 0 ? buildLowStockAlert(lowStockProducts) : ""}

            <!-- Today's Breakdown -->
            ${
              totalSales > 0 || totalPurchases > 0
                ? buildTodayBreakdown({
                    totalSales,
                    cashReceived,
                    creditGiven,
                    totalPurchases,
                    estimatedProfit,
                  })
                : ""
            }

            <!-- Recent Transactions -->
            ${buildRecentTransactions(recentTxns)}

            <!-- Outstanding Credits -->
            ${debtors.length > 0 ? buildDebtors(debtors) : ""}

            <!-- Category Stock -->
            ${buildCategoryStock(categoryStock)}

        </div>
    `;
}

// ============================================================
// SECTIONS
// ============================================================

function buildLowStockAlert(products) {
  const top3 = products.slice(0, 3);
  const items = top3
    .map(
      (p) => `
        <span class="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-[11px] font-medium rounded mr-1 mb-1">
            ${escapeHtml(p.name)}: ${formatNumber(p.stock_quantity)} ${p.unit}
        </span>
    `,
    )
    .join("");

  const more =
    products.length > 3
      ? `<span class="text-[11px] text-red-500 font-medium">+${products.length - 3} more</span>`
      : "";

  return `
        <div id="dash-low-stock" class="bg-red-50 border border-red-200 rounded-xl p-3 cursor-pointer active:bg-red-100 transition-colors">
            <div class="flex items-start gap-2">
                <i data-lucide="alert-triangle" class="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"></i>
                <div>
                    <p class="text-sm font-semibold text-red-700">Low Stock Alert</p>
                    <div class="mt-1.5">${items} ${more}</div>
                </div>
            </div>
        </div>
    `;
}

function buildTodayBreakdown({
  totalSales,
  cashReceived,
  creditGiven,
  totalPurchases,
  estimatedProfit,
}) {
  const cashPct =
    totalSales > 0 ? Math.round((cashReceived / totalSales) * 100) : 0;
  const creditPct =
    totalSales > 0 ? Math.round((creditGiven / totalSales) * 100) : 0;

  return `
        <div class="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
            <h3 class="text-sm font-semibold text-stone-700 flex items-center gap-2">
                    <i data-lucide="bar-chart-3" class="w-4 h-4 text-amber-700"></i>
                    Today's Breakdown
                </h3>

            <div class="space-y-2">
                <!-- Sales bar -->
                <div>
                    <div class="flex justify-between text-xs mb-1">
                        <span class="text-stone-500">Sales ${formatCurrency(totalSales)}</span>
                    </div>
                    <div class="h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div class="h-full rounded-full" style="width:100%; background:#059669;"></div>
                    </div>
                    <div class="flex gap-3 mt-1">
                        <span class="text-[11px] text-stone-500">Cash ${cashPct}%</span>
                        <span class="text-[11px] text-stone-500">Credit ${creditPct}%</span>
                    </div>
                </div>

                ${
                  totalPurchases > 0
                    ? `
                <div class="flex justify-between text-sm pt-1 border-t border-stone-100">
                    <span class="text-stone-500">Purchases</span>
                    <span class="font-medium text-stone-900">${formatCurrency(totalPurchases)}</span>
                </div>
                `
                    : ""
                }

                ${
                  estimatedProfit !== 0
                    ? `
                <div class="flex justify-between text-sm pt-1 border-t border-stone-100">
                    <span class="text-stone-500">Est. Profit</span>
                    <span class="font-semibold ${estimatedProfit > 0 ? "text-green-700" : "text-red-600"}">${formatCurrency(estimatedProfit)}</span>
                </div>
                `
                    : ""
                }
            </div>
        </div>
    `;
}

function buildRecentTransactions(txns) {
  if (txns.length === 0) {
    return `
            <div class="bg-white rounded-xl border border-stone-200 p-4">
                <h3 class="text-sm font-semibold text-stone-700 mb-3">Recent Transactions</h3>
                <div class="text-center py-6">
                    <i data-lucide="receipt" class="w-10 h-10 text-stone-300 mx-auto mb-2"></i>
                    <p class="text-sm text-stone-400">No transactions yet</p>
                    <p class="text-xs text-stone-400 mt-0.5">Record a sale or purchase to see it here</p>
                </div>
            </div>
        `;
  }

  const cards = txns
    .map((t) => {
      const isSale = t.type === "SALE" || t.type === "SALE_RETURN";
      const isReturn = t.type.includes("RETURN");
      const typeColor = isReturn ? "#DC2626" : isSale ? "#059669" : "#2563EB";
      const typeBg = isReturn ? "#FEF2F2" : isSale ? "#ECFDF5" : "#EFF6FF";
      const typeLabel = t.type.replace("_", " ");

      const time = t.created_at
        ? new Date(t.created_at).toLocaleTimeString("en", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "";

      return `
            <div class="flex items-center gap-3 py-2.5 ${txns.indexOf(t) < txns.length - 1 ? "border-b border-stone-100" : ""}">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style="background:${typeBg};">
                    <i data-lucide="${isSale ? "trending-up" : "package"}" class="w-4 h-4" style="color:${typeColor};"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                        <span class="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                              style="background:${typeBg}; color:${typeColor};">${typeLabel}</span>
                        ${t.party_name ? `<span class="text-sm text-stone-700 truncate">${escapeHtml(t.party_name)}</span>` : '<span class="text-sm text-stone-400">Walk-in</span>'}
                    </div>
                    <p class="text-[11px] text-stone-400 mt-0.5">
                        ${t.item_count || 0} item${(t.item_count || 0) !== 1 ? "s" : ""} · ${t.total_quantity || 0} KG · ${t.payment_method}
                    </p>
                </div>
                <div class="text-right flex-shrink-0">
                    <p class="text-sm font-bold ${isReturn ? "text-red-600" : "text-stone-900"}">
                        ${isReturn ? "-" : ""}${formatCurrency(t.total_amount)}
                    </p>
                    <p class="text-[11px] text-stone-400">${time}</p>
                </div>
            </div>
        `;
    })
    .join("");

  return `
        <div class="bg-white rounded-xl border border-stone-200 p-4">
            <h3 class="text-sm font-semibold text-stone-700 mb-2 flex items-center gap-2">
                    <i data-lucide="receipt" class="w-4 h-4 text-amber-700"></i>
                    Recent Transactions
                </h3>
            ${cards}
        </div>
    `;
}

function buildDebtors(debtors) {
  const totalOwed = debtors.reduce((sum, c) => sum + c.balance, 0);

  const list = debtors
    .map(
      (c) => `
        <div class="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
            <div class="flex items-center gap-2 min-w-0">
                <div class="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="user" class="w-3.5 h-3.5 text-red-600"></i>
                </div>
                <span class="text-sm text-stone-800 truncate">${escapeHtml(c.name)}</span>
            </div>
            <span class="text-sm font-bold text-red-600 flex-shrink-0 ml-2">${formatCurrency(c.balance)}</span>
        </div>
    `,
    )
    .join("");

  return `
        <div class="bg-white rounded-xl border border-stone-200 p-4">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-semibold text-stone-700 flex items-center gap-2">
                        <i data-lucide="users" class="w-4 h-4 text-red-500"></i>
                        Outstanding Credits
                    </h3>
                <span class="text-xs font-bold text-red-600">${formatCurrency(totalOwed)} total</span>
            </div>
            ${list}
            <button id="dash-view-customers"
                class="w-full mt-3 pt-2 border-t border-stone-100 text-xs font-semibold
                       text-amber-700 text-center">
                View All Customers
            </button>
        </div>
    `;
}

function buildCategoryStock(categories) {
  if (categories.length === 0) return "";

  const maxStock = Math.max(...categories.map((c) => c.totalStock), 1);

  const bars = categories
    .map((c) => {
      const pct = Math.max(2, (c.totalStock / maxStock) * 100);
      return `
            <div class="flex-1">
                <div class="h-24 rounded-lg relative overflow-hidden" style="background:${c.color}15; border:1px solid ${c.color}30;">
                    <div class="absolute bottom-0 left-0 right-0 rounded-b-lg transition-all duration-500"
                         style="height:${pct}%; background:${c.color}; opacity:0.7;"></div>
                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                        <span class="text-xs font-bold" style="color:${c.color};">${formatNumber(c.totalStock)}</span>
                        <span class="text-[10px]" style="color:${c.color}; opacity:0.7;">KG</span>
                    </div>
                </div>
                <p class="text-[11px] font-semibold text-center mt-1.5 truncate" style="color:${c.color};">${c.name}</p>
                <p class="text-[10px] text-stone-400 text-center">${c.productCount} item${c.productCount !== 1 ? "s" : ""}</p>
            </div>
        `;
    })
    .join("");

  return `
        <div class="bg-white rounded-xl border border-stone-200 p-4">
            <h3 class="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
                    <i data-lucide="package" class="w-4 h-4 text-amber-700"></i>
                    Stock by Category
                </h3>
            <div class="flex gap-3">${bars}</div>
        </div>
    `;
}

// ============================================================
// UTILITY
// ============================================================

function formatDateLong(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}


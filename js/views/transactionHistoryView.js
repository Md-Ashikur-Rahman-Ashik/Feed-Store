import db from "../db/schema.js";
import { formatCurrency, formatNumber, toBool } from "../utils/helpers.js";
import { todayDate } from "../utils/uuid.js";
import { updateHeader, updateNav } from "./viewHelpers.js";

let filterType = "ALL";
let filterFrom = "";
let filterTo = "";
let searchTerm = "";

export async function renderTransactionHistory(mount) {
  updateHeader("Transactions");
  updateNav("more");
  filterType = "ALL";
  filterFrom = "";
  filterTo = "";
  searchTerm = "";
  mount.innerHTML = buildShell();
  await loadTransactions();
}

function buildShell() {
  return `
        <div class="p-4 space-y-3 pb-8">
            <div class="flex gap-2 overflow-x-auto no-scrollbar" style="-ms-overflow-style:none;scrollbar-width:none;">
                <button class="tx-tab" data-type="ALL">All</button>
                <button class="tx-tab" data-type="SALE">Sales</button>
                <button class="tx-tab" data-type="PURCHASE">Purchases</button>
                <button class="tx-tab" data-type="SALE_RETURN">Sale Returns</button>
                <button class="tx-tab" data-type="PURCHASE_RETURN">Purchase Returns</button>
            </div>
            <style>
                .tx-tab { flex-shrink:0; padding:5px 12px; border-radius:16px; font-size:12px; font-weight:600;
                    border:1.5px solid #E7E5E4; background:white; color:#78716C;
                    transition:all 0.15s; cursor:pointer; font-family:'DM Sans',sans-serif; white-space:nowrap; }
                .tx-tab.active { color:white; border-color:transparent; background:#B45309; }
            </style>
            <div class="flex gap-2">
                <input id="tx-from" type="date" placeholder="From"
                    class="flex-1 h-9 px-2 border border-stone-300 rounded-lg text-xs text-stone-900
                           focus:outline-none focus:ring-2 focus:ring-amber-700" style="font-size:14px;">
                <input id="tx-to" type="date" placeholder="To"
                    class="flex-1 h-9 px-2 border border-stone-300 rounded-lg text-xs text-stone-900
                           focus:outline-none focus:ring-2 focus:ring-amber-700" style="font-size:14px;">
            </div>
            <div class="relative">
                <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"></i>
                <input id="tx-search" type="text" inputmode="text" autocomplete="off"
                    placeholder="Search by name..."
                    class="w-full h-9 pl-10 pr-3 bg-white border border-stone-200 rounded-lg
                           text-sm text-stone-900 placeholder-stone-400
                           focus:outline-none focus:ring-2 focus:ring-amber-700" style="font-size:16px;">
            </div>
            <p id="tx-count" class="text-xs text-stone-500 px-1"></p>
            <div id="tx-list" class="space-y-2"></div>
        </div>
    `;
  if (window.lucide) lucide.createIcons();
}

async function loadTransactions() {
  const list = document.getElementById("tx-list");
  const count = document.getElementById("tx-count");
  list.innerHTML =
    '<div class="text-center py-8"><div class="inline-block w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin"></div></div>';

  let txns = (await db.transactions.toArray()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  if (filterType !== "ALL") txns = txns.filter((t) => t.type === filterType);
  if (filterFrom) txns = txns.filter((t) => t.transaction_date >= filterFrom);
  if (filterTo) txns = txns.filter((t) => t.transaction_date <= filterTo);

  if (searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    const cIds = [
      ...new Set(txns.filter((t) => t.customer_id).map((t) => t.customer_id)),
    ];
    const sIds = [
      ...new Set(txns.filter((t) => t.supplier_id).map((t) => t.supplier_id)),
    ];
    const [custs, supps] = await Promise.all([
      cIds.length ? (await db.customers.bulkGet(cIds)).filter(Boolean) : [],
      sIds.length ? (await db.suppliers.bulkGet(sIds)).filter(Boolean) : [],
    ]);
    const nameMap = {};
    custs.forEach((c) => {
      nameMap[c.id] = c.name.toLowerCase();
    });
    supps.forEach((s) => {
      nameMap[s.id] = s.name.toLowerCase();
    });
    txns = txns.filter((t) => {
      const pid = t.customer_id || t.supplier_id;
      return pid && nameMap[pid] && nameMap[pid].includes(term);
    });
  }

  // Batch load names for display
  const cIds = [
    ...new Set(txns.filter((t) => t.customer_id).map((t) => t.customer_id)),
  ];
  const sIds = [
    ...new Set(txns.filter((t) => t.supplier_id).map((t) => t.supplier_id)),
  ];
  const [custs, supps] = await Promise.all([
    cIds.length ? (await db.customers.bulkGet(cIds)).filter(Boolean) : [],
    sIds.length ? (await db.suppliers.bulkGet(sIds)).filter(Boolean) : [],
  ]);
  const cMap = {};
  custs.forEach((c) => {
    cMap[c.id] = c.name;
  });
  const sMap = {};
  supps.forEach((s) => {
    sMap[s.id] = s.name;
  });

  count.textContent = `${txns.length} transaction${txns.length !== 1 ? "s" : ""}`;

  if (txns.length === 0) {
    list.innerHTML =
      '<div class="text-center py-8"><p class="text-sm text-stone-400">No transactions found</p></div>';
    return;
  }

  list.innerHTML = txns
    .map((t) => {
      const isSale = t.type.includes("SALE");
      const isReturn = t.type.includes("RETURN");
      const typeColor = isReturn ? "#DC2626" : isSale ? "#059669" : "#2563EB";
      const typeBg = isReturn ? "#FEF2F2" : isSale ? "#ECFDF5" : "#EFF6FF";
      const party = t.customer_id
        ? cMap[t.customer_id] || "—"
        : t.supplier_id
          ? sMap[t.supplier_id] || "—"
          : null;
      const time = t.created_at
        ? new Date(t.created_at).toLocaleTimeString("en", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "";

      return `
        <div class="bg-white rounded-xl border border-stone-200 p-3">
            <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style="background:${typeBg};">
                    <i data-lucide="${isSale ? "trending-up" : "package"}" class="w-4 h-4" style="color:${typeColor};"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded" style="background:${typeBg};color:${typeColor};">${t.type.replace("_", " ")}</span>
                        ${party ? `<span class="text-sm text-stone-700 truncate">${escapeHtml(party)}</span>` : '<span class="text-sm text-stone-400">Walk-in</span>'}
                    </div>
                    <p class="text-[11px] text-stone-400 mt-0.5">${t.transaction_date} · ${time} · ${t.payment_method} · ${t.item_count || 0} items</p>
                </div>
                <div class="text-right flex-shrink-0">
                    <p class="text-sm font-bold ${isReturn ? "text-red-600" : "text-stone-900"}">${isReturn ? "-" : ""}${formatCurrency(t.total_amount)}</p>
                    ${t.amount_due > 0 ? `<p class="text-[10px] text-red-500">Due: ${formatCurrency(t.amount_due)}</p>` : ""}
                </div>
            </div>
        </div>`;
    })
    .join("");
  if (window.lucide) lucide.createIcons();
}

document.addEventListener("click", (e) => {
  const tab = e.target.closest(".tx-tab");
  if (tab) {
    filterType = tab.dataset.type;
    document
      .querySelectorAll(".tx-tab")
      .forEach((t) =>
        t.classList.toggle("active", t.dataset.type === filterType),
      );
    loadTransactions();
    return;
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "tx-search") {
    searchTerm = e.target.value;
    loadTransactions();
    return;
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "tx-from") {
    filterFrom = e.target.value;
    loadTransactions();
    return;
  }
  if (e.target.id === "tx-to") {
    filterTo = e.target.value;
    loadTransactions();
    return;
  }
});

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

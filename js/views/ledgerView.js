import CustomerService from "../services/customerService.js";
import SupplierService from "../services/supplierService.js";
import { formatCurrency } from "../utils/helpers.js";
import { todayDate } from "../utils/uuid.js";
import { updateHeader, updateNav, showToast } from "./viewHelpers.js";

export async function renderLedger(mount) {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.split("?")[1] || "");
  const id = params.get("id");

  if (!id) {
    updateHeader("Statement");
    updateNav("more");
    mount.innerHTML = '<p class="p-4 text-sm text-stone-400">Missing ID</p>';
    return;
  }

  const isCustomer = hash.startsWith("#customer");
  updateHeader(isCustomer ? "Customer Statement" : "Supplier Statement");
  updateNav("more");

  mount.innerHTML =
    '<div class="p-4"><div class="text-center py-8"><div class="inline-block w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin"></div></div></div>';

  const result = isCustomer
    ? await CustomerService.getLedger(id)
    : await SupplierService.getLedger(id);

  if (!result.success) {
    mount.innerHTML = `<p class="p-4 text-sm text-red-600">${result.error}</p>`;
    return;
  }

  const { customer, supplier, entries } = result.data;
  const entity = customer || supplier;
  const balance = entity.balance;
  const fromDate = todayDate().substring(0, 8) + "01"; // First of month

  mount.innerHTML = `
        <div class="p-4 space-y-4 pb-8">
            <div class="flex items-center gap-3 p-3 bg-white border border-stone-200 rounded-lg">
                <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="${isCustomer ? "user" : "truck"}" class="w-5 h-5 text-amber-700"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-base font-bold text-stone-900 truncate">${escapeHtml(entity.name)}</p>
                    ${entity.phone ? `<p class="text-sm text-stone-500">${escapeHtml(entity.phone)}</p>` : ""}
                </div>
            </div>

            <div class="p-4 rounded-lg ${balance > 0 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}">
                <p class="text-xs font-medium ${balance > 0 ? "text-red-500" : "text-green-600"} mb-1">${isCustomer ? "Outstanding Balance" : "We Owe"}</p>
                <p class="text-2xl font-bold ${balance > 0 ? "text-red-700" : "text-green-700"}">${formatCurrency(balance)}</p>
            </div>

            ${
              entries.length > 0
                ? `
            <div class="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-stone-50 text-left">
                            <th class="px-3 py-2 text-[11px] font-semibold text-stone-500 w-20">Date</th>
                            <th class="px-3 py-2 text-[11px] font-semibold text-stone-500">Description</th>
                            <th class="px-3 py-2 text-[11px] font-semibold text-stone-500 text-right w-20">Debit</th>
                            <th class="px-3 py-2 text-[11px] font-semibold text-stone-500 text-right w-20">Credit</th>
                            <th class="px-3 py-2 text-[11px] font-semibold text-stone-500 text-right w-24">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${entries
                          .map(
                            (e) => `
                            <tr class="border-t border-stone-100">
                                <td class="px-3 py-2.5 text-stone-500 text-xs">${e.entry_date.substring(5)}</td>
                                <td class="px-3 py-2.5 text-stone-800 text-xs">${escapeHtml(e.description)}</td>
                                <td class="px-3 py-2.5 text-right text-xs ${e.debit > 0 ? "text-red-600 font-medium" : "text-stone-300"}">${e.debit > 0 ? formatCurrency(e.debit) : ""}</td>
                                <td class="px-3 py-2.5 text-right text-xs ${e.credit > 0 ? "text-green-700 font-medium" : "text-stone-300"}">${e.credit > 0 ? formatCurrency(e.credit) : ""}</td>
                                <td class="px-3 py-2.5 text-right text-xs font-bold text-stone-900">${formatCurrency(e.running_balance)}</td>
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>`
                : '<p class="text-center text-sm text-stone-400 py-6">No ledger entries yet</p>'
            }
        </div>
    `;
  if (window.lucide) lucide.createIcons();
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

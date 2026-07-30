import db from "../db/schema.js";
import { formatCurrency, escapeHtml } from "../utils/helpers.js";
import { todayDate } from "../utils/uuid.js";
import { useMountEffect, updateHeader, updateNav } from "./viewHelpers.js";

let selectedDate = todayDate();

export async function renderCashBook(mount) {
  updateHeader("Cash Book");
  updateNav("more");
  mount.innerHTML = `
        <div class="p-4 space-y-4 pb-8">
            <div class="flex items-center gap-2">
                <label class="text-sm font-medium text-stone-600">Date:</label>
                <input id="cb-date" type="date" value="${selectedDate}"
                    class="flex-1 h-10 px-3 border border-stone-300 rounded-lg text-sm text-stone-900
                           focus:outline-none focus:ring-2 focus:ring-amber-700" style="font-size:16px;">
            </div>
            <div id="cb-body"></div>
        </div>
    `;
  await loadCashBook();

  useMountEffect(({ on }) => {
    on("change", (e) => {
      if (e.target.id === "cb-date") {
        selectedDate = e.target.value;
        loadCashBook();
      }
    });
  });
}


async function loadCashBook() {
  const body = document.getElementById("cb-body");
  body.innerHTML =
    '<div class="text-center py-8"><div class="inline-block w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin"></div></div>';

  const allCash = (await db.ledger_entries.toArray())
    .filter((e) => e.entity_type === "CASH")
    .sort(
      (a, b) =>
        a.entry_date.localeCompare(b.entry_date) ||
        a.created_at.localeCompare(b.created_at),
    );

  const prevEntries = allCash.filter((e) => e.entry_date < selectedDate);
  const opening =
    prevEntries.length > 0
      ? prevEntries[prevEntries.length - 1].running_balance
      : 0;

  const dayEntries = allCash.filter((e) => e.entry_date === selectedDate);
  const cashIn = dayEntries.reduce((s, e) => s + e.debit, 0);
  const cashOut = dayEntries.reduce((s, e) => s + e.credit, 0);
  const closing = opening + cashIn - cashOut;

  body.innerHTML = `
        <div class="space-y-4">
            <div class="bg-white rounded-xl border border-stone-200 p-4">
                <h3 class="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
                    <i data-lucide="wallet" class="w-4 h-4 text-amber-700"></i>
                    Cash Summary — ${formatDateLong(selectedDate)}
                </h3>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-stone-500 flex items-center gap-1.5">
                            <i data-lucide="flag" class="w-3.5 h-3.5 text-stone-400"></i>
                            Opening Balance
                        </span>
                        <span class="font-medium text-stone-900">${formatCurrency(opening)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-stone-500 flex items-center gap-1.5">
                            <i data-lucide="arrow-down-left" class="w-3.5 h-3.5 text-green-500"></i>
                            Cash In (+)
                        </span>
                        <span class="font-medium text-green-700">+${formatCurrency(cashIn)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-stone-500 flex items-center gap-1.5">
                            <i data-lucide="arrow-up-right" class="w-3.5 h-3.5 text-red-500"></i>
                            Cash Out (-)
                        </span>
                        <span class="font-medium text-red-600">-${formatCurrency(cashOut)}</span>
                    </div>
                    <div class="flex justify-between pt-2 border-t border-stone-200">
                        <span class="font-semibold text-stone-700 flex items-center gap-1.5">
                            <i data-lucide="landmark" class="w-3.5 h-3.5 text-stone-600"></i>
                            Closing Balance
                        </span>
                        <span class="font-bold text-stone-900 text-base">${formatCurrency(closing)}</span>
                    </div>
                </div>
            </div>

            ${
              dayEntries.length > 0
                ? `
            <div class="bg-white rounded-xl border border-stone-200 p-4">
                <h3 class="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
                    <i data-lucide="list" class="w-4 h-4 text-amber-700"></i>
                    Entries
                </h3>
                ${dayEntries
                  .map(
                    (e) => `
                    <div class="flex items-center gap-3 py-2 border-b border-stone-100 last:border-0 text-sm">
                        <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${e.debit > 0 ? "bg-green-100" : "bg-red-100"}">
                            <i data-lucide="${e.debit > 0 ? "arrow-down-left" : "arrow-up-right"}" class="w-3.5 h-3.5 ${e.debit > 0 ? "text-green-600" : "text-red-600"}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-stone-800 truncate">${escapeHtml(e.description)}</p>
                        </div>
                        <span class="font-bold flex-shrink-0 ${e.debit > 0 ? "text-green-700" : "text-red-600"}">${e.debit > 0 ? "+" : "-"}${formatCurrency(e.debit || e.credit)}</span>
                    </div>
                `,
                  )
                  .join("")}
            </div>`
                : `
            <div class="text-center py-8">
                <i data-lucide="file-x" class="w-10 h-10 text-stone-300 mx-auto mb-2"></i>
                <p class="text-sm text-stone-400">No cash entries on this date</p>
            </div>`
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

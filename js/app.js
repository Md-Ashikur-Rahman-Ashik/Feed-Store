/**
 * app.js — Application shell, login, all views, settings.
 *
 * Structure:
 *   1. Imports & state
 *   2. Login view
 *   3. App shell (header, bottom nav, more menu, logout modal)
 *   4. Placeholder views
 *   5. Settings view
 *   6. Route registration & initialization
 */

import db from "./db/schema.js";
import { CONFIG, CATEGORY_COLORS } from "./config.js";
import * as auth from "./utils/auth.js";
import * as router from "./router.js";
import SettingsService from "./services/settingsService.js";
import { seedCategories } from "./db/seed.js";
import {
  updateHeader,
  updateNav,
  setAppSettings,
  showToast,
} from "./views/viewHelpers.js";
import { renderProducts } from "./views/productsView.js";
import { renderCustomers } from "./views/customersView.js";
import { renderSuppliers } from "./views/suppliersView.js";

// ============================================================
// APP STATE
// ============================================================

const state = {
  settings: null,
  moreOpen: false,
  logoutOpen: false,
};

// ============================================================
// LOGIN VIEW
// ============================================================

function renderLogin(mount) {
  let isFirstVisit = false;

  mount.innerHTML = `
        <div class="min-h-screen flex items-center justify-center px-6"
             style="background: linear-gradient(160deg, #F5F3EF 0%, #EDE8DF 100%);">
            <div class="w-full max-w-sm">
                <div class="text-center mb-8">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
                         style="background: #B45309;">
                        <i data-lucide="wheat" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-stone-900">Feed Store</h1>
                    <p id="login-subtitle" class="text-stone-500 text-sm mt-1"></p>
                </div>

                <div class="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                    <div id="login-error"
                         class="hidden mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    </div>
                    <div id="login-form"></div>
                </div>

                <p class="text-center text-stone-400 text-xs mt-6">
                    Data is stored locally on this device
                </p>
            </div>
        </div>
    `;

  if (window.lucide) lucide.createIcons();

  auth.isPasswordSet().then((set) => {
    isFirstVisit = !set;
    document.getElementById("login-subtitle").textContent = isFirstVisit
      ? "Create a password to get started"
      : "Enter your password to continue";
    renderForm(isFirstVisit);
  });

  function renderForm(firstVisit) {
    const form = document.getElementById("login-form");
    form.innerHTML = `
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
                    <div class="relative">
                        <input id="login-pw" type="password" autocomplete="current-password"
                               class="w-full h-12 px-4 pr-12 border border-stone-300 rounded-lg
                                      text-stone-900 text-base focus:outline-none focus:ring-2
                                      focus:ring-amber-700 focus:border-amber-700"
                               style="-webkit-appearance:none;font-size:16px;"
                               placeholder="Enter password">
                        <button type="button" id="login-toggle-pw"
                                class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400
                                       hover:text-stone-600" aria-label="Toggle password visibility">
                            <i data-lucide="eye" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
                <div id="confirm-pw-group" class="${firstVisit ? "" : "hidden"}">
                    <label class="block text-sm font-medium text-stone-700 mb-1.5">Confirm Password</label>
                    <div class="relative">
                        <input id="login-confirm-pw" type="password" autocomplete="new-password"
                               class="w-full h-12 px-4 pr-12 border border-stone-300 rounded-lg
                                      text-stone-900 text-base focus:outline-none focus:ring-2
                                      focus:ring-amber-700 focus:border-amber-700"
                               style="-webkit-appearance:none;font-size:16px;"
                               placeholder="Re-enter password">
                        <button type="button" id="login-toggle-confirm"
                                class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400
                                       hover:text-stone-600" aria-label="Toggle password visibility">
                            <i data-lucide="eye" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
                <button id="login-btn"
                        class="w-full h-12 bg-amber-700 hover:bg-amber-800 text-white font-semibold
                               rounded-lg text-base transition-colors disabled:opacity-50
                               disabled:cursor-not-allowed mt-2">
                    ${firstVisit ? "Get Started" : "Login"}
                </button>
            </div>
        `;
    if (window.lucide) lucide.createIcons();
    attachFormHandlers(firstVisit);
  }

  function attachFormHandlers(firstVisit) {
    const togglePw = (inputId, btnId) => {
      const input = document.getElementById(inputId);
      const btn = document.getElementById(btnId);
      btn.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.innerHTML = `<i data-lucide="${show ? "eye-off" : "eye"}" class="w-5 h-5"></i>`;
        if (window.lucide) lucide.createIcons();
      });
    };
    togglePw("login-pw", "login-toggle-pw");
    if (firstVisit) togglePw("login-confirm-pw", "login-toggle-confirm");

    document.getElementById("login-btn").addEventListener("click", async () => {
      const errEl = document.getElementById("login-error");
      const btn = document.getElementById("login-btn");
      const pw = document.getElementById("login-pw").value;
      errEl.classList.add("hidden");
      btn.disabled = true;
      btn.textContent = "Please wait...";

      let result;
      if (firstVisit) {
        const confirm = document.getElementById("login-confirm-pw").value;
        if (pw !== confirm) {
          errEl.textContent = "Passwords do not match";
          errEl.classList.remove("hidden");
          btn.disabled = false;
          btn.textContent = "Get Started";
          return;
        }
        result = await auth.setPassword(pw);
      } else {
        result = await auth.verifyPassword(pw);
      }

      if (result.success) {
        const s = await SettingsService.get();
        state.settings = s.data;
        setAppSettings(state.settings);
        renderShell(document.getElementById("app"));
        router.setMountPoint(document.getElementById("view-mount"));
        router.navigate("dashboard");
      } else {
        errEl.textContent = result.error;
        errEl.classList.remove("hidden");
        btn.disabled = false;
        btn.textContent = firstVisit ? "Get Started" : "Login";
      }
    });

    document.getElementById("login-pw").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("login-btn").click();
    });
    if (firstVisit) {
      document
        .getElementById("login-confirm-pw")
        .addEventListener("keydown", (e) => {
          if (e.key === "Enter") document.getElementById("login-btn").click();
        });
    }
  }
}

// ============================================================
// APP SHELL
// ============================================================

function renderShell(appEl) {
  const name = state.settings?.store_name || "Feed Store";
  appEl.innerHTML = `
        <header id="app-header" class="fixed top-0 left-0 right-0 h-14 bg-white border-b border-stone-200
                                       flex items-center px-4 z-30"
                style="padding-top: env(safe-area-inset-top, 0px);">
            <button id="header-back" class="hidden p-2 -ml-2 text-stone-600 hover:text-stone-900
                                              rounded-lg" aria-label="Go back">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </button>
            <h1 id="header-title" class="text-base font-bold text-stone-900 truncate">${name}</h1>
            <div class="flex-1"></div>
            <button id="header-logout" class="p-2 -mr-2 text-stone-400 hover:text-red-600
                                             rounded-lg" aria-label="Logout">
                <i data-lucide="log-out" class="w-5 h-5"></i>
            </button>
        </header>
        <main id="view-mount" class="pt-14 pb-16 min-h-screen bg-stone-100"></main>
        <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-30
                     grid grid-cols-4"
             style="padding-bottom: env(safe-area-inset-bottom, 0px); height: calc(60px + env(safe-area-inset-bottom, 0px));">
            <button data-nav="dashboard" class="nav-btn flex flex-col items-center justify-center
                     gap-0.5 text-amber-700">
                <i data-lucide="home" class="w-5 h-5"></i>
                <span class="text-[11px] font-medium">Home</span>
            </button>
            <button data-nav="sale" class="nav-btn flex flex-col items-center justify-center
                     gap-0.5 text-stone-400">
                <i data-lucide="trending-up" class="w-5 h-5"></i>
                <span class="text-[11px] font-medium">Sale</span>
            </button>
            <button data-nav="purchase" class="nav-btn flex flex-col items-center justify-center
                     gap-0.5 text-stone-400">
                <i data-lucide="package" class="w-5 h-5"></i>
                <span class="text-[11px] font-medium">Purchase</span>
            </button>
            <button data-nav="more" class="nav-btn flex flex-col items-center justify-center
                     gap-0.5 text-stone-400">
                <i data-lucide="grid-3x3" class="w-5 h-5"></i>
                <span class="text-[11px] font-medium">More</span>
            </button>
        </nav>
        <div id="more-overlay" class="fixed inset-0 bg-black/40 z-40 opacity-0
                    pointer-events-none transition-opacity duration-200"></div>
        <div id="more-sheet" class="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-40
                    transform translate-y-full transition-transform duration-250 ease-out"
             style="max-height: 55vh; padding-bottom: env(safe-area-inset-bottom, 16px);
                    transition:transform 0.25s cubic-bezier(0.32,0.72,0,1);">
            <div class="flex justify-center pt-3 pb-2">
                <div class="w-9 h-1 bg-stone-300 rounded-full"></div>
            </div>
            <div class="px-2 pb-2">
                <button data-more="products" class="more-item w-full flex items-center gap-3
                    h-12 px-3 rounded-lg hover:bg-stone-50 text-left">
                    <i data-lucide="package" class="w-5 h-5 text-stone-500"></i>
                    <span class="text-sm font-medium text-stone-800">Products</span>
                </button>
                <button data-more="customers" class="more-item w-full flex items-center gap-3
                    h-12 px-3 rounded-lg hover:bg-stone-50 text-left">
                    <i data-lucide="users" class="w-5 h-5 text-stone-500"></i>
                    <span class="text-sm font-medium text-stone-800">Customers</span>
                </button>
                <button data-more="suppliers" class="more-item w-full flex items-center gap-3
                    h-12 px-3 rounded-lg hover:bg-stone-50 text-left">
                    <i data-lucide="truck" class="w-5 h-5 text-stone-500"></i>
                    <span class="text-sm font-medium text-stone-800">Suppliers</span>
                </button>
                <button data-more="reports" class="more-item w-full flex items-center gap-3
                    h-12 px-3 rounded-lg hover:bg-stone-50 text-left">
                    <i data-lucide="bar-chart-3" class="w-5 h-5 text-stone-500"></i>
                    <span class="text-sm font-medium text-stone-800">Reports</span>
                </button>
                <button data-more="cash-book" class="more-item w-full flex items-center gap-3
                    h-12 px-3 rounded-lg hover:bg-stone-50 text-left">
                    <i data-lucide="wallet" class="w-5 h-5 text-stone-500"></i>
                    <span class="text-sm font-medium text-stone-800">Cash Book</span>
                </button>
                <div class="border-t border-stone-100 my-1"></div>
                <button data-more="settings" class="more-item w-full flex items-center gap-3
                    h-12 px-3 rounded-lg hover:bg-stone-50 text-left">
                    <i data-lucide="settings" class="w-5 h-5 text-stone-500"></i>
                    <span class="text-sm font-medium text-stone-800">Settings</span>
                </button>
            </div>
        </div>
        <div id="logout-modal" class="fixed inset-0 bg-black/40 z-50 flex items-center
                    justify-center px-6 opacity-0 pointer-events-none transition-opacity duration-200">
            <div class="bg-white rounded-xl w-full max-w-xs p-6 shadow-xl">
                <h3 class="text-lg font-bold text-stone-900 mb-2">Logout?</h3>
                <p class="text-sm text-stone-500 mb-6">Are you sure you want to logout?</p>
                <div class="flex gap-3">
                    <button id="logout-cancel" class="flex-1 h-11 border border-stone-300 rounded-lg
                        text-sm font-semibold text-stone-700 hover:bg-stone-50 transition-colors">
                        Cancel
                    </button>
                    <button id="logout-confirm" class="flex-1 h-11 bg-red-600 hover:bg-red-700
                        rounded-lg text-sm font-semibold text-white transition-colors">
                        Logout
                    </button>
                </div>
            </div>
        </div>
    `;
  if (window.lucide) lucide.createIcons();
  attachShellHandlers();
}

function attachShellHandlers() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.nav;
      if (target === "more") {
        openMore();
      } else {
        closeMore();
        router.navigate(target);
      }
    });
  });
  document.querySelectorAll(".more-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeMore();
      router.navigate(btn.dataset.more);
    });
  });
  document.getElementById("more-overlay").addEventListener("click", closeMore);
  document.getElementById("header-logout").addEventListener("click", () => {
    state.logoutOpen = true;
    const m = document.getElementById("logout-modal");
    m.classList.remove("opacity-0", "pointer-events-none");
    m.classList.add("opacity-100", "pointer-events-auto");
  });
  document
    .getElementById("logout-cancel")
    .addEventListener("click", closeLogout);
  document.getElementById("logout-confirm").addEventListener("click", () => {
    closeLogout();
    auth.logout();
  });
  document.getElementById("logout-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeLogout();
  });
}

function openMore() {
  state.moreOpen = true;
  const o = document.getElementById("more-overlay");
  const s = document.getElementById("more-sheet");
  o.classList.remove("opacity-0", "pointer-events-none");
  o.classList.add("opacity-100", "pointer-events-auto");
  s.classList.remove("translate-y-full");
  s.classList.add("translate-y-0");
}
function closeMore() {
  state.moreOpen = false;
  const o = document.getElementById("more-overlay");
  const s = document.getElementById("more-sheet");
  o.classList.add("opacity-0", "pointer-events-none");
  o.classList.remove("opacity-100", "pointer-events-auto");
  s.classList.add("translate-y-full");
  s.classList.remove("translate-y-0");
}
function closeLogout() {
  state.logoutOpen = false;
  const m = document.getElementById("logout-modal");
  m.classList.add("opacity-0", "pointer-events-none");
  m.classList.remove("opacity-100", "pointer-events-auto");
}

// ============================================================
// PLACEHOLDER VIEWS
// ============================================================

function renderPlaceholder(mount, { title, description, phase, items }) {
  updateHeader(title);
  updateNav(router.getCurrentRoute());
  const itemsHtml = items
    .map(
      (i) =>
        `<li class="flex items-start gap-2 text-sm text-stone-600">
            <i data-lucide="check" class="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0"></i>
            <span>${i}</span>
        </li>`,
    )
    .join("");
  mount.innerHTML = `
        <div class="p-4 space-y-5">
            <div><p class="text-stone-500 text-sm">${description}</p></div>
            <div class="bg-white rounded-xl border border-stone-200 p-5">
                <ul class="space-y-3">${itemsHtml}</ul>
            </div>
            <div class="text-center">
                <span class="inline-block px-3 py-1.5 bg-amber-50 text-amber-700
                             text-xs font-semibold rounded-full">Built in ${phase}</span>
            </div>
        </div>
    `;
  if (window.lucide) lucide.createIcons();
}

// ============================================================
// DASHBOARD VIEW
// ============================================================

function renderDashboard(mount) {
  updateHeader(null);
  updateNav("dashboard");
  mount.innerHTML = `
        <div class="p-4 space-y-5">
            <div class="grid grid-cols-3 gap-3">
                <div class="bg-white rounded-xl border border-stone-200 p-3 text-center">
                    <p class="text-lg font-bold text-stone-900">৳0</p>
                    <p class="text-[11px] text-stone-500 mt-0.5">Today's Sales</p>
                </div>
                <div class="bg-white rounded-xl border border-stone-200 p-3 text-center">
                    <p class="text-lg font-bold text-stone-900">0</p>
                    <p class="text-[11px] text-stone-500 mt-0.5">Sales Today</p>
                </div>
                <div class="bg-white rounded-xl border border-stone-200 p-3 text-center">
                    <p class="text-lg font-bold text-stone-900">0</p>
                    <p class="text-[11px] text-stone-500 mt-0.5">Low Stock</p>
                </div>
            </div>
            <div class="bg-white rounded-xl border border-stone-200 p-4">
                <h3 class="text-sm font-semibold text-stone-700 mb-3">Recent Transactions</h3>
                <div class="text-center py-6">
                    <i data-lucide="receipt" class="w-10 h-10 text-stone-300 mx-auto mb-2"></i>
                    <p class="text-sm text-stone-400">No transactions yet</p>
                </div>
            </div>
            <div class="bg-white rounded-xl border border-stone-200 p-4">
                <h3 class="text-sm font-semibold text-stone-700 mb-3">Feed Categories</h3>
                <div class="flex gap-4">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background:${CATEGORY_COLORS.poultry}"></div>
                        <span class="text-sm text-stone-600">Poultry</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background:${CATEGORY_COLORS.fish}"></div>
                        <span class="text-sm text-stone-600">Fish</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background:${CATEGORY_COLORS.cow}"></div>
                        <span class="text-sm text-stone-600">Cow</span>
                    </div>
                </div>
            </div>
            <div class="text-center">
                <span class="inline-block px-3 py-1.5 bg-amber-50 text-amber-700
                             text-xs font-semibold rounded-full">Dashboard stats built in P6</span>
            </div>
        </div>
    `;
  if (window.lucide) lucide.createIcons();
}

// ============================================================
// SETTINGS VIEW
// ============================================================

function renderSettings(mount) {
  updateHeader("Settings");
  updateNav("more");
  const s = state.settings || {};
  mount.innerHTML = `
        <div class="p-4 space-y-5">
            <div class="bg-white rounded-xl border border-stone-200 p-4 space-y-4">
                <h3 class="text-sm font-semibold text-stone-700">Store Information</h3>
                <div id="settings-msg" class="hidden p-3 rounded-lg text-sm"></div>
                <div>
                    <label class="block text-sm font-medium text-stone-600 mb-1">Store Name</label>
                    <input id="s-name" type="text" value="${s.store_name || ""}"
                        class="w-full h-11 px-3 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
                <div>
                    <label class="block text-sm font-medium text-stone-600 mb-1">Address</label>
                    <input id="s-address" type="text" value="${s.store_address || ""}"
                        class="w-full h-11 px-3 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
                <div>
                    <label class="block text-sm font-medium text-stone-600 mb-1">Phone</label>
                    <input id="s-phone" type="tel" value="${s.store_phone || ""}"
                        class="w-full h-11 px-3 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
                <button id="s-save" class="w-full h-11 bg-amber-700 hover:bg-amber-800 text-white
                    font-semibold rounded-lg text-sm transition-colors disabled:opacity-50">
                    Save Changes
                </button>
            </div>
            <div class="bg-white rounded-xl border border-stone-200 p-4 space-y-4">
                <h3 class="text-sm font-semibold text-stone-700">Change Password</h3>
                <div id="pw-msg" class="hidden p-3 rounded-lg text-sm"></div>
                <div>
                    <label class="block text-sm font-medium text-stone-600 mb-1">Current Password</label>
                    <input id="pw-current" type="password" autocomplete="current-password"
                        class="w-full h-11 px-3 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
                <div>
                    <label class="block text-sm font-medium text-stone-600 mb-1">New Password</label>
                    <input id="pw-new" type="password" autocomplete="new-password"
                        class="w-full h-11 px-3 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
                <div>
                    <label class="block text-sm font-medium text-stone-600 mb-1">Confirm New Password</label>
                    <input id="pw-confirm" type="password" autocomplete="new-password"
                        class="w-full h-11 px-3 border border-stone-300 rounded-lg text-stone-900
                               text-sm focus:outline-none focus:ring-2 focus:ring-amber-700
                               focus:border-amber-700" style="font-size:16px;">
                </div>
                <button id="pw-save" class="w-full h-11 bg-stone-800 hover:bg-stone-900 text-white
                    font-semibold rounded-lg text-sm transition-colors disabled:opacity-50">
                    Update Password
                </button>
            </div>
        </div>
    `;

  document.getElementById("s-save").addEventListener("click", async () => {
    const btn = document.getElementById("s-save");
    const msg = document.getElementById("settings-msg");
    btn.disabled = true;
    const result = await SettingsService.update({
      store_name: document.getElementById("s-name").value.trim(),
      store_address: document.getElementById("s-address").value.trim(),
      store_phone: document.getElementById("s-phone").value.trim(),
    });
    if (result.success) {
      state.settings = result.data;
      setAppSettings(result.data);
      document.getElementById("header-title").textContent =
        result.data.store_name || "Feed Store";
      msg.className =
        "p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200";
      msg.textContent = "Settings saved successfully";
      msg.classList.remove("hidden");
    } else {
      msg.className =
        "p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200";
      msg.textContent = result.error;
      msg.classList.remove("hidden");
    }
    btn.disabled = false;
    setTimeout(() => msg.classList.add("hidden"), 3000);
  });

  document.getElementById("pw-save").addEventListener("click", async () => {
    const btn = document.getElementById("pw-save");
    const msg = document.getElementById("pw-msg");
    const current = document.getElementById("pw-current").value;
    const newPw = document.getElementById("pw-new").value;
    const confirm = document.getElementById("pw-confirm").value;
    msg.classList.add("hidden");
    if (newPw !== confirm) {
      msg.className =
        "p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200";
      msg.textContent = "New passwords do not match";
      msg.classList.remove("hidden");
      return;
    }
    btn.disabled = true;
    const result = await auth.changePassword(current, newPw);
    btn.disabled = false;
    if (result.success) {
      msg.className =
        "p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200";
      msg.textContent = "Password updated successfully";
      msg.classList.remove("hidden");
      document.getElementById("pw-current").value = "";
      document.getElementById("pw-new").value = "";
      document.getElementById("pw-confirm").value = "";
    } else {
      msg.className =
        "p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200";
      msg.textContent = result.error;
      msg.classList.remove("hidden");
    }
    setTimeout(() => msg.classList.add("hidden"), 3000);
  });
}

// ============================================================
// ROUTE REGISTRATION
// ============================================================

router.registerRoute("login", renderLogin);
router.registerRoute("dashboard", renderDashboard);
router.registerRoute("products", renderProducts);

router.registerRoute("sale", (mount) =>
  renderPlaceholder(mount, {
    title: "New Sale",
    description:
      "Record a customer purchase — cash, credit, or partial payment.",
    phase: "P4",
    items: [
      "Select customer or create walk-in sale",
      "Add feed items with quantity and price",
      "Choose payment method: Cash, Credit, or Partial",
      "Stock deducted automatically",
      "Customer balance updated for credit sales",
      "Receipt generated for printing",
    ],
  }),
);

router.registerRoute("purchase", (mount) =>
  renderPlaceholder(mount, {
    title: "New Purchase",
    description: "Record incoming stock from a supplier.",
    phase: "P5",
    items: [
      "Select supplier",
      "Add feed items received with quantity and cost",
      "Stock added automatically",
      "Supplier balance updated for credit purchases",
      "Track payment method: Cash or Credit",
    ],
  }),
);

router.registerRoute("customers", renderCustomers);
router.registerRoute("suppliers", renderSuppliers);

router.registerRoute("reports", (mount) =>
  renderPlaceholder(mount, {
    title: "Reports",
    description: "View business reports and summaries.",
    phase: "P7",
    items: [
      "Daily summary: sales, purchases, cash, credit, profit",
      "Date range reports",
      "Category-wise sales breakdown",
      "Outstanding credits report — who owes what",
    ],
  }),
);

router.registerRoute("cash-book", (mount) =>
  renderPlaceholder(mount, {
    title: "Cash Book",
    description: "Track cash flow in and out of the store.",
    phase: "P7",
    items: [
      "Today's cash flow: opening balance, cash in, cash out, closing",
      "Historical cash flow by date",
      "Link each entry to its source transaction",
    ],
  }),
);

router.registerRoute("settings", renderSettings);

// ============================================================
// INITIALIZATION
// ============================================================

(async function init() {
  // Ensure feed categories exist in the database
  await seedCategories();

  const appEl = document.getElementById("app");
  if (auth.isLoggedIn()) {
    const result = await SettingsService.get();
    if (!result.data) {
      auth.logout();
      return;
    }
    state.settings = result.data;
    setAppSettings(state.settings);
    renderShell(appEl);
    router.initRouter(document.getElementById("view-mount"), auth.isLoggedIn);
  } else {
    router.initRouter(appEl, auth.isLoggedIn);
  }
})();

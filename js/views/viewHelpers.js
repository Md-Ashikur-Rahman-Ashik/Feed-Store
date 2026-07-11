/**
 * viewHelpers.js — Shared view utilities.
 *
 * Extracted from app.js so all views can use them
 * without circular imports.
 */

import { showToast as _showToast } from "./viewHelpers.js";
import { CONFIG, CATEGORY_COLORS } from "../config.js";

let _settings = null;

/** Allow app.js to inject settings so header title stays current. */
export function setAppSettings(s) {
  _settings = s;
}

/** Update the header for non-dashboard pages. */
export function updateHeader(pageTitle) {
  const back = document.getElementById("header-back");
  const title = document.getElementById("header-title");
  if (pageTitle) {
    back.classList.remove("hidden");
    back.onclick = () => {
      window.location.hash = "#dashboard";
    };
    title.textContent = pageTitle;
  } else {
    back.classList.add("hidden");
    back.onclick = null;
    title.textContent = _settings?.store_name || "Feed Store";
  }
}

/** Update bottom nav active state. */
export function updateNav(activeRoute) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const nav = btn.dataset.nav;
    const isActive =
      nav === activeRoute ||
      (activeRoute !== "dashboard" &&
        nav === "more" &&
        !["dashboard", "sale", "purchase"].includes(activeRoute));
    btn.classList.toggle("text-amber-700", isActive);
    btn.classList.toggle("text-stone-400", !isActive);
  });
}

/** Show a toast notification. Appended to body for reliable fixed positioning. */
export function showToast(message, type = "success") {
  const toast = document.createElement("div");
  const bg = type === "success" ? "background:#059669;" : "background:#DC2626;";
  toast.style.cssText = `
        position:fixed; top:60px; left:16px; right:16px; z-index:60;
        ${bg} color:white; font-size:14px; font-weight:500;
        padding:12px 16px; border-radius:10px;
        box-shadow:0 4px 12px rgba(0,0,0,0.15);
        transform:translateY(-12px); opacity:0;
        transition:all 0.2s ease; pointer-events:none;
        font-family:'DM Sans',sans-serif;
    `;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = "translateY(0)";
    toast.style.opacity = "1";
  });

  setTimeout(() => {
    toast.style.transform = "translateY(-12px)";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

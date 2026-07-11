/**
 * auth.js — Local password authentication.
 *
 * No server. No Supabase Auth in V1.
 * Password hashed with SHA-256, stored in settings table.
 *
 * Flow:
 *   First visit  → "Set Password" screen
 *   Return visit → "Enter Password" screen
 *   Correct      → create session, show app
 *   Wrong        → show error, stay on login
 *   15 min idle  → auto-logout
 */

import db from "../db/schema.js";
import { CONFIG } from "../config.js";

const SESSION_KEY = "feedstore_session";
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
let inactivityTimer = null;

/**
 * Hash a string with SHA-256.
 * @param {string} password
 * @returns {Promise<string>} hex-encoded hash
 */
export async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Check if a password has been set (first-visit detection). */
export async function isPasswordSet() {
  const row = await db.settings.get(CONFIG.SETTINGS_ID);
  return !!(row && row.password_hash);
}

/** Set password for the first time. Also creates the settings row. */
export async function setPassword(password) {
  if (!password || password.length < 4) {
    return { success: false, error: "Password must be at least 4 characters" };
  }
  if (password.length > 50) {
    return { success: false, error: "Password must be 50 characters or less" };
  }
  const hash = await hashPassword(password);
  await db.settings.put({
    id: CONFIG.SETTINGS_ID,
    password_hash: hash,
    store_name: "Feed Store",
    store_address: "",
    store_phone: "",
    currency_symbol: CONFIG.CURRENCY,
    receipt_prefix: "INV",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  createSession();
  return { success: true };
}

/** Verify a password. Creates session on success. */
export async function verifyPassword(password) {
  const row = await db.settings.get(CONFIG.SETTINGS_ID);
  if (!row || !row.password_hash) {
    return { success: false, error: "No password set. Please set up first." };
  }
  const hash = await hashPassword(password);
  if (hash === row.password_hash) {
    createSession();
    return { success: true };
  }
  return { success: false, error: "Wrong password" };
}

/** Change password. Does NOT create a new session (caller is already logged in). */
export async function changePassword(current, newPass) {
  const row = await db.settings.get(CONFIG.SETTINGS_ID);
  if (!row || !row.password_hash) {
    return { success: false, error: "No password set" };
  }
  if ((await hashPassword(current)) !== row.password_hash) {
    return { success: false, error: "Current password is wrong" };
  }
  if (!newPass || newPass.length < 4) {
    return {
      success: false,
      error: "New password must be at least 4 characters",
    };
  }
  await db.settings.update(CONFIG.SETTINGS_ID, {
    password_hash: await hashPassword(newPass),
    updated_at: new Date().toISOString(),
  });
  return { success: true };
}

function createSession() {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      loggedInAt: new Date().toISOString(),
      lastActivity: Date.now(),
    }),
  );
  resetTimer();
}

/** Check if there's an active, non-expired session. */
export function isLoggedIn() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    if (Date.now() - s.lastActivity > INACTIVITY_TIMEOUT) {
      logout();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Bump the activity timestamp (called on user interaction). */
export function touchSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    s.lastActivity = Date.now();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    resetTimer();
  } catch {
    /* ignore */
  }
}

/** Destroy session and redirect to login. */
export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  if (inactivityTimer) clearTimeout(inactivityTimer);
  window.location.hash = "#login";
}

function resetTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(logout, INACTIVITY_TIMEOUT);
}

// Reset timer on any user interaction
["click", "keydown", "scroll", "touchstart"].forEach((evt) => {
  document.addEventListener(
    evt,
    () => {
      if (isLoggedIn()) touchSession();
    },
    { passive: true },
  );
});

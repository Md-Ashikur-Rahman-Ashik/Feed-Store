/**
 * uuid.js — UUID v4 generation.
 *
 * Uses crypto.randomUUID() in modern browsers.
 * Falls back to Math.random for older browsers.
 * For single-device local use, the fallback is sufficient.
 */

export function uuid() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowISO() {
  return new Date().toISOString();
}

export function todayDate() {
  return new Date().toISOString().split("T")[0];
}

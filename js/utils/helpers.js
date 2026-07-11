/**
 * helpers.js — Shared formatting and utility functions.
 *
 * Used across all views. Keeps formatting consistent
 * and centralizes locale/number/currency logic.
 */

/** Format a number as currency with ৳ symbol. */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "৳0";
  return (
    "৳" +
    Number(amount).toLocaleString("en", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  );
}

/** Format a plain number with commas. */
export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return Number(num).toLocaleString("en", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** Debounce a function call. */
export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Dexie stores booleans as 0/1 in some browsers.
 * This normalizes both representations to true/false.
 */
export function toBool(val) {
  return val === true || val === 1;
}

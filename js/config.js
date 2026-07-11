/**
 * config.js — Single source of truth for all constants.
 *
 * Every other file imports from here.
 * Change currency? Change it here. Change units? Here.
 * Nothing else should hardcode these values.
 */

export const CONFIG = {
  DB_NAME: "FeedStoreDB",
  DB_VERSION: 1,
  CURRENCY: "৳",
  UNITS: ["KG"],
  TRANSACTION_TYPES: ["SALE", "PURCHASE", "SALE_RETURN", "PURCHASE_RETURN"],
  PAYMENT_METHODS: ["CASH", "CREDIT", "PARTIAL"],
  ENTITY_TYPES: ["CUSTOMER", "SUPPLIER", "CASH", "OPENING_BALANCE"],
  SYNC_STATUSES: ["PENDING", "SYNCED", "CONFLICT"],
  // Fixed UUID for the single-row settings table
  SETTINGS_ID: "00000000-0000-0000-0000-000000000000",
};

// Category colors — used in dashboard charts, product cards, transaction items
export const CATEGORY_COLORS = {
  poultry: "#F59E0B",
  fish: "#06B6D4",
  cow: "#22C55E",
};

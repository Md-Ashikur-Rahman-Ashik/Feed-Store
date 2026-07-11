/**
 * schema.js — Dexie.js database definition.
 *
 * This is the IndexedDB schema. It mirrors the PostgreSQL schema
 * from the architecture phase. Every table includes syncStatus
 * and syncedAt for future V1.1 Supabase synchronization.
 *
 * INDEX STRATEGY:
 * - Primary key: always 'id' (UUID string)
 * - Foreign keys: indexed for JOIN-like queries
 * - Filter fields: indexed for common WHERE clauses
 * - Compound indexes: only where multi-column queries are frequent
 * - syncStatus: indexed on every table for sync queue queries
 *
 * IMPORTANT: Dexie does NOT enforce CHECK constraints.
 * All validation (non-negative stock, correct enums, etc.)
 * is the Service Layer's responsibility.
 */

import Dexie from "https://cdn.jsdelivr.net/npm/dexie@3.2.7/dist/dexie.mjs";
import { CONFIG } from "../config.js";

const db = new Dexie(CONFIG.DB_NAME);

db.version(CONFIG.DB_VERSION).stores({
  // Single-row table. Fixed UUID primary key.
  settings: "id",

  // Feed categories: Poultry, Fish, Cow. Seeded once.
  categories: "id, slug, sort_order, is_active",

  // Products: the core inventory
  products: "id, category_id, is_active, syncStatus, [category_id+is_active]",

  // Customers: people who buy feed
  customers: "id, is_active, balance, syncStatus",

  // Suppliers: people who sell feed to the store
  suppliers: "id, is_active, balance, syncStatus",

  // Transactions: header record for every sale/purchase/return
  transactions: [
    "id, type, transaction_date, customer_id, supplier_id, ",
    "payment_method, syncStatus, [type+transaction_date]",
  ].join(""),

  // Transaction Items: line items within a transaction
  transaction_items: "id, transaction_id, product_id, syncStatus",

  // Ledger Entries: immutable financial trail
  ledger_entries:
    "id, [entity_type+entity_id], entry_date, transaction_id, syncStatus",

  // Cash Book: daily cash flow tracking
  cash_book: "id, entry_date, transaction_id, syncStatus",

  // Daily Summaries: computed daily snapshots
  daily_summaries: "id, summary_date, syncStatus",

  // Stock Adjustments: manual corrections
  stock_adjustments: "id, product_id, adjustment_date, syncStatus",
});

export default db;

/**
 * supplierService.js — Supplier management.
 * @implements P3
 *
 * Identical logic to CustomerService but for suppliers.
 * Balance = amount the store owes the supplier.
 * Archive blocked if balance > 0.
 */

import db from "../db/schema.js";
import { uuid, nowISO } from "../utils/uuid.js";
import { toBool } from "../utils/helpers.js";

const SupplierService = {
  async getAll(options = {}) {
    try {
      const { activeOnly = true, debtorsOnly = false, search = "" } = options;

      let suppliers = (await db.suppliers.toArray()).filter((s) =>
        toBool(s.is_active),
      );

      if (debtorsOnly) {
        suppliers = suppliers.filter((s) => s.balance > 0);
      }

      if (search.trim()) {
        const term = search.trim().toLowerCase();
        suppliers = suppliers.filter(
          (s) =>
            s.name.toLowerCase().includes(term) ||
            (s.phone && s.phone.includes(term)),
        );
      }

      suppliers.sort((a, b) => a.name.localeCompare(b.name));
      return { success: true, data: suppliers };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async getById(id) {
    try {
      const supplier = await db.suppliers.get(id);
      if (!supplier) return { success: false, error: "Supplier not found" };
      return { success: true, data: supplier };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async create(data) {
    try {
      if (!data.name || !data.name.trim()) {
        return { success: false, error: "Supplier name is required" };
      }

      const supplier = {
        id: uuid(),
        name: data.name.trim(),
        phone: (data.phone || "").trim() || null,
        address: (data.address || "").trim() || null,
        balance: 0,
        is_active: true,
        created_at: nowISO(),
        updated_at: nowISO(),
        syncStatus: "PENDING",
        syncedAt: null,
      };

      await db.suppliers.add(supplier);
      return { success: true, data: supplier };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async update(id, data) {
    try {
      const existing = await db.suppliers.get(id);
      if (!existing) return { success: false, error: "Supplier not found" };

      if (data.name !== undefined && (!data.name || !data.name.trim())) {
        return { success: false, error: "Supplier name is required" };
      }

      const updates = {
        updated_at: nowISO(),
        syncStatus: "PENDING",
        syncedAt: null,
      };
      if (data.name !== undefined) updates.name = data.name.trim();
      if (data.phone !== undefined)
        updates.phone = (data.phone || "").trim() || null;
      if (data.address !== undefined)
        updates.address = (data.address || "").trim() || null;

      await db.suppliers.update(id, updates);
      const updated = await db.suppliers.get(id);
      return { success: true, data: updated };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async archive(id) {
    try {
      const supplier = await db.suppliers.get(id);
      if (!supplier) return { success: false, error: "Supplier not found" };
      if (!toBool(supplier.is_active)) {
        return { success: false, error: "Supplier is already archived" };
      }
      if (supplier.balance > 0) {
        return {
          success: false,
          error:
            "Cannot archive — supplier has an outstanding balance of " +
            supplier.balance +
            ". Settle the account first.",
        };
      }

      await db.suppliers.update(id, {
        is_active: false,
        updated_at: nowISO(),
        syncStatus: "PENDING",
        syncedAt: null,
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};

export default SupplierService;

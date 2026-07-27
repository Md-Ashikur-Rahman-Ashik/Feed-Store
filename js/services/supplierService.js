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

  async getLedger(supplierId, options = {}) {
    try {
      const supplier = await db.suppliers.get(supplierId);
      if (!supplier) return { success: false, error: "Supplier not found" };

      let entries = (await db.ledger_entries.toArray())
        .filter(
          (e) => e.entity_type === "SUPPLIER" && e.entity_id === supplierId,
        )
        .sort(
          (a, b) =>
            a.entry_date.localeCompare(b.entry_date) ||
            a.created_at.localeCompare(b.created_at),
        );

      if (options.fromDate)
        entries = entries.filter((e) => e.entry_date >= options.fromDate);
      if (options.toDate)
        entries = entries.filter((e) => e.entry_date <= options.toDate);

      return { success: true, data: { supplier, entries } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};

export default SupplierService;

import db from "../db/schema.js";
import { uuid, nowISO } from "../utils/uuid.js";
import { toBool } from "../utils/helpers.js";

const CustomerService = {
  async getAll(options = {}) {
    try {
      const { activeOnly = true, debtorsOnly = false, search = "" } = options;

      let customers = (await db.customers.toArray()).filter((c) =>
        toBool(c.is_active),
      );

      if (debtorsOnly) {
        customers = customers.filter((c) => c.balance > 0);
      }

      if (search.trim()) {
        const term = search.trim().toLowerCase();
        customers = customers.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            (c.phone && c.phone.includes(term)),
        );
      }

      customers.sort((a, b) => a.name.localeCompare(b.name));
      return { success: true, data: customers };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async getById(id) {
    try {
      const customer = await db.customers.get(id);
      if (!customer) return { success: false, error: "Customer not found" };
      return { success: true, data: customer };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async create(data) {
    try {
      if (!data.name || !data.name.trim()) {
        return { success: false, error: "Customer name is required" };
      }

      const customer = {
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

      await db.customers.add(customer);
      return { success: true, data: customer };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async update(id, data) {
    try {
      const existing = await db.customers.get(id);
      if (!existing) return { success: false, error: "Customer not found" };

      if (data.name !== undefined && (!data.name || !data.name.trim())) {
        return { success: false, error: "Customer name is required" };
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

      await db.customers.update(id, updates);
      const updated = await db.customers.get(id);
      return { success: true, data: updated };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async archive(id) {
    try {
      const customer = await db.customers.get(id);
      if (!customer) return { success: false, error: "Customer not found" };
      if (!toBool(customer.is_active)) {
        return { success: false, error: "Customer is already archived" };
      }
      if (customer.balance > 0) {
        return {
          success: false,
          error:
            "Cannot archive — customer has an outstanding balance of " +
            customer.balance +
            ". Settle the account first.",
        };
      }

      await db.customers.update(id, {
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

  async getLedger(customerId, options = {}) {
    try {
      const customer = await db.customers.get(customerId);
      if (!customer) return { success: false, error: "Customer not found" };

      let entries = (await db.ledger_entries.toArray())
        .filter(
          (e) => e.entity_type === "CUSTOMER" && e.entity_id === customerId,
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

      return { success: true, data: { customer, entries } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};

export default CustomerService;

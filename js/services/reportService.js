import db from "../db/schema.js";
import { toBool } from "../utils/helpers.js";

const ReportService = {
  async getDailySummary(date) {
    try {
      const summary = await db.daily_summaries
        .where("summary_date")
        .equals(date)
        .first();
      const transactions = (await db.transactions.toArray()).filter(
        (t) => t.transaction_date === date,
      );

      // Category breakdown from transaction items
      const txIds = transactions.map((t) => t.id);
      const allItems =
        txIds.length > 0
          ? (await db.transaction_items.toArray()).filter((i) =>
              txIds.includes(i.transaction_id),
            )
          : [];
      const prodIds = [...new Set(allItems.map((i) => i.product_id))];
      const prods =
        prodIds.length > 0
          ? (await db.products.bulkGet(prodIds)).filter(Boolean)
          : [];
      const cats = await db.categories.toArray();
      const catMap = {};
      cats.forEach((c) => {
        catMap[c.id] = c;
      });
      const prodCat = {};
      prods.forEach((p) => {
        prodCat[p.id] = p.category_id;
      });

      const catBreakdown = {};
      for (const item of allItems) {
        const catId = prodCat[item.product_id];
        if (!catId || !catMap[catId]) continue;
        const cat = catMap[catId];
        if (!catBreakdown[cat.slug]) {
          catBreakdown[cat.slug] = {
            name: cat.name,
            color: cat.color,
            total: 0,
            quantity: 0,
          };
        }
        catBreakdown[cat.slug].total += item.total;
        catBreakdown[cat.slug].quantity += item.quantity;
      }

      // Cash from ledger
      const cashEntries = (await db.ledger_entries.toArray())
        .filter((e) => e.entity_type === "CASH" && e.entry_date <= date)
        .sort(
          (a, b) =>
            a.entry_date.localeCompare(b.entry_date) ||
            a.created_at.localeCompare(b.created_at),
        );
      const cashBalance =
        cashEntries.length > 0
          ? cashEntries[cashEntries.length - 1].running_balance
          : 0;
      const dayCash = cashEntries.filter((e) => e.entry_date === date);
      const cashIn = dayCash.reduce((s, e) => s + e.debit, 0);
      const cashOut = dayCash.reduce((s, e) => s + e.credit, 0);

      return {
        success: true,
        data: {
          date,
          summary,
          transactions,
          categoryBreakdown: Object.values(catBreakdown),
          cashBalance,
          cashIn,
          cashOut,
        },
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async getDateRangeSummary(from, to) {
    try {
      const summaries = (await db.daily_summaries.toArray())
        .filter((s) => s.summary_date >= from && s.summary_date <= to)
        .sort((a, b) => a.summary_date.localeCompare(b.summary_date));
      const t = {
        total_sales: 0,
        total_purchases: 0,
        total_cash_received: 0,
        total_credit_given: 0,
        total_cash_paid: 0,
        total_credit_used: 0,
        net_sales: 0,
        net_purchases: 0,
        estimated_profit: 0,
        sale_count: 0,
        purchase_count: 0,
      };
      for (const s of summaries) {
        for (const k of Object.keys(t)) {
          t[k] += s[k] || 0;
        }
      }
      return {
        success: true,
        data: {
          from,
          to,
          summaries,
          totals: { ...t, dayCount: summaries.length },
        },
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async getOutstandingCredits() {
    try {
      const customers = (await db.customers.toArray())
        .filter((c) => toBool(c.is_active) && c.balance > 0)
        .sort((a, b) => b.balance - a.balance);
      return {
        success: true,
        data: {
          customers,
          totalOwed: customers.reduce((s, c) => s + c.balance, 0),
        },
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};

export default ReportService;

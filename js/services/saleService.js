/**
 * saleService.js — THE CRITICAL PATH.
 * @implements P4
 *
 * createSale() is an ATOMIC Dexie transaction that touches 7 tables.
 * If ANY step fails, EVERYTHING rolls back. No partial sales. No ghost stock.
 *
 * Steps (identical to the PostgreSQL create_sale function):
 *   1. Validate: products exist, active, sufficient stock
 *   2. Create TRANSACTION record (type: SALE)
 *   3. For each item: create TRANSACTION_ITEM, deduct stock
 *   4. If cash received: create CASH ledger entry
 *   5. If credit given: create CUSTOMER ledger entry, update customer balance
 *   6. Create CASH_BOOK entry
 *   7. Update DAILY_SUMMARY (upsert)
 */

import db from "../db/schema.js";
import { uuid, nowISO, todayDate } from "../utils/uuid.js";
import { toBool } from "../utils/helpers.js";
import { CONFIG } from "../config.js";

const SaleService = {
  async createSale(sale) {
    const {
      customerId = null,
      items = [],
      paymentMethod,
      amountPaid = 0,
      discount = 0,
      notes = null,
      transactionDate = todayDate(),
    } = sale;

    // --- Format validation (outside transaction) ---
    if (!items || items.length === 0) {
      return { success: false, error: "Add at least one item" };
    }
    if (!CONFIG.PAYMENT_METHODS.includes(paymentMethod)) {
      return { success: false, error: "Invalid payment method" };
    }
    for (const item of items) {
      if (!item.productId)
        return { success: false, error: "Item is missing product data" };
      if (!item.quantity || item.quantity <= 0) {
        return { success: false, error: "Quantity must be greater than 0" };
      }
      if (
        item.unitPrice === undefined ||
        item.unitPrice === null ||
        item.unitPrice < 0
      ) {
        return { success: false, error: "Price cannot be negative" };
      }
    }

    const discountAmount = Math.max(
      0,
      Math.min(parseFloat(discount) || 0, 99999999),
    );
    const paidAmount = Math.max(0, parseFloat(amountPaid) || 0);

    // --- Atomic transaction ---
    const transactionId = uuid();
    let resultData = null;

    try {
      await db.transaction(
        "rw",
        [
          db.transactions,
          db.transaction_items,
          db.products,
          db.ledger_entries,
          db.cash_book,
          db.daily_summaries,
          db.customers,
        ],
        async () => {
          let subtotal = 0;
          let totalQuantity = 0;
          let costTotal = 0;
          const returnItems = [];

          // --- 1. Validate items & calculate ---
          for (const item of items) {
            const product = await db.products.get(item.productId);
            if (!product) throw new Error("Product not found");
            if (!toBool(product.is_active))
              throw new Error(`"${product.name}" is not active`);
            if (product.stock_quantity < item.quantity) {
              throw new Error(
                `Insufficient stock for "${product.name}". ` +
                  `Available: ${product.stock_quantity} ${product.unit}, ` +
                  `Requested: ${item.quantity}`,
              );
            }

            const lineTotal = item.quantity * item.unitPrice;
            subtotal += lineTotal;
            totalQuantity += item.quantity;
            costTotal += item.quantity * product.cost_price;

            returnItems.push({
              product_name: product.name,
              product_unit: product.unit,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              total: lineTotal,
            });
          }

          const totalAmount = Math.max(0, subtotal - discountAmount);
          const finalPaid = Math.min(paidAmount, totalAmount);
          const amountDue = totalAmount - finalPaid;

          // Payment method consistency
          if (paymentMethod === "CASH" && amountDue !== 0) {
            throw new Error("Cash sale cannot have outstanding amount");
          }
          if (paymentMethod === "CREDIT" && finalPaid !== 0) {
            throw new Error(
              "Credit sale should not have amount paid. Use Partial instead.",
            );
          }
          if (
            (paymentMethod === "CREDIT" || paymentMethod === "PARTIAL") &&
            amountDue > 0 &&
            !customerId
          ) {
            throw new Error("Select a customer for credit sales");
          }

          // --- 2. Create transaction header ---
          await db.transactions.add({
            id: transactionId,
            type: "SALE",
            customer_id: customerId,
            supplier_id: null,
            transaction_date: transactionDate,
            subtotal,
            discount: discountAmount,
            total_amount: totalAmount,
            payment_method: paymentMethod,
            amount_paid: finalPaid,
            amount_due: amountDue,
            notes,
            item_count: items.length,
            total_quantity: totalQuantity,
            created_at: nowISO(),
            syncStatus: "PENDING",
            syncedAt: null,
          });

          // --- 3. Create items & deduct stock ---
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const product = await db.products.get(item.productId);
            const lineTotal = item.quantity * item.unitPrice;

            await db.transaction_items.add({
              id: uuid(),
              transaction_id: transactionId,
              product_id: item.productId,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              total: lineTotal,
              created_at: nowISO(),
              syncStatus: "PENDING",
              syncedAt: null,
            });

            await db.products.update(item.productId, {
              stock_quantity: product.stock_quantity - item.quantity,
              updated_at: nowISO(),
              syncStatus: "PENDING",
              syncedAt: null,
            });
          }

          // --- 4. Ledger entries ---
          if (finalPaid > 0) {
            const cashEntries = (await db.ledger_entries.toArray())
              .filter((e) => e.entity_type === "CASH")
              .sort((a, b) => a.created_at.localeCompare(b.created_at));
            const cashBalance =
              cashEntries.length > 0
                ? cashEntries[cashEntries.length - 1].running_balance
                : 0;

            await db.ledger_entries.add({
              id: uuid(),
              entity_type: "CASH",
              entity_id: null,
              transaction_id: transactionId,
              entry_date: transactionDate,
              description: "Sale — Cash received",
              debit: finalPaid,
              credit: 0,
              running_balance: cashBalance + finalPaid,
              created_at: nowISO(),
              created_by: null,
              syncStatus: "PENDING",
              syncedAt: null,
            });
          }

          if (amountDue > 0 && customerId) {
            const customer = await db.customers.get(customerId);
            const newBalance = customer.balance + amountDue;

            await db.ledger_entries.add({
              id: uuid(),
              entity_type: "CUSTOMER",
              entity_id: customerId,
              transaction_id: transactionId,
              entry_date: transactionDate,
              description: "Sale — Credit given",
              debit: amountDue,
              credit: 0,
              running_balance: newBalance,
              created_at: nowISO(),
              created_by: null,
              syncStatus: "PENDING",
              syncedAt: null,
            });

            await db.customers.update(customerId, {
              balance: newBalance,
              updated_at: nowISO(),
              syncStatus: "PENDING",
              syncedAt: null,
            });
          }

          // --- 5. Cash book ---
          if (finalPaid > 0) {
            await db.cash_book.add({
              id: uuid(),
              entry_date: transactionDate,
              opening_balance: 0,
              total_in: finalPaid,
              total_out: 0,
              closing_balance: 0,
              transaction_id: transactionId,
              description: "Sale",
              created_at: nowISO(),
              syncStatus: "PENDING",
              syncedAt: null,
            });
          }

          // --- 6. Daily summary (upsert) ---
          const existing = await db.daily_summaries
            .where("summary_date")
            .equals(transactionDate)
            .first();

          if (existing) {
            await db.daily_summaries.update(existing.id, {
              total_sales: existing.total_sales + totalAmount,
              total_cash_received: existing.total_cash_received + finalPaid,
              total_credit_given: existing.total_credit_given + amountDue,
              net_sales: existing.net_sales + totalAmount,
              estimated_profit:
                existing.estimated_profit + (totalAmount - costTotal),
              sale_count: existing.sale_count + 1,
              updated_at: nowISO(),
              syncStatus: "PENDING",
              syncedAt: null,
            });
          } else {
            await db.daily_summaries.add({
              id: uuid(),
              summary_date: transactionDate,
              total_sales: totalAmount,
              total_sales_return: 0,
              total_purchases: 0,
              total_purchases_return: 0,
              total_cash_received: finalPaid,
              total_credit_given: amountDue,
              total_cash_paid: 0,
              total_credit_used: 0,
              net_sales: totalAmount,
              net_purchases: 0,
              estimated_profit: totalAmount - costTotal,
              sale_count: 1,
              purchase_count: 0,
              created_at: nowISO(),
              updated_at: nowISO(),
              syncStatus: "PENDING",
              syncedAt: null,
            });
          }

          // --- Prepare return data ---
          let customerName = null;
          if (customerId) {
            const c = await db.customers.get(customerId);
            customerName = c ? c.name : null;
          }

          resultData = {
            id: transactionId,
            type: "SALE",
            customer_id: customerId,
            customer_name: customerName,
            transaction_date: transactionDate,
            subtotal,
            discount: discountAmount,
            total_amount: totalAmount,
            payment_method: paymentMethod,
            amount_paid: finalPaid,
            amount_due: amountDue,
            notes,
            items: returnItems,
            item_count: items.length,
            total_quantity: totalQuantity,
          };
        },
      );

      return { success: true, data: resultData };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async getAll() {
    return { success: false, error: "Not implemented — P7" };
  },

  async getById() {
    return { success: false, error: "Not implemented — P7" };
  },
};

export default SaleService;

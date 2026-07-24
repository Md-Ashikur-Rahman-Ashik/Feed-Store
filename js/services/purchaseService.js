import db from "../db/schema.js";
import { uuid, nowISO, todayDate } from "../utils/uuid.js";
import { toBool } from "../utils/helpers.js";
import { CONFIG } from "../config.js";

const PurchaseService = {
  async createPurchase(purchase) {
    const {
      supplierId = null,
      items = [],
      paymentMethod,
      amountPaid = 0,
      discount = 0,
      notes = null,
      transactionDate = todayDate(),
    } = purchase;

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
          db.suppliers,
        ],
        async () => {
          let subtotal = 0;
          let totalQuantity = 0;
          const returnItems = [];

          // --- 1. Validate items & calculate ---
          for (const item of items) {
            const product = await db.products.get(item.productId);
            if (!product) throw new Error("Product not found");
            if (!toBool(product.is_active))
              throw new Error(`"${product.name}" is not active`);

            const lineTotal = item.quantity * item.unitPrice;
            subtotal += lineTotal;
            totalQuantity += item.quantity;

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

          if (paymentMethod === "CASH" && amountDue !== 0) {
            throw new Error("Cash purchase cannot have outstanding amount");
          }
          if (paymentMethod === "CREDIT" && finalPaid !== 0) {
            throw new Error(
              "Credit purchase should not have amount paid. Use Partial instead.",
            );
          }
          if (
            (paymentMethod === "CREDIT" || paymentMethod === "PARTIAL") &&
            amountDue > 0 &&
            !supplierId
          ) {
            throw new Error("Select a supplier for credit purchases");
          }

          // --- 2. Create transaction header ---
          await db.transactions.add({
            id: transactionId,
            type: "PURCHASE",
            customer_id: null,
            supplier_id: supplierId,
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

          // --- 3. Create items & ADD stock ---
          for (const item of items) {
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
              stock_quantity: product.stock_quantity + item.quantity,
              updated_at: nowISO(),
              syncStatus: "PENDING",
              syncedAt: null,
            });
          }

          // --- 4. Ledger entries ---

          // Cash outflow (credit cash = money leaving)
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
              description: "Purchase — Cash paid",
              debit: 0,
              credit: finalPaid,
              running_balance: cashBalance - finalPaid,
              created_at: nowISO(),
              created_by: null,
              syncStatus: "PENDING",
              syncedAt: null,
            });
          }

          // Supplier credit (we owe them more)
          if (amountDue > 0 && supplierId) {
            const supplier = await db.suppliers.get(supplierId);
            const newBalance = supplier.balance + amountDue;

            await db.ledger_entries.add({
              id: uuid(),
              entity_type: "SUPPLIER",
              entity_id: supplierId,
              transaction_id: transactionId,
              entry_date: transactionDate,
              description: "Purchase — Credit taken",
              debit: 0,
              credit: amountDue,
              running_balance: newBalance,
              created_at: nowISO(),
              created_by: null,
              syncStatus: "PENDING",
              syncedAt: null,
            });

            await db.suppliers.update(supplierId, {
              balance: newBalance,
              updated_at: nowISO(),
              syncStatus: "PENDING",
              syncedAt: null,
            });
          }

          // --- 5. Cash book (outflow) ---
          if (finalPaid > 0) {
            await db.cash_book.add({
              id: uuid(),
              entry_date: transactionDate,
              opening_balance: 0,
              total_in: 0,
              total_out: finalPaid,
              closing_balance: 0,
              transaction_id: transactionId,
              description: "Purchase",
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
              total_purchases: existing.total_purchases + totalAmount,
              total_cash_paid: existing.total_cash_paid + finalPaid,
              total_credit_used: existing.total_credit_used + amountDue,
              net_purchases: existing.net_purchases + totalAmount,
              // Profit NOT updated — realized at sale time
              purchase_count: existing.purchase_count + 1,
              updated_at: nowISO(),
              syncStatus: "PENDING",
              syncedAt: null,
            });
          } else {
            await db.daily_summaries.add({
              id: uuid(),
              summary_date: transactionDate,
              total_sales: 0,
              total_sales_return: 0,
              total_purchases: totalAmount,
              total_purchases_return: 0,
              total_cash_received: 0,
              total_credit_given: 0,
              total_cash_paid: finalPaid,
              total_credit_used: amountDue,
              net_sales: 0,
              net_purchases: totalAmount,
              estimated_profit: 0,
              sale_count: 0,
              purchase_count: 1,
              created_at: nowISO(),
              updated_at: nowISO(),
              syncStatus: "PENDING",
              syncedAt: null,
            });
          }

          // --- Prepare return data ---
          let supplierName = null;
          if (supplierId) {
            const s = await db.suppliers.get(supplierId);
            supplierName = s ? s.name : null;
          }

          resultData = {
            id: transactionId,
            type: "PURCHASE",
            supplier_id: supplierId,
            supplier_name: supplierName,
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

export default PurchaseService;

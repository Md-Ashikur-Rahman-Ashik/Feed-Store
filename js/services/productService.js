/**
 * productService.js — Product inventory management.
 * @implements P2
 *
 * All validation happens here before touching the database.
 * Dexie does not enforce CHECK constraints, so every field
 * is validated explicitly.
 *
 * Boolean handling: IndexedDB may store booleans as 0/1.
 * We use toBool() for safety, but filter in JS after toArray()
 * to avoid compound index edge cases with boolean values.
 */

import db from "../db/schema.js";
import { uuid, nowISO } from "../utils/uuid.js";
import { toBool } from "../utils/helpers.js";

const ProductService = {
  /**
   * Get all products with optional filters.
   * Joins with categories to return category name/color.
   */
  async getAll(options = {}) {
    try {
      const {
        categoryId = null,
        activeOnly = true,
        lowStockOnly = false,
        search = "",
      } = options;

      let products = await db.products.toArray();

      // Active filter (JS-side for boolean safety)
      if (activeOnly) {
        products = products.filter((p) => toBool(p.is_active));
      }

      // Category filter
      if (categoryId) {
        products = products.filter((p) => p.category_id === categoryId);
      }

      // Low stock filter
      if (lowStockOnly) {
        products = products.filter(
          (p) => p.stock_quantity <= p.min_stock_level && p.min_stock_level > 0,
        );
      }

      // Search filter (case-insensitive on name and brand)
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        products = products.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            (p.brand && p.brand.toLowerCase().includes(term)),
        );
      }

      // Join categories
      const categories = await db.categories.toArray();
      const catMap = {};
      categories.forEach((c) => {
        catMap[c.id] = c;
      });

      const enriched = products.map((p) => ({
        ...p,
        category: catMap[p.category_id] || null,
      }));

      // Sort alphabetically by name
      enriched.sort((a, b) => a.name.localeCompare(b.name));

      return { success: true, data: enriched };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /** Get a single product with category join. */
  async getById(id) {
    try {
      const product = await db.products.get(id);
      if (!product) return { success: false, error: "Product not found" };
      const category = await db.categories.get(product.category_id);
      return { success: true, data: { ...product, category } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Create a new product.
   * Validates: name required, category required, prices >= 0, stock >= 0.
   * Checks name+category uniqueness among active products.
   */
  async create(data) {
    try {
      // --- Validation ---
      if (!data.name || !data.name.trim()) {
        return { success: false, error: "Product name is required" };
      }
      if (!data.category_id) {
        return { success: false, error: "Category is required" };
      }
      const costPrice = parseFloat(data.cost_price) || 0;
      const sellingPrice = parseFloat(data.selling_price) || 0;
      const stock = parseFloat(data.stock_quantity) || 0;
      const minStock = parseFloat(data.min_stock_level) || 0;

      if (costPrice < 0)
        return { success: false, error: "Cost price cannot be negative" };
      if (sellingPrice < 0)
        return { success: false, error: "Selling price cannot be negative" };
      if (stock < 0)
        return { success: false, error: "Stock cannot be negative" };
      if (minStock < 0)
        return { success: false, error: "Low stock alert cannot be negative" };

      // Uniqueness check: name + category among active products
      const allActive = await db.products
        .where("is_active")
        .equals(1)
        .toArray();
      const dup = allActive.find(
        (p) =>
          p.category_id === data.category_id &&
          p.name.trim().toLowerCase() === data.name.trim().toLowerCase(),
      );
      if (dup) {
        return {
          success: false,
          error: `"${data.name.trim()}" already exists in this category`,
        };
      }

      // --- Create ---
      const now = nowISO();
      const product = {
        id: uuid(),
        name: data.name.trim(),
        category_id: data.category_id,
        brand: (data.brand || "").trim() || null,
        unit: data.unit || "KG",
        cost_price: costPrice,
        selling_price: sellingPrice,
        stock_quantity: stock,
        min_stock_level: minStock,
        is_active: true,
        created_at: now,
        updated_at: now,
        syncStatus: "PENDING",
        syncedAt: null,
      };

      await db.products.add(product);

      const category = await db.categories.get(product.category_id);
      return { success: true, data: { ...product, category } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Update an existing product.
   * Only provided fields are updated (partial update).
   */
  async update(id, data) {
    try {
      const existing = await db.products.get(id);
      if (!existing) return { success: false, error: "Product not found" };

      // --- Validation ---
      if (data.name !== undefined) {
        if (!data.name || !data.name.trim()) {
          return { success: false, error: "Product name is required" };
        }
      }
      if (data.cost_price !== undefined && parseFloat(data.cost_price) < 0) {
        return { success: false, error: "Cost price cannot be negative" };
      }
      if (
        data.selling_price !== undefined &&
        parseFloat(data.selling_price) < 0
      ) {
        return { success: false, error: "Selling price cannot be negative" };
      }
      if (
        data.stock_quantity !== undefined &&
        parseFloat(data.stock_quantity) < 0
      ) {
        return { success: false, error: "Stock cannot be negative" };
      }
      if (
        data.min_stock_level !== undefined &&
        parseFloat(data.min_stock_level) < 0
      ) {
        return { success: false, error: "Low stock alert cannot be negative" };
      }

      // Uniqueness check if name or category changed
      const newName = (data.name !== undefined ? data.name : existing.name)
        .trim()
        .toLowerCase();
      const newCatId =
        data.category_id !== undefined
          ? data.category_id
          : existing.category_id;
      const allActive = await db.products
        .where("is_active")
        .equals(1)
        .toArray();
      const dup = allActive.find(
        (p) =>
          p.id !== id &&
          p.category_id === newCatId &&
          p.name.trim().toLowerCase() === newName,
      );
      if (dup) {
        return {
          success: false,
          error: `"${newName}" already exists in this category`,
        };
      }

      // --- Build updates ---
      const updates = {
        updated_at: nowISO(),
        syncStatus: "PENDING",
        syncedAt: null,
      };
      if (data.name !== undefined) updates.name = data.name.trim();
      if (data.category_id !== undefined)
        updates.category_id = data.category_id;
      if (data.brand !== undefined)
        updates.brand = (data.brand || "").trim() || null;
      if (data.unit !== undefined) updates.unit = data.unit;
      if (data.cost_price !== undefined)
        updates.cost_price = parseFloat(data.cost_price) || 0;
      if (data.selling_price !== undefined)
        updates.selling_price = parseFloat(data.selling_price) || 0;
      if (data.stock_quantity !== undefined)
        updates.stock_quantity = parseFloat(data.stock_quantity) || 0;
      if (data.min_stock_level !== undefined)
        updates.min_stock_level = parseFloat(data.min_stock_level) || 0;

      await db.products.update(id, updates);

      const updated = await db.products.get(id);
      const category = await db.categories.get(updated.category_id);
      return { success: true, data: { ...updated, category } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Archive a product (soft delete).
   * Sets is_active = false. Product disappears from lists
   * but remains in the database for historical transaction references.
   */
  async archive(id) {
    try {
      const product = await db.products.get(id);
      if (!product) return { success: false, error: "Product not found" };
      if (!toBool(product.is_active)) {
        return { success: false, error: "Product is already archived" };
      }

      await db.products.update(id, {
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

export default ProductService;

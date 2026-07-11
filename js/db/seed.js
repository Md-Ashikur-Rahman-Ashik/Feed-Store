/**
 * seed.js — Seeds the three feed categories.
 *
 * Uses fixed UUIDs so the entire application can reference
 * Poultry = 1111..., Fish = 2222..., Cow = 3333... consistently.
 * Uses bulkPut (upsert) so it's safe to call multiple times.
 */

import db from "./schema.js";
import { CATEGORY_COLORS, nowISO } from "../config.js";
import { uuid } from "../utils/uuid.js";

const SEED_CATEGORIES = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Poultry Feed",
    slug: "poultry",
    color: CATEGORY_COLORS.poultry,
    sort_order: 1,
    is_active: true,
    created_at: nowISO(),
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Fish Feed",
    slug: "fish",
    color: CATEGORY_COLORS.fish,
    sort_order: 2,
    is_active: true,
    created_at: nowISO(),
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Cow Feed",
    slug: "cow",
    color: CATEGORY_COLORS.cow,
    sort_order: 3,
    is_active: true,
    created_at: nowISO(),
  },
];

export async function seedCategories() {
  await db.categories.bulkPut(SEED_CATEGORIES);
}

/**
 * settingsService.js — Store settings management.
 * @implements P1
 *
 * Security: password_hash is NEVER returned to the UI layer
 * and can NEVER be updated through this service.
 */

import db from "../db/schema.js";
import { CONFIG } from "../config.js";

const SettingsService = {
  async get() {
    try {
      const row = await db.settings.get(CONFIG.SETTINGS_ID);
      if (row) {
        const { password_hash, ...safe } = row;
        return { success: true, data: safe };
      }
      return { success: true, data: null };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async update(data) {
    try {
      // Strip dangerous fields — never update password_hash or id through here
      const { password_hash, id, created_at, ...fields } = data;
      fields.updated_at = new Date().toISOString();
      await db.settings.update(CONFIG.SETTINGS_ID, fields);
      const updated = await db.settings.get(CONFIG.SETTINGS_ID);
      const { password_hash: _, ...safe } = updated;
      return { success: true, data: safe };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};

export default SettingsService;

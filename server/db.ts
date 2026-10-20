/**
 * server/db.ts – Server-side database adapter for SmartInvoice
 *
 * Supports two modes:
 *   1. "local" / "sqlite"  → JSON files under ./data/ (fallback, always works)
 *   2. "supabase"          → Supabase Cloud via @supabase/supabase-js
 */

import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Data directory ──────────────────────────────────────────────────
const DATA_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const CONFIG_PATH = path.join(DATA_DIR, "server-config.json");
const INVOICES_PATH = path.join(DATA_DIR, "invoices.json");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

// ── Types (mirror client-side DatabaseConfig) ───────────────────────
export interface DatabaseConfig {
  activeDriver: "sqlite" | "mariadb" | "supabase";
  sqlite: { filePath: string };
  mariadb: {
    host: string;
    port: number;
    user: string;
    password?: string;
    database: string;
  };
  supabase: {
    url: string;
    anonKey: string;
  };
  // Legacy fields that may exist in old config files
  driver?: string;
  credentials?: any;
}

const DEFAULT_CONFIG: DatabaseConfig = {
  activeDriver: "sqlite",
  sqlite: { filePath: "./data/smartinvoice.db" },
  mariadb: {
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "smartinvoice",
  },
  supabase: { url: "", anonKey: "" },
};

// ══════════════════════════════════════════════════════════════════════
// CONFIG persistence
// ══════════════════════════════════════════════════════════════════════

export function loadServerDbConfig(): DatabaseConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      return { ...DEFAULT_CONFIG, ...raw };
    }
  } catch (e) {
    console.warn("[db] Failed to read server config:", e);
  }
  return { ...DEFAULT_CONFIG };
}

export function saveServerDbConfig(
  cfg: Partial<DatabaseConfig>,
): DatabaseConfig {
  const current = loadServerDbConfig();
  const merged: DatabaseConfig = { ...current, ...cfg };

  if (cfg.sqlite) merged.sqlite = { ...current.sqlite, ...cfg.sqlite };
  if (cfg.mariadb) merged.mariadb = { ...current.mariadb, ...cfg.mariadb };
  if (cfg.supabase) merged.supabase = { ...current.supabase, ...cfg.supabase };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
  _supabaseClient = null;

  console.log(`[db] Config saved. Active driver: ${merged.activeDriver}`);
  return merged;
}

function getActiveDriver(): string {
  const cfg = loadServerDbConfig();
  return cfg.activeDriver || (cfg as any).driver || "sqlite";
}

// ══════════════════════════════════════════════════════════════════════
// Supabase client (lazy-initialized)
// ══════════════════════════════════════════════════════════════════════
let _supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (_supabaseClient) return _supabaseClient;

  const cfg = loadServerDbConfig();
  const url = cfg.supabase?.url;
  const key = cfg.supabase?.anonKey;

  if (!url || !key) {
    throw new Error(
      "Supabase belum dikonfigurasi. Silakan isi URL dan Anon Key di menu Pengaturan → Database.",
    );
  }

  _supabaseClient = createClient(url, key);
  return _supabaseClient;
}

function isSupabaseActive(): boolean {
  try {
    const cfg = loadServerDbConfig();
    return (
      cfg.activeDriver === "supabase" &&
      Boolean(cfg.supabase?.url) &&
      Boolean(cfg.supabase?.anonKey)
    );
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════
// LOCAL JSON helpers (fallback storage)
// ══════════════════════════════════════════════════════════════════════
function readJsonArray(filePath: string): any[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) || [];
  } catch {
    return [];
  }
}

function writeJsonArray(filePath: string, arr: any[]) {
  fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), "utf-8");
}

function readJsonObject(filePath: string): Record<string, any> {
  try {
    if (!fs.existsSync(filePath)) return {};
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

// ══════════════════════════════════════════════════════════════════════
// INVOICES CRUD
// ══════════════════════════════════════════════════════════════════════

export async function getAllInvoices(): Promise<any[]> {
  if (isSupabaseActive()) {
    try {
      const { data, error } = await getSupabase()
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapSupabaseInvoiceToApp);
    } catch (err: any) {
      console.error("[db] Supabase getAllInvoices error:", err.message);
      throw err;
    }
  }
  return readJsonArray(INVOICES_PATH);
}

export async function saveInvoice(invoice: any): Promise<void> {
  if (isSupabaseActive()) {
    try {
      const row = mapAppInvoiceToSupabase(invoice);
      const { error } = await getSupabase()
        .from("invoices")
        .upsert(row, { onConflict: "id" });
      if (error) throw error;
      return;
    } catch (err: any) {
      console.error("[db] Supabase saveInvoice error:", err.message);
      throw err;
    }
  }
  const arr = readJsonArray(INVOICES_PATH);
  const idx = arr.findIndex((i: any) => i.id === invoice.id);
  if (idx >= 0) {
    arr[idx] = invoice;
  } else {
    arr.push(invoice);
  }
  writeJsonArray(INVOICES_PATH, arr);
}

export async function deleteInvoice(id: string): Promise<void> {
  if (isSupabaseActive()) {
    try {
      const { error } = await getSupabase()
        .from("invoices")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return;
    } catch (err: any) {
      console.error("[db] Supabase deleteInvoice error:", err.message);
      throw err;
    }
  }
  const arr = readJsonArray(INVOICES_PATH);
  writeJsonArray(
    INVOICES_PATH,
    arr.filter((i: any) => i.id !== id),
  );
}

// ══════════════════════════════════════════════════════════════════════
// SETTINGS (Key-Value store)
// ══════════════════════════════════════════════════════════════════════

export async function getSetting(
  key: string,
  defaultValue: any = null,
): Promise<any> {
  if (isSupabaseActive()) {
    try {
      const { data, error } = await getSupabase()
        .from("settings")
        .select("value")
        .eq("key", key)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data?.value ?? defaultValue;
    } catch (err: any) {
      console.error(`[db] Supabase getSetting(${key}) error:`, err.message);
      throw err;
    }
  }
  const map = readJsonObject(SETTINGS_PATH);
  return key in map ? map[key] : defaultValue;
}

export async function saveSetting(key: string, value: any): Promise<void> {
  if (isSupabaseActive()) {
    try {
      const { error } = await getSupabase()
        .from("settings")
        .upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) throw error;
      return;
    } catch (err: any) {
      console.error(`[db] Supabase saveSetting(${key}) error:`, err.message);
      throw err;
    }
  }
  const map = readJsonObject(SETTINGS_PATH);
  map[key] = value;
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(map, null, 2), "utf-8");
}

// ══════════════════════════════════════════════════════════════════════
// TEST CONNECTION
// ══════════════════════════════════════════════════════════════════════

export async function testConnection(
  driver: string,
  credentials?: any,
): Promise<any> {
  const start = Date.now();

  if (driver === "supabase") {
    const url = credentials?.url;
    const key = credentials?.anonKey;
    if (!url || !key) {
      return {
        success: false,
        message: "URL dan Anon Key Supabase wajib diisi.",
      };
    }
    try {
      const client = createClient(url, key);
      const { error } = await client.from("settings").select("key").limit(1);
      const latencyMs = Date.now() - start;
      if (error) {
        if (error.code === "42P01") {
          return {
            success: true,
            message: `Terhubung ke Supabase (${latencyMs}ms). Tabel belum dibuat – gunakan skrip SQL.`,
            latencyMs,
          };
        }
        return {
          success: false,
          message: `Supabase error: ${error.message}`,
          latencyMs,
        };
      }
      return {
        success: true,
        message: `Berhasil terhubung ke Supabase (${latencyMs}ms)!`,
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal terhubung ke Supabase: ${err.message}`,
      };
    }
  }

  if (driver === "sqlite") {
    return {
      success: true,
      message: `SQLite (JSON fallback) siap digunakan. Data disimpan di ${INVOICES_PATH}`,
      latencyMs: Date.now() - start,
    };
  }

  return {
    success: false,
    message: "Driver MariaDB belum diimplementasikan di server ini.",
    latencyMs: Date.now() - start,
  };
}

// ══════════════════════════════════════════════════════════════════════
// MIGRATE between drivers
// ══════════════════════════════════════════════════════════════════════

export async function migrateDataBetweenDrivers(
  fromDriver: string,
  toDriver: string,
): Promise<any> {
  if (fromDriver === toDriver) {
    return {
      success: false,
      count: 0,
      message: "Driver asal dan tujuan tidak boleh sama.",
    };
  }

  try {
    if (fromDriver === "sqlite" && toDriver === "supabase") {
      const localInvoices = readJsonArray(INVOICES_PATH);
      const localSettings = readJsonObject(SETTINGS_PATH);
      const sb = getSupabase();

      let count = 0;
      for (const inv of localInvoices) {
        const row = mapAppInvoiceToSupabase(inv);
        const { error } = await sb
          .from("invoices")
          .upsert(row, { onConflict: "id" });
        if (!error) count++;
      }
      for (const [key, value] of Object.entries(localSettings)) {
        await sb
          .from("settings")
          .upsert(
            { key, value, updated_at: new Date().toISOString() },
            { onConflict: "key" },
          );
        count++;
      }

      const cfg = loadServerDbConfig();
      cfg.activeDriver = "supabase";
      saveServerDbConfig(cfg);

      return {
        success: true,
        count,
        message: `Berhasil migrasi ${count} item dari Lokal ke Supabase. Driver aktif diubah ke Supabase.`,
      };
    }

    if (fromDriver === "supabase" && toDriver === "sqlite") {
      const sb = getSupabase();
      let count = 0;

      const { data: rows } = await sb.from("invoices").select("*");
      if (rows) {
        const mapped = rows.map(mapSupabaseInvoiceToApp);
        writeJsonArray(INVOICES_PATH, mapped);
        count += mapped.length;
      }
      const { data: settingsRows } = await sb.from("settings").select("*");
      if (settingsRows) {
        const map: Record<string, any> = {};
        for (const s of settingsRows) {
          map[s.key] = s.value;
          count++;
        }
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(map, null, 2), "utf-8");
      }

      const cfg = loadServerDbConfig();
      cfg.activeDriver = "sqlite";
      saveServerDbConfig(cfg);

      return {
        success: true,
        count,
        message: `Berhasil migrasi ${count} item dari Supabase ke Lokal. Driver aktif diubah ke SQLite.`,
      };
    }

    return {
      success: false,
      count: 0,
      message: `Migrasi dari ${fromDriver} ke ${toDriver} belum didukung.`,
    };
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      message: `Gagal migrasi: ${err.message}`,
    };
  }
}

// ══════════════════════════════════════════════════════════════════════
// MAPPING helpers (app ↔ Supabase row)
// ══════════════════════════════════════════════════════════════════════

/**
 * Map the app's Invoice object to a flat Supabase row.
 */
function mapAppInvoiceToSupabase(inv: any): Record<string, any> {
  return {
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    issue_date: inv.issueDate,
    due_date: inv.dueDate,
    status: inv.status,
    client_data: inv.client,
    items_data: inv.items,
    subtotal: inv.subtotal,
    discount_type: inv.discountType,
    discount_value: inv.discountValue,
    discount_amount: inv.discountAmount,
    tax_rate: inv.taxRate,
    tax_amount: inv.taxAmount,
    shipping_fee: inv.shippingFee,
    total: inv.total,
    notes: inv.notes || null,
    terms: inv.terms || null,
    payment_instructions: inv.paymentInstructions || null,

    // ── PERBAIKAN: Tambahkan 2 field ini agar tersimpan ke DB ──
    payment_method: inv.paymentMethod || null,
    payment_account_number: inv.paymentAccountNumber || null,
    // ───────────────────────────────────────────────────────────

    paid_at: inv.paidAt || null,
    paid_method: inv.paidMethod || null,
    whatsapp_status: inv.whatsappStatus || "not_sent",
    whatsapp_sent_at: inv.whatsappSentAt || null,
    whatsapp_recipient: inv.whatsappRecipient || null,
    whatsapp_last_log: inv.whatsappLastLog || null,
    created_at: inv.createdAt || new Date().toISOString(),
    updated_at: inv.updatedAt || new Date().toISOString(),
  };
}

/**
 * Map a Supabase row back to the app's Invoice shape (camelCase).
 */
function mapSupabaseInvoiceToApp(row: any): any {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    status: row.status,
    client: row.client_data,
    items: row.items_data,
    subtotal: parseFloat(row.subtotal) || 0,
    discountType: row.discount_type || "fixed",
    discountValue: parseFloat(row.discount_value) || 0,
    discountAmount: parseFloat(row.discount_amount) || 0,
    taxRate: parseFloat(row.tax_rate) || 0,
    taxAmount: parseFloat(row.tax_amount) || 0,
    shippingFee: parseFloat(row.shipping_fee) || 0,
    total: parseFloat(row.total) || 0,
    notes: row.notes,
    terms: row.terms,
    paymentInstructions: row.payment_instructions,

    // ── PERBAIKAN: Ambil 2 field ini dari DB ke Frontend ──
    paymentMethod: row.payment_method,
    paymentAccountNumber: row.payment_account_number,
    // ─────────────────────────────────────────────────────

    paidAt: row.paid_at,
    paidMethod: row.paid_method,
    whatsappStatus: row.whatsapp_status,
    whatsappSentAt: row.whatsapp_sent_at,
    whatsappRecipient: row.whatsapp_recipient,
    whatsappLastLog: row.whatsapp_last_log,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

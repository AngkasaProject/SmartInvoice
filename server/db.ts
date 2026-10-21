/**
 * server/db.ts – Server-side database adapter for SmartInvoice
 *
 * Supports two modes:
 *   1. "sqlite"  → SQLite asli via bun:sqlite (data/smartinvoice.db)
 *   2. "supabase" → Supabase Cloud via @supabase/supabase-js
 *
 * Configuration is loaded centrally from server/config.ts
 */

import { Database } from "bun:sqlite";
import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseConfig } from "./config";

// ── Data directory ──────────────────────────────────────────────────
const DATA_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "smartinvoice.db");
const db = new Database(DB_PATH, { create: true });

// Optimasi standar: WAL untuk konkurensi baca/tulis, FK aktif
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

// ══════════════════════════════════════════════════════════════════════
// SKEMA (idempotent — aman dijalankan setiap start)
// ══════════════════════════════════════════════════════════════════════
db.run(`
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    issue_date TEXT,
    due_date TEXT,
    status TEXT,
    client_data TEXT,
    items_data TEXT,
    subtotal REAL DEFAULT 0,
    discount_type TEXT,
    discount_value REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    shipping_fee REAL DEFAULT 0,
    total REAL DEFAULT 0,
    notes TEXT,
    terms TEXT,
    payment_instructions TEXT,
    payment_method TEXT,
    payment_account_number TEXT,
    down_payment REAL DEFAULT 0,
    remaining_balance REAL DEFAULT 0,
    paid_at TEXT,
    paid_method TEXT,
    whatsapp_status TEXT,
    whatsapp_sent_at TEXT,
    whatsapp_recipient TEXT,
    whatsapp_last_log TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);

db.run(
  `CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number)`,
);
db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`);
db.run(
  `CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at)`,
);

db.run(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TEXT
  )
`);

// ══════════════════════════════════════════════════════════════════════
// Supabase client (lazy-initialized, hanya dipakai bila ENV aktif)
// ══════════════════════════════════════════════════════════════════════
let _supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (_supabaseClient) return _supabaseClient;

  const cfg = getDatabaseConfig();
  const url = cfg.supabase?.url;
  const key = cfg.supabase?.anonKey;

  if (!url || !key) {
    throw new Error(
      "Supabase belum dikonfigurasi. Silakan isi URL dan Anon Key di menu Pengaturan → Database.",
    );
  }

  _supabaseClient = createClient(url, key);
  console.log(`[db] Supabase client created for ${url}`);
  return _supabaseClient;
}

function isSupabaseActive(): boolean {
  const cfg = getDatabaseConfig();
  return (
    cfg.activeDriver === "supabase" &&
    Boolean(cfg.supabase?.url) &&
    Boolean(cfg.supabase?.anonKey)
  );
}

// ══════════════════════════════════════════════════════════════════════
// Mapping helpers (SQLite row ↔ objek app / Supabase row)
// ══════════════════════════════════════════════════════════════════════
function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapSqliteRowToApp(row: any): any {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    status: row.status,
    client: safeJsonParse(row.client_data, {}),
    items: safeJsonParse(row.items_data, []),
    subtotal: row.subtotal ?? 0,
    discountType: row.discount_type || "fixed",
    discountValue: row.discount_value ?? 0,
    discountAmount: row.discount_amount ?? 0,
    taxRate: row.tax_rate ?? 0,
    taxAmount: row.tax_amount ?? 0,
    shippingFee: row.shipping_fee ?? 0,
    total: row.total ?? 0,
    notes: row.notes,
    terms: row.terms,
    paymentInstructions: row.payment_instructions,
    paymentMethod: row.payment_method,
    paymentAccountNumber: row.payment_account_number,
    downPayment: row.down_payment ?? 0,
    remainingBalance: row.remaining_balance ?? 0,
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
    paymentMethod: row.payment_method,
    paymentAccountNumber: row.payment_account_number,
    downPayment: parseFloat(row.down_payment) || 0,
    remainingBalance: parseFloat(row.remaining_balance) || 0,
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
    payment_method: inv.paymentMethod || null,
    payment_account_number: inv.paymentAccountNumber || null,
    down_payment: inv.downPayment || 0,
    remaining_balance: inv.remainingBalance || 0,
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
  const rows = db
    .query("SELECT * FROM invoices ORDER BY created_at DESC")
    .all() as any[];
  return rows.map(mapSqliteRowToApp);
}

export async function getInvoiceById(id: string): Promise<any> {
  if (isSupabaseActive()) {
    const { data, error } = await getSupabase()
      .from("invoices")
      .select("*")
      .eq("id", id)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? mapSupabaseInvoiceToApp(data) : null;
  }
  const row = db.query("SELECT * FROM invoices WHERE id = ?").get(id) as any;
  return row ? mapSqliteRowToApp(row) : null;
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

  db.run(
    `INSERT INTO invoices (
      id, invoice_number, issue_date, due_date, status,
      client_data, items_data,
      subtotal, discount_type, discount_value, discount_amount,
      tax_rate, tax_amount, shipping_fee, total,
      notes, terms, payment_instructions,
      payment_method, payment_account_number,
      down_payment, remaining_balance,
      paid_at, paid_method,
      whatsapp_status, whatsapp_sent_at, whatsapp_recipient, whatsapp_last_log,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      invoice_number = excluded.invoice_number,
      issue_date = excluded.issue_date,
      due_date = excluded.due_date,
      status = excluded.status,
      client_data = excluded.client_data,
      items_data = excluded.items_data,
      subtotal = excluded.subtotal,
      discount_type = excluded.discount_type,
      discount_value = excluded.discount_value,
      discount_amount = excluded.discount_amount,
      tax_rate = excluded.tax_rate,
      tax_amount = excluded.tax_amount,
      shipping_fee = excluded.shipping_fee,
      total = excluded.total,
      notes = excluded.notes,
      terms = excluded.terms,
      payment_instructions = excluded.payment_instructions,
      payment_method = excluded.payment_method,
      payment_account_number = excluded.payment_account_number,
      down_payment = excluded.down_payment,
      remaining_balance = excluded.remaining_balance,
      paid_at = excluded.paid_at,
      paid_method = excluded.paid_method,
      whatsapp_status = excluded.whatsapp_status,
      whatsapp_sent_at = excluded.whatsapp_sent_at,
      whatsapp_recipient = excluded.whatsapp_recipient,
      whatsapp_last_log = excluded.whatsapp_last_log,
      updated_at = excluded.updated_at`,
    [
      invoice.id,
      invoice.invoiceNumber,
      invoice.issueDate ?? null,
      invoice.dueDate ?? null,
      invoice.status ?? null,
      JSON.stringify(invoice.client ?? {}),
      JSON.stringify(invoice.items ?? []),
      invoice.subtotal ?? 0,
      invoice.discountType ?? "fixed",
      invoice.discountValue ?? 0,
      invoice.discountAmount ?? 0,
      invoice.taxRate ?? 0,
      invoice.taxAmount ?? 0,
      invoice.shippingFee ?? 0,
      invoice.total ?? 0,
      invoice.notes ?? null,
      invoice.terms ?? null,
      invoice.paymentInstructions ?? null,
      invoice.paymentMethod ?? null,
      invoice.paymentAccountNumber ?? null,
      invoice.downPayment ?? 0,
      invoice.remainingBalance ?? 0,
      invoice.paidAt ?? null,
      invoice.paidMethod ?? null,
      invoice.whatsappStatus ?? "not_sent",
      invoice.whatsappSentAt ?? null,
      invoice.whatsappRecipient ?? null,
      invoice.whatsappLastLog ?? null,
      invoice.createdAt ?? new Date().toISOString(),
      invoice.updatedAt ?? new Date().toISOString(),
    ],
  );
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
  db.run("DELETE FROM invoices WHERE id = ?", [id]);
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
  const row = db
    .query("SELECT value FROM settings WHERE key = ?")
    .get(key) as any;
  if (!row) return defaultValue;
  return safeJsonParse(row.value, defaultValue);
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
  db.run(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    [key, JSON.stringify(value ?? null), new Date().toISOString()],
  );
}

// ══════════════════════════════════════════════════════════════════════
// USERS CRUD (AUTH)
// ══════════════════════════════════════════════════════════════════════

export async function checkAdminExists(): Promise<boolean> {
  if (isSupabaseActive()) {
    const { count } = await getSupabase()
      .from("users")
      .select("*", { count: "exact", head: true });
    return (count || 0) > 0;
  }
  const row = db.query("SELECT COUNT(*) as c FROM users").get() as {
    c: number;
  };
  return (row?.c || 0) > 0;
}

export async function createAdminUser(user: any): Promise<void> {
  if (isSupabaseActive()) {
    const { error } = await getSupabase().from("users").insert(user);
    if (error) throw error;
    return;
  }
  db.run(
    `INSERT INTO users (id, username, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      user.id,
      user.username,
      user.password_hash,
      user.role ?? "admin",
      user.created_at ?? new Date().toISOString(),
    ],
  );
}

export async function getAdminUser(username: string): Promise<any> {
  if (isSupabaseActive()) {
    const { data } = await getSupabase()
      .from("users")
      .select("*")
      .eq("username", username)
      .single();
    return data;
  }
  return (
    db.query("SELECT * FROM users WHERE username = ?").get(username) ?? null
  );
}

// ══════════════════════════════════════════════════════════════════════
// TEST CONNECTION & MIGRATION
// ══════════════════════════════════════════════════════════════════════

export async function testConnection(
  driver: string,
  credentials?: any,
): Promise<any> {
  const start = Date.now();

  if (driver === "supabase") {
    const url = credentials?.url || getDatabaseConfig().supabase.url;
    const key = credentials?.anonKey || getDatabaseConfig().supabase.anonKey;

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
    try {
      // Cek tulis-baca ke SQLite agar tidak sekadar asumsi
      db.run(
        `CREATE TABLE IF NOT EXISTS _healthcheck (id INTEGER PRIMARY KEY, ts TEXT)`,
      );
      const ts = new Date().toISOString();
      db.run("DELETE FROM _healthcheck");
      db.run("INSERT INTO _healthcheck (ts) VALUES (?)", [ts]);
      const row = db.query("SELECT ts FROM _healthcheck LIMIT 1").get() as {
        ts: string;
      };
      if (row?.ts === ts) {
        return {
          success: true,
          message: `SQLite siap digunakan. Data disimpan di ${DB_PATH}`,
          latencyMs: Date.now() - start,
        };
      }
      return {
        success: false,
        message: "SQLite tidak dapat membaca kembali data yang baru ditulis.",
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal menguji SQLite: ${err.message}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  return {
    success: false,
    message: "Driver MariaDB belum diimplementasikan di server ini.",
    latencyMs: Date.now() - start,
  };
}

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
      const sb = getSupabase();
      const rows = db.query("SELECT * FROM invoices").all() as any[];
      const settingsRows = db.query("SELECT * FROM settings").all() as any[];

      let count = 0;
      for (const row of rows) {
        const appInv = mapSqliteRowToApp(row);
        const sbRow = mapAppInvoiceToSupabase(appInv);
        const { error } = await sb
          .from("invoices")
          .upsert(sbRow, { onConflict: "id" });
        if (!error) count++;
      }
      for (const s of settingsRows) {
        await sb.from("settings").upsert(
          {
            key: s.key,
            value: safeJsonParse(s.value, null),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );
        count++;
      }
      return {
        success: true,
        count,
        message: `Berhasil migrasi ${count} item ke Supabase.`,
      };
    }

    if (fromDriver === "supabase" && toDriver === "sqlite") {
      const sb = getSupabase();
      let count = 0;

      const { data: rows } = await sb.from("invoices").select("*");
      if (rows) {
        for (const r of rows) {
          const appInv = mapSupabaseInvoiceToApp(r);
          await saveInvoice(appInv);
          count++;
        }
      }
      const { data: settingsRows } = await sb.from("settings").select("*");
      if (settingsRows) {
        for (const s of settingsRows) {
          await saveSetting(s.key, s.value);
          count++;
        }
      }
      return {
        success: true,
        count,
        message: `Berhasil migrasi ${count} item ke SQLite.`,
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

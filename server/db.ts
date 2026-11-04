/**
 * server/db.ts – Server-side database adapter for SmartInvoice
 *
 * Supports SQLite, Supabase, and Neon. Cloudflare D1 is handled in _worker.ts.
 *
 * Configuration is loaded centrally from server/config.ts
 */

import { Database } from "bun:sqlite";
import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { DatabaseConfig, getDatabaseConfig } from "./config";

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

function isNeonActive(): boolean {
  return (
    getDatabaseConfig().activeDriver === "neon" &&
    Boolean(process.env.NEON_DATABASE_URL)
  );
}

function assertSqliteActive(
  driver: DatabaseConfig["activeDriver"] = getDatabaseConfig().activeDriver,
): void {
  if (driver === "sqlite") return;
  if (driver === "d1") {
    throw new Error("Cloudflare D1 hanya tersedia pada runtime Workers.");
  }
  if (driver === "neon" && !process.env.NEON_DATABASE_URL) {
    throw new Error("NEON_DATABASE_URL belum dikonfigurasi.");
  }
  if (
    driver === "supabase" &&
    (!getDatabaseConfig().supabase.url || !getDatabaseConfig().supabase.anonKey)
  ) {
    throw new Error("URL dan Anon Key Supabase wajib dikonfigurasi.");
  }
  throw new Error(`Database driver '${driver}' tidak tersedia.`);
}

function getNeon() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error("NEON_DATABASE_URL belum dikonfigurasi.");
  }
  return neon(connectionString);
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  return safeJsonParse(value, fallback);
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
  if (isNeonActive()) {
    const rows = await getNeon().query(
      "SELECT * FROM invoices ORDER BY created_at DESC",
    );
    return rows.map(mapSupabaseInvoiceToApp);
  }
  assertSqliteActive();
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
  if (isNeonActive()) {
    const rows = await getNeon().query(
      "SELECT * FROM invoices WHERE id = $1 LIMIT 1",
      [id],
    );
    return rows[0] ? mapSupabaseInvoiceToApp(rows[0]) : null;
  }
  assertSqliteActive();
  const row = db.query("SELECT * FROM invoices WHERE id = ?").get(id) as any;
  return row ? mapSqliteRowToApp(row) : null;
}

export async function saveInvoice(
  invoice: any,
  targetDriver: DatabaseConfig["activeDriver"] = getDatabaseConfig()
    .activeDriver,
): Promise<void> {
  if (targetDriver === "supabase") {
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

  if (targetDriver === "neon") {
    const row = mapAppInvoiceToSupabase(invoice);
    const columns = Object.keys(row);
    const jsonColumns = new Set(["client_data", "items_data"]);
    const values = columns.map((column) =>
      jsonColumns.has(column) ? JSON.stringify(row[column]) : row[column],
    );
    const placeholders = columns.map((column, index) =>
      jsonColumns.has(column) ? `$${index + 1}::jsonb` : `$${index + 1}`,
    );
    const updates = columns
      .filter((column) => column !== "id")
      .map((column) => `${column} = EXCLUDED.${column}`);
    await getNeon().query(
      `INSERT INTO invoices (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}`,
      values,
    );
    return;
  }

  assertSqliteActive(targetDriver);
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
  if (isNeonActive()) {
    await getNeon().query("DELETE FROM invoices WHERE id = $1", [id]);
    return;
  }
  assertSqliteActive();
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
  if (isNeonActive()) {
    const rows = await getNeon().query(
      "SELECT value FROM settings WHERE key = $1 LIMIT 1",
      [key],
    );
    return rows[0] ? parseJsonValue(rows[0].value, defaultValue) : defaultValue;
  }
  assertSqliteActive();
  const row = db
    .query("SELECT value FROM settings WHERE key = ?")
    .get(key) as any;
  if (!row) return defaultValue;
  return safeJsonParse(row.value, defaultValue);
}

export async function saveSetting(
  key: string,
  value: any,
  targetDriver: DatabaseConfig["activeDriver"] = getDatabaseConfig()
    .activeDriver,
): Promise<void> {
  if (targetDriver === "supabase") {
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
  if (targetDriver === "neon") {
    await getNeon().query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = EXCLUDED.updated_at`,
      [key, JSON.stringify(value ?? null), new Date().toISOString()],
    );
    return;
  }
  assertSqliteActive(targetDriver);
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
  if (isNeonActive()) {
    const rows = await getNeon().query(
      "SELECT COUNT(*)::int AS c FROM users",
    );
    return Number(rows[0]?.c || 0) > 0;
  }
  assertSqliteActive();
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
  if (isNeonActive()) {
    await getNeon().query(
      `INSERT INTO users (id, username, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        user.username,
        user.password_hash,
        user.role ?? "admin",
        user.created_at ?? new Date().toISOString(),
      ],
    );
    return;
  }
  assertSqliteActive();
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
  if (isNeonActive()) {
    const rows = await getNeon().query(
      "SELECT * FROM users WHERE username = $1 LIMIT 1",
      [username],
    );
    return rows[0] ?? null;
  }
  assertSqliteActive();
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

  if (driver === "neon") {
    if (!process.env.NEON_DATABASE_URL) {
      return {
        success: false,
        message: "NEON_DATABASE_URL belum dikonfigurasi sebagai secret ENV.",
        latencyMs: Date.now() - start,
      };
    }
    try {
      await getNeon().query("SELECT 1 AS connected");
      return {
        success: true,
        message: `Berhasil terhubung ke Neon (${Date.now() - start}ms).`,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal terhubung ke Neon: ${err.message}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  return {
    success: false,
    message: `Driver '${driver}' tidak tersedia di server Bun.`,
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

  const supportedDrivers = new Set(["sqlite", "supabase", "neon"]);
  if (!supportedDrivers.has(fromDriver) || !supportedDrivers.has(toDriver)) {
    return {
      success: false,
      count: 0,
      message: "Migrasi hanya tersedia untuk SQLite, Supabase, dan Neon pada server Bun.",
    };
  }

  try {
    let invoices: any[];
    let settings: any[];
    let users: any[];

    if (fromDriver === "sqlite") {
      invoices = (db.query("SELECT * FROM invoices").all() as any[]).map(
        mapSqliteRowToApp,
      );
      settings = (db.query("SELECT * FROM settings").all() as any[]).map(
        (row) => ({
          key: row.key,
          value: safeJsonParse(row.value, null),
        }),
      );
      users = db.query("SELECT * FROM users").all() as any[];
    } else if (fromDriver === "supabase") {
      const sb = getSupabase();
      const [invoiceResult, settingResult, userResult] = await Promise.all([
        sb.from("invoices").select("*"),
        sb.from("settings").select("*"),
        sb.from("users").select("*"),
      ]);
      if (invoiceResult.error) throw invoiceResult.error;
      if (settingResult.error) throw settingResult.error;
      if (userResult.error) throw userResult.error;
      invoices = (invoiceResult.data || []).map(mapSupabaseInvoiceToApp);
      settings = settingResult.data || [];
      users = userResult.data || [];
    } else {
      const [invoiceRows, settingRows, userRows] = await Promise.all([
        getNeon().query("SELECT * FROM invoices"),
        getNeon().query("SELECT * FROM settings"),
        getNeon().query("SELECT * FROM users"),
      ]);
      invoices = invoiceRows.map(mapSupabaseInvoiceToApp);
      settings = settingRows.map((row: any) => ({
        key: row.key,
        value: parseJsonValue(row.value, null),
      }));
      users = userRows;
    }

    for (const invoice of invoices) {
      await saveInvoice(invoice, toDriver as DatabaseConfig["activeDriver"]);
    }
    for (const setting of settings) {
      await saveSetting(
        setting.key,
        setting.value,
        toDriver as DatabaseConfig["activeDriver"],
      );
    }
    for (const user of users) {
      if (toDriver === "sqlite") {
        db.run(
          `INSERT INTO users (id, username, password_hash, role, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             username = excluded.username,
             password_hash = excluded.password_hash,
             role = excluded.role,
             created_at = excluded.created_at`,
          [
            user.id,
            user.username,
            user.password_hash,
            user.role ?? "admin",
            user.created_at ?? new Date().toISOString(),
          ],
        );
      } else if (toDriver === "supabase") {
        const { error } = await getSupabase()
          .from("users")
          .upsert(user, { onConflict: "id" });
        if (error) throw error;
      } else {
        await getNeon().query(
          `INSERT INTO users (id, username, password_hash, role, created_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             username = EXCLUDED.username,
             password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             created_at = EXCLUDED.created_at`,
          [
            user.id,
            user.username,
            user.password_hash,
            user.role ?? "admin",
            user.created_at ?? new Date().toISOString(),
          ],
        );
      }
    }

    const count = invoices.length + settings.length + users.length;
    return {
      success: true,
      count,
      message: `Berhasil migrasi ${count} data dari ${fromDriver} ke ${toDriver}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      message: `Gagal migrasi: ${err.message}`,
    };
  }
}

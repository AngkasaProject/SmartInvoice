/**
 * Cloudflare Workers Edge Entry Point
 * Database D1/Neon/Supabase and R2-backed image storage.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { neon } from "@neondatabase/serverless";
import { hashPassword, verifyPassword } from "./src/utils/password";

interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  error?: string;
}

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1Statement;
}

interface R2Object {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  writeHttpMetadata(headers: Headers): void;
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}

interface Env {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  DB?: D1Database;
  R2_BUCKET?: R2Bucket;
  ENVIRONMENT?: string;
  DATABASE_DRIVER?: string;
  NEON_DATABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_STORAGE_BUCKET?: string;
  WHATSAPP_PROVIDER?: string;
  OPENWA_SERVER_URL?: string;
  OPENWA_API_KEY?: string;
  OPENWA_SESSION_ID?: string;
  FONNTE_TOKEN?: string;
}

let _supabase: SupabaseClient | null = null;
function getSupabase(env: Env): SupabaseClient {
  if (_supabase) return _supabase;
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL/Key belum diatur.");
  }
  _supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  return _supabase;
}

type WorkerDatabaseDriver = "d1" | "supabase" | "neon";

function getDatabaseDriver(env: Env): WorkerDatabaseDriver {
  const requested = env.DATABASE_DRIVER?.toLowerCase();
  if (requested) {
    if (requested === "d1" || requested === "supabase" || requested === "neon") {
      return requested;
    }
    throw new Error(
      `DATABASE_DRIVER '${requested}' tidak didukung oleh Cloudflare Workers.`,
    );
  }
  if (env.DB) return "d1";
  if (env.NEON_DATABASE_URL) return "neon";
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) return "supabase";
  return "d1";
}

function isDatabaseConfigured(env: Env): boolean {
  switch (getDatabaseDriver(env)) {
    case "d1":
      return Boolean(env.DB);
    case "neon":
      return Boolean(env.NEON_DATABASE_URL);
    case "supabase":
      return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
  }
}

function requireDatabase(env: Env): WorkerDatabaseDriver {
  const driver = getDatabaseDriver(env);
  if (!isDatabaseConfigured(env)) {
    throw new Error(
      driver === "d1"
        ? "Binding D1 'DB' belum dikonfigurasi di Wrangler."
        : driver === "neon"
          ? "NEON_DATABASE_URL belum dikonfigurasi."
          : "SUPABASE_URL dan SUPABASE_ANON_KEY belum dikonfigurasi.",
    );
  }
  return driver;
}

function getNeon(env: Env) {
  if (!env.NEON_DATABASE_URL) {
    throw new Error("NEON_DATABASE_URL belum dikonfigurasi.");
  }
  return neon(env.NEON_DATABASE_URL);
}

function toPostgresPlaceholders(query: string): string {
  let index = 0;
  return query.replace(/\?/g, () => `$${++index}`);
}

async function queryRows<T extends Record<string, any>>(
  env: Env,
  query: string,
  values: unknown[] = [],
): Promise<T[]> {
  const driver = requireDatabase(env);
  if (driver === "d1") {
    const result = await env.DB!.prepare(query).bind(...values).all<T>();
    if (!result.success) throw new Error(result.error || "Query D1 gagal.");
    return result.results || [];
  }
  if (driver === "neon") {
    return (await getNeon(env).query(
      toPostgresPlaceholders(query),
      values,
    )) as T[];
  }
  throw new Error("Query SQL hanya dapat digunakan dengan D1 atau Neon.");
}

async function queryFirst<T extends Record<string, any>>(
  env: Env,
  query: string,
  values: unknown[] = [],
): Promise<T | null> {
  const driver = requireDatabase(env);
  if (driver === "d1") {
    return env.DB!.prepare(query).bind(...values).first<T>();
  }
  if (driver === "neon") {
    const rows = await queryRows<T>(env, query, values);
    return rows[0] || null;
  }
  throw new Error("Query SQL hanya dapat digunakan dengan D1 atau Neon.");
}

async function executeQuery(
  env: Env,
  query: string,
  values: unknown[] = [],
): Promise<void> {
  const driver = requireDatabase(env);
  if (driver === "d1") {
    const result = await env.DB!.prepare(query).bind(...values).run();
    if (!result.success) throw new Error(result.error || "Query D1 gagal.");
    return;
  }
  if (driver === "neon") {
    await getNeon(env).query(toPostgresPlaceholders(query), values);
    return;
  }
  throw new Error("Query SQL hanya dapat digunakan dengan D1 atau Neon.");
}

function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapInvoiceRow(row: Record<string, any>) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    status: row.status,
    client: parseJson(row.client_data, {}),
    items: parseJson(row.items_data, []),
    subtotal: Number(row.subtotal) || 0,
    discountType: row.discount_type || "fixed",
    discountValue: Number(row.discount_value) || 0,
    discountAmount: Number(row.discount_amount) || 0,
    taxRate: Number(row.tax_rate) || 0,
    taxAmount: Number(row.tax_amount) || 0,
    shippingFee: Number(row.shipping_fee) || 0,
    total: Number(row.total) || 0,
    notes: row.notes,
    terms: row.terms,
    paymentInstructions: row.payment_instructions,
    paymentMethod: row.payment_method,
    paymentAccountNumber: row.payment_account_number,
    downPayment: Number(row.down_payment) || 0,
    remainingBalance: Number(row.remaining_balance) || 0,
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

async function getInvoiceRow(env: Env, id: string) {
  const driver = requireDatabase(env);
  if (driver === "supabase") {
    const { data, error } = await getSupabase(env)
      .from("invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  return queryFirst(env, "SELECT * FROM invoices WHERE id = ?", [id]);
}

async function getSettingValue(env: Env, key: string) {
  const driver = requireDatabase(env);
  if (driver === "supabase") {
    const { data, error } = await getSupabase(env)
      .from("settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  }
  const row = await queryFirst<{ value: unknown }>(
    env,
    "SELECT value FROM settings WHERE key = ?",
    [key],
  );
  return row ? parseJson(row.value, null) : null;
}

async function getUserByUsername(env: Env, username: string) {
  const driver = requireDatabase(env);
  if (driver === "supabase") {
    const { data, error } = await getSupabase(env)
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  return queryFirst(env, "SELECT * FROM users WHERE username = ?", [username]);
}

function getWhatsAppEnvConfig(env: Env) {
  if (!env.WHATSAPP_PROVIDER) return null;
  return {
    provider: env.WHATSAPP_PROVIDER as "openwa" | "fonnte",
    serverUrl: env.OPENWA_SERVER_URL || "",
    apiKey: env.OPENWA_API_KEY || "",
    sessionName: env.OPENWA_SESSION_ID || "",
    fonnteToken: env.FONNTE_TOKEN || "",
    endpointType: "sendPdf",
    customEndpointPath: "/sendPdf",
    autoSendCaption: "",
    directWhatsappFallback: true,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, api_key, X-API-Key",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const activeDriver = getDatabaseDriver(env);
      const hasDatabase = isDatabaseConfigured(env);

      // ==========================================
      // 1. ENDPOINT PUBLIK (Untuk Link Print)
      // ==========================================
      if (
        url.pathname.startsWith("/api/public/invoice/") &&
        request.method === "GET"
      ) {
        const id = url.pathname.replace("/api/public/invoice/", "");

        const invRow = await getInvoiceRow(env, id);

        if (!invRow) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Invoice tidak ditemukan.",
            }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const business = await getSettingValue(env, "business_profile");

        return new Response(
          JSON.stringify({
            success: true,
            invoice: mapInvoiceRow(invRow),
            business,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // ==========================================
      // 2. ENDPOINT AUTH
      // ==========================================
      if (url.pathname === "/api/auth/status" && request.method === "GET") {
        requireDatabase(env);
        let count = 0;
        if (activeDriver === "supabase") {
          const { count: userCount, error } = await getSupabase(env)
            .from("users")
            .select("*", { count: "exact", head: true });
          if (error) throw error;
          count = userCount || 0;
        } else {
          const row = await queryFirst<{ c: number }>(
            env,
            "SELECT COUNT(*) AS c FROM users",
          );
          count = Number(row?.c) || 0;
        }
        return new Response(
          JSON.stringify({
            success: true,
            hasAdmin: count > 0,
            isAnonymous: false,
            activeDriver,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (
        (url.pathname === "/api/auth/setup" ||
          url.pathname === "/api/auth/login") &&
        !hasDatabase
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Database tidak dikonfigurasi.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname === "/api/auth/setup" && request.method === "POST") {
        requireDatabase(env);
        let hasAdmin = false;
        if (activeDriver === "supabase") {
          const { count, error } = await getSupabase(env)
            .from("users")
            .select("*", { count: "exact", head: true });
          if (error) throw error;
          hasAdmin = (count || 0) > 0;
        } else {
          const row = await queryFirst<{ c: number }>(
            env,
            "SELECT COUNT(*) AS c FROM users",
          );
          hasAdmin = Number(row?.c) > 0;
        }
        if (hasAdmin) {
          return new Response(
            JSON.stringify({ success: false, message: "Admin sudah ada." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        const body: any = await request.json();
        const passwordHash = await hashPassword(body.password);
        const newUser = {
          id: `user_${Date.now()}`,
          username: body.username,
          password_hash: passwordHash,
          role: "admin",
        };
        if (activeDriver === "supabase") {
          const { error } = await getSupabase(env).from("users").insert({
            ...newUser,
            created_at: new Date().toISOString(),
          });
          if (error) throw error;
        } else {
          await executeQuery(
            env,
            `INSERT INTO users (id, username, password_hash, role, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
              newUser.id,
              newUser.username,
              newUser.password_hash,
              newUser.role,
              new Date().toISOString(),
            ],
          );
        }
        return new Response(
          JSON.stringify({ success: true, message: "Admin dibuat." }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        requireDatabase(env);
        const body: any = await request.json();
        const user = await getUserByUsername(env, body.username);
        if (!user) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "User tidak ditemukan.",
            }),
            {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        const isMatch = await verifyPassword(body.password, user.password_hash);
        if (!isMatch) {
          return new Response(
            JSON.stringify({ success: false, message: "Password salah." }),
            {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        return new Response(
          JSON.stringify({
            success: true,
            token: `auth_${Date.now()}`,
            user: { username: user.username },
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // ==========================================
      // 3. ENDPOINT DB CONFIG
      // ==========================================
      if (url.pathname === "/api/db/config" && request.method === "GET") {
        const config = {
          activeDriver,
          sqlite: { filePath: "" },
          d1: { binding: "DB" },
          supabase: {
            url: env.SUPABASE_URL || "",
            anonKey: env.SUPABASE_ANON_KEY || "",
          },
          neon: { configured: Boolean(env.NEON_DATABASE_URL) },
        };
        const isEnvLocked = Boolean(
          env.DB ||
            env.DATABASE_DRIVER ||
            env.NEON_DATABASE_URL ||
            (env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
        );
        return new Response(
          JSON.stringify({
            success: true,
            config,
            isEnvLocked,
            canMigrate: false,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname === "/api/db/config" && request.method === "POST") {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Konfigurasi database Workers dikelola melalui Wrangler dan secrets.",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname === "/api/db/test" && request.method === "POST") {
        const body: any = await request.json();
        const driver = body.driver || activeDriver;
        const start = Date.now();
        if (driver === "d1" && env.DB) {
          await env.DB.prepare("SELECT 1 AS ok").first();
        } else if (driver === "neon" && env.NEON_DATABASE_URL) {
          await getNeon(env).query("SELECT 1 AS ok");
        } else if (
          driver === "supabase" &&
          env.SUPABASE_URL &&
          env.SUPABASE_ANON_KEY
        ) {
          const { error } = await getSupabase(env)
            .from("settings")
            .select("key")
            .limit(1);
          if (error && error.code !== "42P01") throw error;
        } else {
          throw new Error(`Driver '${driver}' tidak tersedia di Workers.`);
        }
        return new Response(
          JSON.stringify({
            success: true,
            message: `Berhasil terhubung ke ${driver}.`,
            latencyMs: Date.now() - start,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // ==========================================
      // 4. ENDPOINT INVOICES
      // ==========================================
      if (url.pathname === "/api/invoices" && request.method === "GET") {
        requireDatabase(env);
        let rows: Record<string, any>[];
        if (activeDriver === "supabase") {
          const { data, error } = await getSupabase(env)
            .from("invoices")
            .select("*")
            .order("created_at", { ascending: false });
          if (error) throw error;
          rows = data || [];
        } else {
          rows = await queryRows(
            env,
            "SELECT * FROM invoices ORDER BY created_at DESC",
          );
        }
        const invoices = rows.map(mapInvoiceRow);
        return new Response(JSON.stringify({ success: true, invoices }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/invoices" && request.method === "POST") {
        requireDatabase(env);
        const body: any = await request.json();
        const row: Record<string, any> = {
          id: body.id,
          invoice_number: body.invoiceNumber,
          issue_date: body.issueDate,
          due_date: body.dueDate,
          status: body.status,
          client_data: body.client,
          items_data: body.items,
          subtotal: body.subtotal,
          discount_type: body.discountType,
          discount_value: body.discountValue,
          discount_amount: body.discountAmount,
          tax_rate: body.taxRate,
          tax_amount: body.taxAmount,
          shipping_fee: body.shippingFee,
          total: body.total,
          notes: body.notes || null,
          terms: body.terms || null,
          payment_instructions: body.paymentInstructions || null,
          payment_method: body.paymentMethod || null,
          payment_account_number: body.paymentAccountNumber || null,
          down_payment: body.downPayment || 0,
          remaining_balance: body.remainingBalance || 0,
          paid_at: body.paidAt || null,
          paid_method: body.paidMethod || null,
          whatsapp_status: body.whatsappStatus || "not_sent",
          whatsapp_sent_at: body.whatsappSentAt || null,
          whatsapp_recipient: body.whatsappRecipient || null,
          whatsapp_last_log: body.whatsappLastLog || null,
          created_at: body.createdAt || new Date().toISOString(),
          updated_at: body.updatedAt || new Date().toISOString(),
        };
        if (activeDriver === "supabase") {
          const { error } = await getSupabase(env)
            .from("invoices")
            .upsert(row, { onConflict: "id" });
          if (error) throw error;
        } else {
          const columns = Object.keys(row);
          const jsonColumns = new Set(["client_data", "items_data"]);
          const values = columns.map((column) =>
            jsonColumns.has(column)
              ? JSON.stringify(row[column] ?? (column === "items_data" ? [] : {}))
              : row[column],
          );
          const postgresPlaceholders = columns.map((column, index) =>
            jsonColumns.has(column) ? `$${index + 1}::jsonb` : `$${index + 1}`,
          );
          const updates = columns
            .filter((column) => column !== "id")
            .map((column) => `${column} = excluded.${column}`);
          if (activeDriver === "neon") {
            await getNeon(env).query(
              `INSERT INTO invoices (${columns.join(", ")})
               VALUES (${postgresPlaceholders.join(", ")})
               ON CONFLICT(id) DO UPDATE SET ${updates.join(", ")}`,
              values,
            );
          } else {
            await executeQuery(
              env,
              `INSERT INTO invoices (${columns.join(", ")})
               VALUES (${columns.map(() => "?").join(", ")})
               ON CONFLICT(id) DO UPDATE SET ${updates.join(", ")}`,
              values,
            );
          }
        }
        return new Response(
          JSON.stringify({ success: true, message: "Invoice tersimpan" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (
        url.pathname.startsWith("/api/invoices/") &&
        request.method === "DELETE"
      ) {
        requireDatabase(env);
        const id = decodeURIComponent(url.pathname.slice("/api/invoices/".length));
        if (activeDriver === "supabase") {
          const { error } = await getSupabase(env)
            .from("invoices")
            .delete()
            .eq("id", id);
          if (error) throw error;
        } else {
          await executeQuery(env, "DELETE FROM invoices WHERE id = ?", [id]);
        }
        return new Response(
          JSON.stringify({ success: true, message: "Invoice dihapus" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // ==========================================
      // 5. ENDPOINT SETTINGS
      // ==========================================
      if (url.pathname.startsWith("/api/settings/")) {
        const key = url.pathname.replace("/api/settings/", "");

        if (key === "openwa_config" && getWhatsAppEnvConfig(env)) {
          if (request.method === "GET") {
            return new Response(
              JSON.stringify({
                success: true,
                value: getWhatsAppEnvConfig(env),
                isEnvLocked: true,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
          if (request.method === "POST") {
            return new Response(
              JSON.stringify({ success: false, message: "Dikunci oleh ENV." }),
              {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        }

        requireDatabase(env);

        if (request.method === "GET") {
          const value = await getSettingValue(env, key);
          return new Response(
            JSON.stringify({
              success: true,
              value,
              isEnvLocked: false,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (request.method === "POST") {
          const body: any = await request.json();
          const updatedAt = new Date().toISOString();
          if (activeDriver === "supabase") {
            const { error } = await getSupabase(env)
              .from("settings")
              .upsert(
                { key, value: body.value, updated_at: updatedAt },
                { onConflict: "key" },
              );
            if (error) throw error;
          } else if (activeDriver === "neon") {
            await getNeon(env).query(
              `INSERT INTO settings (key, value, updated_at)
               VALUES ($1, $2::jsonb, $3)
               ON CONFLICT (key) DO UPDATE SET
                 value = EXCLUDED.value,
                 updated_at = EXCLUDED.updated_at`,
              [key, JSON.stringify(body.value ?? null), updatedAt],
            );
          } else {
            await executeQuery(
              env,
              `INSERT INTO settings (key, value, updated_at)
               VALUES (?, ?, ?)
               ON CONFLICT(key) DO UPDATE SET
                 value = excluded.value,
                 updated_at = excluded.updated_at`,
              [key, JSON.stringify(body.value ?? null), updatedAt],
            );
          }
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // ==========================================
      // 5b. FONNTE PROXY (parity dengan server.ts)
      // ==========================================
      if (url.pathname === "/api/fonnte/test" && request.method === "POST") {
        try {
          let body: any = {};
          try {
            const raw = await request.text();
            if (raw && raw.trim()) body = JSON.parse(raw);
          } catch {
            return new Response(
              JSON.stringify({
                success: false,
                message: "Body JSON tidak valid.",
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          const token = String(body.token || env.FONNTE_TOKEN || "").trim();
          if (!token) {
            return new Response(
              JSON.stringify({ success: false, message: "Token kosong" }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          const startTime = Date.now();
          let upstreamRes: Response;
          try {
            upstreamRes = await fetch("https://api.fonnte.com/device", {
              method: "POST",
              headers: { Authorization: token },
            });
          } catch (netErr: any) {
            return new Response(
              JSON.stringify({
                success: false,
                message: netErr.message || "Gagal menghubungi Fonnte",
                latencyMs: Date.now() - startTime,
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          const latencyMs = Date.now() - startTime;
          const text = await upstreamRes.text();
          const trimmed = text.trim();

          if (!trimmed || trimmed.startsWith("<")) {
            return new Response(
              JSON.stringify({
                success: false,
                message: trimmed
                  ? "Fonnte mengembalikan HTML, bukan JSON."
                  : "Fonnte mengembalikan body kosong.",
                latencyMs,
                snippet: trimmed.slice(0, 300),
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          let data: any = null;
          try {
            data = JSON.parse(trimmed);
          } catch {
            return new Response(
              JSON.stringify({
                success: false,
                message: "Respons Fonnte bukan JSON valid.",
                latencyMs,
                snippet: trimmed.slice(0, 300),
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          if (data?.status === true) {
            const deviceStatus = data.device_status || "connect";
            if (deviceStatus === "connect") {
              return new Response(
                JSON.stringify({
                  success: true,
                  message: `Terhubung (${latencyMs}ms)`,
                  latencyMs,
                  data,
                }),
                {
                  status: 200,
                  headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                  },
                },
              );
            }
            return new Response(
              JSON.stringify({
                success: false,
                message: `Status: '${deviceStatus}'`,
                latencyMs,
                data,
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          return new Response(
            JSON.stringify({
              success: false,
              message: data?.reason || data?.message || "Token invalid",
              latencyMs,
              data,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({
              success: false,
              message: err.message || "Kesalahan internal",
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      if (url.pathname === "/api/fonnte/send" && request.method === "POST") {
        try {
          let body: any = {};
          try {
            const raw = await request.text();
            if (raw && raw.trim()) body = JSON.parse(raw);
          } catch {
            return new Response(
              JSON.stringify({
                success: false,
                message: "Body JSON tidak valid.",
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          const token = String(body.token || env.FONNTE_TOKEN || "").trim();
          const target = String(body.target || "").trim();
          const file = body.file ? String(body.file) : "";
          const filename = String(body.filename || "Invoice.pdf");
          const caption = String(body.caption || "");

          if (!token) {
            return new Response(
              JSON.stringify({ success: false, message: "Token kosong" }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
          if (!target) {
            return new Response(
              JSON.stringify({ success: false, message: "Target kosong" }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          let cleanTarget = target.replace(/\D/g, "");
          if (cleanTarget.startsWith("0"))
            cleanTarget = "62" + cleanTarget.slice(1);

          const payload: Record<string, any> = {
            target: cleanTarget,
            message: caption || "",
          };
          if (file) {
            payload.url = file.startsWith("data:")
              ? file
              : `data:application/pdf;base64,${file}`;
            payload.filename = filename;
          }

          let upstreamRes: Response;
          try {
            upstreamRes = await fetch("https://api.fonnte.com/send", {
              method: "POST",
              headers: {
                Authorization: token,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            });
          } catch (netErr: any) {
            return new Response(
              JSON.stringify({
                success: false,
                message: netErr.message || "Gagal menghubungi Fonnte",
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          const text = await upstreamRes.text();
          const trimmed = text.trim();

          if (!trimmed || trimmed.startsWith("<")) {
            return new Response(
              JSON.stringify({
                success: false,
                message: trimmed
                  ? "Fonnte mengembalikan HTML, bukan JSON."
                  : "Fonnte mengembalikan body kosong.",
                snippet: trimmed.slice(0, 300),
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          let data: any = null;
          try {
            data = JSON.parse(trimmed);
          } catch {
            return new Response(
              JSON.stringify({
                success: false,
                message: "Respons Fonnte bukan JSON valid.",
                snippet: trimmed.slice(0, 300),
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          if (data?.status === true) {
            return new Response(
              JSON.stringify({
                success: true,
                message: "Berhasil dikirim",
                data,
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
          return new Response(
            JSON.stringify({
              success: false,
              message: data?.reason || data?.message || "Gagal",
              data,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({
              success: false,
              message: err.message || "Kesalahan internal",
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      if (url.pathname === "/api/upload" && request.method === "POST") {
        if (!env.R2_BUCKET) {
          throw new Error(
            "Binding R2_BUCKET belum dikonfigurasi untuk penyimpanan gambar.",
          );
        }
        const body: any = await request.json();
        if (typeof body.image !== "string" || !body.image) {
          return new Response(
            JSON.stringify({ success: false, message: "Tidak ada data gambar." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        const dataUrlMatch = body.image.match(
          /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/,
        );
        const base64 = dataUrlMatch ? dataUrlMatch[2] : body.image;
        if (base64.length > 14_000_000) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Ukuran gambar melebihi batas 10 MB.",
            }),
            {
              status: 413,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        const filename =
          String(body.filename || "upload.png").split(/[\\/]/).pop() ||
          "upload.png";
        const extension = filename
          .match(/\.(png|jpe?g|webp|gif)$/i)?.[1]
          ?.toLowerCase();
        const mimeType =
          dataUrlMatch?.[1] ||
          (extension === "jpg" || extension === "jpeg"
            ? "image/jpeg"
            : extension
              ? `image/${extension}`
              : "");
        if (!mimeType) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Format gambar tidak didukung.",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        let binary: string;
        try {
          binary = atob(base64);
        } catch {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Data base64 gambar tidak valid.",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        if (bytes.byteLength > 10 * 1024 * 1024) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Ukuran gambar melebihi batas 10 MB.",
            }),
            {
              status: 413,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        const key = `public/img_${crypto.randomUUID()}.${extension || "png"}`;
        await env.R2_BUCKET.put(key, bytes, {
          httpMetadata: { contentType: mimeType },
        });
        return new Response(
          JSON.stringify({
            success: true,
            message: "Gambar berhasil diunggah",
            url: `/uploads/${key}`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (url.pathname === "/api/delete-file" && request.method === "POST") {
        const body: any = await request.json();
        const fileUrl = String(body.fileUrl || "");
        if (!fileUrl.startsWith("/uploads/")) {
          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const key = decodeURIComponent(fileUrl.slice("/uploads/".length));
        if (!key.startsWith("public/") || key.includes("..")) {
          return new Response(
            JSON.stringify({ success: false, message: "Path file tidak valid." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        if (!env.R2_BUCKET) {
          throw new Error("Binding R2_BUCKET belum dikonfigurasi.");
        }
        await env.R2_BUCKET.delete(key);
        return new Response(
          JSON.stringify({ success: true, message: "File R2 dihapus" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (url.pathname.startsWith("/uploads/") && request.method === "GET") {
        const key = decodeURIComponent(url.pathname.slice("/uploads/".length));
        if (
          !key.startsWith("public/") ||
          key.includes("..") ||
          !env.R2_BUCKET
        ) {
          return new Response("Not found", { status: 404 });
        }
        const object = await env.R2_BUCKET.get(key);
        if (!object) return new Response("Not found", { status: 404 });
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        headers.set(
          "Content-Type",
          object.httpMetadata?.contentType || "application/octet-stream",
        );
        headers.set("X-Content-Type-Options", "nosniff");
        return new Response(object.body, { headers });
      }

      // ==========================================
      // 6. STATIC ASSETS
      // ==========================================
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("SmartInvoice Edge Ready", { status: 200 });
    } catch (err: any) {
      return new Response(
        JSON.stringify({ success: false, message: err.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  },
};

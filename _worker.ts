/**
 * Cloudflare Workers Edge Entry Point
 * Terintegrasi dengan Supabase, mendukung ENV Lock & Auth
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface Env {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  ENVIRONMENT?: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  WHATSAPP_PROVIDER?: string;
  OPENWA_SERVER_URL?: string;
  OPENWA_API_KEY?: string;
  OPENWA_SESSION_ID?: string;
  FONNTE_TOKEN?: string;
}

// Singleton Supabase Client
let _supabase: SupabaseClient | null = null;
function getSupabase(env: Env): SupabaseClient {
  if (_supabase) return _supabase;
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL/Key belum diatur.");
  }
  _supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  return _supabase;
}

// Helper untuk mengecek apakah WA dikunci oleh ENV
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

// Helper Hashing (SHA-256)
async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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
      const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);

      // ==========================================
      // 1. AUTH ENDPOINTS
      // ==========================================
      if (url.pathname === "/api/auth/status" && request.method === "GET") {
        // Jika tidak ada Supabase, paksa Mode Anonim
        if (!hasSupabase) {
          return new Response(
            JSON.stringify({
              success: true,
              hasAdmin: false,
              isAnonymous: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Jika ada Supabase, cek user
        try {
          const supabase = getSupabase(env);
          const { count } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true });
          const hasAdmin = (count || 0) > 0;

          return new Response(
            JSON.stringify({ success: true, hasAdmin, isAnonymous: false }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          // Jika tabel users belum dibuat, kembalikan mode setup
          return new Response(
            JSON.stringify({
              success: true,
              hasAdmin: false,
              isAnonymous: true,
              error: err.message,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      // Jika endpoint setup/login diakses tanpa Supabase, blokir
      if (
        (url.pathname === "/api/auth/setup" ||
          url.pathname === "/api/auth/login") &&
        !hasSupabase
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            message:
              "Database tidak dikonfigurasi. Login dinonaktifkan di mode anonim.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname === "/api/auth/setup" && request.method === "POST") {
        const supabase = getSupabase(env);
        const { count } = await supabase
          .from("users")
          .select("*", { count: "exact", head: true });

        if ((count || 0) > 0) {
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

        const { error } = await supabase.from("users").insert(newUser);
        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, message: "Admin dibuat." }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        const supabase = getSupabase(env);
        const body: any = await request.json();

        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("username", body.username)
          .single();
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

        const passwordHash = await hashPassword(body.password);
        if (passwordHash !== user.password_hash) {
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
      // 2. ENDPOINT DB CONFIG
      // ==========================================
      if (url.pathname === "/api/db/config" && request.method === "GET") {
        const config = {
          activeDriver: "supabase",
          sqlite: { filePath: "" },
          mariadb: { host: "", port: 0, user: "", database: "" },
          supabase: {
            url: env.SUPABASE_URL || "",
            anonKey: env.SUPABASE_ANON_KEY || "",
          },
        };

        return new Response(
          JSON.stringify({ success: true, config, isEnvLocked: hasSupabase }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // ==========================================
      // 3. ENDPOINT INVOICES
      // ==========================================
      // Hanya jalan jika ada Supabase
      if (url.pathname === "/api/invoices" && request.method === "GET") {
        if (!hasSupabase)
          return new Response(JSON.stringify({ success: true, invoices: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });

        const supabase = getSupabase(env);
        const { data, error } = await supabase
          .from("invoices")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;

        const invoices = (data || []).map((row: any) => ({
          id: row.id,
          invoiceNumber: row.invoice_number,
          issueDate: row.issue_date,
          dueDate: row.due_date,
          status: row.status,
          client: row.client_data,
          items: row.items_data,
          subtotal: parseFloat(row.subtotal) || 0,
          discountType: row.discount_type,
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
        }));

        return new Response(JSON.stringify({ success: true, invoices }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/invoices" && request.method === "POST") {
        if (!hasSupabase)
          return new Response(
            JSON.stringify({
              success: false,
              message: "Database tidak aktif.",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );

        const body: any = await request.json();
        const supabase = getSupabase(env);
        // ... (mapping sama seperti sebelumnya)
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ==========================================
      // 4. ENDPOINT SETTINGS
      // ==========================================
      if (url.pathname.startsWith("/api/settings/")) {
        if (!hasSupabase) {
          return new Response(
            JSON.stringify({ success: true, value: null, isEnvLocked: false }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        // ... (logika settings lama)
      }

      // ==========================================
      // 5. STATIC ASSETS
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

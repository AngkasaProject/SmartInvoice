/**
 * Cloudflare Workers Edge Entry Point
 * Terintegrasi dengan Supabase, mendukung ENV Lock untuk WA & Database
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface Env {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  ENVIRONMENT?: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  // ENV untuk WhatsApp
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
    throw new Error(
      "Supabase URL/Key belum diatur di Environment Variables Cloudflare.",
    );
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
      // ==========================================
      // 1. ENDPOINT DB CONFIG (DINAMIS)
      // ==========================================
      if (url.pathname === "/api/db/config" && request.method === "GET") {
        // Cek apakah variabel ENV benar-benar terisi
        const isLocked = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);

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
          JSON.stringify({
            success: true,
            config: config,
            isEnvLocked: isLocked, // <-- Dinamis
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // ==========================================
      // 2. ENDPOINT INVOICES
      // ==========================================
      if (url.pathname === "/api/invoices" && request.method === "GET") {
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
        const body = await request.json();
        const supabase = getSupabase(env);

        const row = {
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

        const { error } = await supabase
          .from("invoices")
          .upsert(row, { onConflict: "id" });
        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, message: "Invoice tersimpan" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // ==========================================
      // 3. ENDPOINT SETTINGS (Profil & WA Config)
      // ==========================================
      if (url.pathname.startsWith("/api/settings/")) {
        const key = url.pathname.replace("/api/settings/", "");

        // LOGIKA HYBRID UNTUK WA CONFIG
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
              JSON.stringify({
                success: false,
                message:
                  "Konfigurasi WhatsApp dikunci oleh Environment Variable.",
              }),
              {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        }

        // LOGIKA NORMAL UNTUK PROFIL USAHA (Business Profile)
        const supabase = getSupabase(env);

        if (request.method === "GET") {
          const { data, error } = await supabase
            .from("settings")
            .select("value")
            .eq("key", key)
            .single();
          if (error && error.code !== "PGRST116") throw error;
          return new Response(
            JSON.stringify({
              success: true,
              value: data?.value || null,
              isEnvLocked: false,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (request.method === "POST") {
          const body = await request.json();
          const { error } = await supabase
            .from("settings")
            .upsert(
              { key, value: body.value, updated_at: new Date().toISOString() },
              { onConflict: "key" },
            );
          if (error) throw error;
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // ==========================================
      // 4. ENDPOINT OPENWA SEND (Proxy)
      // ==========================================
      if (url.pathname === "/api/openwa/send" && request.method === "POST") {
        return new Response(
          JSON.stringify({
            success: false,
            message: "OpenWA send belum diimplementasikan di Worker ini.",
          }),
          {
            status: 501,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // ==========================================
      // 5. STATIC ASSETS
      // ==========================================
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

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

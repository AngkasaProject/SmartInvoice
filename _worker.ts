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

let _supabase: SupabaseClient | null = null;
function getSupabase(env: Env): SupabaseClient {
  if (_supabase) return _supabase;
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL/Key belum diatur.");
  }
  _supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  return _supabase;
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
      // 1. ENDPOINT PUBLIK (Untuk Link Print)
      // ==========================================
      if (
        url.pathname.startsWith("/api/public/invoice/") &&
        request.method === "GET"
      ) {
        const id = url.pathname.replace("/api/public/invoice/", "");

        if (!hasSupabase) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Mode anonim tidak mendukung link publik.",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const supabase = getSupabase(env);
        const { data: invRow } = await supabase
          .from("invoices")
          .select("*")
          .eq("id", id)
          .single();

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

        const { data: bizRow } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "business_profile")
          .single();

        const mappedInvoice = {
          id: invRow.id,
          invoiceNumber: invRow.invoice_number,
          issueDate: invRow.issue_date,
          dueDate: invRow.due_date,
          status: invRow.status,
          client: invRow.client_data,
          items: invRow.items_data,
          subtotal: parseFloat(invRow.subtotal) || 0,
          discountType: invRow.discount_type,
          discountValue: parseFloat(invRow.discount_value) || 0,
          discountAmount: parseFloat(invRow.discount_amount) || 0,
          taxRate: parseFloat(invRow.tax_rate) || 0,
          taxAmount: parseFloat(invRow.tax_amount) || 0,
          shippingFee: parseFloat(invRow.shipping_fee) || 0,
          total: parseFloat(invRow.total) || 0,
          notes: invRow.notes,
          terms: invRow.terms,
          paymentInstructions: invRow.payment_instructions,
          paymentMethod: invRow.payment_method,
          paymentAccountNumber: invRow.payment_account_number,
          downPayment: parseFloat(invRow.down_payment) || 0,
          remainingBalance: parseFloat(invRow.remaining_balance) || 0,
          paidAt: invRow.paid_at,
          paidMethod: invRow.paid_method,
          whatsappStatus: invRow.whatsapp_status,
          whatsappSentAt: invRow.whatsapp_sent_at,
          whatsappRecipient: invRow.whatsapp_recipient,
          whatsappLastLog: invRow.whatsapp_last_log,
          createdAt: invRow.created_at,
          updatedAt: invRow.updated_at,
        };

        return new Response(
          JSON.stringify({
            success: true,
            invoice: mappedInvoice,
            business: bizRow?.value,
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
        if (!hasSupabase) {
          return new Response(
            JSON.stringify({
              success: true,
              hasAdmin: false,
              isAnonymous: true,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        try {
          const supabase = getSupabase(env);
          const { count } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true });
          const hasAdmin = (count || 0) > 0;
          return new Response(
            JSON.stringify({ success: true, hasAdmin, isAnonymous: false }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({
              success: true,
              hasAdmin: false,
              isAnonymous: true,
              error: err.message,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      if (
        (url.pathname === "/api/auth/setup" ||
          url.pathname === "/api/auth/login") &&
        !hasSupabase
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
      // 3. ENDPOINT DB CONFIG
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
      // 4. ENDPOINT INVOICES
      // ==========================================
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

        if (!hasSupabase) {
          return new Response(
            JSON.stringify({ success: true, value: null, isEnvLocked: false }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

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
          const body: any = await request.json();
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

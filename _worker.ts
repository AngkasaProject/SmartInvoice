/**
 * Cloudflare Workers Edge Entry Point
 * Terintegrasi dengan Supabase
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface Env {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  ENVIRONMENT?: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

// Singleton Supabase Client untuk Worker
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

    // ==========================================
    // ENDPOINT INVOICES
    // ==========================================
    if (url.pathname === "/api/invoices" && request.method === "GET") {
      try {
        const supabase = getSupabase(env);
        const { data, error } = await supabase
          .from("invoices")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        // Mapping dari snake_case ke camelCase (sesuai db.ts)
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
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, message: err.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    if (url.pathname === "/api/invoices" && request.method === "POST") {
      try {
        const body = await request.json();
        const supabase = getSupabase(env);

        // Mapping camelCase ke snake_case
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
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, message: err.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // ==========================================
    // ENDPOINT SETTINGS (Profil, Config, dll)
    // ==========================================
    if (url.pathname.startsWith("/api/settings/")) {
      const key = url.pathname.replace("/api/settings/", "");
      const supabase = getSupabase(env);

      if (request.method === "GET") {
        try {
          const { data, error } = await supabase
            .from("settings")
            .select("value")
            .eq("key", key)
            .single();
          if (error && error.code !== "PGRST116") throw error;
          return new Response(
            JSON.stringify({ success: true, value: data?.value || null }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ success: false, message: err.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      if (request.method === "POST") {
        try {
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
        } catch (err: any) {
          return new Response(
            JSON.stringify({ success: false, message: err.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    // ==========================================
    // ENDPOINT OPENWA (Seperti sebelumnya)
    // ==========================================
    if (url.pathname === "/api/openwa/send" && request.method === "POST") {
      // ... (Logika lama Anda tetap di sini) ...
    }

    // ==========================================
    // STATIC ASSETS
    // ==========================================
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("SmartInvoice Edge Ready", { status: 200 });
  },
};
